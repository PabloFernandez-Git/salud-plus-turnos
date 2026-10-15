import { randomUUID } from "node:crypto";
import pg from "pg";
import { completeIntegration } from "./integration-state.mjs";
import {
  addOwned,
  assert,
  asActor,
  databaseConfig,
  devClients,
  openDatabase,
  readLedger,
  ledgerPath,
} from "./fixture-core.mjs";

pg.types.setTypeParser(1184, (value) => value);
const { dev } = devClients();
const ledger = readLedger();
assert(ledger.stage === "fixtures_ready", `Expected fixtures_ready, got ${ledger.stage}`);
const ids = ledger.ids;
const actors = Object.fromEntries(
  Object.entries(ledger.actors).map(([name, user]) => [name, user.id]),
);
const createSql =
  "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)";
const linkSql = "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)";
const resolveSql = "select * from public.staff_resolve_patient_identity($1,$2,$3,$4)";
const searchSql = "select * from public.staff_search_patient_centers($1,$2,$3,$4,$5)";
const reactivateSql = "select * from public.staff_reactivate_patient_center($1,$2,$3,$4,$5,$6,$7)";
const updateSql = "select * from public.staff_update_patient_center($1,$2,$3,$4,$5,$6,$7)";
const deactivateSql = "select * from public.staff_deactivate_patient_center($1,$2,$3,$4)";
const doc = (name) => `${name}-${ledger.runId}`;
const createArgs = (document) => [
  ids.centerA,
  "Integration",
  "Fixture",
  "1990-01-01",
  "AR",
  document,
  "A-555",
  "a-test@example.test",
  "A insurance",
  "A notes",
];
const linkArgs = (center, personId, document, phone = "B-555") => [
  center,
  personId,
  "AR",
  document,
  "1990-01-01",
  phone,
  "b-test@example.test",
  "B insurance",
  "B notes",
  true,
];
let control;
let a;
let b;
let aTransaction = false;
let bPending;
const evidence = [];

async function expectFailure(label, work, code, message) {
  try {
    await work();
  } catch (error) {
    assert(
      error.code === code && (!message || error.message === message),
      `${label}: ${error.code}/${error.message}`,
    );
    evidence.push({ label, outcome: `${code}/${message}` });
    return;
  }
  throw new Error(`${label}: unexpectedly succeeded`);
}

async function raceA() {
  await a.query("begin");
  aTransaction = true;
  await a.query("set local role authenticated");
  await a.query("select set_config('request.jwt.claim.sub',$1,true)", [actors.adminA]);
  await a.query("set local statement_timeout='15000ms'");
}

async function race(label, sql, args, expected) {
  const pid = (await b.query("select pg_backend_pid() as pid")).rows[0].pid;
  bPending = b.query(sql, args).then(
    (result) => ({ ok: true, row: result.rows[0] }),
    (error) => ({ ok: false, code: error.code, message: error.message }),
  );
  let blocked = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await control.query("select wait_event_type from pg_stat_activity where pid=$1", [
      pid,
    ]);
    if (state.rows[0]?.wait_event_type === "Lock") {
      blocked = true;
      break;
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  assert(blocked, `${label}: second connection did not wait on a lock`);
  await a.query("commit");
  aTransaction = false;
  const second = await bPending;
  bPending = null;
  assert(expected(second), `${label}: second outcome ${JSON.stringify(second)}`);
  evidence.push({
    label,
    lockObserved: true,
    second: second.ok ? second.row.outcome : `${second.code}/${second.message}`,
  });
}

async function run() {
  control = await openDatabase(dev, "integration-control");
  const config = databaseConfig(dev);
  a = new pg.Client({ ...config, application_name: "task007d-integration-a" });
  b = new pg.Client({ ...config, application_name: "task007d-integration-b" });
  await Promise.all([a.connect(), b.connect()]);
  await b.query("set role authenticated");
  await b.query("select set_config('request.jwt.claim.sub',$1,false)", [actors.adminA]);
  await b.query("set statement_timeout='15000ms'");

  for (const [name, actorId, centerId, allowed] of [
    ["ADMIN", actors.adminA, ids.centerA, true],
    ["RECEPTION", actors.receptionA, ids.centerA, true],
    ["PROFESSIONAL", actors.professionalA, ids.centerA, false],
    ["PLATFORM_ADMIN_ONLY", actors.platformOnly, ids.centerA, false],
    ["INACTIVE_MEMBERSHIP", actors.inactiveA, ids.centerA, false],
    ["INACTIVE_CENTER", actors.adminA, ids.centerInactive, false],
    ["CROSS_CENTER", actors.adminA, ids.centerB, false],
  ]) {
    if (allowed) {
      const rows = await asActor(control, actorId, () =>
        control.query(searchSql, [centerId, null, "ALL", 25, 0]),
      );
      assert(Array.isArray(rows.rows), `${name} search failed`);
    } else {
      await expectFailure(
        name,
        () =>
          asActor(control, actorId, () => control.query(searchSql, [centerId, null, "ALL", 25, 0])),
        "42501",
        "PATIENT_ACCESS_DENIED",
      );
    }
  }
  await control.query("begin");
  try {
    await control.query("set local role anon");
    await expectFailure(
      "ANON",
      () => control.query(searchSql, [ids.centerA, null, "ALL", 25, 0]),
      "42501",
      null,
    );
  } finally {
    await control.query("rollback");
  }
  const visibleA = await asActor(control, actors.receptionA, () =>
    control.query("select id from public.patient_centers"),
  );
  assert(
    visibleA.rows.every((row) => row.id === ids.privacyPatientA || row.id === ids.racePatientA),
    "RLS leaked cross-center PatientCenter",
  );
  const hiddenProfessional = await asActor(control, actors.professionalA, () =>
    control.query("select id from public.patient_centers"),
  );
  assert(hiddenProfessional.rowCount === 0, "Professional RLS must hide PatientCenters");

  const privacyDocument = doc("PRIV");
  const beforeB = await asActor(control, actors.adminB, () =>
    control.query(searchSql, [ids.centerB, privacyDocument, "ALL", 25, 0]),
  );
  assert(beforeB.rowCount === 0, "Center B tenant search saw unlinked Person");
  const personRowsBeforeB = await asActor(control, actors.adminB, () =>
    control.query("select id from public.persons"),
  );
  assert(personRowsBeforeB.rowCount === 0, "Center B RLS exposed an unlinked Person");
  const mismatch = (
    await asActor(control, actors.adminB, () =>
      control.query(resolveSql, [ids.centerB, "AR", privacyDocument, "1991-01-01"]),
    )
  ).rows[0];
  assert(
    mismatch.identity_status === "FOUND" &&
      mismatch.birth_date_matches === false &&
      mismatch.person_id === null &&
      mismatch.patient_center_id === null,
    "DOB mismatch leaked identity ID",
  );
  await expectFailure(
    "DOB_MISMATCH_LINK",
    () =>
      asActor(control, actors.adminB, () =>
        control.query(linkSql, [
          ids.centerB,
          ids.privacyPerson,
          "AR",
          privacyDocument,
          "1991-01-01",
          "B-555",
          null,
          null,
          null,
          true,
        ]),
      ),
    "P0001",
    "PATIENT_BIRTH_DATE_MISMATCH",
  );
  const exact = (
    await asActor(control, actors.adminB, () =>
      control.query(resolveSql, [ids.centerB, "AR", privacyDocument, "1990-01-01"]),
    )
  ).rows[0];
  assert(
    exact.identity_status === "FOUND" &&
      exact.relationship_state === "NOT_LINKED" &&
      exact.birth_date_matches === true,
    "Center B exact resolve state",
  );
  assert(
    !Object.keys(exact).some((key) =>
      [
        "phone",
        "email",
        "insurance_name",
        "administrative_notes",
        "center_id",
        "birth_date",
      ].includes(key),
    ),
    "Resolve exposed foreign data",
  );
  const linkedB = (
    await asActor(control, actors.adminB, () =>
      control.query(linkSql, linkArgs(ids.centerB, ids.privacyPerson, privacyDocument)),
    )
  ).rows[0];
  assert(linkedB.outcome === "LINKED", "Center B explicit link failed");
  addOwned(ledger, "patientCenters", linkedB.patient_center_id);
  const privacyRows = (
    await control.query(
      "select id,center_id,phone,email,insurance_name,administrative_notes from public.patient_centers where id=any($1::uuid[]) order by center_id",
      [[ids.privacyPatientA, linkedB.patient_center_id]],
    )
  ).rows;
  const rowA = privacyRows.find((row) => row.id === ids.privacyPatientA);
  const rowB = privacyRows.find((row) => row.id === linkedB.patient_center_id);
  assert(
    rowA?.phone === "A-111" &&
      rowA.email === "a-private@example.test" &&
      rowA.insurance_name === "A coverage" &&
      rowA.administrative_notes === "A-only notes",
    "Center A data changed",
  );
  assert(
    rowB?.phone === "B-555" &&
      rowB.email === "b-test@example.test" &&
      rowB.insurance_name === "B insurance" &&
      rowB.administrative_notes === "B notes",
    "Center B did not own its admin data",
  );
  const afterB = await asActor(control, actors.adminB, () =>
    control.query(searchSql, [ids.centerB, privacyDocument, "ALL", 25, 0]),
  );
  assert(
    afterB.rows.some((row) => row.patient_center_id === linkedB.patient_center_id),
    "Center B cannot search own linked PatientCenter",
  );
  assert(
    afterB.rows.every(
      (row) =>
        row.patient_center_id !== ids.privacyPatientA &&
        row.phone !== "A-111" &&
        row.email !== "a-private@example.test",
    ),
    "Center B search exposed Center A administrative data",
  );
  const reused = (
    await asActor(control, actors.adminB, () =>
      control.query(
        linkSql,
        linkArgs(ids.centerB, ids.privacyPerson, privacyDocument, "OVERWRITE"),
      ),
    )
  ).rows[0];
  assert(
    reused.outcome === "ALREADY_ACTIVE" && reused.patient_center_id === linkedB.patient_center_id,
    "ACTIVE reuse outcome",
  );
  assert(
    (
      await control.query("select phone from public.patient_centers where id=$1", [
        linkedB.patient_center_id,
      ])
    ).rows[0].phone === "B-555",
    "ACTIVE reuse overwrote data",
  );
  evidence.push({ label: "multi-center privacy, DOB mismatch, ACTIVE reuse", outcome: "PASS" });

  await raceA();
  const raceCreateDoc = doc("CREATE-RACE");
  const created = (await a.query(createSql, createArgs(raceCreateDoc))).rows[0];
  assert(created.outcome === "CREATED", "create/create first create");
  addOwned(ledger, "persons", created.person_id);
  addOwned(ledger, "patientCenters", created.patient_center_id);
  await race(
    "create/create",
    createSql,
    createArgs(raceCreateDoc),
    (result) =>
      !result.ok && result.code === "P0001" && result.message === "PATIENT_IDENTITY_ALREADY_EXISTS",
  );

  await raceA();
  const raceCreateLinkDoc = doc("CREATE-LINK-RACE");
  const createdLink = (await a.query(createSql, createArgs(raceCreateLinkDoc))).rows[0];
  assert(createdLink.outcome === "CREATED", "create/link first create");
  addOwned(ledger, "persons", createdLink.person_id);
  addOwned(ledger, "patientCenters", createdLink.patient_center_id);
  await race(
    "create/link",
    linkSql,
    linkArgs(ids.centerA, createdLink.person_id, raceCreateLinkDoc),
    (result) =>
      result.ok &&
      result.row.outcome === "ALREADY_ACTIVE" &&
      result.row.patient_center_id === createdLink.patient_center_id,
  );

  const raceLinkPerson = randomUUID();
  addOwned(ledger, "persons", raceLinkPerson);
  const raceLinkDoc = doc("LINK-RACE");
  await control.query(
    "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Race','Link','1990-01-01','AR',$2)",
    [raceLinkPerson, raceLinkDoc],
  );
  await raceA();
  const linked = (await a.query(linkSql, linkArgs(ids.centerA, raceLinkPerson, raceLinkDoc)))
    .rows[0];
  assert(linked.outcome === "LINKED", "link/link first link");
  addOwned(ledger, "patientCenters", linked.patient_center_id);
  await race(
    "link/link",
    linkSql,
    linkArgs(ids.centerA, raceLinkPerson, raceLinkDoc),
    (result) =>
      result.ok &&
      result.row.outcome === "ALREADY_ACTIVE" &&
      result.row.patient_center_id === linked.patient_center_id,
  );

  const stateInitial = (
    await control.query("select updated_at from public.patient_centers where id=$1", [
      ids.racePatientA,
    ])
  ).rows[0].updated_at;
  const reactivateArgs = [
    ids.centerA,
    ids.racePatientA,
    "AR",
    doc("RACE"),
    "1990-01-01",
    stateInitial,
    true,
  ];
  await raceA();
  const active = (await a.query(reactivateSql, reactivateArgs)).rows[0];
  assert(active.outcome === "REACTIVATED", "reactivate/reactivate first outcome");
  await race(
    "reactivate/reactivate",
    reactivateSql,
    reactivateArgs,
    (result) =>
      !result.ok && result.code === "P0001" && result.message === "STALE_PATIENT_CENTER_STATE",
  );
  const alreadyActive = (
    await asActor(control, actors.receptionA, () =>
      control.query(reactivateSql, [
        ids.centerA,
        ids.racePatientA,
        "AR",
        doc("RACE"),
        "1990-01-01",
        active.updated_at,
        true,
      ]),
    )
  ).rows[0];
  assert(alreadyActive.outcome === "ALREADY_ACTIVE", "reactivate no-op outcome");
  const noOp = (
    await asActor(control, actors.receptionA, () =>
      control.query(updateSql, [
        ids.centerA,
        ids.racePatientA,
        active.updated_at,
        "R-111",
        "race@example.test",
        "Race coverage",
        "Race notes",
      ]),
    )
  ).rows[0];
  assert(noOp.outcome === "UNCHANGED", "update no-op outcome");
  const updated = (
    await asActor(control, actors.receptionA, () =>
      control.query(updateSql, [
        ids.centerA,
        ids.racePatientA,
        active.updated_at,
        "R-222",
        "changed@example.test",
        "Changed coverage",
        "Changed notes",
      ]),
    )
  ).rows[0];
  assert(updated.outcome === "UPDATED", "edit outcome");
  await expectFailure(
    "EDIT_STALE",
    () =>
      asActor(control, actors.receptionA, () =>
        control.query(updateSql, [
          ids.centerA,
          ids.racePatientA,
          active.updated_at,
          "OVERWRITE",
          null,
          null,
          null,
        ]),
      ),
    "P0001",
    "STALE_PATIENT_CENTER_STATE",
  );
  await expectFailure(
    "DEACTIVATE_STALE",
    () =>
      asActor(control, actors.receptionA, () =>
        control.query(deactivateSql, [ids.centerA, ids.racePatientA, active.updated_at, true]),
      ),
    "P0001",
    "STALE_PATIENT_CENTER_STATE",
  );
  const inactive = (
    await asActor(control, actors.receptionA, () =>
      control.query(deactivateSql, [ids.centerA, ids.racePatientA, updated.updated_at, true]),
    )
  ).rows[0];
  assert(inactive.outcome === "DEACTIVATED", "deactivate outcome");
  const alreadyInactive = (
    await asActor(control, actors.receptionA, () =>
      control.query(deactivateSql, [ids.centerA, ids.racePatientA, inactive.updated_at, true]),
    )
  ).rows[0];
  assert(alreadyInactive.outcome === "UNCHANGED", "deactivate no-op outcome");
  await expectFailure(
    "REACTIVATE_STALE",
    () =>
      asActor(control, actors.receptionA, () =>
        control.query(reactivateSql, [
          ids.centerA,
          ids.racePatientA,
          "AR",
          doc("RACE"),
          "1990-01-01",
          updated.updated_at,
          true,
        ]),
      ),
    "P0001",
    "STALE_PATIENT_CENTER_STATE",
  );
  const preserved = (
    await control.query(
      "select phone,email,insurance_name,administrative_notes from public.patient_centers where id=$1",
      [ids.racePatientA],
    )
  ).rows[0];
  assert(
    preserved.phone === "R-222" &&
      preserved.email === "changed@example.test" &&
      preserved.insurance_name === "Changed coverage" &&
      preserved.administrative_notes === "Changed notes",
    "State change lost administrative data",
  );
  evidence.push({ label: "CAS stale, no-op, tenant data preservation", outcome: "PASS" });

  completeIntegration(ledger, evidence);
  console.log(
    JSON.stringify(
      {
        gate: "TASK-007D DB integration",
        verdict: "PASS",
        scenarios: evidence,
        ledger: ledgerPath,
      },
      null,
      2,
    ),
  );
}

try {
  await run();
} finally {
  if (aTransaction) await a?.query("rollback").catch(() => undefined);
  if (bPending) await bPending.catch(() => undefined);
  await Promise.allSettled([control?.end(), a?.end(), b?.end()]);
}
