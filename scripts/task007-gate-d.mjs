import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditClean } from "./task007-gate-d/audit-clean.mjs";
import {
  addOwned,
  assert,
  devClients,
  expectedDigest,
  inventory,
  ledgerDigest,
  ledgerPath,
  newLedger,
  openDatabase,
  readLedger,
  saveLedger,
} from "./task007-gate-d/fixture-core.mjs";

const mode = process.argv[2];
assert(
  ["setup", "audit", "audit-clean", "capture-smoke", "capture-smoke-link", "cleanup"].includes(
    mode,
  ),
  "Usage: node scripts/task007-gate-d.mjs setup|audit|audit-clean|capture-smoke UUID|capture-smoke-link UUID|cleanup",
);
const { dev, authAdmin } = devClients();
let database;

function evidence(ledger, event, data = {}) {
  ledger.evidence.push({ at: new Date().toISOString(), event, ...data });
  saveLedger(ledger);
}

async function assertPlannedIdsAbsent(database, ledger) {
  const checks = [
    ["public.centers", [ledger.ids.centerA, ledger.ids.centerB, ledger.ids.centerInactive]],
    [
      "public.center_memberships",
      Object.entries(ledger.ids)
        .filter(([k]) => k.startsWith("membership"))
        .map(([, v]) => v),
    ],
    ["public.professionals", [ledger.ids.professional]],
    ["public.professional_centers", [ledger.ids.professionalCenter]],
    [
      "public.persons",
      [
        ledger.ids.privacyPerson,
        ledger.ids.unlinkedPerson,
        ledger.ids.manualUnlinkedPerson,
        ledger.ids.racePerson,
      ],
    ],
    ["public.patient_centers", [ledger.ids.privacyPatientA, ledger.ids.racePatientA]],
  ];
  for (const [table, ids] of checks) {
    const found = await database.query(`select id from ${table} where id=any($1::uuid[])`, [ids]);
    assert(found.rowCount === 0, `Planned UUID already exists in ${table}`);
  }
  for (const actor of Object.values(ledger.actors)) {
    const found = await database.query("select id from auth.users where email=$1", [actor.email]);
    assert(found.rowCount === 0, "Planned exact Auth email already exists");
  }
}

async function setup() {
  assert(
    !existsSync(ledgerPath),
    `Ledger already exists: ${ledgerPath}; inspect it before another run`,
  );
  database = await openDatabase(dev, "setup");
  const before = await inventory(database);
  assert(before["public.persons"].length === 0, "DEV Persons changed since approved preflight");
  assert(
    before["public.patient_centers"].length === 0,
    "DEV PatientCenters changed since approved preflight",
  );
  const verifierHash = createHash("sha256")
    .update(readFileSync(resolve("scripts/verify-task007a-baseline-v2.mjs")))
    .digest("hex");
  assert(
    verifierHash === "f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c",
    "V2 verifier changed",
  );
  const ledger = newLedger(dev.projectRef, before);
  await assertPlannedIdsAbsent(database, ledger);
  saveLedger(ledger); // Ownership reservation exists before the first DEV write.
  console.log(
    JSON.stringify({
      gate: "TASK-007D",
      stage: "ownership_planned",
      ledger: ledgerPath,
      runId: ledger.runId,
      counts: Object.fromEntries(Object.entries(before).map(([key, ids]) => [key, ids.length])),
    }),
  );

  ledger.stage = "creating";
  saveLedger(ledger);
  for (const [name, actor] of Object.entries(ledger.actors)) {
    const { data, error } = await authAdmin.auth.admin.createUser({
      email: actor.email,
      password: ledger.password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error(`Auth fixture creation failed for ${name}`, { cause: error });
    actor.id = data.user.id;
    addOwned(ledger, "authUsers", actor.id);
  }

  await database.query("begin");
  try {
    for (const [name, actor] of Object.entries(ledger.actors)) {
      await database.query(
        "insert into public.users(id,email,first_name,last_name) values($1,$2,$3,'Fixture')",
        [actor.id, actor.email, name],
      );
    }
    await database.query(
      "insert into public.centers(id,name,is_active) values($1,$2,true),($3,$4,true),($5,$6,false)",
      [
        ledger.ids.centerA,
        `TASK-007D A ${ledger.runId}`,
        ledger.ids.centerB,
        `TASK-007D B ${ledger.runId}`,
        ledger.ids.centerInactive,
        `TASK-007D inactive ${ledger.runId}`,
      ],
    );
    await database.query(
      "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'Task','Fixture','AR',$2,$3)",
      [ledger.ids.professional, `P-${ledger.runId}`, `professional-${ledger.runId}@example.test`],
    );
    await database.query(
      "insert into public.professional_centers(id,professional_id,center_id) values($1,$2,$3)",
      [ledger.ids.professionalCenter, ledger.ids.professional, ledger.ids.centerA],
    );
    const membershipRows = [
      [
        ledger.ids.membershipAdminA,
        ledger.ids.centerA,
        ledger.actors.adminA.id,
        "ADMIN",
        null,
        true,
      ],
      [
        ledger.ids.membershipReceptionA,
        ledger.ids.centerA,
        ledger.actors.receptionA.id,
        "RECEPTION",
        null,
        true,
      ],
      [
        ledger.ids.membershipAdminB,
        ledger.ids.centerB,
        ledger.actors.adminB.id,
        "ADMIN",
        null,
        true,
      ],
      [
        ledger.ids.membershipProfessionalA,
        ledger.ids.centerA,
        ledger.actors.professionalA.id,
        "PROFESSIONAL",
        ledger.ids.professionalCenter,
        true,
      ],
      [
        ledger.ids.membershipInactiveA,
        ledger.ids.centerA,
        ledger.actors.inactiveA.id,
        "RECEPTION",
        null,
        false,
      ],
      [
        ledger.ids.membershipInactiveCenter,
        ledger.ids.centerInactive,
        ledger.actors.adminA.id,
        "ADMIN",
        null,
        true,
      ],
    ];
    for (const row of membershipRows)
      await database.query(
        "insert into public.center_memberships(id,center_id,user_id,role,professional_center_id,is_active) values($1,$2,$3,$4,$5,$6)",
        row,
      );
    await database.query("insert into public.platform_admins(user_id) values($1)", [
      ledger.actors.platformOnly.id,
    ]);
    const personRows = [
      [ledger.ids.privacyPerson, "Private", "Fixture", `PRIV-${ledger.runId}`],
      [ledger.ids.unlinkedPerson, "Unlinked", "Fixture", `UNLINK-${ledger.runId}`],
      [
        ledger.ids.manualUnlinkedPerson,
        "Manual",
        "Fixture",
        ledger.generated.manualUnlinkedDocument,
      ],
      [ledger.ids.racePerson, "Race", "Fixture", `RACE-${ledger.runId}`],
    ];
    for (const row of personRows)
      await database.query(
        "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,$2,$3,'1990-01-01','AR',$4)",
        row,
      );
    await database.query(
      "insert into public.patient_centers(id,person_id,center_id,phone,email,insurance_name,administrative_notes,is_active) values($1,$2,$3,'A-111','a-private@example.test','A coverage','A-only notes',true),($4,$5,$6,'R-111','race@example.test','Race coverage','Race notes',false)",
      [
        ledger.ids.privacyPatientA,
        ledger.ids.privacyPerson,
        ledger.ids.centerA,
        ledger.ids.racePatientA,
        ledger.ids.racePerson,
        ledger.ids.centerA,
      ],
    );
    await database.query("commit");
  } catch (error) {
    await database.query("rollback").catch(() => undefined);
    throw error;
  }
  ledger.owned.publicUsers = Object.values(ledger.actors).map((actor) => actor.id);
  ledger.owned.centers = [ledger.ids.centerA, ledger.ids.centerB, ledger.ids.centerInactive];
  ledger.owned.memberships = Object.entries(ledger.ids)
    .filter(([key]) => key.startsWith("membership"))
    .map(([, id]) => id);
  ledger.owned.professionals = [ledger.ids.professional];
  ledger.owned.professionalCenters = [ledger.ids.professionalCenter];
  ledger.owned.platformAdmins = [ledger.actors.platformOnly.id];
  ledger.owned.persons = [
    ledger.ids.privacyPerson,
    ledger.ids.unlinkedPerson,
    ledger.ids.manualUnlinkedPerson,
    ledger.ids.racePerson,
  ];
  ledger.owned.patientCenters = [ledger.ids.privacyPatientA, ledger.ids.racePatientA];
  ledger.stage = "fixtures_ready";
  evidence(ledger, "fixture_setup_pass");
  console.log(
    JSON.stringify({
      gate: "TASK-007D",
      stage: ledger.stage,
      ledger: ledgerPath,
      actors: Object.fromEntries(
        Object.entries(ledger.actors).map(([name, actor]) => [name, actor.email]),
      ),
      centerA: ledger.ids.centerA,
      centerB: ledger.ids.centerB,
    }),
  );
}

async function audit(database, ledger) {
  const owned = ledger.owned;
  const centerIds = owned.centers;
  const personIds = owned.persons;
  const pcIds = owned.patientCenters;
  assert(
    centerIds.length === 3 && personIds.length >= 3 && pcIds.length >= 2,
    "Incomplete ownership ledger",
  );
  const required = [
    ["public.centers", "id", centerIds],
    ["public.center_memberships", "id", owned.memberships],
    ["public.professionals", "id", owned.professionals],
    ["public.professional_centers", "id", owned.professionalCenters],
    ["public.users", "id", owned.publicUsers],
    ["auth.users", "id", owned.authUsers],
    ["public.platform_admins", "user_id", owned.platformAdmins],
    ["public.persons", "id", personIds],
    ["public.patient_centers", "id", pcIds],
  ];
  for (const [table, column, ids] of required) {
    const rows = await database.query(
      `select ${column} from ${table} where ${column}=any($1::uuid[])`,
      [ids],
    );
    assert(rows.rowCount === ids.length, `Ownership mismatch: ${table}`);
  }
  for (const [table, column, expected] of [
    ["public.center_memberships", "center_id", owned.memberships],
    ["public.patient_centers", "center_id", pcIds],
    ["public.professional_centers", "center_id", owned.professionalCenters],
  ]) {
    const rows = await database.query(`select id from ${table} where ${column}=any($1::uuid[])`, [
      centerIds,
    ]);
    assert(
      rows.rows.every((row) => expected.includes(row.id)) && rows.rowCount === expected.length,
      `Foreign/unknown relation under owned Center: ${table}`,
    );
  }
  const pEdges = await database.query(
    "select id,person_id,center_id from public.patient_centers where person_id=any($1::uuid[])",
    [personIds],
  );
  assert(
    pEdges.rows.every((row) => pcIds.includes(row.id) && centerIds.includes(row.center_id)),
    "Person has foreign PatientCenter edge",
  );
  const pcRows = await database.query(
    "select id,person_id,center_id from public.patient_centers where id=any($1::uuid[])",
    [pcIds],
  );
  assert(
    pcRows.rows.every(
      (row) => personIds.includes(row.person_id) && centerIds.includes(row.center_id),
    ),
    "PatientCenter points outside owned graph",
  );
  const memberships = await database.query(
    "select id,user_id,center_id from public.center_memberships where user_id=any($1::uuid[])",
    [owned.authUsers],
  );
  assert(
    memberships.rows.every(
      (row) => owned.memberships.includes(row.id) && centerIds.includes(row.center_id),
    ),
    "Fixture actor has foreign membership",
  );
  const professionalEdges = await database.query(
    "select id,center_id from public.professional_centers where professional_id=any($1::uuid[])",
    [owned.professionals],
  );
  assert(
    professionalEdges.rows.every(
      (row) => owned.professionalCenters.includes(row.id) && centerIds.includes(row.center_id),
    ),
    "Fixture Professional has a foreign Center relation",
  );
  const platformEdges = await database.query(
    "select user_id from public.platform_admins where user_id=any($1::uuid[])",
    [owned.authUsers],
  );
  assert(
    platformEdges.rows.every((row) => owned.platformAdmins.includes(row.user_id)) &&
      platformEdges.rowCount === owned.platformAdmins.length,
    "Fixture actor has an unexpected Platform Admin relation",
  );
  const publicUsers = await database.query(
    "select id,email from public.users where id=any($1::uuid[])",
    [owned.publicUsers],
  );
  assert(
    publicUsers.rows.every((row) =>
      Object.values(ledger.actors).some(
        (actor) => actor.id === row.id && actor.email === row.email,
      ),
    ),
    "Public User fixture identity changed",
  );
  const authRows = await database.query(
    "select id,email from auth.users where id=any($1::uuid[])",
    [owned.authUsers],
  );
  assert(
    authRows.rows.every((row) =>
      Object.values(ledger.actors).some(
        (actor) => actor.id === row.id && actor.email === row.email,
      ),
    ),
    "Auth fixture identity changed",
  );
  const incoming = await database.query(
    `
    select distinct child.relname as table_name
    from pg_constraint fk
    join pg_class parent on parent.oid=fk.confrelid
    join pg_namespace parent_ns on parent_ns.oid=parent.relnamespace
    join pg_class child on child.oid=fk.conrelid
    join pg_namespace child_ns on child_ns.oid=child.relnamespace
    where fk.contype='f' and parent_ns.nspname='public' and child_ns.nspname='public'
      and parent.relname=any($1::text[])
    order by child.relname
  `,
    [["centers", "users", "persons", "patient_centers", "professionals", "professional_centers"]],
  );
  const knownChildren = new Set([
    "center_memberships",
    "professional_centers",
    "professional_center_specialties",
    "patient_centers",
    "specialties",
    "availabilities",
    "appointments",
    "platform_admins",
  ]);
  assert(
    incoming.rows.every((row) => knownChildren.has(row.table_name)),
    "Unknown incoming FK blocks cleanup",
  );
  const external = [
    ["public.appointments", "center_id", centerIds],
    ["public.appointments", "patient_center_id", pcIds],
    ["public.specialties", "center_id", centerIds],
    ["public.availabilities", "center_id", centerIds],
    ["public.professional_center_specialties", "center_id", centerIds],
  ];
  for (const [table, column, ids] of external) {
    const rows = await database.query(
      `select count(*)::int as count from ${table} where ${column}=any($1::uuid[])`,
      [ids],
    );
    assert(rows.rows[0].count === 0, `External reference blocks cleanup: ${table}.${column}`);
  }
  return {
    centers: centerIds.length,
    authUsers: owned.authUsers.length,
    persons: personIds.length,
    patientCenters: pcIds.length,
  };
}

async function captureSmoke(linkOnly) {
  const ledger = readLedger();
  assert(ledger.stage === "e2e_pass", `Smoke capture requires e2e_pass, got ${ledger.stage}`);
  const patientCenterId = process.argv[3];
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientCenterId ?? ""),
    "Pass the exact patient UUID from the UI URL",
  );
  database = await openDatabase(dev, "capture-smoke");
  const rows = await database.query(
    "select pc.id,pc.person_id,pc.center_id,p.document_number,p.nationality_code,p.birth_date::text as birth_date from public.patient_centers pc join public.persons p on p.id=pc.person_id where pc.id=$1",
    [patientCenterId],
  );
  assert(rows.rowCount === 1, "Smoke PatientCenter UUID does not exist");
  const row = rows.rows[0];
  const expectedDocument = linkOnly
    ? ledger.generated.manualUnlinkedDocument
    : ledger.generated.smokeDocument;
  assert(
    row.center_id === ledger.ids.centerA &&
      row.document_number === expectedDocument &&
      row.nationality_code === "AR" &&
      row.birth_date === "1990-01-01" &&
      (!linkOnly || row.person_id === ledger.ids.manualUnlinkedPerson),
    "Smoke row does not match the exact reserved identity and owned Center; STOP",
  );
  if (!linkOnly && !ledger.owned.persons.includes(row.person_id))
    ledger.owned.persons.push(row.person_id);
  if (!ledger.owned.patientCenters.includes(row.id)) ledger.owned.patientCenters.push(row.id);
  evidence(ledger, linkOnly ? "manual_link_uuid_captured" : "manual_create_uuid_captured", {
    personId: row.person_id,
    patientCenterId: row.id,
  });
  console.log(
    JSON.stringify({
      gate: "TASK-007D",
      captured: linkOnly ? "manual_link" : "manual_create",
      personId: row.person_id,
      patientCenterId: row.id,
      ledger: ledgerPath,
    }),
  );
}

async function cleanup() {
  const ledger = readLedger();
  assert(
    ["creating", "fixtures_ready", "integrated", "e2e_pass", "db_cleaned"].includes(ledger.stage),
    `Cannot clean stage ${ledger.stage}`,
  );
  database = await openDatabase(dev, "cleanup");
  if (ledger.stage === "creating") {
    const planned = [
      ["public.centers", [ledger.ids.centerA, ledger.ids.centerB, ledger.ids.centerInactive]],
      [
        "public.center_memberships",
        Object.entries(ledger.ids)
          .filter(([key]) => key.startsWith("membership"))
          .map(([, id]) => id),
      ],
      ["public.professionals", [ledger.ids.professional]],
      ["public.professional_centers", [ledger.ids.professionalCenter]],
      [
        "public.persons",
        [
          ledger.ids.privacyPerson,
          ledger.ids.unlinkedPerson,
          ledger.ids.manualUnlinkedPerson,
          ledger.ids.racePerson,
        ],
      ],
      ["public.patient_centers", [ledger.ids.privacyPatientA, ledger.ids.racePatientA]],
      ["public.users", ledger.owned.authUsers],
    ];
    for (const [table, ids] of planned) {
      const rows = await database.query(`select id from ${table} where id=any($1::uuid[])`, [ids]);
      assert(rows.rowCount === 0, `Partial setup has DB rows in ${table}; STOP cleanup`);
    }
    ledger.stage = "db_cleaned";
    evidence(ledger, "partial_setup_db_empty");
  }
  if (ledger.stage !== "db_cleaned") {
    const summary = await audit(database, ledger);
    evidence(ledger, "ownership_and_references_pass", summary);
    await database.query("begin");
    try {
      for (const [table, column, ids] of [
        ["public.patient_centers", "id", ledger.owned.patientCenters],
        ["public.persons", "id", ledger.owned.persons],
        ["public.center_memberships", "id", ledger.owned.memberships],
        ["public.platform_admins", "user_id", ledger.owned.platformAdmins],
        ["public.professional_centers", "id", ledger.owned.professionalCenters],
        ["public.professionals", "id", ledger.owned.professionals],
        ["public.centers", "id", ledger.owned.centers],
        ["public.users", "id", ledger.owned.publicUsers],
      ]) {
        const result = await database.query(
          `delete from ${table} where ${column}=any($1::uuid[]) returning ${column}`,
          [ids],
        );
        assert(
          result.rowCount === ids.length && result.rows.every((row) => ids.includes(row[column])),
          `Unexpected cleanup result: ${table}`,
        );
      }
      await database.query("commit");
    } catch (error) {
      await database.query("rollback").catch(() => undefined);
      throw error;
    }
    ledger.stage = "db_cleaned";
    evidence(ledger, "db_cleanup_pass");
  }
  for (const actor of Object.values(ledger.actors).reverse()) {
    if (ledger.authDeleted.includes(actor.id)) continue;
    const { data, error } = await authAdmin.auth.admin.getUserById(actor.id);
    if (error || !data.user || data.user.email !== actor.email)
      throw new Error(`Auth ownership ambiguous for ${actor.id}; STOP cleanup`);
    const deleted = await authAdmin.auth.admin.deleteUser(actor.id);
    if (deleted.error)
      throw new Error(`Auth cleanup failed for exact ID ${actor.id}`, { cause: deleted.error });
    ledger.authDeleted.push(actor.id);
    saveLedger(ledger);
  }
  const after = await inventory(database);
  assert(
    JSON.stringify(after) === JSON.stringify(ledger.before),
    "Persistent inventory differs after cleanup; final gate blocked",
  );
  ledger.stage = "cleaned";
  evidence(ledger, "inventory_restored_pass");
  console.log(
    JSON.stringify({
      gate: "TASK-007D",
      stage: ledger.stage,
      beforeRestored: true,
      ledger: ledgerPath,
      expectedDigest,
    }),
  );
}

try {
  if (mode === "setup") await setup();
  else if (mode === "audit") {
    const ledger = readLedger();
    const ledgerSha256 = ledgerDigest();
    database = await openDatabase(dev, "audit");
    const ownership = await audit(database, ledger);
    assert(ledgerDigest() === ledgerSha256, "Audit changed the ownership ledger; STOP");
    console.log(
      JSON.stringify({
        gate: "TASK-007D",
        stage: ledger.stage,
        ownership,
        ledger: ledgerPath,
        ledgerSha256,
      }),
    );
  } else if (mode === "capture-smoke" || mode === "capture-smoke-link") {
    await captureSmoke(mode === "capture-smoke-link");
  } else if (mode === "audit-clean") {
    const ledger = readLedger();
    const ledgerSha256 = ledgerDigest();
    database = await openDatabase(dev, "audit-clean");
    const result = await auditClean(database, ledger);
    assert(ledgerDigest() === ledgerSha256, "Clean audit changed the ownership ledger; STOP");
    console.log(
      JSON.stringify({ gate: "TASK-007D", stage: ledger.stage, ...result, ledgerSha256 }),
    );
  } else await cleanup();
} finally {
  await database?.end().catch(() => undefined);
}
