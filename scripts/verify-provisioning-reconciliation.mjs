import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import {
  assertLinkedSupabaseProject,
  loadLocalEnv,
  loadSupabaseDevConfig,
} from "./lib/supabase-dev-env.mjs";

const { Client } = pg;
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");

loadLocalEnv();
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!secretKey)
  throw new Error("SUPABASE_SECRET_KEY es requerida para la suite de reconciliación.");

const admin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const invalidAdmin = createClient(dev.url, "invalid-task005-secret", {
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

async function connect(role) {
  const client = new Client({
    ...temporaryDatabaseConfig(),
    application_name: `task005-remediation-${role}`,
  });
  await client.connect();
  await client.query("set role postgres");
  return client;
}

async function asUser(client, userId, action) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = await action(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function beginAsUser(client, userId) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
}

function assertEqual(actual, expected, description) {
  if (actual !== expected) {
    throw new Error(`${description}: expected ${expected}, received ${actual}.`);
  }
}

async function expectSqlState(action, code, description) {
  try {
    await action();
  } catch (error) {
    if (error?.code === code) return;
    throw new Error(`${description} returned SQLSTATE ${error?.code ?? "unknown"}.`, {
      cause: error,
    });
  }
  throw new Error(`${description} unexpectedly succeeded.`);
}

async function serviceRpc(name, args) {
  const { data, error } = await admin.rpc(name, args).single();
  if (error) throw error;
  return data;
}

async function prepareAndBind(options) {
  let prepared;
  if (options.operationType === "BOOTSTRAP_PLATFORM_ADMIN") {
    prepared = await serviceRpc("prepare_platform_admin_bootstrap_operation", {
      p_email: options.email,
      p_first_name: options.firstName,
      p_last_name: options.lastName,
      p_operation_id: options.operationId,
    });
  } else if (options.operationType === "PLATFORM_CREATE_CENTER") {
    prepared = await serviceRpc("prepare_platform_center_provisioning_operation", {
      p_actor_user_id: options.actorUserId,
      p_admin_email: options.email,
      p_admin_first_name: options.firstName,
      p_admin_last_name: options.lastName,
      p_center_address: options.centerAddress,
      p_center_email: options.centerEmail,
      p_center_name: options.centerName,
      p_center_phone: options.centerPhone,
      p_center_timezone: options.centerTimezone,
      p_operation_id: options.operationId,
    });
  } else {
    prepared = await serviceRpc("prepare_tenant_user_provisioning_operation", {
      p_actor_user_id: options.actorUserId,
      p_center_id: options.scopeCenterId,
      p_first_name: options.firstName,
      p_last_name: options.lastName,
      p_operation_id: options.operationId,
      p_professional_center_id: options.professionalCenterId,
      p_role: options.role,
      p_user_email: options.email,
    });
  }
  const payloadHash = prepared.payload_hash;
  const bound = await serviceRpc("bind_auth_provisioning_operation", {
    p_auth_user_id: options.authUserId,
    p_auth_user_was_created: options.authUserWasCreated,
    p_operation_id: options.operationId,
    p_payload_hash: payloadHash,
  });
  return { ...bound, payload_hash: payloadHash };
}

async function reconcile(operationId, payloadHash) {
  return serviceRpc("reconcile_auth_provisioning_operation", {
    p_operation_id: operationId,
    p_payload_hash: payloadHash,
  });
}

async function markCompensation(operationId, payloadHash, authUserId, compensated) {
  return serviceRpc("mark_auth_provisioning_compensation", {
    p_auth_user_id: authUserId,
    p_compensated: compensated,
    p_operation_id: operationId,
    p_payload_hash: payloadHash,
  });
}

const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const password = randomBytes(24).toString("base64url");
const authUsers = new Map();
const operationIds = [];
const centerIds = [];
let control;
let transactionA;
let transactionB;

async function createAuth(name) {
  const email = `task005-remediation-${runId}-${name}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear el fixture Auth ${name}.`);
  const fixture = { id: data.user.id, email };
  authUsers.set(name, fixture);
  return fixture;
}

async function cleanup() {
  if (control) {
    const discovered = await control.query(
      `select distinct result_center_id as id
       from private.provisioning_operations
       where id = any($1::uuid[]) and result_center_id is not null`,
      [operationIds],
    );
    const cleanupCenters = [...new Set([...centerIds, ...discovered.rows.map(({ id }) => id)])];
    await control.query("begin");
    try {
      if (cleanupCenters.length > 0) {
        await control.query(
          "delete from public.center_memberships where center_id=any($1::uuid[])",
          [cleanupCenters],
        );
        await control.query("delete from public.centers where id=any($1::uuid[])", [
          cleanupCenters,
        ]);
      }
      const userIds = [...authUsers.values()].map(({ id }) => id);
      await control.query("delete from public.platform_admins where user_id=any($1::uuid[])", [
        userIds,
      ]);
      await control.query("delete from public.users where id=any($1::uuid[])", [userIds]);
      await control.query("delete from private.provisioning_operations where id=any($1::uuid[])", [
        operationIds,
      ]);
      await control.query("commit");
    } catch (error) {
      await control.query("rollback");
      throw error;
    }
  }

  const authCleanupErrors = [];
  for (const { id } of [...authUsers.values()].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && error.status !== 404) authCleanupErrors.push(error);
  }
  if (authCleanupErrors.length > 0) {
    throw new AggregateError(authCleanupErrors, "Auth remediation fixture cleanup failed.");
  }
}

async function assertCleanup() {
  const result = await control.query(
    `select
       (select count(*)::int from auth.users where email like 'task005-remediation-%@example.test') auth_users,
       (select count(*)::int from public.users where email like 'task005-remediation-%@example.test') public_users,
       (select count(*)::int from public.centers where name like 'TASK-005 Remediation%') centers,
       (select count(*)::int from private.provisioning_operations
          where id=any($1::uuid[])) operations,
       (select count(*)::int from public.platform_admins
          where user_id=any($2::uuid[])) platform_admins`,
    [operationIds, [...authUsers.values()].map(({ id }) => id)],
  );
  for (const [kind, count] of Object.entries(result.rows[0])) {
    assertEqual(count, 0, `${kind} cleanup`);
  }
}

try {
  control = await connect("control");
  const platform = await createAuth("platform");

  const bootstrapOperation = randomUUID();
  operationIds.push(bootstrapOperation);
  const { payload_hash: bootstrapHash } = await prepareAndBind({
    operationId: bootstrapOperation,
    operationType: "BOOTSTRAP_PLATFORM_ADMIN",
    email: platform.email,
    firstName: "Platform",
    lastName: "Remediation",
    authUserId: platform.id,
    authUserWasCreated: true,
  });
  await expectSqlState(
    () =>
      control.query("select * from public.bootstrap_platform_admin($1,$2,$3,$4)", [
        bootstrapOperation,
        platform.id,
        "Changed",
        "Remediation",
      ]),
    "23514",
    "bootstrap changed arguments",
  );
  await control.query("begin");
  await control.query("select * from public.bootstrap_platform_admin($1,$2,$3,$4)", [
    bootstrapOperation,
    platform.id,
    "Platform",
    "Remediation",
  ]);
  await control.query("commit");
  const bootstrapAfterLostResponse = await reconcile(bootstrapOperation, bootstrapHash);
  assertEqual(
    bootstrapAfterLostResponse.operation_status,
    "SUCCEEDED",
    "bootstrap commit reconciliation",
  );
  const bootstrapRetry = await control.query(
    "select * from public.bootstrap_platform_admin($1,$2,$3,$4)",
    [bootstrapOperation, platform.id, "Platform", "Remediation"],
  );
  assertEqual(bootstrapRetry.rows[0].user_id, platform.id, "bootstrap idempotent retry");

  const firstAdmin = await createAuth("first-admin");
  const rollbackUser = await createAuth("rollback");
  const orphanUser = await createAuth("orphan");
  const existingUser = await createAuth("existing");
  const tenantUser = await createAuth("tenant");

  const centerOperation = randomUUID();
  operationIds.push(centerOperation);
  const centerIntent = {
    centerName: `TASK-005 Remediation ${runId}`,
    centerPhone: "100",
    centerEmail: "remediation-center@example.test",
    centerAddress: "Remediation address",
    centerTimezone: "America/Argentina/Buenos_Aires",
    email: firstAdmin.email,
    firstName: "First",
    lastName: "Admin",
  };
  const { payload_hash: centerHash } = await prepareAndBind({
    operationId: centerOperation,
    operationType: "PLATFORM_CREATE_CENTER",
    actorUserId: platform.id,
    scopeCenterId: null,
    ...centerIntent,
    authUserId: firstAdmin.id,
    authUserWasCreated: true,
  });

  const centerArgs = [
    centerOperation,
    centerIntent.centerName,
    centerIntent.centerPhone,
    centerIntent.centerEmail,
    centerIntent.centerAddress,
    centerIntent.centerTimezone,
    firstAdmin.id,
    centerIntent.firstName,
    centerIntent.lastName,
  ];
  const centerSql =
    "select * from public.platform_create_center_with_admin($1,$2,$3,$4,$5,$6,$7,$8,$9)";

  const changedCenterArguments = [
    centerArgs.with(1, `${centerIntent.centerName} changed`),
    centerArgs.with(2, "999"),
    centerArgs.with(3, "changed-center@example.test"),
    centerArgs.with(4, "Changed address"),
    centerArgs.with(7, "Changed"),
    centerArgs.with(8, "Person"),
  ];
  for (const [index, changedArgs] of changedCenterArguments.entries()) {
    await expectSqlState(
      () => asUser(control, platform.id, (client) => client.query(centerSql, changedArgs)),
      "23514",
      `center changed argument ${index + 1}`,
    );
  }
  const noPrematureCenterEffect = await control.query(
    "select count(*)::int count from public.centers where name like 'TASK-005 Remediation%'",
  );
  assertEqual(noPrematureCenterEffect.rows[0].count, 0, "changed center arguments no effect");
  transactionA = await connect("same-operation-a");
  transactionB = await connect("same-operation-b");
  await beginAsUser(transactionA, platform.id);
  const firstCenterCall = await transactionA.query(centerSql, centerArgs);
  await beginAsUser(transactionB, platform.id);
  const secondCenterCallPromise = transactionB.query(centerSql, centerArgs);
  void secondCenterCallPromise.catch(() => {});
  let secondCenterCallSettled = false;
  void secondCenterCallPromise.then(
    () => {
      secondCenterCallSettled = true;
    },
    () => {
      secondCenterCallSettled = true;
    },
  );

  let observedOperationWait = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = await control.query(
      `select 1 from pg_catalog.pg_stat_activity
       where application_name like '%same-operation-b'
         and wait_event_type='Lock'`,
    );
    if (waiting.rowCount === 1) {
      observedOperationWait = true;
      break;
    }
    if (secondCenterCallSettled) break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  if (!observedOperationWait && secondCenterCallSettled) {
    throw new Error("The concurrent same-operation call did not serialize.");
  }

  await transactionA.query("commit");
  const secondCenterCall = await secondCenterCallPromise;
  await transactionB.query("commit");
  await transactionA.end();
  await transactionB.end();
  transactionA = undefined;
  transactionB = undefined;

  const centerId = firstCenterCall.rows[0].center_id;
  const membershipId = firstCenterCall.rows[0].membership_id;
  centerIds.push(centerId);
  assertEqual(secondCenterCall.rows[0].center_id, centerId, "concurrent center idempotency");
  assertEqual(
    secondCenterCall.rows[0].membership_id,
    membershipId,
    "concurrent membership idempotency",
  );
  const centerEffect = await control.query(
    `select
       (select count(*)::int from public.centers where id=$1) centers,
       (select count(*)::int from public.center_memberships where center_id=$1) memberships`,
    [centerId],
  );
  assertEqual(centerEffect.rows[0].centers, 1, "single Center effect");
  assertEqual(centerEffect.rows[0].memberships, 1, "single first ADMIN effect");

  const lostResponseReconciliation = await reconcile(centerOperation, centerHash);
  assertEqual(
    lostResponseReconciliation.operation_status,
    "SUCCEEDED",
    "center response-loss reconciliation",
  );
  const centerRetry = await asUser(control, platform.id, (client) =>
    client.query(centerSql, centerArgs),
  );
  assertEqual(centerRetry.rows[0].center_id, centerId, "center retry result");
  await expectSqlState(
    () =>
      serviceRpc("prepare_platform_center_provisioning_operation", {
        p_actor_user_id: platform.id,
        p_admin_email: firstAdmin.email,
        p_admin_first_name: centerIntent.firstName,
        p_admin_last_name: centerIntent.lastName,
        p_center_address: centerIntent.centerAddress,
        p_center_email: centerIntent.centerEmail,
        p_center_name: `${centerIntent.centerName} incompatible`,
        p_center_phone: centerIntent.centerPhone,
        p_center_timezone: centerIntent.centerTimezone,
        p_operation_id: centerOperation,
      }),
    "23514",
    "operation id payload reuse",
  );

  const rollbackOperation = randomUUID();
  operationIds.push(rollbackOperation);
  const { payload_hash: rollbackHash } = await prepareAndBind({
    operationId: rollbackOperation,
    operationType: "TENANT_PROVISION_USER",
    actorUserId: firstAdmin.id,
    scopeCenterId: centerId,
    email: rollbackUser.email,
    firstName: "Rollback",
    lastName: "User",
    role: "PROFESSIONAL",
    professionalCenterId: null,
    authUserId: rollbackUser.id,
    authUserWasCreated: true,
  });
  await expectSqlState(
    () =>
      asUser(control, firstAdmin.id, (client) =>
        client.query("select * from public.admin_provision_center_user($1,$2,$3,$4,$5,$6,$7)", [
          rollbackOperation,
          centerId,
          rollbackUser.id,
          "Rollback",
          "User",
          "PROFESSIONAL",
          null,
        ]),
      ),
    "23514",
    "rollback provisioning",
  );
  const rolledBack = await reconcile(rollbackOperation, rollbackHash);
  assertEqual(rolledBack.operation_status, "AUTH_READY", "confirmed DB rollback state");
  const { error: rollbackDeleteError } = await admin.auth.admin.deleteUser(rollbackUser.id);
  if (rollbackDeleteError) throw rollbackDeleteError;
  await markCompensation(rollbackOperation, rollbackHash, rollbackUser.id, true);
  const compensated = await reconcile(rollbackOperation, rollbackHash);
  assertEqual(compensated.operation_status, "COMPENSATED", "successful Auth compensation");

  const orphanOperation = randomUUID();
  operationIds.push(orphanOperation);
  const { payload_hash: orphanHash } = await prepareAndBind({
    operationId: orphanOperation,
    operationType: "TENANT_PROVISION_USER",
    actorUserId: firstAdmin.id,
    scopeCenterId: centerId,
    email: orphanUser.email,
    firstName: "Orphan",
    lastName: "User",
    role: "PROFESSIONAL",
    professionalCenterId: null,
    authUserId: orphanUser.id,
    authUserWasCreated: true,
  });
  await expectSqlState(
    () =>
      asUser(control, firstAdmin.id, (client) =>
        client.query("select * from public.admin_provision_center_user($1,$2,$3,$4,$5,$6,$7)", [
          orphanOperation,
          centerId,
          orphanUser.id,
          "Orphan",
          "User",
          "PROFESSIONAL",
          null,
        ]),
      ),
    "23514",
    "orphan rollback provisioning",
  );
  const { error: simulatedDeleteError } = await invalidAdmin.auth.admin.deleteUser(orphanUser.id);
  if (!simulatedDeleteError)
    throw new Error("The controlled Auth delete failure was not observed.");
  await markCompensation(orphanOperation, orphanHash, orphanUser.id, false);
  const orphanState = await reconcile(orphanOperation, orphanHash);
  assertEqual(orphanState.operation_status, "COMPENSATION_REQUIRED", "failed compensation state");
  const orphanAccess = await asUser(control, orphanUser.id, (client) =>
    client.query("select count(*)::int count from public.centers"),
  );
  assertEqual(orphanAccess.rows[0].count, 0, "orphan fail-closed access");

  const existingOperation = randomUUID();
  operationIds.push(existingOperation);
  await prepareAndBind({
    operationId: existingOperation,
    operationType: "TENANT_PROVISION_USER",
    actorUserId: firstAdmin.id,
    scopeCenterId: centerId,
    email: existingUser.email,
    firstName: "Existing",
    lastName: "User",
    role: "PROFESSIONAL",
    professionalCenterId: null,
    authUserId: existingUser.id,
    authUserWasCreated: false,
  });
  await expectSqlState(
    () =>
      asUser(control, firstAdmin.id, (client) =>
        client.query("select * from public.admin_provision_center_user($1,$2,$3,$4,$5,$6,$7)", [
          existingOperation,
          centerId,
          existingUser.id,
          "Existing",
          "User",
          "PROFESSIONAL",
          null,
        ]),
      ),
    "23514",
    "existing identity DB failure",
  );
  const { data: existingStillPresent, error: existingLookupError } =
    await admin.auth.admin.getUserById(existingUser.id);
  if (existingLookupError || existingStillPresent.user.id !== existingUser.id) {
    throw new Error("A pre-existing Auth identity was removed after DB failure.");
  }

  const tenantOperation = randomUUID();
  operationIds.push(tenantOperation);
  await prepareAndBind({
    operationId: tenantOperation,
    operationType: "TENANT_PROVISION_USER",
    actorUserId: firstAdmin.id,
    scopeCenterId: centerId,
    email: tenantUser.email,
    firstName: "Tenant",
    lastName: "User",
    role: "RECEPTION",
    professionalCenterId: null,
    authUserId: tenantUser.id,
    authUserWasCreated: true,
  });
  const tenantArgs = [
    tenantOperation,
    centerId,
    tenantUser.id,
    "Tenant",
    "User",
    "RECEPTION",
    null,
  ];
  const tenantSql = "select * from public.admin_provision_center_user($1,$2,$3,$4,$5,$6,$7)";
  await expectSqlState(
    () =>
      asUser(control, firstAdmin.id, (client) =>
        client.query(tenantSql, tenantArgs.with(5, "ADMIN")),
      ),
    "23514",
    "tenant changed role",
  );
  await expectSqlState(
    () =>
      asUser(control, firstAdmin.id, (client) =>
        client.query(tenantSql, tenantArgs.with(6, randomUUID())),
      ),
    "23514",
    "tenant changed ProfessionalCenter",
  );
  await expectSqlState(
    () =>
      serviceRpc("prepare_tenant_user_provisioning_operation", {
        p_actor_user_id: firstAdmin.id,
        p_center_id: randomUUID(),
        p_first_name: "Tenant",
        p_last_name: "User",
        p_operation_id: tenantOperation,
        p_professional_center_id: null,
        p_role: "RECEPTION",
        p_user_email: tenantUser.email,
      }),
    "23514",
    "tenant changed scope",
  );
  await expectSqlState(
    () =>
      serviceRpc("prepare_tenant_user_provisioning_operation", {
        p_actor_user_id: firstAdmin.id,
        p_center_id: centerId,
        p_first_name: "Tenant",
        p_last_name: "User",
        p_operation_id: tenantOperation,
        p_professional_center_id: null,
        p_role: "RECEPTION",
        p_user_email: `changed-${tenantUser.email}`,
      }),
    "23514",
    "tenant changed email",
  );
  const tenantResult = await asUser(control, firstAdmin.id, (client) =>
    client.query(tenantSql, tenantArgs),
  );
  const tenantRetry = await asUser(control, firstAdmin.id, (client) =>
    client.query(tenantSql, tenantArgs),
  );
  assertEqual(
    tenantRetry.rows[0].membership_id,
    tenantResult.rows[0].membership_id,
    "tenant idempotent retry",
  );
  const tenantMembershipCount = await control.query(
    "select count(*)::int count from public.center_memberships where center_id=$1 and user_id=$2",
    [centerId, tenantUser.id],
  );
  assertEqual(tenantMembershipCount.rows[0].count, 1, "single tenant membership effect");

  console.log(
    "Provisioning reconciliation DEV verification passed: response-loss, retry, concurrency, compensation and existing identity.",
  );
} finally {
  for (const client of [transactionA, transactionB]) {
    if (client) {
      await client.query("rollback").catch(() => {});
      await client.end().catch(() => {});
    }
  }

  const cleanupErrors = [];
  try {
    await cleanup();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await assertCleanup();
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (control) await control.end().catch((error) => cleanupErrors.push(error));
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "TASK-005 remediation fixture cleanup failed.");
  }
  console.log("Provisioning remediation cleanup verified: zero Auth, DB and operation residues.");
}
