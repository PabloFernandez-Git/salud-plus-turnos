import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

const { Client } = pg;
const execFileAsync = promisify(execFile);
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const schemaTestFile = resolve("supabase/tests/initial-domain-schema.sql");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");
const expectedConstraint = "appointments_no_blocking_overlap";
const runnerApplicationPrefix = "task004-concurrency-";
const polling = Object.freeze({ intervalMilliseconds: 150, timeoutMilliseconds: 180_000 });
const connectionTimeoutMilliseconds = 20_000;
const cleanupWatchdogMilliseconds = 30_000;
const cliTimeoutMilliseconds = 255_000;
const controlQueryTimeoutMilliseconds = 60_000;
const controlAttemptTimeoutMilliseconds = 20_000;

const ids = Object.freeze({
  center: "10000000-0000-0000-0000-000000000101",
  professional: "10000000-0000-0000-0000-000000000301",
  professionalCenter: "10000000-0000-0000-0000-000000000401",
  person: "10000000-0000-0000-0000-000000000501",
  specialty: "10000000-0000-0000-0000-000000000601",
  patientCenter: "10000000-0000-0000-0000-000000000701",
  firstAppointment: "10000000-0000-0000-0000-000000000801",
  secondAppointment: "10000000-0000-0000-0000-000000000802",
});

const cleanupSql = `
delete from public.appointments
where id in ('${ids.firstAppointment}', '${ids.secondAppointment}');
delete from public.professional_center_specialties
where professional_center_id = '${ids.professionalCenter}'
  and specialty_id = '${ids.specialty}';
delete from public.patient_centers where id = '${ids.patientCenter}';
delete from public.professional_centers where id = '${ids.professionalCenter}';
delete from public.specialties where id = '${ids.specialty}';
delete from public.persons where id = '${ids.person}';
delete from public.professionals where id = '${ids.professional}';
delete from public.centers where id = '${ids.center}';
`;

const setupSql = `
insert into public.centers (id, name)
values ('${ids.center}', 'Concurrency verification center');
insert into public.professionals (
  id,
  first_name,
  last_name,
  nationality_code,
  document_number,
  email
) values (
  '${ids.professional}',
  'Concurrency',
  'Professional',
  'AR',
  'CONCURRENCY-001',
  'concurrency@example.test'
);
insert into public.professional_centers (id, professional_id, center_id)
values ('${ids.professionalCenter}', '${ids.professional}', '${ids.center}');
insert into public.specialties (id, center_id, name)
values ('${ids.specialty}', '${ids.center}', 'Concurrency specialty');
insert into public.professional_center_specialties (
  professional_center_id,
  specialty_id,
  center_id
) values ('${ids.professionalCenter}', '${ids.specialty}', '${ids.center}');
insert into public.persons (
  id,
  first_name,
  last_name,
  birth_date,
  nationality_code,
  document_number
) values (
  '${ids.person}',
  'Concurrency',
  'Patient',
  '1990-01-01',
  'AR',
  'CONCURRENCY-002'
);
insert into public.patient_centers (id, person_id, center_id, phone)
values ('${ids.patientCenter}', '${ids.person}', '${ids.center}', '0000000000');
`;

function appointmentInsert(id, startsAt, endsAt) {
  return `
insert into public.appointments (
  id,
  center_id,
  patient_center_id,
  professional_center_id,
  specialty_id,
  starts_at,
  ends_at
) values (
  '${id}',
  '${ids.center}',
  '${ids.patientCenter}',
  '${ids.professionalCenter}',
  '${ids.specialty}',
  '${startsAt}',
  '${endsAt}'
);
`;
}

async function runSupabase(args, timeoutMilliseconds = cliTimeoutMilliseconds) {
  return execFileAsync(process.execPath, [supabaseCli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "true",
      DO_NOT_TRACK: "1",
      SUPABASE_TELEMETRY_DISABLED: "1",
    },
    maxBuffer: 10 * 1024 * 1024,
    timeout: timeoutMilliseconds,
    windowsHide: true,
  });
}

async function linkedQuery(sql, timeoutMilliseconds) {
  return runSupabase(["db", "query", "--linked", sql], timeoutMilliseconds);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function errorEvidence(reason) {
  if (!(reason instanceof Error)) return String(reason);
  return [reason.message, reason.stdout, reason.stderr].filter(Boolean).join("\n");
}

function isTransientControlError(error) {
  const evidence = errorEvidence(error);
  return (
    (error instanceof Error && error.killed === true) ||
    /unexpected status 5\d\d|Cloudflare|ECONNRESET|ETIMEDOUT/i.test(evidence)
  );
}

async function controlQuery(sql, timeoutMilliseconds = controlQueryTimeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    const remainingMilliseconds = deadline - Date.now();
    if (remainingMilliseconds <= 0) throw lastError;

    try {
      return await linkedQuery(
        sql,
        Math.min(controlAttemptTimeoutMilliseconds, remainingMilliseconds),
      );
    } catch (error) {
      lastError = error;
      if (!isTransientControlError(error)) throw error;
      await delay(Math.min(attempt * 250, 1_000));
    }
  }

  throw lastError;
}

async function controlQueryRows(sql, timeoutMilliseconds) {
  const { stdout } = await controlQuery(sql, timeoutMilliseconds);
  const result = JSON.parse(stdout.trim());
  return result.rows ?? [];
}

function temporaryDatabaseConfigFromDryRun(stdout, projectRef, executionId) {
  const variables = Object.fromEntries(
    [...stdout.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
  );
  const requiredVariables = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"];
  const missingVariable = requiredVariables.find((name) => !variables[name]);
  if (missingVariable) {
    throw new Error(
      `Supabase CLI did not provide ${missingVariable} for the temporary login role.`,
    );
  }

  const poolerUrl = new URL(readFileSync(poolerUrlFile, "utf8").trim());
  const directHost = `db.${projectRef}.supabase.co`;
  const usesApprovedDirectHost = variables.PGHOST === directHost;
  const usesApprovedPooler =
    variables.PGHOST === poolerUrl.hostname && variables.PGUSER.endsWith(`.${projectRef}`);
  if (!usesApprovedDirectHost && !usesApprovedPooler) {
    throw new Error(
      "The temporary login role does not target the approved DEV direct host or linked pooler.",
    );
  }

  return Object.freeze({
    host: variables.PGHOST,
    port: Number(variables.PGPORT),
    database: variables.PGDATABASE,
    user: variables.PGUSER,
    password: variables.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: connectionTimeoutMilliseconds,
    keepAlive: true,
    applicationNamePrefix: `${runnerApplicationPrefix}${executionId}`,
  });
}

async function createTemporaryDatabaseConfig(projectRef, executionId) {
  const { stdout } = await runSupabase(
    ["db", "dump", "--linked", "--dry-run", "--schema", "public"],
    controlQueryTimeoutMilliseconds,
  );
  return temporaryDatabaseConfigFromDryRun(stdout, projectRef, executionId);
}

async function connectDatabaseClient(config, role) {
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    keepAlive: config.keepAlive,
    application_name: `${config.applicationNamePrefix}-${role}`,
  });
  client.on("error", (error) => {
    client.unexpectedConnectionError = error;
  });
  await client.connect();
  await client.query("set role postgres");
  return client;
}

function randomAdvisoryKey(usedKeys) {
  let key;
  do {
    key = randomBytes(8).readBigInt64BE().toString();
  } while (key === "0" || usedKeys.has(key));
  usedKeys.add(key);
  return key;
}

function trackPromise(label, promise) {
  let settled = false;
  const tracked = promise.finally(() => {
    settled = true;
  });
  void tracked.catch(() => {});
  return { label, promise: tracked, isSettled: () => settled };
}

async function pollForRow(observer, description, sql, values, sessionsThatMustRemainPending = []) {
  const deadline = Date.now() + polling.timeoutMilliseconds;

  while (Date.now() < deadline) {
    const settledSession = sessionsThatMustRemainPending.find((session) => session.isSettled());
    if (settledSession) {
      throw new Error(`${settledSession.label} ended before ${description} was observed.`);
    }

    const result = await observer.query({
      text: sql,
      values,
      query_timeout: Math.min(controlAttemptTimeoutMilliseconds, deadline - Date.now()),
    });
    if (result.rows.length > 0) return result.rows[0];

    await delay(polling.intervalMilliseconds);
  }

  throw new Error(
    `Timed out after ${polling.timeoutMilliseconds} ms waiting for ${description}; the required database state was never observed.`,
  );
}

async function waitForTrackedPromise(tracked, description) {
  let watchdog;
  try {
    await Promise.race([
      tracked.promise.then(
        () => undefined,
        () => undefined,
      ),
      new Promise((_, reject) => {
        watchdog = setTimeout(
          () => reject(new Error(`Cleanup timed out while waiting for ${description}.`)),
          cleanupWatchdogMilliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(watchdog);
  }
}

async function endClient(client, description) {
  if (!client) return;
  let watchdog;
  try {
    await Promise.race([
      client.end(),
      new Promise((_, reject) => {
        watchdog = setTimeout(
          () => reject(new Error(`Cleanup timed out while closing ${description}.`)),
          cleanupWatchdogMilliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(watchdog);
  }
}

const devConfig = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

await runSupabase(["db", "query", "--linked", "--file", schemaTestFile]);

const cancelStaleTestSessionsSql = `
select pg_cancel_backend(activity.pid)
from pg_catalog.pg_stat_activity activity
where activity.pid <> pg_backend_pid()
  and (
    activity.application_name like '${runnerApplicationPrefix}%'
    or activity.query like '%${ids.firstAppointment}%'
    or activity.query like '%${ids.secondAppointment}%'
  );
`;

await controlQuery(cancelStaleTestSessionsSql);
await controlQuery(cleanupSql);

const executionId = randomUUID().replaceAll("-", "").slice(0, 16);
const usedLockKeys = new Set();
const lockKeys = Object.freeze({
  commitGate: randomAdvisoryKey(usedLockKeys),
  firstInserted: randomAdvisoryKey(usedLockKeys),
  secondStarted: randomAdvisoryKey(usedLockKeys),
});

let controller;
let firstClient;
let secondClient;
let observer;
let controllerHasGate = false;
let firstInTransaction = false;
let secondInTransaction = false;
let firstGateWait;
let secondInsert;
let scenarioError;
const cleanupErrors = [];

try {
  const databaseConfig = await createTemporaryDatabaseConfig(devConfig.projectRef, executionId);
  controller = await connectDatabaseClient(databaseConfig, "controller");
  firstClient = await connectDatabaseClient(databaseConfig, "a");
  secondClient = await connectDatabaseClient(databaseConfig, "b");
  observer = await connectDatabaseClient(databaseConfig, "observer");

  await observer.query(setupSql);

  const controllerPid = Number(
    (
      await controller.query(
        "select pg_backend_pid() as pid, pg_advisory_lock($1::bigint) is null as gate_locked",
        [lockKeys.commitGate],
      )
    ).rows[0].pid,
  );
  controllerHasGate = true;

  await firstClient.query("begin");
  firstInTransaction = true;
  const firstPid = Number((await firstClient.query("select pg_backend_pid() as pid")).rows[0].pid);
  await firstClient.query(
    appointmentInsert(ids.firstAppointment, "2027-02-01 09:00+00", "2027-02-01 10:00+00"),
  );
  await firstClient.query("select pg_advisory_xact_lock($1::bigint)", [lockKeys.firstInserted]);
  firstGateWait = trackPromise(
    "Transaction A gate wait",
    firstClient.query("select pg_advisory_xact_lock($1::bigint)", [lockKeys.commitGate]),
  );

  await pollForRow(
    observer,
    "transaction A to remain open behind the controller gate",
    `
select first_activity.pid as first_pid
from pg_catalog.pg_stat_activity first_activity
join pg_catalog.pg_locks first_wait
  on first_wait.pid = first_activity.pid
 and first_wait.locktype = 'advisory'
 and not first_wait.granted
join pg_catalog.pg_locks controller_gate
  on controller_gate.pid = $2
 and controller_gate.locktype = 'advisory'
 and controller_gate.granted
 and controller_gate.database is not distinct from first_wait.database
 and controller_gate.classid is not distinct from first_wait.classid
 and controller_gate.objid is not distinct from first_wait.objid
 and controller_gate.objsubid is not distinct from first_wait.objsubid
where first_activity.pid = $1
  and first_activity.xact_start is not null
  and first_activity.wait_event_type = 'Lock'
  and first_activity.wait_event = 'advisory'
  and $2 = any(pg_blocking_pids(first_activity.pid))
  and exists (
    select 1
    from pg_catalog.pg_locks first_marker
    where first_marker.pid = first_activity.pid
      and first_marker.locktype = 'advisory'
      and first_marker.granted
  );
`,
    [firstPid, controllerPid],
    [firstGateWait],
  );

  await secondClient.query("begin");
  secondInTransaction = true;
  const secondPid = Number(
    (await secondClient.query("select pg_backend_pid() as pid")).rows[0].pid,
  );
  await secondClient.query("select pg_advisory_xact_lock($1::bigint)", [lockKeys.secondStarted]);
  secondInsert = trackPromise(
    "Transaction B INSERT",
    secondClient.query(
      appointmentInsert(ids.secondAppointment, "2027-02-01 09:30+00", "2027-02-01 10:30+00"),
    ),
  );

  await pollForRow(
    observer,
    "transaction B to wait on transaction A while A remains behind the controller gate",
    `
select
  first_activity.pid as first_pid,
  second_activity.pid as second_pid,
  first_activity.wait_event_type as first_wait_event_type,
  first_activity.wait_event as first_wait_event,
  second_activity.wait_event_type as second_wait_event_type,
  second_activity.wait_event as second_wait_event
from pg_catalog.pg_stat_activity first_activity
join pg_catalog.pg_stat_activity second_activity on second_activity.pid = $2
join pg_catalog.pg_locks first_wait
  on first_wait.pid = first_activity.pid
 and first_wait.locktype = 'advisory'
 and not first_wait.granted
join pg_catalog.pg_locks controller_gate
  on controller_gate.pid = $3
 and controller_gate.locktype = 'advisory'
 and controller_gate.granted
 and controller_gate.database is not distinct from first_wait.database
 and controller_gate.classid is not distinct from first_wait.classid
 and controller_gate.objid is not distinct from first_wait.objid
 and controller_gate.objsubid is not distinct from first_wait.objsubid
join pg_catalog.pg_locks second_wait
  on second_wait.pid = second_activity.pid
 and second_wait.locktype = 'transactionid'
 and not second_wait.granted
where first_activity.pid = $1
  and first_activity.xact_start is not null
  and first_activity.wait_event_type = 'Lock'
  and first_activity.wait_event = 'advisory'
  and $3 = any(pg_blocking_pids(first_activity.pid))
  and second_activity.xact_start is not null
  and second_activity.wait_event_type = 'Lock'
  and second_activity.wait_event = 'transactionid'
  and $1 = any(pg_blocking_pids(second_activity.pid))
  and exists (
    select 1
    from pg_catalog.pg_locks first_marker
    where first_marker.pid = first_activity.pid
      and first_marker.locktype = 'advisory'
      and first_marker.granted
  )
  and exists (
    select 1
    from pg_catalog.pg_locks second_marker
    where second_marker.pid = second_activity.pid
      and second_marker.locktype = 'advisory'
      and second_marker.granted
  );
`,
    [firstPid, secondPid, controllerPid],
    [firstGateWait, secondInsert],
  );

  if (firstGateWait.isSettled() || secondInsert.isSettled()) {
    throw new Error("A or B settled before the complete concurrency barrier was observed.");
  }

  console.log(
    `Concurrency barrier observed: A PID ${firstPid} was held behind controller PID ${controllerPid}; B PID ${secondPid} was pending on Lock/transactionid and blocked by A.`,
  );

  const releaseResult = await controller.query(
    "select pg_advisory_unlock($1::bigint) as unlocked",
    [lockKeys.commitGate],
  );
  if (releaseResult.rows[0]?.unlocked !== true) {
    throw new Error("releaseGate() did not release the controller advisory lock.");
  }
  controllerHasGate = false;

  const firstGateResult = await Promise.allSettled([firstGateWait.promise]);
  if (firstGateResult[0].status !== "fulfilled") {
    throw new Error("Transaction A did not continue after releaseGate().");
  }

  await firstClient.query("commit");
  firstInTransaction = false;

  const secondResult = (await Promise.allSettled([secondInsert.promise]))[0];
  if (secondResult.status !== "rejected") {
    throw new Error("Both overlapping concurrency transactions inserted successfully.");
  }
  if (secondResult.reason?.code !== "23P01") {
    throw new Error(
      `Transaction B returned SQLSTATE ${secondResult.reason?.code ?? "unavailable"}; expected exactly 23P01.`,
    );
  }
  if (secondResult.reason.constraint && secondResult.reason.constraint !== expectedConstraint) {
    throw new Error(
      `Transaction B reported constraint ${secondResult.reason.constraint}; expected ${expectedConstraint}.`,
    );
  }

  console.log(`Transaction B rejected with PostgreSQL SQLSTATE ${secondResult.reason.code}.`);

  const persistedAppointments = await observer.query(
    `
select count(*)::integer as appointment_count
from public.appointments
where id in ($1, $2);
`,
    [ids.firstAppointment, ids.secondAppointment],
  );
  if (persistedAppointments.rows[0].appointment_count !== 1) {
    throw new Error("Exactly one concurrent appointment must commit.");
  }
} catch (error) {
  scenarioError = error;
} finally {
  const cleanupStep = async (description, action) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(new Error(`Failed to ${description}.`, { cause: error }));
    }
  };

  if (controller && controllerHasGate) {
    await cleanupStep("release the controller advisory gate", async () => {
      const result = await controller.query("select pg_advisory_unlock($1::bigint) as unlocked", [
        lockKeys.commitGate,
      ]);
      if (result.rows[0]?.unlocked !== true) {
        throw new Error("The controller no longer owned the advisory gate.");
      }
      controllerHasGate = false;
    });
  }

  if (firstGateWait && !firstGateWait.isSettled()) {
    await cleanupStep("wait for transaction A to leave the gate", () =>
      waitForTrackedPromise(firstGateWait, "transaction A to leave the gate"),
    );
  }

  if (firstClient && firstInTransaction) {
    await cleanupStep("roll back transaction A", async () => {
      await firstClient.query("rollback");
      firstInTransaction = false;
    });
  }

  if (secondInsert && !secondInsert.isSettled()) {
    await cleanupStep("wait for transaction B after rolling back A", () =>
      waitForTrackedPromise(secondInsert, "transaction B after rolling back A"),
    );
  }

  if (secondClient && secondInTransaction) {
    await cleanupStep("roll back transaction B", async () => {
      await secondClient.query("rollback");
      secondInTransaction = false;
    });
  }

  if (observer) {
    await cleanupStep("delete concurrency fixtures", () => observer.query(cleanupSql));
  } else {
    await cleanupStep("delete concurrency fixtures through the linked project", () =>
      controlQuery(cleanupSql),
    );
  }

  for (const [description, client] of [
    ["controller connection", controller],
    ["transaction A connection", firstClient],
    ["transaction B connection", secondClient],
    ["observer connection", observer],
  ]) {
    await cleanupStep(`close the ${description}`, () => endClient(client, description));
  }

  await cleanupStep("remove any fixtures left after closing the test connections", () =>
    controlQuery(cleanupSql),
  );

  await cleanupStep("verify final concurrency cleanup", async () => {
    const rows = await controlQueryRows(`
select
  (
    select count(*)::integer
    from public.appointments
    where id in ('${ids.firstAppointment}', '${ids.secondAppointment}')
  ) as fixture_count,
  (
    select count(*)::integer
    from pg_catalog.pg_stat_activity activity
    where activity.pid <> pg_backend_pid()
      and activity.application_name like '${runnerApplicationPrefix}%'
  ) as runner_session_count,
  (
    select count(*)::integer
    from pg_catalog.pg_locks test_lock
    join pg_catalog.pg_stat_activity activity on activity.pid = test_lock.pid
    where test_lock.locktype = 'advisory'
      and activity.application_name like '${runnerApplicationPrefix}%'
  ) as runner_advisory_lock_count;
`);
    const cleanupState = rows[0];
    if (
      !cleanupState ||
      cleanupState.fixture_count !== 0 ||
      cleanupState.runner_session_count !== 0 ||
      cleanupState.runner_advisory_lock_count !== 0
    ) {
      throw new Error(`Residual concurrency state detected: ${JSON.stringify(cleanupState)}.`);
    }
  });
}

if (scenarioError) {
  if (cleanupErrors.length > 0) {
    scenarioError.cleanupErrors = cleanupErrors;
    console.error("Concurrency cleanup also encountered errors:", ...cleanupErrors);
  }
  throw scenarioError;
}

if (cleanupErrors.length > 0) {
  throw new AggregateError(cleanupErrors, "The concurrency scenario passed but cleanup failed.");
}

console.log("Initial schema verification passed, including real concurrent transactions.");
