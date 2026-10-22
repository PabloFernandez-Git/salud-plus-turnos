import assert from "node:assert/strict";
import { ownedRows } from "./plan.mjs";

async function insert(client, sql, values) {
  const result = await client.query(sql, values);
  assert.equal(result.rowCount, 1, "Fixture insertion count differs");
}

export async function assertPlanAbsent(client, plan) {
  const owned = ownedRows(plan);
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    for (const [table, ids] of Object.entries(owned)) {
      if (!ids.length || table === "public.professional_center_specialties") continue;
      const key = table === "public.platform_admins" ? "user_id" : "id";
      const result = await client.query(
        `select count(*)::int as n from ${table} where ${key}=any($1::uuid[])`,
        [ids],
      );
      assert.equal(result.rows[0].n, 0, `${table} planned UUID already exists`);
    }
    const existingEmails = await client.query(
      "select count(*)::int as n from auth.users where email=any($1::text[])",
      [Object.values(plan.actors).map((actor) => actor.email)],
    );
    assert.equal(existingEmails.rows[0].n, 0, "Planned Auth email already exists");
    for (const pair of owned["public.professional_center_specialties"]) {
      const [pc, specialty] = pair.split("/");
      const found = await client.query(
        "select 1 from public.professional_center_specialties where professional_center_id=$1 and specialty_id=$2",
        [pc, specialty],
      );
      assert.equal(found.rowCount, 0, "Planned Professional/Specialty relation already exists");
    }
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

// Auth Admin is used only to create/delete isolated Auth identities. Access
// assertions use a publishable key and each actor's real JWT.
export async function createAuthFixtures(client, admin, ledger, password, save) {
  for (const [name, actor] of Object.entries(ledger.plan.actors)) {
    ledger.stage = `auth_create_attempt:${name}`;
    save(ledger); // durable intent before the external write
    const { data, error } = await admin.auth.admin.createUser({
      email: actor.email,
      password,
      email_confirm: true,
      user_metadata: { gate: "TASK-022", runId: ledger.plan.runId, actor: name },
    });
    if (error || !data?.user?.id || data.user.email !== actor.email) {
      throw new Error(`Auth create outcome for ${name} is uncertain; read-only reconcile required`);
    }
    actor.id = data.user.id;
    ledger.stage = `auth_created:${name}`;
    save(ledger);
  }
}

export async function insertDatabaseFixtures(client, ledger, save) {
  const { plan } = ledger;
  const i = plan.ids;
  const a = plan.actors;
  assert(Object.values(a).every((actor) => actor.id));
  ledger.stage = "db_begin";
  save(ledger);
  await client.query("BEGIN");
  let commitAttempted = false;
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    for (const [name, actor] of Object.entries(a)) {
      await insert(
        client,
        "insert into public.users(id,email,first_name,last_name) values($1,$2,$3,'Fixture')",
        [actor.id, actor.email, `Task022 ${name}`],
      );
    }
    for (const [id, label, timezone] of [
      [i.centerA, "A", "America/New_York"],
      [i.centerB, "B", "America/Argentina/Buenos_Aires"],
    ])
      await insert(client, "insert into public.centers(id,name,timezone) values($1,$2,$3)", [
        id,
        `TASK-022 ${label} ${plan.runId}`,
        timezone,
      ]);
    for (const [id, label] of [
      [i.professionalA, "A"],
      [i.professionalB, "B"],
    ])
      await insert(
        client,
        "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'Task022',$2,'AR',$3,$4)",
        [
          id,
          `Professional ${label}`,
          `T022-P-${label}-${plan.runId}`,
          `task022-prof-${label.toLowerCase()}-${plan.runId}@example.test`,
        ],
      );
    for (const [pc, professional, center] of [
      [i.pcA, i.professionalA, i.centerA],
      [i.pcB, i.professionalB, i.centerB],
    ])
      await insert(
        client,
        "insert into public.professional_centers(id,professional_id,center_id,usual_appointment_duration_minutes) values($1,$2,$3,30)",
        [pc, professional, center],
      );
    for (const [id, center, label] of [
      [i.specialtyA, i.centerA, "A"],
      [i.specialtyB, i.centerB, "B"],
    ])
      await insert(client, "insert into public.specialties(id,center_id,name) values($1,$2,$3)", [
        id,
        center,
        `TASK-022 Specialty ${label} ${plan.runId}`,
      ]);
    for (const [pc, specialty, center] of [
      [i.pcA, i.specialtyA, i.centerA],
      [i.pcB, i.specialtyB, i.centerB],
    ])
      await insert(
        client,
        "insert into public.professional_center_specialties(professional_center_id,specialty_id,center_id) values($1,$2,$3)",
        [pc, specialty, center],
      );
    for (const [id, center, actor, role, pc] of [
      [i.adminMembershipA, i.centerA, a.adminA.id, "ADMIN", null],
      [i.receptionMembershipA, i.centerA, a.receptionA.id, "RECEPTION", null],
      [i.professionalMembershipA, i.centerA, a.professionalA.id, "PROFESSIONAL", i.pcA],
      [i.adminMembershipB, i.centerB, a.adminB.id, "ADMIN", null],
    ])
      await insert(
        client,
        "insert into public.center_memberships(id,center_id,user_id,role,professional_center_id) values($1,$2,$3,$4,$5)",
        [id, center, actor, role, pc],
      );
    for (const [id, label] of [
      [i.personA, "A"],
      [i.personEmpty, "Empty"],
      [i.personB, "B"],
    ])
      await insert(
        client,
        "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Task022',$2,'1990-01-01','AR',$3)",
        [id, `Patient ${label}`, `T022-PAT-${label}-${plan.runId}`],
      );
    for (const [id, person, center, label] of [
      [i.patientA, i.personA, i.centerA, "a"],
      [i.patientEmpty, i.personEmpty, i.centerA, "empty"],
      [i.patientB, i.personB, i.centerB, "b"],
    ])
      await insert(
        client,
        "insert into public.patient_centers(id,person_id,center_id,phone,email) values($1,$2,$3,'0000000000',$4)",
        [id, person, center, `task022-patient-${label}-${plan.runId}@example.test`],
      );
    for (const row of plan.appointments) {
      const start = new Date(row.startsAt);
      await insert(
        client,
        "insert into public.appointments(id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          row.id,
          i[row.center],
          i[row.patient],
          i[row.professionalCenter],
          i[row.specialty],
          row.startsAt,
          new Date(start.getTime() + 30 * 60_000).toISOString(),
          row.status,
        ],
      );
    }
    ledger.stage = "db_commit_attempt";
    save(ledger);
    commitAttempted = true;
    await client.query("COMMIT");
    ledger.stage = "fixtures_ready";
    save(ledger);
  } catch (error) {
    if (!commitAttempted) {
      await client.query("ROLLBACK");
      ledger.stage = "db_rolled_back";
      save(ledger);
    }
    if (commitAttempted)
      throw new Error("Database COMMIT outcome uncertain; read-only reconcile required");
    throw error;
  }
}

async function deleteExact(client, table, key, ids) {
  if (!ids.length) return;
  const result = await client.query(
    `delete from ${table} where ${key}=any($1::uuid[]) returning ${key}::text as id`,
    [ids],
  );
  assert.deepEqual(
    result.rows.map((row) => row.id).sort(),
    [...ids].sort(),
    `${table} deletion set differs`,
  );
}

export async function cleanupDatabaseFixtures(client, ledger, save) {
  const o = ownedRows(ledger.plan);
  ledger.stage = "db_cleanup_begin";
  save(ledger);
  await client.query("BEGIN");
  let commitAttempted = false;
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    for (const table of [
      "public.appointments",
      "public.patient_centers",
      "public.persons",
      "public.center_memberships",
    ]) {
      await deleteExact(client, table, "id", o[table]);
    }
    for (const pair of o["public.professional_center_specialties"]) {
      const [pc, specialty] = pair.split("/");
      const result = await client.query(
        "delete from public.professional_center_specialties where professional_center_id=$1 and specialty_id=$2 returning professional_center_id",
        [pc, specialty],
      );
      assert.equal(result.rowCount, 1);
    }
    for (const table of [
      "public.specialties",
      "public.professional_centers",
      "public.professionals",
      "public.centers",
      "public.users",
    ]) {
      await deleteExact(client, table, "id", o[table]);
    }
    ledger.stage = "db_cleanup_commit_attempt";
    save(ledger);
    commitAttempted = true;
    await client.query("COMMIT");
    ledger.stage = "database_cleaned";
    save(ledger);
  } catch (error) {
    if (!commitAttempted) await client.query("ROLLBACK").catch(() => undefined);
    if (commitAttempted)
      throw new Error("Cleanup COMMIT outcome uncertain; read-only reconcile required");
    throw error;
  }
}

export async function cleanupAuthFixtures(client, admin, ledger, save, allowAlreadyAbsent = false) {
  for (const [name, actor] of Object.entries(ledger.plan.actors).reverse()) {
    const existing = await client.query(
      "select email,raw_user_meta_data->>'gate' as gate,raw_user_meta_data->>'runId' as run_id from auth.users where id=$1",
      [actor.id],
    );
    if (allowAlreadyAbsent && existing.rowCount === 0) continue;
    assert.equal(existing.rowCount, 1, `Auth actor ${name} missing before delete`);
    assert.equal(existing.rows[0].email, actor.email);
    assert.equal(existing.rows[0].gate, "TASK-022");
    assert.equal(existing.rows[0].run_id, ledger.plan.runId);
    ledger.stage = `auth_delete_attempt:${name}`;
    save(ledger);
    const deleted = await admin.auth.admin.deleteUser(actor.id);
    if (deleted.error)
      throw new Error(`Auth delete outcome for ${name} uncertain; read-only reconcile required`);
    ledger.stage = `auth_deleted:${name}`;
    save(ledger);
  }
}
