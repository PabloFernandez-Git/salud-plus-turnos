import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { expect, test } from "vitest";

import {
  assertLinkedSupabaseProject,
  loadLocalEnv,
  loadSupabaseDevConfig,
} from "./lib/supabase-dev-env.mjs";
import { ProvisioningFailure } from "../src/modules/access/domain/auth-compensation";
import { provisioningTestOnly } from "../src/modules/access/server/provisioning";

const { Client } = pg;
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");

loadLocalEnv();
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!secretKey) {
  throw new Error("SUPABASE_SECRET_KEY es requerida para la suite integrada de provisioning.");
}

const admin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function temporaryDatabaseConfig() {
  const stdout = execFileSync(
    process.execPath,
    [supabaseCli, "db", "dump", "--linked", "--dry-run", "--schema", "public"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "true",
        DO_NOT_TRACK: "1",
        SUPABASE_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const variables = Object.fromEntries(
    [...stdout.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
  );
  const poolerUrl = new URL(readFileSync(poolerUrlFile, "utf8").trim());
  const approvedHost =
    variables.PGHOST === `db.${dev.projectRef}.supabase.co` ||
    (variables.PGHOST === poolerUrl.hostname && variables.PGUSER?.endsWith(`.${dev.projectRef}`));
  if (!approvedHost) throw new Error("La conexión temporal no apunta al proyecto DEV aprobado.");

  return {
    host: variables.PGHOST,
    port: Number(variables.PGPORT),
    database: variables.PGDATABASE,
    user: variables.PGUSER,
    password: variables.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  };
}

async function serviceRpc(name, args) {
  const { data, error } = await admin.rpc(name, args).single();
  if (error) throw error;
  return data;
}

async function createAuth(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear el fixture Auth ${email}.`);
  return data.user;
}

async function authenticatedClient(email, password) {
  const client = createClient(dev.url, dev.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function expectProvisioningFailure(action, code) {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(ProvisioningFailure);
    expect(error).toMatchObject({ code });
    return error;
  }
  throw new Error(`Se esperaba ProvisioningFailure(${code}).`);
}

test("la orquestación real reconcilia response-loss, rollback y compensación", async () => {
  const runId = randomUUID().replaceAll("-", "").slice(0, 16);
  const prefix = `task005-orchestration-${runId}`;
  const password = randomBytes(24).toString("base64url");
  const operationIds = [];
  let control;
  let platformClient;
  let centerAdminClient;

  const email = (name) => `${prefix}-${name}@example.test`;

  try {
    control = new Client({
      ...temporaryDatabaseConfig(),
      application_name: "task005-orchestration-integration",
    });
    await control.connect();
    await control.query("set role postgres");

    const platform = await createAuth(email("platform"), password);
    const bootstrapOperation = randomUUID();
    operationIds.push(bootstrapOperation);
    const preparedBootstrap = await serviceRpc("prepare_platform_admin_bootstrap_operation", {
      p_email: platform.email,
      p_first_name: "Platform",
      p_last_name: "Orchestration",
      p_operation_id: bootstrapOperation,
    });
    await serviceRpc("bind_auth_provisioning_operation", {
      p_auth_user_id: platform.id,
      p_auth_user_was_created: true,
      p_operation_id: bootstrapOperation,
      p_payload_hash: preparedBootstrap.payload_hash,
    });
    await serviceRpc("bootstrap_platform_admin", {
      p_auth_user_id: platform.id,
      p_first_name: "Platform",
      p_last_name: "Orchestration",
      p_operation_id: bootstrapOperation,
    });
    platformClient = await authenticatedClient(platform.email, password);

    const centerOperation = randomUUID();
    operationIds.push(centerOperation);
    const centerInput = {
      operationId: centerOperation,
      center: {
        name: `TASK-005 Orchestration ${runId}`,
        phone: "100",
        email: email("center"),
        address: "Orchestration address",
        timezone: "America/Argentina/Buenos_Aires",
      },
      admin: {
        email: email("first-admin"),
        firstName: "First",
        lastName: "Admin",
        initialPassword: password,
      },
    };
    let centerResponseLossInjected = 0;
    const centerResult = await provisioningTestOnly.createCenterWithFirstAdmin(
      centerInput,
      platformClient,
      {
        adminClient: admin,
        afterPersistCommit(operationType, operationId) {
          expect(operationType).toBe("PLATFORM_CREATE_CENTER");
          expect(operationId).toBe(centerOperation);
          centerResponseLossInjected += 1;
          throw new Error("controlled response loss after center commit");
        },
      },
    );
    expect(centerResponseLossInjected).toBe(1);

    const centerRetry = await provisioningTestOnly.createCenterWithFirstAdmin(
      centerInput,
      platformClient,
      { adminClient: admin },
    );
    expect(centerRetry).toEqual(centerResult);
    const centerEffect = await control.query(
      `select
         (select count(*)::int from public.centers where id=$1) centers,
         (select count(*)::int from public.center_memberships where center_id=$1) memberships,
         (select status from private.provisioning_operations where id=$2) status`,
      [centerResult.center_id, centerOperation],
    );
    expect(centerEffect.rows[0]).toEqual({ centers: 1, memberships: 1, status: "SUCCEEDED" });

    centerAdminClient = await authenticatedClient(centerInput.admin.email, password);
    const tenantOperation = randomUUID();
    operationIds.push(tenantOperation);
    const tenantInput = {
      operationId: tenantOperation,
      centerId: centerResult.center_id,
      identity: {
        email: email("tenant-user"),
        firstName: "Tenant",
        lastName: "User",
        initialPassword: password,
      },
      role: "RECEPTION",
      professionalCenterId: null,
    };
    let tenantResponseLossInjected = 0;
    const tenantResult = await provisioningTestOnly.provisionCenterUser(
      tenantInput,
      centerAdminClient,
      {
        adminClient: admin,
        afterPersistCommit(operationType, operationId) {
          expect(operationType).toBe("TENANT_PROVISION_USER");
          expect(operationId).toBe(tenantOperation);
          tenantResponseLossInjected += 1;
          throw new Error("controlled response loss after tenant commit");
        },
      },
    );
    expect(tenantResponseLossInjected).toBe(1);
    const tenantRetry = await provisioningTestOnly.provisionCenterUser(
      tenantInput,
      centerAdminClient,
      { adminClient: admin },
    );
    expect(tenantRetry).toEqual(tenantResult);
    const tenantEffect = await control.query(
      `select count(*)::int count
       from public.center_memberships
       where center_id=$1 and user_id=$2`,
      [centerResult.center_id, tenantResult.user_id],
    );
    expect(tenantEffect.rows[0].count).toBe(1);

    const rollbackOperation = randomUUID();
    operationIds.push(rollbackOperation);
    const rollbackEmail = email("rollback");
    await expectProvisioningFailure(
      () =>
        provisioningTestOnly.createCenterWithFirstAdmin(
          {
            ...centerInput,
            operationId: rollbackOperation,
            center: {
              ...centerInput.center,
              name: `TASK-005 Orchestration rollback ${runId}`,
              timezone: "Invalid/Controlled_Timezone",
            },
            admin: { ...centerInput.admin, email: rollbackEmail },
          },
          platformClient,
          { adminClient: admin },
        ),
      "DATABASE_PROVISIONING_FAILED",
    );
    const rollbackState = await control.query(
      `select
         (select count(*)::int from auth.users where email=$1) auth_users,
         (select count(*)::int from public.users where email=$1) public_users,
         (select status from private.provisioning_operations where id=$2) status`,
      [rollbackEmail, rollbackOperation],
    );
    expect(rollbackState.rows[0]).toEqual({
      auth_users: 0,
      public_users: 0,
      status: "COMPENSATED",
    });

    const uncertainOperation = randomUUID();
    operationIds.push(uncertainOperation);
    const uncertainEmail = email("uncertain");
    let uncertainDeleteCalls = 0;
    await expectProvisioningFailure(
      () =>
        provisioningTestOnly.createCenterWithFirstAdmin(
          {
            ...centerInput,
            operationId: uncertainOperation,
            center: {
              ...centerInput.center,
              name: `TASK-005 Orchestration uncertain ${runId}`,
              timezone: "Invalid/Controlled_Timezone",
            },
            admin: { ...centerInput.admin, email: uncertainEmail },
          },
          platformClient,
          {
            adminClient: admin,
            beforeReconcile() {
              throw new Error("controlled reconciliation outage");
            },
            deleteCreatedAuthUser() {
              uncertainDeleteCalls += 1;
              return Promise.resolve();
            },
          },
        ),
      "PROVISIONING_RECONCILIATION_REQUIRED",
    );
    expect(uncertainDeleteCalls).toBe(0);
    const uncertainState = await control.query(
      `select
         (select count(*)::int from auth.users where email=$1) auth_users,
         (select count(*)::int from public.users where email=$1) public_users,
         (select status from private.provisioning_operations where id=$2) status`,
      [uncertainEmail, uncertainOperation],
    );
    expect(uncertainState.rows[0]).toEqual({
      auth_users: 1,
      public_users: 0,
      status: "AUTH_READY",
    });

    const compensationOperation = randomUUID();
    operationIds.push(compensationOperation);
    const compensationEmail = email("compensation-required");
    let deleteFailureCalls = 0;
    await expectProvisioningFailure(
      () =>
        provisioningTestOnly.createCenterWithFirstAdmin(
          {
            ...centerInput,
            operationId: compensationOperation,
            center: {
              ...centerInput.center,
              name: `TASK-005 Orchestration compensation ${runId}`,
              timezone: "Invalid/Controlled_Timezone",
            },
            admin: { ...centerInput.admin, email: compensationEmail },
          },
          platformClient,
          {
            adminClient: admin,
            deleteCreatedAuthUser() {
              deleteFailureCalls += 1;
              throw new Error("controlled Auth delete failure");
            },
          },
        ),
      "COMPENSATION_REQUIRED",
    );
    expect(deleteFailureCalls).toBe(1);
    const compensationState = await control.query(
      `select
         (select count(*)::int from auth.users where email=$1) auth_users,
         (select count(*)::int from public.users where email=$1) public_users,
         (select status from private.provisioning_operations where id=$2) status`,
      [compensationEmail, compensationOperation],
    );
    expect(compensationState.rows[0]).toEqual({
      auth_users: 1,
      public_users: 0,
      status: "COMPENSATION_REQUIRED",
    });

    const existingEmail = email("existing");
    const existing = await createAuth(existingEmail, password);
    await control.query(
      "insert into public.users (id,first_name,last_name,email) values ($1,$2,$3,$4)",
      [existing.id, "Existing", "Identity", existingEmail],
    );
    const existingOperation = randomUUID();
    operationIds.push(existingOperation);
    await expectProvisioningFailure(
      () =>
        provisioningTestOnly.createCenterWithFirstAdmin(
          {
            ...centerInput,
            operationId: existingOperation,
            center: {
              ...centerInput.center,
              name: `TASK-005 Orchestration existing ${runId}`,
              timezone: "Invalid/Controlled_Timezone",
            },
            admin: {
              email: existingEmail,
              firstName: "Changed",
              lastName: "Names",
            },
          },
          platformClient,
          { adminClient: admin },
        ),
      "DATABASE_PROVISIONING_FAILED",
    );
    const existingState = await control.query(
      `select
         (select count(*)::int from auth.users where id=$1) auth_users,
         first_name,
         last_name
       from public.users
       where id=$1`,
      [existing.id],
    );
    expect(existingState.rows[0]).toEqual({
      auth_users: 1,
      first_name: "Existing",
      last_name: "Identity",
    });
  } finally {
    await platformClient?.auth.signOut().catch(() => {});
    await centerAdminClient?.auth.signOut().catch(() => {});

    const cleanupErrors = [];
    if (control) {
      try {
        const fixtureAuth = await control.query(
          "select id from auth.users where email like $1 order by created_at desc",
          [`${prefix}-%@example.test`],
        );
        const fixtureUserIds = fixtureAuth.rows.map(({ id }) => id);
        const fixtureCenters = await control.query(
          "select id from public.centers where name like $1",
          [`TASK-005 Orchestration%${runId}%`],
        );
        const fixtureCenterIds = fixtureCenters.rows.map(({ id }) => id);

        await control.query("begin");
        if (fixtureCenterIds.length > 0) {
          await control.query(
            "delete from public.center_memberships where center_id=any($1::uuid[])",
            [fixtureCenterIds],
          );
          await control.query("delete from public.centers where id=any($1::uuid[])", [
            fixtureCenterIds,
          ]);
        }
        if (fixtureUserIds.length > 0) {
          await control.query("delete from public.platform_admins where user_id=any($1::uuid[])", [
            fixtureUserIds,
          ]);
          await control.query("delete from public.users where id=any($1::uuid[])", [
            fixtureUserIds,
          ]);
        }
        if (operationIds.length > 0) {
          await control.query(
            "delete from private.provisioning_operations where id=any($1::uuid[])",
            [operationIds],
          );
        }
        await control.query("commit");

        for (const { id } of fixtureAuth.rows) {
          const { error } = await admin.auth.admin.deleteUser(id);
          if (error && error.status !== 404) cleanupErrors.push(error);
        }

        const residue = await control.query(
          `select
             (select count(*)::int from auth.users where email like $1) auth_users,
             (select count(*)::int from public.users where email like $1) public_users,
             (select count(*)::int from public.centers where name like $3) centers,
             (select count(*)::int from private.provisioning_operations
               where id=any($2::uuid[])) operations`,
          [`${prefix}-%@example.test`, operationIds, `TASK-005 Orchestration%${runId}%`],
        );
        expect(residue.rows[0]).toEqual({
          auth_users: 0,
          public_users: 0,
          centers: 0,
          operations: 0,
        });
      } catch (error) {
        await control.query("rollback").catch(() => {});
        cleanupErrors.push(error);
      }
      await control.end().catch((error) => cleanupErrors.push(error));
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Provisioning orchestration cleanup failed.");
    }
  }
});
