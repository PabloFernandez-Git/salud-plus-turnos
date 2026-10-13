import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

pg.types.setTypeParser(1184, (value) => value);
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
const output = execFileSync(
  process.execPath,
  [
    resolve("node_modules/supabase/dist/supabase.js"),
    "db",
    "dump",
    "--linked",
    "--dry-run",
    "--schema",
    "public",
  ],
  {
    encoding: "utf8",
    env: { ...process.env, CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
const config = Object.fromEntries(
  [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
);
const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
if (
  config.PGHOST !== `db.${dev.projectRef}.supabase.co` &&
  !(config.PGHOST === pooler.hostname && config.PGUSER?.endsWith(`.${dev.projectRef}`))
)
  throw new Error("Database target is not approved DEV.");
function connect(name) {
  return new pg.Client({
    host: config.PGHOST,
    port: Number(config.PGPORT),
    database: config.PGDATABASE,
    user: config.PGUSER,
    password: config.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    application_name: `task007a-${name}`,
  });
}
function assert(value, message) {
  if (!value) throw new Error(message);
}
const centerId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const control = connect("concurrency-control");
const a = connect("concurrency-a");
const b = connect("concurrency-b");
const ownedPersons = new Set();
const ownedPatientCenters = new Set();
const evidence = [];
let inTransactionA = false;
let bPending = null;
let mainError;
let adminId;
let bPid;

async function actorA() {
  await a.query("begin");
  inTransactionA = true;
  await a.query("set local role authenticated");
  await a.query("select set_config('request.jwt.claim.sub',$1,true)", [adminId]);
  await a.query("set local statement_timeout='15000ms'");
}
async function commitA() {
  await a.query("commit");
  inTransactionA = false;
}
async function waitForBLock(label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await control.query(
      "select wait_event_type from pg_stat_activity where pid=$1",
      [bPid],
    );
    if (result.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`${label}: second real connection did not block on a lock`);
}
function startB(sql, params) {
  bPending = b.query(sql, params).then(
    (result) => ({ ok: true, row: result.rows[0] }),
    (error) => ({ ok: false, code: error.code, message: error.message }),
  );
}
async function finishRace(label, expectedA, expectedB) {
  await waitForBLock(label);
  await commitA();
  const second = await bPending;
  bPending = null;
  assert(expectedB(second), `${label}: unexpected second outcome ${JSON.stringify(second)}`);
  evidence.push({
    race: label,
    first: expectedA,
    second: second.ok ? second.row.outcome : `${second.code}/${second.message}`,
    lock_observed: true,
  });
}
const createSql =
  "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)";
const linkSql = "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)";
const reactivateSql = "select * from public.staff_reactivate_patient_center($1,$2,$3,$4,$5,$6,$7)";
const updateSql = "select * from public.staff_update_patient_center($1,$2,$3,$4,$5,$6,$7)";
const deactivateSql = "select * from public.staff_deactivate_patient_center($1,$2,$3,$4)";
function createArgs(document) {
  return [
    centerId,
    "Concurrency",
    "Fixture",
    "1990-01-01",
    "AR",
    document,
    "123",
    null,
    null,
    null,
  ];
}
function linkArgs(id, document) {
  return [centerId, id, "AR", document, "1990-01-01", "123", null, null, null, true];
}
async function newPerson(document) {
  const id = randomUUID();
  ownedPersons.add(id);
  await control.query(
    "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Concurrency','Fixture','1990-01-01','AR',$2)",
    [id, document],
  );
  return id;
}
async function newPatientCenter(personId, active = true) {
  const id = randomUUID();
  ownedPatientCenters.add(id);
  const row = await control.query(
    "insert into public.patient_centers(id,person_id,center_id,phone,email,insurance_name,administrative_notes,is_active) values($1,$2,$3,'123','fixture@example.test','Coverage','Notes',$4) returning updated_at",
    [id, personId, centerId, active],
  );
  return { id, updated_at: row.rows[0].updated_at };
}
async function captureExactIdentity(document) {
  const result = await control.query(
    "select p.id as person_id,pc.id as patient_center_id from public.persons p left join public.patient_centers pc on pc.person_id=p.id where p.nationality_code='AR' and p.normalized_document=private.normalize_document($1)",
    [document],
  );
  for (const row of result.rows) {
    ownedPersons.add(row.person_id);
    if (row.patient_center_id) ownedPatientCenters.add(row.patient_center_id);
  }
  return result.rows;
}
try {
  await Promise.all([control.connect(), a.connect(), b.connect()]);
  await control.query("set role postgres");
  const admin = await control.query(
    "select user_id from public.center_memberships where center_id=$1 and role='ADMIN' and is_active",
    [centerId],
  );
  assert(admin.rows.length === 1, "approved baseline ADMIN missing");
  adminId = admin.rows[0].user_id;
  await b.query("set role authenticated");
  await b.query("select set_config('request.jwt.claim.sub',$1,false)", [adminId]);
  await b.query("set statement_timeout='15000ms'");
  bPid = (await b.query("select pg_backend_pid() as pid")).rows[0].pid;

  // A commits while B is visibly waiting on the same identity lock.
  const createDocument = `T007A-${randomUUID()}`;
  await actorA();
  const created = (await a.query(createSql, createArgs(createDocument))).rows[0];
  assert(created.outcome === "CREATED", "create/create first outcome");
  ownedPersons.add(created.person_id);
  ownedPatientCenters.add(created.patient_center_id);
  startB(createSql, createArgs(createDocument));
  await finishRace(
    "create/create",
    "CREATED",
    (v) => !v.ok && v.code === "P0001" && v.message === "PATIENT_IDENTITY_ALREADY_EXISTS",
  );
  assert(
    (await captureExactIdentity(createDocument)).length === 1,
    "create/create duplicate or partial state",
  );

  const createLinkDocument = `T007A-${randomUUID()}`;
  await actorA();
  const createLink = (await a.query(createSql, createArgs(createLinkDocument))).rows[0];
  assert(createLink.outcome === "CREATED", "create/link first outcome");
  ownedPersons.add(createLink.person_id);
  ownedPatientCenters.add(createLink.patient_center_id);
  startB(linkSql, linkArgs(createLink.person_id, createLinkDocument));
  await finishRace(
    "create/link",
    "CREATED",
    (v) =>
      v.ok &&
      v.row.outcome === "ALREADY_ACTIVE" &&
      v.row.patient_center_id === createLink.patient_center_id,
  );
  assert(
    (await captureExactIdentity(createLinkDocument)).length === 1,
    "create/link duplicate or partial state",
  );

  const linkDocument = `T007A-${randomUUID()}`;
  const linkPersonId = await newPerson(linkDocument);
  await actorA();
  const linked = (await a.query(linkSql, linkArgs(linkPersonId, linkDocument))).rows[0];
  assert(linked.outcome === "LINKED", "link/link first outcome");
  ownedPatientCenters.add(linked.patient_center_id);
  startB(linkSql, linkArgs(linkPersonId, linkDocument));
  await finishRace(
    "link/link",
    "LINKED",
    (v) =>
      v.ok &&
      v.row.outcome === "ALREADY_ACTIVE" &&
      v.row.patient_center_id === linked.patient_center_id,
  );
  assert(
    (await captureExactIdentity(linkDocument)).length === 1,
    "link/link duplicate or partial state",
  );

  const stateDocument = `T007A-${randomUUID()}`;
  const statePersonId = await newPerson(stateDocument);
  const statePc = await newPatientCenter(statePersonId, false);
  const reactivateArgs = [
    centerId,
    statePc.id,
    "AR",
    stateDocument,
    "1990-01-01",
    statePc.updated_at,
    true,
  ];
  await actorA();
  const reactivated = (await a.query(reactivateSql, reactivateArgs)).rows[0];
  assert(
    reactivated.outcome === "REACTIVATED" && reactivated.updated_at > statePc.updated_at,
    "reactivate first monotonic outcome",
  );
  startB(reactivateSql, reactivateArgs);
  await finishRace(
    "reactivate/reactivate",
    "REACTIVATED",
    (v) => !v.ok && v.code === "P0001" && v.message === "STALE_PATIENT_CENTER_STATE",
  );
  const preserved = (
    await control.query(
      "select phone,email,insurance_name,administrative_notes from public.patient_centers where id=$1",
      [statePc.id],
    )
  ).rows[0];
  assert(
    preserved.phone === "123" &&
      preserved.email === "fixture@example.test" &&
      preserved.insurance_name === "Coverage" &&
      preserved.administrative_notes === "Notes",
    "reactivate changed tenant fields",
  );

  const updateArgs = [
    centerId,
    statePc.id,
    reactivated.updated_at,
    "456",
    "fixture@example.test",
    "Coverage",
    "Notes",
  ];
  await actorA();
  const updated = (await a.query(updateSql, updateArgs)).rows[0];
  assert(
    updated.outcome === "UPDATED" && updated.updated_at > reactivated.updated_at,
    "update first monotonic outcome",
  );
  startB(updateSql, [
    centerId,
    statePc.id,
    reactivated.updated_at,
    "789",
    "fixture@example.test",
    "Coverage",
    "Notes",
  ]);
  await finishRace(
    "update/update",
    "UPDATED",
    (v) => !v.ok && v.code === "P0001" && v.message === "STALE_PATIENT_CENTER_STATE",
  );
  assert(
    (await control.query("select phone from public.patient_centers where id=$1", [statePc.id]))
      .rows[0].phone === "456",
    "update loser mutated state",
  );

  const deactivateArgs = [centerId, statePc.id, updated.updated_at, true];
  await actorA();
  const deactivated = (await a.query(deactivateSql, deactivateArgs)).rows[0];
  assert(
    deactivated.outcome === "DEACTIVATED" && deactivated.updated_at > updated.updated_at,
    "state first monotonic outcome",
  );
  startB(deactivateSql, deactivateArgs);
  await finishRace(
    "state/state",
    "DEACTIVATED",
    (v) => !v.ok && v.code === "P0001" && v.message === "STALE_PATIENT_CENTER_STATE",
  );
  assert(
    (await control.query("select is_active from public.patient_centers where id=$1", [statePc.id]))
      .rows[0].is_active === false,
    "state loser mutated state",
  );
} catch (error) {
  mainError = error;
} finally {
  if (inTransactionA) await a.query("rollback").catch(() => {});
  if (bPending) await bPending.catch(() => {});
  try {
    // Inventory exact captured UUIDs and reject cleanup when another relation references them.
    const pcIds = [...ownedPatientCenters];
    const personIds = [...ownedPersons];
    if (pcIds.length || personIds.length) {
      const others = await control.query(
        "select count(*)::int as n from public.appointments where patient_center_id=any($1::uuid[])",
        [pcIds],
      );
      assert(others.rows[0].n === 0, "cleanup blocked: fixture has appointments");
      const edges = await control.query(
        "select id,person_id,center_id from public.patient_centers where person_id=any($1::uuid[])",
        [personIds],
      );
      assert(
        edges.rows.every((row) => ownedPatientCenters.has(row.id) && row.center_id === centerId),
        "cleanup blocked: foreign PatientCenter edge",
      );
      await control.query("begin");
      for (const id of pcIds)
        await control.query("delete from public.patient_centers where id=$1 and center_id=$2", [
          id,
          centerId,
        ]);
      for (const id of personIds)
        await control.query("delete from public.persons where id=$1", [id]);
      await control.query("commit");
      assert(
        (
          await control.query(
            "select count(*)::int as n from public.persons where id=any($1::uuid[])",
            [personIds],
          )
        ).rows[0].n === 0,
        "cleanup left Person fixture",
      );
    }
  } catch (cleanupError) {
    await control.query("rollback").catch(() => {});
    if (mainError)
      mainError = new AggregateError([mainError, cleanupError], "Race and cleanup failure");
    else mainError = cleanupError;
  }
  await Promise.allSettled([control.end(), a.end(), b.end()]);
}
if (mainError) throw mainError;
console.log(
  JSON.stringify(
    {
      dev_project_ref: dev.projectRef,
      races: evidence,
      cleaned_person_ids: ownedPersons.size,
      cleaned_patient_center_ids: ownedPatientCenters.size,
      verdict: "PASS",
    },
    null,
    2,
  ),
);
