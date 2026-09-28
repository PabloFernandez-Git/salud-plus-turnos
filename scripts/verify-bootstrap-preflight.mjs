import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
const expectedOperationId = "352a309e-f137-488e-b6e7-4b53e2cdb7b2";
const checkedTables = ["platform_admins", "users", "centers", "center_memberships"];
const expectedPreflight = Object.freeze({
  platform_is_empty: true,
  auth_users_empty: true,
  public_users_empty: true,
  platform_admins_empty: true,
  centers_empty: true,
  center_memberships_empty: true,
});

loadLocalEnv();
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es requerida para verificar el preflight.`);
  return value;
}

const secretKey = requireValue("SUPABASE_SECRET_KEY");
const operationId = requireValue("SUPABASE_BOOTSTRAP_OPERATION_ID");
const email = requireValue("BOOTSTRAP_PLATFORM_ADMIN_EMAIL").toLowerCase();
const firstName = requireValue("BOOTSTRAP_PLATFORM_ADMIN_FIRST_NAME");
const lastName = requireValue("BOOTSTRAP_PLATFORM_ADMIN_LAST_NAME");

if (operationId !== expectedOperationId) {
  throw new Error(
    "El operation ID configurado no coincide con el intento de bootstrap preservado.",
  );
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
    application_name: "task005-bootstrap-preflight",
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForDatabaseState(query, predicate, failureMessage, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await query();
    if (predicate(result)) return result;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(failureMessage);
}

function assertPreflight(actual, expected = expectedPreflight) {
  assert(actual && typeof actual === "object", "La RPC no devolvió una fila estructurada.");
  assert(
    JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(Object.keys(expected).sort()),
    "La RPC expone campos distintos de los seis booleanos aprobados.",
  );
  for (const [key, value] of Object.entries(expected)) {
    assert(typeof actual[key] === "boolean", `${key} no es booleano.`);
    assert(actual[key] === value, `${key} no coincide con el estado esperado.`);
  }
}

async function expectRoleDenied(database, role) {
  await database.query("begin");
  try {
    await database.query(`set local role ${role}`);
    await database.query("select * from public.bootstrap_platform_preflight()");
    throw new Error(`${role} pudo ejecutar el preflight service-only.`);
  } catch (error) {
    assert(error.code === "42501", `${role} no fue rechazado con SQLSTATE 42501.`);
  } finally {
    await database.query("rollback");
  }
}

async function assertFixtureMakesPlatformNonEmpty(database, setup, falseFlag) {
  await database.query("begin");
  try {
    await setup(database);
    await database.query("set local role service_role");
    const result = await database.query("select * from public.bootstrap_platform_preflight()");
    const row = result.rows[0];
    assert(row.platform_is_empty === false, `${falseFlag} no bloqueó el preflight.`);
    assert(row[falseFlag] === false, `${falseFlag} no reflejó la fila transaccional.`);
  } finally {
    await database.query("rollback");
  }
}

function insertAuthUser(database, id, fixtureEmail) {
  return database.query(
    `insert into auth.users (id, email, created_at, updated_at)
     values ($1, $2, now(), now())`,
    [id, fixtureEmail],
  );
}

function insertPublicUser(database, id, fixtureEmail) {
  return database.query(
    `insert into public.users (id, first_name, last_name, email)
     values ($1, 'Preflight', 'Fixture', $2)`,
    [id, fixtureEmail],
  );
}

async function prepareAndBindBootstrap(database, operationId, authUserId, fixtureEmail) {
  const prepared = await database.query(
    `select * from public.prepare_platform_admin_bootstrap_operation($1,$2,$3,$4)`,
    [operationId, fixtureEmail, "Preflight", "Bootstrap"],
  );
  await database.query(`select * from public.bind_auth_provisioning_operation($1,$2,$3,$4)`, [
    operationId,
    prepared.rows[0].payload_hash,
    authUserId,
    true,
  ]);
}

async function assertFinalBootstrapAuthRevalidation(database) {
  const legitimateAuthUserId = randomUUID();
  const competingAuthUserId = randomUUID();
  const rejectedOperationId = randomUUID();
  const legitimateEmail = `task005-preflight-${legitimateAuthUserId}@example.test`;
  const competingEmail = `task005-preflight-${competingAuthUserId}@example.test`;

  await database.query("begin");
  try {
    await insertAuthUser(database, legitimateAuthUserId, legitimateEmail);
    await prepareAndBindBootstrap(
      database,
      rejectedOperationId,
      legitimateAuthUserId,
      legitimateEmail,
    );
    await insertAuthUser(database, competingAuthUserId, competingEmail);
    await database.query("savepoint before_bootstrap_mutation");
    try {
      await database.query("select * from public.bootstrap_platform_admin($1,$2,$3,$4)", [
        rejectedOperationId,
        legitimateAuthUserId,
        "Preflight",
        "Bootstrap",
      ]);
      throw new Error("La RPC final ignoró una identidad Auth competidora.");
    } catch (error) {
      assert(error.code === "23514", "La identidad Auth competidora no produjo SQLSTATE 23514.");
      await database.query("rollback to savepoint before_bootstrap_mutation");
    }

    const rejectedState = await database.query(
      `select
         (select count(*)::int from public.users) public_users,
         (select count(*)::int from public.platform_admins) platform_admins,
         operation.status,
         operation.result_user_id,
         operation.completed_at
       from private.provisioning_operations as operation
       where operation.id=$1`,
      [rejectedOperationId],
    );
    assert(rejectedState.rows[0].public_users === 0, "El rechazo creó public.users.");
    assert(rejectedState.rows[0].platform_admins === 0, "El rechazo concedió PLATFORM_ADMIN.");
    assert(rejectedState.rows[0].status === "AUTH_READY", "La operación rechazada fue completada.");
    assert(rejectedState.rows[0].result_user_id === null, "El rechazo persistió result_user_id.");
    assert(rejectedState.rows[0].completed_at === null, "El rechazo persistió completed_at.");
  } finally {
    await database.query("rollback");
  }

  const positiveAuthUserId = randomUUID();
  const postSuccessAuthUserId = randomUUID();
  const successfulOperationId = randomUUID();
  const positiveEmail = `task005-preflight-${positiveAuthUserId}@example.test`;

  await database.query("begin");
  try {
    await insertAuthUser(database, positiveAuthUserId, positiveEmail);
    await prepareAndBindBootstrap(
      database,
      successfulOperationId,
      positiveAuthUserId,
      positiveEmail,
    );
    const succeeded = await database.query(
      "select * from public.bootstrap_platform_admin($1,$2,$3,$4)",
      [successfulOperationId, positiveAuthUserId, "Preflight", "Bootstrap"],
    );
    assert(
      succeeded.rows[0].user_id === positiveAuthUserId,
      "La identidad vinculada fue rechazada.",
    );

    const successfulState = await database.query(
      `select
         (select count(*)::int from public.users where id=$2) public_users,
         (select count(*)::int from public.platform_admins where user_id=$2) platform_admins,
         operation.status,
         operation.result_user_id
       from private.provisioning_operations as operation
       where operation.id=$1`,
      [successfulOperationId, positiveAuthUserId],
    );
    assert(successfulState.rows[0].public_users === 1, "El bootstrap positivo no creó el perfil.");
    assert(
      successfulState.rows[0].platform_admins === 1,
      "El bootstrap positivo no creó PLATFORM_ADMIN.",
    );
    assert(successfulState.rows[0].status === "SUCCEEDED", "El bootstrap positivo no completó.");
    assert(
      successfulState.rows[0].result_user_id === positiveAuthUserId,
      "El bootstrap positivo persistió otro resultado.",
    );

    await insertAuthUser(
      database,
      postSuccessAuthUserId,
      `task005-preflight-${postSuccessAuthUserId}@example.test`,
    );
    const retry = await database.query(
      "select * from public.bootstrap_platform_admin($1,$2,$3,$4)",
      [successfulOperationId, positiveAuthUserId, "Preflight", "Bootstrap"],
    );
    assert(retry.rows[0].user_id === positiveAuthUserId, "El retry SUCCEEDED no fue idempotente.");
  } finally {
    await database.query("rollback");
  }
}

async function deleteAuthFixturesByEmail(database, emails) {
  const fixtures = await database.query(
    "select id from auth.users where pg_catalog.lower(email)=any($1::text[])",
    [emails.map((fixtureEmail) => fixtureEmail.toLowerCase())],
  );
  for (const fixture of fixtures.rows) {
    const { error } = await admin.auth.admin.deleteUser(fixture.id);
    assert(!error, "No se pudo limpiar una identidad Auth temporal del test de lock.");
  }
}

async function assertAuthWritesWaitForBootstrapCommit(databaseConfig, database) {
  const operationId = randomUUID();
  const legitimateEmail = `task005-preflight-race-${randomUUID()}@example.test`;
  const competingEmail = `task005-preflight-race-${randomUUID()}@example.test`;
  const password = `Task005-${randomUUID()}-aA1!`;
  const blocker = new Client(databaseConfig);
  const bootstrap = new Client(databaseConfig);
  const observer = new Client(databaseConfig);
  let legitimateAuthUserId;
  let competingCreation;
  let competingSettled = false;

  try {
    const { data: legitimate, error: legitimateError } = await admin.auth.admin.createUser({
      email: legitimateEmail,
      password,
      email_confirm: true,
    });
    assert(
      !legitimateError && legitimate.user,
      "No se pudo crear Auth A temporal mediante GoTrue.",
    );
    legitimateAuthUserId = legitimate.user.id;

    await prepareAndBindBootstrap(database, operationId, legitimateAuthUserId, legitimateEmail);

    await Promise.all([blocker.connect(), bootstrap.connect(), observer.connect()]);
    await Promise.all([
      blocker.query("set role postgres"),
      bootstrap.query("set role service_role"),
      observer.query("set role postgres"),
    ]);

    await blocker.query("begin");
    await insertPublicUser(blocker, legitimateAuthUserId, legitimateEmail);

    await bootstrap.query("begin");
    const bootstrapPid = (await bootstrap.query("select pg_backend_pid() pid")).rows[0].pid;
    const bootstrapCall = bootstrap.query(
      "select * from public.bootstrap_platform_admin($1,$2,$3,$4)",
      [operationId, legitimateAuthUserId, "Preflight", "Bootstrap"],
    );

    await waitForDatabaseState(
      () =>
        observer.query(
          `select
             activity.wait_event_type,
             activity.wait_event,
             exists (
               select 1
               from pg_catalog.pg_locks as held_lock
               where held_lock.pid=$1
                 and held_lock.relation='auth.users'::regclass
                 and held_lock.mode='ShareLock'
                 and held_lock.granted
             ) auth_share_lock_granted
           from pg_catalog.pg_stat_activity as activity
           where activity.pid=$1`,
          [bootstrapPid],
        ),
      (result) =>
        result.rows[0]?.auth_share_lock_granted === true &&
        result.rows[0]?.wait_event_type === "Lock",
      "La RPC no alcanzó la barrera posterior al lock/check Auth y previa al INSERT público.",
    );

    competingCreation = admin.auth.admin
      .createUser({ email: competingEmail, password, email_confirm: true })
      .finally(() => {
        competingSettled = true;
      });

    await waitForDatabaseState(
      () =>
        observer.query(
          `select count(*)::int waiting_writers
           from pg_catalog.pg_locks as waiting_lock
           where waiting_lock.relation='auth.users'::regclass
             and waiting_lock.mode='RowExclusiveLock'
             and not waiting_lock.granted`,
        ),
      (result) => result.rows[0]?.waiting_writers >= 1,
      "GoTrue no quedó esperando ROW EXCLUSIVE sobre auth.users.",
    );
    assert(!competingSettled, "Auth B confirmó mientras la RPC retenía SHARE sobre auth.users.");

    await blocker.query("rollback");
    const bootstrapResult = await bootstrapCall;
    assert(
      bootstrapResult.rows[0]?.user_id === legitimateAuthUserId,
      "La RPC concurrente no devolvió Auth A.",
    );
    assert(!competingSettled, "Auth B confirmó antes del COMMIT que concede PLATFORM_ADMIN.");

    const beforeCommit = await observer.query(
      `select count(*)::int waiting_writers
       from pg_catalog.pg_locks as waiting_lock
       where waiting_lock.relation='auth.users'::regclass
         and waiting_lock.mode='RowExclusiveLock'
         and not waiting_lock.granted`,
    );
    assert(
      beforeCommit.rows[0].waiting_writers >= 1,
      "Auth B dejó de esperar antes del COMMIT de PLATFORM_ADMIN.",
    );

    await bootstrap.query("commit");
    const competingResult = await competingCreation;
    assert(
      !competingResult.error && competingResult.data.user,
      "Auth B no pudo confirmar después del COMMIT de PLATFORM_ADMIN.",
    );

    const committedState = await database.query(
      `select
         (select count(*)::int from public.users where id=$2) public_users,
         (select count(*)::int from public.platform_admins where user_id=$2) platform_admins,
         operation.status,
         operation.result_user_id
       from private.provisioning_operations as operation
       where operation.id=$1`,
      [operationId, legitimateAuthUserId],
    );
    assert(
      committedState.rows[0].public_users === 1,
      "El bootstrap serializado no creó el perfil.",
    );
    assert(
      committedState.rows[0].platform_admins === 1,
      "El bootstrap serializado no concedió PLATFORM_ADMIN.",
    );
    assert(committedState.rows[0].status === "SUCCEEDED", "La operación no quedó SUCCEEDED.");
    assert(
      committedState.rows[0].result_user_id === legitimateAuthUserId,
      "La operación serializada persistió otro resultado.",
    );
  } finally {
    await blocker.query("rollback").catch(() => {});
    await bootstrap.query("rollback").catch(() => {});
    await Promise.all([
      blocker.end().catch(() => {}),
      bootstrap.end().catch(() => {}),
      observer.end().catch(() => {}),
    ]);
    await competingCreation?.catch(() => {});

    await database.query("begin");
    try {
      await database.query("delete from public.platform_admins where user_id=$1", [
        legitimateAuthUserId ?? null,
      ]);
      await database.query("delete from public.users where id=$1", [legitimateAuthUserId ?? null]);
      await database.query("delete from private.provisioning_operations where id=$1", [
        operationId,
      ]);
      await database.query("commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }
    await deleteAuthFixturesByEmail(database, [legitimateEmail, competingEmail]);
  }
}

let database;
try {
  const databaseConfig = temporaryDatabaseConfig();
  database = new Client(databaseConfig);
  await database.connect();
  await database.query("set role postgres");

  const baseline = await database.query(
    `select
       (select count(*)::int from auth.users) auth_users,
       (select count(*)::int from public.users) public_users,
       (select count(*)::int from public.platform_admins) platform_admins,
       (select count(*)::int from public.centers) centers,
       (select count(*)::int from public.center_memberships) center_memberships,
       (select count(*)::int from private.provisioning_operations) provisioning_operations`,
  );
  const initializedBaseline = {
    auth_users: 1,
    public_users: 1,
    platform_admins: 1,
    centers: 1,
    center_memberships: 1,
    provisioning_operations: 2,
  };
  const platformAlreadyInitialized =
    JSON.stringify(baseline.rows[0]) === JSON.stringify(initializedBaseline);

  if (platformAlreadyInitialized) {
    for (const table of checkedTables) {
      const { error } = await admin.from(table).select("*").limit(1);
      assert(error?.code === "42501", `service_role obtuvo SELECT directo sobre ${table}.`);
    }
    await expectRoleDenied(database, "anon");
    await expectRoleDenied(database, "authenticated");

    const { data: preflight, error: preflightError } = await admin
      .rpc("bootstrap_platform_preflight")
      .single();
    assert(!preflightError, "service_role no pudo ejecutar la RPC de preflight.");
    assertPreflight(preflight, {
      platform_is_empty: false,
      auth_users_empty: false,
      public_users_empty: false,
      platform_admins_empty: false,
      centers_empty: false,
      center_memberships_empty: false,
    });

    const persistentBootstrap = await database.query(
      `select operation_type,status,result_user_id,completed_at
       from private.provisioning_operations where id=$1`,
      [operationId],
    );
    assert(persistentBootstrap.rowCount === 1, "No existe la operación de bootstrap persistente.");
    assert(
      persistentBootstrap.rows[0].operation_type === "BOOTSTRAP_PLATFORM_ADMIN" &&
        persistentBootstrap.rows[0].status === "SUCCEEDED" &&
        persistentBootstrap.rows[0].result_user_id !== null &&
        persistentBootstrap.rows[0].completed_at !== null,
      "La operación de bootstrap persistente no conserva el estado SUCCEEDED esperado.",
    );

    const finalBaseline = await database.query(
      `select
         (select count(*)::int from auth.users) auth_users,
         (select count(*)::int from public.users) public_users,
         (select count(*)::int from public.platform_admins) platform_admins,
         (select count(*)::int from public.centers) centers,
         (select count(*)::int from public.center_memberships) center_memberships,
         (select count(*)::int from private.provisioning_operations) provisioning_operations`,
    );
    assert(
      JSON.stringify(finalBaseline.rows[0]) === JSON.stringify(baseline.rows[0]),
      "El preflight de plataforma inicializada mutó DEV.",
    );
    console.log(
      "Bootstrap preflight DEV PASS: plataforma inicializada rechazada, grants service-only y baseline persistente intacto.",
    );
  } else {
    assert(
      JSON.stringify(baseline.rows[0]) ===
        JSON.stringify({
          auth_users: 0,
          public_users: 0,
          platform_admins: 0,
          centers: 0,
          center_memberships: 0,
          provisioning_operations: 1,
        }),
      "El estado DEV no coincide con un baseline de bootstrap admitido.",
    );

    for (const table of checkedTables) {
      const { error } = await admin.from(table).select("*").limit(1);
      assert(error?.code === "42501", `service_role obtuvo SELECT directo sobre ${table}.`);
    }

    await expectRoleDenied(database, "anon");
    await expectRoleDenied(database, "authenticated");

    const { data: preflight, error: preflightError } = await admin
      .rpc("bootstrap_platform_preflight")
      .single();
    assert(!preflightError, "service_role no pudo ejecutar la RPC de preflight.");
    assertPreflight(preflight);

    const fixtureId = randomUUID();
    const fixtureEmail = `task005-preflight-${fixtureId}@example.test`;
    await assertFixtureMakesPlatformNonEmpty(
      database,
      (client) => insertAuthUser(client, fixtureId, fixtureEmail),
      "auth_users_empty",
    );
    await assertFixtureMakesPlatformNonEmpty(
      database,
      async (client) => {
        await insertAuthUser(client, fixtureId, fixtureEmail);
        await insertPublicUser(client, fixtureId, fixtureEmail);
      },
      "public_users_empty",
    );
    await assertFixtureMakesPlatformNonEmpty(
      database,
      async (client) => {
        await insertAuthUser(client, fixtureId, fixtureEmail);
        await insertPublicUser(client, fixtureId, fixtureEmail);
        await client.query("insert into public.platform_admins (user_id) values ($1)", [fixtureId]);
      },
      "platform_admins_empty",
    );
    await assertFixtureMakesPlatformNonEmpty(
      database,
      (client) =>
        client.query("insert into public.centers (id, name) values ($1, $2)", [
          fixtureId,
          "TASK-005 Bootstrap preflight fixture",
        ]),
      "centers_empty",
    );
    await assertFixtureMakesPlatformNonEmpty(
      database,
      async (client) => {
        await insertAuthUser(client, fixtureId, fixtureEmail);
        await insertPublicUser(client, fixtureId, fixtureEmail);
        await client.query("insert into public.centers (id, name) values ($1, $2)", [
          fixtureId,
          "TASK-005 Bootstrap preflight fixture",
        ]);
        await client.query(
          `insert into public.center_memberships (center_id, user_id, role)
         values ($1, $1, 'ADMIN')`,
          [fixtureId],
        );
      },
      "center_memberships_empty",
    );

    await assertFinalBootstrapAuthRevalidation(database);
    await assertAuthWritesWaitForBootstrapCommit(databaseConfig, database);

    const before = await database.query(
      `select operation_type, status, auth_user_id, result_user_id, completed_at
     from private.provisioning_operations where id=$1`,
      [operationId],
    );
    assert(before.rowCount === 1, "No existe la operación PENDING preservada.");
    assert(
      JSON.stringify(before.rows[0]) ===
        JSON.stringify({
          operation_type: "BOOTSTRAP_PLATFORM_ADMIN",
          status: "PENDING",
          auth_user_id: null,
          result_user_id: null,
          completed_at: null,
        }),
      "La operación preservada no conserva el estado PENDING esperado.",
    );

    const { data: prepared, error: prepareError } = await admin
      .rpc("prepare_platform_admin_bootstrap_operation", {
        p_email: email,
        p_first_name: firstName,
        p_last_name: lastName,
        p_operation_id: operationId,
      })
      .single();
    assert(!prepareError, "El mismo operation ID no pudo reutilizar la intención original.");
    assert(
      prepared.operation_status === "PENDING" &&
        prepared.auth_user_id === null &&
        prepared.result_user_id === null,
      "El retry idempotente no devolvió el estado PENDING original.",
    );

    const after = await database.query(
      `select operation_type, status, auth_user_id, result_user_id, completed_at
     from private.provisioning_operations where id=$1`,
      [operationId],
    );
    assert(
      JSON.stringify(after.rows[0]) === JSON.stringify(before.rows[0]),
      "El retry mutó la operación.",
    );

    const residue = await database.query(
      `select
       (select count(*)::int from auth.users) auth_users,
       (select count(*)::int from public.users) public_users,
       (select count(*)::int from public.platform_admins) platform_admins,
       (select count(*)::int from public.centers) centers,
       (select count(*)::int from public.center_memberships) center_memberships,
       (select count(*)::int from private.provisioning_operations) provisioning_operations`,
    );
    assert(
      JSON.stringify(residue.rows[0]) === JSON.stringify(baseline.rows[0]),
      "Quedaron fixtures persistentes.",
    );

    console.log(
      "Bootstrap preflight DEV PASS: contrato exacto, grants mínimos, Auth B serializado hasta COMMIT, rollback/cleanup y operación PENDING reutilizable.",
    );
  }
} finally {
  await database?.query("rollback").catch(() => {});
  await database?.end().catch(() => {});
}
