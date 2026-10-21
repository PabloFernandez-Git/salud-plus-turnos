import { randomUUID } from "node:crypto";
import { markAuthOwned, markOwned, planAuthEmail, planOwned, saveLedger } from "./ledger.mjs";

const actorNames = [
  "admina",
  "receptiona",
  "professionala",
  "professionalb",
  "adminb",
  "inactivea",
  "platformonly",
  "unlinked",
];

const tableByKind = Object.freeze({
  publicUsers: ["public.users", "id"],
  platformAdmins: ["public.platform_admins", "user_id"],
  centers: ["public.centers", "id"],
  memberships: ["public.center_memberships", "id"],
  professionals: ["public.professionals", "id"],
  professionalCenters: ["public.professional_centers", "id"],
  specialties: ["public.specialties", "id"],
  availabilities: ["public.availabilities", "id"],
  persons: ["public.persons", "id"],
  patientCenters: ["public.patient_centers", "id"],
});

function ownId(ledger, kind) {
  const id = randomUUID();
  planOwned(ledger, kind, id);
  return id;
}

export function planFixtures(ledger) {
  if (ledger.stage !== "planned") throw new Error("Fixture planning requires planned stage");
  if (ledger.ids || ledger.actors) throw new Error("Fixture plan already exists; STOP");
  ledger.ids = {
    centerA: ownId(ledger, "centers"),
    centerB: ownId(ledger, "centers"),
    centerC: ownId(ledger, "centers"),
    centerD: ownId(ledger, "centers"),
    professionalA: ownId(ledger, "professionals"),
    professionalB: ownId(ledger, "professionals"),
    professionalC: ownId(ledger, "professionals"),
    pcA: ownId(ledger, "professionalCenters"),
    pcB: ownId(ledger, "professionalCenters"),
    pcC: ownId(ledger, "professionalCenters"),
    specialtyA: ownId(ledger, "specialties"),
    specialtyB: ownId(ledger, "specialties"),
    specialtyC: ownId(ledger, "specialties"),
    personA: ownId(ledger, "persons"),
    personB: ownId(ledger, "persons"),
    personC: ownId(ledger, "persons"),
    patientA: ownId(ledger, "patientCenters"),
    patientB: ownId(ledger, "patientCenters"),
    patientC: ownId(ledger, "patientCenters"),
    membershipAdminA: ownId(ledger, "memberships"),
    membershipReceptionA: ownId(ledger, "memberships"),
    membershipProfessionalA: ownId(ledger, "memberships"),
    membershipProfessionalB: ownId(ledger, "memberships"),
    membershipAdminB: ownId(ledger, "memberships"),
    membershipAdminC: ownId(ledger, "memberships"),
    membershipInactiveA: ownId(ledger, "memberships"),
    membershipInactiveCenter: ownId(ledger, "memberships"),
  };
  ledger.actors = Object.fromEntries(
    actorNames.map((name) => [name, { email: planAuthEmail(ledger, name), id: null }]),
  );
  for (const [pc, specialty] of [
    [ledger.ids.pcA, ledger.ids.specialtyA],
    [ledger.ids.pcB, ledger.ids.specialtyB],
    [ledger.ids.pcC, ledger.ids.specialtyC],
  ]) {
    planOwned(ledger, "professionalCenterSpecialties", `${pc}/${specialty}`);
  }
  ledger.availabilityPlan = [
    ...Array.from({ length: 7 }, (_, index) => ({
      id: ownId(ledger, "availabilities"),
      centerId: ledger.ids.centerA,
      pcId: ledger.ids.pcA,
      weekday: index + 1,
      start: "00:00",
      end: "23:59",
    })),
    {
      id: ownId(ledger, "availabilities"),
      centerId: ledger.ids.centerB,
      pcId: ledger.ids.pcB,
      weekday: 7,
      start: "00:00",
      end: "04:00",
    },
    {
      id: ownId(ledger, "availabilities"),
      centerId: ledger.ids.centerC,
      pcId: ledger.ids.pcC,
      weekday: 7,
      start: "00:00",
      end: "04:00",
    },
  ];
  saveLedger(ledger);
  return ledger;
}

export async function assertPlannedResourcesAbsent(client, ledger) {
  for (const [kind, [table, column]] of Object.entries(tableByKind)) {
    const ids = ledger.planned[kind];
    if (!ids.length) continue;
    const result = await client.query(
      `select count(*)::int as count from ${table} where ${column}=any($1::uuid[])`,
      [ids],
    );
    if (result.rows[0].count !== 0) throw new Error(`Planned ${kind} UUID already exists; STOP`);
  }
  for (const key of ledger.planned.professionalCenterSpecialties) {
    const [pc, specialty] = key.split("/");
    const found = await client.query(
      "select 1 from public.professional_center_specialties where professional_center_id=$1 and specialty_id=$2",
      [pc, specialty],
    );
    if (found.rowCount) throw new Error("Planned PC/Specialty pair already exists; STOP");
  }
  for (const email of ledger.plannedAuthEmails) {
    const found = await client.query("select 1 from auth.users where email=$1", [email]);
    if (found.rowCount) throw new Error("Reserved synthetic Auth email already exists; STOP");
  }
}

async function createAuthUsers(client, admin, ledger, password) {
  for (const [name, actor] of Object.entries(ledger.actors)) {
    const { data, error } = await admin.auth.admin.createUser({
      email: actor.email,
      password,
      email_confirm: true,
      user_metadata: { gate: "TASK-009", runId: ledger.runId, actor: name },
    });
    if (error || !data?.user?.id) {
      const found = await client.query(
        "select id from auth.users where email=$1 and raw_user_meta_data ->> 'runId'=$2 and raw_user_meta_data ->> 'gate'='TASK-009'",
        [actor.email, ledger.runId],
      );
      if (found.rowCount !== 1) {
        throw new Error(`Auth creation outcome for ${name} is uncertain; STOP and preserve ledger`);
      }
      actor.id = found.rows[0].id;
    } else {
      if (data.user.email !== actor.email) {
        throw new Error(`Auth response identity mismatch for ${name}; STOP`);
      }
      actor.id = data.user.id;
    }
    markAuthOwned(ledger, actor.email, actor.id);
    planOwned(ledger, "publicUsers", actor.id);
    if (name === "platformonly") planOwned(ledger, "platformAdmins", actor.id);
  }
}

export async function setupFixtures(client, admin, ledger, password) {
  if (ledger.stage !== "planned") throw new Error("Setup requires planned ledger stage");
  await assertPlannedResourcesAbsent(client, ledger);
  ledger.stage = "creating";
  saveLedger(ledger);
  await createAuthUsers(client, admin, ledger, password);
  for (const kind of ["publicUsers", "platformAdmins"]) {
    const [table, column] = tableByKind[kind];
    const result = await client.query(
      `select count(*)::int as count from ${table} where ${column}=any($1::uuid[])`,
      [ledger.planned[kind]],
    );
    if (result.rows[0].count !== 0) {
      throw new Error(`Auth setup produced an unexpected ${kind} row; STOP`);
    }
  }
  const id = ledger.ids;
  const actor = ledger.actors;

  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    for (const [name, user] of Object.entries(actor)) {
      await client.query(
        "insert into public.users(id,email,first_name,last_name) values($1,$2,$3,'Fixture')",
        [user.id, user.email, `Task009 ${name}`],
      );
    }
    for (const [centerId, label, timezone, active] of [
      [id.centerA, "A", "America/Argentina/Buenos_Aires", true],
      [id.centerB, "B", "America/New_York", true],
      [id.centerC, "C", "Australia/Lord_Howe", true],
      [id.centerD, "D", "America/Argentina/Buenos_Aires", false],
    ]) {
      await client.query(
        "insert into public.centers(id,name,timezone,is_active) values($1,$2,$3,$4)",
        [centerId, `TASK-009 ${label} ${ledger.runId}`, timezone, active],
      );
    }
    for (const [professionalId, label] of [
      [id.professionalA, "A"],
      [id.professionalB, "B"],
      [id.professionalC, "C"],
    ]) {
      await client.query(
        "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'Task009',$2,'AR',$3,$4)",
        [
          professionalId,
          `Professional ${label}`,
          `T009-P-${label}-${ledger.runId}`,
          `task009-prof-${label.toLowerCase()}-${ledger.runId}@example.test`,
        ],
      );
    }
    for (const [pcId, professionalId, centerId] of [
      [id.pcA, id.professionalA, id.centerA],
      [id.pcB, id.professionalB, id.centerB],
      [id.pcC, id.professionalC, id.centerC],
    ]) {
      await client.query(
        "insert into public.professional_centers(id,professional_id,center_id,usual_appointment_duration_minutes) values($1,$2,$3,30)",
        [pcId, professionalId, centerId],
      );
    }
    for (const [specialtyId, centerId, label] of [
      [id.specialtyA, id.centerA, "A"],
      [id.specialtyB, id.centerB, "B"],
      [id.specialtyC, id.centerC, "C"],
    ]) {
      await client.query(
        "insert into public.specialties(id,center_id,name,is_active) values($1,$2,$3,true)",
        [specialtyId, centerId, `TASK-009 Specialty ${label} ${ledger.runId}`],
      );
    }
    for (const [pcId, specialtyId, centerId] of [
      [id.pcA, id.specialtyA, id.centerA],
      [id.pcB, id.specialtyB, id.centerB],
      [id.pcC, id.specialtyC, id.centerC],
    ]) {
      await client.query(
        "insert into public.professional_center_specialties(professional_center_id,specialty_id,center_id,is_active) values($1,$2,$3,true)",
        [pcId, specialtyId, centerId],
      );
    }
    for (const row of ledger.availabilityPlan) {
      await client.query(
        "insert into public.availabilities(id,professional_center_id,center_id,weekday,start_time,end_time,is_active) values($1,$2,$3,$4,$5,$6,true)",
        [row.id, row.pcId, row.centerId, row.weekday, row.start, row.end],
      );
    }
    for (const [membershipId, centerId, userId, role, pcId, active] of [
      [id.membershipAdminA, id.centerA, actor.admina.id, "ADMIN", null, true],
      [id.membershipReceptionA, id.centerA, actor.receptiona.id, "RECEPTION", null, true],
      [
        id.membershipProfessionalA,
        id.centerA,
        actor.professionala.id,
        "PROFESSIONAL",
        id.pcA,
        true,
      ],
      [
        id.membershipProfessionalB,
        id.centerB,
        actor.professionalb.id,
        "PROFESSIONAL",
        id.pcB,
        true,
      ],
      [id.membershipAdminB, id.centerB, actor.adminb.id, "ADMIN", null, true],
      [id.membershipAdminC, id.centerC, actor.adminb.id, "ADMIN", null, true],
      [id.membershipInactiveA, id.centerA, actor.inactivea.id, "RECEPTION", null, false],
      [id.membershipInactiveCenter, id.centerD, actor.adminb.id, "ADMIN", null, true],
    ]) {
      await client.query(
        "insert into public.center_memberships(id,center_id,user_id,role,professional_center_id,is_active) values($1,$2,$3,$4,$5,$6)",
        [membershipId, centerId, userId, role, pcId, active],
      );
    }
    await client.query("insert into public.platform_admins(user_id) values($1)", [
      actor.platformonly.id,
    ]);
    for (const [personId, label] of [
      [id.personA, "A"],
      [id.personB, "B"],
      [id.personC, "C"],
    ]) {
      await client.query(
        "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,$2,'Fixture','1990-01-01','AR',$3)",
        [personId, `Synthetic ${label}`, `T009-PAT-${label}-${ledger.runId}`],
      );
    }
    for (const [patientId, personId, centerId, label] of [
      [id.patientA, id.personA, id.centerA, "A"],
      [id.patientB, id.personB, id.centerB, "B"],
      [id.patientC, id.personC, id.centerC, "C"],
    ]) {
      await client.query(
        "insert into public.patient_centers(id,person_id,center_id,phone,email,is_active) values($1,$2,$3,'0000000000',$4,true)",
        [
          patientId,
          personId,
          centerId,
          `task009-patient-${label.toLowerCase()}-${ledger.runId}@example.test`,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  for (const [kind, ids] of Object.entries(ledger.planned)) {
    if (kind === "authUsers" || kind === "appointments") continue;
    for (const ownedId of ids) markOwned(ledger, kind, ownedId);
  }
  ledger.stage = "fixtures_ready";
  saveLedger(ledger);
  return ledger;
}
