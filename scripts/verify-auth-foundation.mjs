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
if (!secretKey) {
  throw new Error("SUPABASE_SECRET_KEY es requerida para fixtures Auth temporales de DEV.");
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

async function connect(role) {
  const client = new Client({ ...temporaryDatabaseConfig(), application_name: `task005-${role}` });
  await client.connect();
  await client.query("set role postgres");
  return client;
}

async function asUser(client, userId, action) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await action(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function expectSqlState(action, expectedCode, description) {
  try {
    await action();
  } catch (error) {
    if (error?.code === expectedCode) return;
    throw new Error(`${description} returned SQLSTATE ${error?.code ?? "unknown"}.`, {
      cause: error,
    });
  }
  throw new Error(`${description} unexpectedly succeeded.`);
}

function assertEqual(actual, expected, description) {
  if (actual !== expected) {
    throw new Error(`${description}: expected ${expected}, received ${actual}.`);
  }
}

async function observePendingAdvisoryLock(controlClient, blockedPid, description) {
  if (!Number.isInteger(blockedPid)) {
    throw new Error(`${description}: the blocked connection PID is unavailable.`);
  }

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = await controlClient.query(
      `select exists (
         select 1
         from pg_catalog.pg_locks
         where pid=$1
           and locktype='advisory'
           and not granted
       ) as is_waiting`,
      [blockedPid],
    );
    if (waiting.rows[0].is_waiting) {
      console.log(`${description}: PID ${blockedPid} is waiting on an advisory lock.`);
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }

  const activity = await controlClient.query(
    `select state,wait_event_type,wait_event
     from pg_catalog.pg_stat_activity
     where pid=$1`,
    [blockedPid],
  );
  throw new Error(`${description}: advisory-lock wait was not observed.`, {
    cause: { blockedPid, activity: activity.rows[0] ?? null },
  });
}

const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const password = randomBytes(24).toString("base64url");
const fixtureNames = [
  "platform",
  "adminA",
  "adminA2",
  "adminB",
  "reception",
  "professional",
  "inactive",
  "noMember",
  "existing",
];
const fixtures = new Map();
const createdAuthUserIds = [];
const centerIds = [];
const professionalIds = [];
const operationIds = [];
let control;
let transactionA;
let transactionB;

async function createAuthFixtures() {
  for (const name of fixtureNames) {
    const email = `task005-${runId}-${name.toLowerCase()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error("No se pudo crear un fixture Auth temporal.");
    fixtures.set(name, { id: data.user.id, email });
    createdAuthUserIds.push(data.user.id);
  }
}

async function prepareAndBindOperation(options) {
  operationIds.push(options.operationId);
  let prepared;
  if (options.operationType === "BOOTSTRAP_PLATFORM_ADMIN") {
    prepared = await control.query(
      "select * from public.prepare_platform_admin_bootstrap_operation($1,$2,$3,$4)",
      [options.operationId, options.email, options.firstName, options.lastName],
    );
  } else if (options.operationType === "PLATFORM_CREATE_CENTER") {
    prepared = await control.query(
      "select * from public.prepare_platform_center_provisioning_operation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        options.operationId,
        options.actorUserId,
        options.centerName,
        options.centerPhone,
        options.centerEmail,
        options.centerAddress,
        options.centerTimezone,
        options.email,
        options.firstName,
        options.lastName,
      ],
    );
  } else {
    prepared = await control.query(
      "select * from public.prepare_tenant_user_provisioning_operation($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        options.operationId,
        options.actorUserId,
        options.scopeCenterId,
        options.email,
        options.firstName,
        options.lastName,
        options.role,
        options.professionalCenterId,
      ],
    );
  }
  const payloadHash = prepared.rows[0].payload_hash;
  await control.query("select * from public.bind_auth_provisioning_operation($1,$2,$3,$4)", [
    options.operationId,
    payloadHash,
    options.authUserId,
    options.authUserWasCreated,
  ]);
  return payloadHash;
}

async function cleanupDatabase(userIds) {
  if (!control || userIds.length === 0) return;

  const discoveredCenters = await control.query(
    `select distinct center_id
     from public.center_memberships
     where user_id = any($1::uuid[])`,
    [userIds],
  );
  const cleanupCenterIds = [
    ...new Set([...centerIds, ...discoveredCenters.rows.map(({ center_id }) => center_id)]),
  ];
  const discoveredProfessionals =
    cleanupCenterIds.length === 0
      ? { rows: [] }
      : await control.query(
          `select distinct professional_id
           from public.professional_centers
           where center_id = any($1::uuid[])`,
          [cleanupCenterIds],
        );
  const cleanupProfessionalIds = [
    ...new Set([
      ...professionalIds,
      ...discoveredProfessionals.rows.map(({ professional_id }) => professional_id),
    ]),
  ];

  await control.query("begin");
  try {
    if (cleanupCenterIds.length > 0) {
      await control.query("delete from public.appointments where center_id = any($1::uuid[])", [
        cleanupCenterIds,
      ]);
      await control.query("delete from public.availabilities where center_id = any($1::uuid[])", [
        cleanupCenterIds,
      ]);
      await control.query(
        "delete from public.professional_center_specialties where center_id = any($1::uuid[])",
        [cleanupCenterIds],
      );
      await control.query(
        "delete from public.center_memberships where center_id = any($1::uuid[])",
        [cleanupCenterIds],
      );
      await control.query("delete from public.patient_centers where center_id = any($1::uuid[])", [
        cleanupCenterIds,
      ]);
      await control.query("delete from public.specialties where center_id = any($1::uuid[])", [
        cleanupCenterIds,
      ]);
      await control.query(
        "delete from public.professional_centers where center_id = any($1::uuid[])",
        [cleanupCenterIds],
      );
      await control.query("delete from public.centers where id = any($1::uuid[])", [
        cleanupCenterIds,
      ]);
    }
    if (cleanupProfessionalIds.length > 0) {
      await control.query(
        `delete from public.professionals
         where id = any($1::uuid[])
           and document_number like 'TASK005-%'`,
        [cleanupProfessionalIds],
      );
    }
    await control.query(
      `delete from private.provisioning_operations
       where id = any($1::uuid[])
          or actor_user_id = any($2::uuid[])
          or auth_user_id = any($2::uuid[])`,
      [operationIds, userIds],
    );
    await control.query("delete from public.platform_admins where user_id = any($1::uuid[])", [
      userIds,
    ]);
    await control.query("delete from public.users where id = any($1::uuid[])", [userIds]);
    await control.query("commit");
  } catch (error) {
    await control.query("rollback");
    throw error;
  }
}

async function cleanupAuth(userIds) {
  const errors = [];
  for (const userId of [...userIds].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "Auth fixture cleanup failed.");
}

async function cleanupStaleTask005Fixtures() {
  const staleUsers = await control.query(
    `select id
     from auth.users
     where email like 'task005-%@example.test'`,
  );
  const staleUserIds = staleUsers.rows.map(({ id }) => id);
  if (staleUserIds.length === 0) return;

  await cleanupDatabase(staleUserIds);
  await cleanupAuth(staleUserIds);
  console.log(`Removed ${staleUserIds.length} stale TASK-005 Auth fixture(s) before the run.`);
}

async function assertFixtureCleanup() {
  const residue = await control.query(
    `select
       (select count(*)::integer from auth.users where email like 'task005-%@example.test')
         as auth_users,
       (select count(*)::integer from public.users where email like 'task005-%@example.test')
         as public_users,
       (select count(*)::integer from public.platform_admins)
         as platform_admins,
       (select count(*)::integer from private.provisioning_operations)
         as provisioning_operations,
       (select count(*)::integer from public.professionals where document_number like 'TASK005-%')
         as professionals,
       (select count(*)::integer from public.centers where name like 'TASK-005 Center %')
         as centers,
       (select count(*)::integer from public.specialties where name like 'TASK-005 Specialty%')
         as specialties`,
  );
  for (const [kind, count] of Object.entries(residue.rows[0])) {
    assertEqual(count, 0, `${kind} fixture cleanup`);
  }
  console.log("TASK-005 fixture cleanup verified: zero Auth and domain residues.");
}

try {
  control = await connect("control");
  await cleanupStaleTask005Fixtures();
  await createAuthFixtures();
  const platform = fixtures.get("platform");
  const adminA = fixtures.get("adminA");
  const adminA2 = fixtures.get("adminA2");
  const adminB = fixtures.get("adminB");
  const reception = fixtures.get("reception");
  const professional = fixtures.get("professional");
  const inactive = fixtures.get("inactive");
  const noMember = fixtures.get("noMember");
  const existing = fixtures.get("existing");

  const bootstrapOperationA = randomUUID();
  const bootstrapOperationB = randomUUID();
  const bootstrapHashA = await prepareAndBindOperation({
    operationId: bootstrapOperationA,
    operationType: "BOOTSTRAP_PLATFORM_ADMIN",
    email: platform.email,
    firstName: "Platform",
    lastName: "Admin",
    authUserId: platform.id,
    authUserWasCreated: true,
  });
  await prepareAndBindOperation({
    operationId: bootstrapOperationB,
    operationType: "BOOTSTRAP_PLATFORM_ADMIN",
    email: noMember.email,
    firstName: "Second",
    lastName: "Bootstrap",
    authUserId: noMember.id,
    authUserWasCreated: true,
  });

  transactionA = await connect("bootstrap-a");
  transactionB = await connect("bootstrap-b");
  await transactionA.query("begin");
  await transactionA.query("select * from public.bootstrap_platform_admin($1,$2,$3,$4)", [
    bootstrapOperationA,
    platform.id,
    "Platform",
    "Admin",
  ]);
  await transactionB.query("begin");
  const bootstrapBlockedPid = Number(
    (await transactionB.query("select pg_catalog.pg_backend_pid() as pid")).rows[0].pid,
  );
  const losingBootstrap = transactionB.query(
    "select * from public.bootstrap_platform_admin($1,$2,$3,$4)",
    [bootstrapOperationB, noMember.id, "Second", "Bootstrap"],
  );
  void losingBootstrap.catch(() => {});

  await observePendingAdvisoryLock(control, bootstrapBlockedPid, "Bootstrap concurrency barrier");

  await transactionA.query("commit");
  const losingBootstrapResult = await Promise.allSettled([losingBootstrap]);
  if (
    losingBootstrapResult[0].status !== "rejected" ||
    losingBootstrapResult[0].reason?.code !== "23514"
  ) {
    throw new Error("Concurrent bootstrap did not leave exactly one PLATFORM_ADMIN.");
  }
  await transactionB.query("rollback");
  await transactionA.end();
  await transactionB.end();
  transactionA = undefined;
  transactionB = undefined;

  const reconciledBootstrap = await control.query(
    "select * from public.reconcile_auth_provisioning_operation($1,$2)",
    [bootstrapOperationA, bootstrapHashA],
  );
  assertEqual(
    reconciledBootstrap.rows[0].operation_status,
    "SUCCEEDED",
    "bootstrap response-loss reconciliation",
  );
  const retriedBootstrap = await control.query(
    "select * from public.bootstrap_platform_admin($1,$2,$3,$4)",
    [bootstrapOperationA, platform.id, "Platform", "Admin"],
  );
  assertEqual(retriedBootstrap.rows[0].user_id, platform.id, "idempotent bootstrap retry");

  const centerAOperation = randomUUID();
  await prepareAndBindOperation({
    operationId: centerAOperation,
    operationType: "PLATFORM_CREATE_CENTER",
    actorUserId: platform.id,
    centerName: "TASK-005 Center A",
    centerPhone: "100",
    centerEmail: "center-a@example.test",
    centerAddress: "Address A",
    centerTimezone: "America/Argentina/Buenos_Aires",
    email: adminA.email,
    firstName: "Admin",
    lastName: "A",
    authUserId: adminA.id,
    authUserWasCreated: true,
  });
  const centerAResult = await asUser(control, platform.id, (client) =>
    client.query(
      "select * from public.platform_create_center_with_admin($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        centerAOperation,
        "TASK-005 Center A",
        "100",
        "center-a@example.test",
        "Address A",
        "America/Argentina/Buenos_Aires",
        adminA.id,
        "Admin",
        "A",
      ],
    ),
  );
  const centerA = centerAResult.rows[0].center_id;
  centerIds.push(centerA);

  const centerBOperation = randomUUID();
  await prepareAndBindOperation({
    operationId: centerBOperation,
    operationType: "PLATFORM_CREATE_CENTER",
    actorUserId: platform.id,
    centerName: "TASK-005 Center B",
    centerPhone: "200",
    centerEmail: "center-b@example.test",
    centerAddress: "Address B",
    centerTimezone: "America/Argentina/Buenos_Aires",
    email: adminB.email,
    firstName: "Admin",
    lastName: "B",
    authUserId: adminB.id,
    authUserWasCreated: true,
  });
  const centerBResult = await asUser(control, platform.id, (client) =>
    client.query(
      "select * from public.platform_create_center_with_admin($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        centerBOperation,
        "TASK-005 Center B",
        "200",
        "center-b@example.test",
        "Address B",
        "America/Argentina/Buenos_Aires",
        adminB.id,
        "Admin",
        "B",
      ],
    ),
  );
  const centerB = centerBResult.rows[0].center_id;
  centerIds.push(centerB);

  const professionalId = randomUUID();
  const professionalCenterId = randomUUID();
  professionalIds.push(professionalId);
  await control.query(
    `insert into public.professionals
      (id, first_name, last_name, nationality_code, document_number, email)
     values ($1, 'Fixture', 'Professional', 'AR', $2, $3)`,
    [professionalId, `TASK005-${runId}`, professional.email],
  );
  await control.query(
    "insert into public.professional_centers (id, professional_id, center_id) values ($1,$2,$3)",
    [professionalCenterId, professionalId, centerA],
  );
  await control.query("insert into public.specialties (center_id, name) values ($1,$2)", [
    centerA,
    `TASK-005 Specialty ${runId}`,
  ]);
  await control.query(
    "insert into public.users (id,first_name,last_name,email) values ($1,$2,$3,$4),($5,$6,$7,$8)",
    [
      noMember.id,
      "No",
      "Membership",
      noMember.email,
      existing.id,
      "Preserved",
      "Identity",
      existing.email,
    ],
  );

  const provision = async (fixture, role, professionalCenter = null, firstName = "Fixture") => {
    const operationId = randomUUID();
    await prepareAndBindOperation({
      operationId,
      operationType: "TENANT_PROVISION_USER",
      actorUserId: adminA.id,
      scopeCenterId: centerA,
      email: fixture.email,
      firstName,
      lastName: "User",
      role,
      professionalCenterId: professionalCenter,
      authUserId: fixture.id,
      authUserWasCreated: true,
    });
    return asUser(control, adminA.id, (client) =>
      client.query("select * from public.admin_provision_center_user($1,$2,$3,$4,$5,$6,$7)", [
        operationId,
        centerA,
        fixture.id,
        firstName,
        "User",
        role,
        professionalCenter,
      ]),
    );
  };

  await provision(reception, "RECEPTION");
  await provision(professional, "PROFESSIONAL", professionalCenterId);
  await provision(adminA2, "ADMIN");
  const inactiveMembership = (await provision(inactive, "RECEPTION")).rows[0].membership_id;
  await provision(existing, "RECEPTION", null, "Changed");
  await asUser(control, adminA.id, (client) =>
    client.query("select * from public.admin_set_center_membership($1,$2,$3,$4,$5)", [
      centerA,
      inactiveMembership,
      "RECEPTION",
      null,
      false,
    ]),
  );

  const preserved = await control.query(
    "select first_name,last_name,email from public.users where id=$1",
    [existing.id],
  );
  assertEqual(preserved.rows[0].first_name, "Preserved", "existing first name preservation");
  assertEqual(preserved.rows[0].last_name, "Identity", "existing last name preservation");
  assertEqual(preserved.rows[0].email, existing.email, "existing email preservation");

  const passwordClient = createClient(dev.url, dev.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: passwordError } = await passwordClient.auth.signInWithPassword({
    email: existing.email,
    password,
  });
  if (passwordError) throw new Error("Provisioning changed the existing Auth password.");
  await passwordClient.auth.signOut({ scope: "local" });

  const noMembershipCenters = await asUser(control, noMember.id, (client) =>
    client.query("select count(*)::integer as count from public.centers"),
  );
  assertEqual(noMembershipCenters.rows[0].count, 0, "user without membership center access");

  const inactiveCenters = await asUser(control, inactive.id, (client) =>
    client.query("select count(*)::integer as count from public.centers"),
  );
  assertEqual(inactiveCenters.rows[0].count, 0, "inactive membership center access");

  await control.query("begin");
  await control.query("set local role anon");
  await expectSqlState(
    () => control.query("select * from public.centers"),
    "42501",
    "anonymous domain SELECT",
  );
  await control.query("rollback");

  const adminCenters = await asUser(control, adminA.id, (client) =>
    client.query("select id from public.centers order by id"),
  );
  assertEqual(adminCenters.rows.length, 1, "Center A ADMIN center isolation");
  assertEqual(adminCenters.rows[0].id, centerA, "Center A ADMIN cross-center isolation");

  const adminUsers = await asUser(control, adminA.id, (client) =>
    client.query("select id from public.users"),
  );
  assertEqual(adminUsers.rows.length, 6, "Center ADMIN user visibility including inactive member");

  const receptionProfessionals = await asUser(control, reception.id, (client) =>
    client.query("select count(*)::integer as count from public.professionals"),
  );
  assertEqual(receptionProfessionals.rows[0].count, 0, "RECEPTION professional access");

  const professionalContext = await asUser(control, professional.id, async (client) => {
    const pc = await client.query(
      "select count(*)::integer as count from public.professional_centers",
    );
    const person = await client.query(
      "select count(*)::integer as count from public.professionals",
    );
    return { pc: pc.rows[0].count, professional: person.rows[0].count };
  });
  assertEqual(professionalContext.pc, 1, "PROFESSIONAL own ProfessionalCenter access");
  assertEqual(professionalContext.professional, 1, "PROFESSIONAL own Professional access");

  const platformSummary = await asUser(control, platform.id, (client) =>
    client.query("select * from public.platform_list_centers() order by name"),
  );
  assertEqual(platformSummary.rows.length, 2, "platform center list");
  assertEqual(
    Number(platformSummary.rows[0].active_membership_count),
    5,
    "platform active membership counter",
  );
  assertEqual(
    Number(platformSummary.rows[0].active_professional_center_count),
    1,
    "platform active ProfessionalCenter counter",
  );
  assertEqual(
    Number(platformSummary.rows[0].active_specialty_count),
    1,
    "platform active Specialty counter",
  );

  const platformTenantRows = await asUser(control, platform.id, (client) =>
    client.query("select count(*)::integer as count from public.centers"),
  );
  assertEqual(platformTenantRows.rows[0].count, 0, "PLATFORM_ADMIN tenant bypass");
  const tenantPlatformRows = await asUser(control, adminA.id, (client) =>
    client.query("select count(*)::integer as count from public.platform_admins"),
  );
  assertEqual(tenantPlatformRows.rows[0].count, 0, "tenant ADMIN platform access");
  await expectSqlState(
    () =>
      asUser(control, platform.id, (client) => client.query("select * from public.specialties")),
    "42501",
    "PLATFORM_ADMIN direct operational SELECT",
  );

  const adminBMembership = await control.query(
    "select id from public.center_memberships where center_id=$1 and user_id=$2",
    [centerB, adminB.id],
  );
  await expectSqlState(
    () =>
      asUser(control, adminB.id, (client) =>
        client.query("select * from public.admin_set_center_membership($1,$2,$3,$4,$5)", [
          centerB,
          adminBMembership.rows[0].id,
          "RECEPTION",
          null,
          true,
        ]),
      ),
    "23514",
    "last ADMIN degradation",
  );

  await expectSqlState(
    () =>
      asUser(control, adminA.id, (client) =>
        client.query("update public.center_memberships set is_active=false where center_id=$1", [
          centerA,
        ]),
      ),
    "42501",
    "direct membership UPDATE",
  );
  await expectSqlState(
    () =>
      asUser(control, adminA.id, (client) =>
        client.query(
          "insert into public.users (id,first_name,last_name,email) values ($1,'No','Insert',$2)",
          [randomUUID(), `forbidden-${runId}@example.test`],
        ),
      ),
    "42501",
    "direct user INSERT",
  );
  await expectSqlState(
    () =>
      asUser(control, adminA.id, (client) =>
        client.query("delete from public.center_memberships where id=$1", [inactiveMembership]),
      ),
    "42501",
    "direct membership DELETE",
  );

  transactionA = await connect("concurrency-a");
  transactionB = await connect("concurrency-b");
  const membershipRows = await control.query(
    "select user_id,id from public.center_memberships where center_id=$1 and user_id=any($2::uuid[])",
    [centerA, [adminA.id, adminA2.id]],
  );
  const membershipByUser = new Map(membershipRows.rows.map((row) => [row.user_id, row.id]));

  await transactionA.query("begin");
  await transactionA.query("set local role authenticated");
  await transactionA.query("select set_config('request.jwt.claim.sub',$1,true)", [adminA.id]);
  await transactionA.query("select * from public.admin_set_center_membership($1,$2,$3,$4,$5)", [
    centerA,
    membershipByUser.get(adminA.id),
    "RECEPTION",
    null,
    true,
  ]);

  await transactionB.query("begin");
  const centerBlockedPid = Number(
    (await transactionB.query("select pg_catalog.pg_backend_pid() as pid")).rows[0].pid,
  );
  await transactionB.query("set local role authenticated");
  await transactionB.query("select set_config('request.jwt.claim.sub',$1,true)", [adminA2.id]);
  const secondChange = transactionB.query(
    "select * from public.admin_set_center_membership($1,$2,$3,$4,$5)",
    [centerA, membershipByUser.get(adminA2.id), "RECEPTION", null, true],
  );
  void secondChange.catch(() => {});

  await observePendingAdvisoryLock(control, centerBlockedPid, "Center ADMIN concurrency barrier");

  await transactionA.query("commit");
  const secondResult = await Promise.allSettled([secondChange]);
  if (secondResult[0].status !== "rejected" || secondResult[0].reason?.code !== "23514") {
    throw new Error("Concurrent ADMIN degradation did not fail with SQLSTATE 23514.");
  }
  await transactionB.query("rollback");

  const membershipCountBeforeDisable = Number(
    (
      await control.query(
        "select count(*) as count from public.center_memberships where center_id=$1",
        [centerA],
      )
    ).rows[0].count,
  );
  await asUser(control, platform.id, (client) =>
    client.query("select * from public.platform_set_center_active($1,false)", [centerA]),
  );
  const membershipCountAfterDisable = Number(
    (
      await control.query(
        "select count(*) as count from public.center_memberships where center_id=$1",
        [centerA],
      )
    ).rows[0].count,
  );
  assertEqual(
    membershipCountAfterDisable,
    membershipCountBeforeDisable,
    "inactive center membership preservation",
  );
  const inactiveCenterVisibility = await asUser(control, adminA2.id, (client) =>
    client.query("select count(*)::integer as count from public.centers where id=$1", [centerA]),
  );
  assertEqual(inactiveCenterVisibility.rows[0].count, 0, "inactive center tenant denial");
  await asUser(control, platform.id, (client) =>
    client.query("select * from public.platform_set_center_active($1,true)", [centerA]),
  );

  await control.query("begin");
  await control.query("update public.centers set is_active=false where id=$1", [centerB]);
  await control.query(
    "update public.center_memberships set is_active=false where center_id=$1 and role='ADMIN'",
    [centerB],
  );
  await control.query("set local role authenticated");
  await control.query("select set_config('request.jwt.claim.sub',$1,true)", [platform.id]);
  await expectSqlState(
    () => control.query("select * from public.platform_set_center_active($1,true)", [centerB]),
    "23514",
    "center reactivation without ADMIN",
  );
  await control.query("rollback");

  console.log("Auth/RLS foundation DEV verification passed, including real ADMIN concurrency.");
} finally {
  for (const client of [transactionA, transactionB]) {
    if (client) {
      try {
        await client.query("rollback");
      } catch {}
      await client.end().catch(() => {});
    }
  }

  const cleanupErrors = [];
  try {
    await cleanupDatabase(createdAuthUserIds);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await cleanupAuth(createdAuthUserIds);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await assertFixtureCleanup();
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (control) await control.end().catch((error) => cleanupErrors.push(error));
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "TASK-005 fixture cleanup failed.");
  }
}
