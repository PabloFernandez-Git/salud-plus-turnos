import assert from "node:assert/strict";
import { ownedRows } from "./plan.mjs";

async function insert(client, sql, values) {
  const result = await client.query(sql, values);
  assert.equal(result.rowCount, 1, "Focused fixture insertion count differs");
}

export async function insertFocusedDatabaseFixtures(client, ledger, save) {
  const { plan } = ledger;
  assert.equal(plan.scope, "denial");
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
    ]) {
      await insert(client, "insert into public.centers(id,name,timezone) values($1,$2,$3)", [
        id,
        `TASK-022 ${label} ${plan.runId}`,
        timezone,
      ]);
    }
    await insert(
      client,
      "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'Task022','Professional A','AR',$2,$3)",
      [i.professionalA, `T022-P-A-${plan.runId}`, `task022-prof-a-${plan.runId}@example.test`],
    );
    await insert(
      client,
      "insert into public.professional_centers(id,professional_id,center_id,usual_appointment_duration_minutes) values($1,$2,$3,30)",
      [i.pcA, i.professionalA, i.centerA],
    );
    await insert(client, "insert into public.specialties(id,center_id,name) values($1,$2,$3)", [
      i.specialtyA,
      i.centerA,
      `TASK-022 Specialty A ${plan.runId}`,
    ]);
    await insert(
      client,
      "insert into public.professional_center_specialties(professional_center_id,specialty_id,center_id) values($1,$2,$3)",
      [i.pcA, i.specialtyA, i.centerA],
    );
    for (const [id, center, actor, role, pc] of [
      [i.receptionMembershipA, i.centerA, a.receptionA.id, "RECEPTION", null],
      [i.professionalMembershipA, i.centerA, a.professionalA.id, "PROFESSIONAL", i.pcA],
      [i.adminMembershipB, i.centerB, a.adminB.id, "ADMIN", null],
    ]) {
      await insert(
        client,
        "insert into public.center_memberships(id,center_id,user_id,role,professional_center_id) values($1,$2,$3,$4,$5)",
        [id, center, actor, role, pc],
      );
    }
    await insert(
      client,
      "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Task022','Patient A','1990-01-01','AR',$2)",
      [i.personA, `T022-PAT-A-${plan.runId}`],
    );
    await insert(
      client,
      "insert into public.patient_centers(id,person_id,center_id,phone,email) values($1,$2,$3,'0000000000',$4)",
      [i.patientA, i.personA, i.centerA, `task022-patient-a-${plan.runId}@example.test`],
    );
    const appointment = plan.appointments[0];
    await insert(
      client,
      "insert into public.appointments(id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status) values($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        appointment.id,
        i.centerA,
        i.patientA,
        i.pcA,
        i.specialtyA,
        appointment.startsAt,
        new Date(Date.parse(appointment.startsAt) + 30 * 60_000).toISOString(),
        appointment.status,
      ],
    );
    ledger.stage = "db_commit_attempt";
    save(ledger);
    commitAttempted = true;
    await client.query("COMMIT");
    ledger.stage = "fixtures_ready";
    save(ledger);
  } catch (error) {
    if (!commitAttempted) {
      await client.query("ROLLBACK").catch(() => undefined);
      ledger.stage = "db_rolled_back";
      save(ledger);
    }
    if (commitAttempted)
      throw new Error("Focused database COMMIT outcome uncertain; read-only reconcile required");
    throw error;
  }
}

export async function verifyFocusedFixtureScope(client, plan) {
  assert.equal(plan.scope, "denial");
  const i = plan.ids;
  const a = plan.actors;
  const owned = ownedRows(plan);
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    for (const [table, expected] of Object.entries(owned)) {
      if (!expected.length) continue;
      const key =
        table === "public.professional_center_specialties"
          ? "professional_center_id::text || '/' || specialty_id::text"
          : "id::text";
      const actual = (
        await client.query(
          `select (${key})::text as id from ${table} where (${key})::text=any($1::text[]) order by id`,
          [expected],
        )
      ).rows.map((row) => row.id);
      assert.deepEqual(actual, [...expected].sort(), `${table} exact UUID scope differs`);
    }
    const centers = (
      await client.query(
        "select id::text,name,timezone from public.centers where id=any($1::uuid[])",
        [[i.centerA, i.centerB]],
      )
    ).rows;
    assert.deepEqual(
      centers.sort((x, y) => x.id.localeCompare(y.id)),
      [
        { id: i.centerA, name: `TASK-022 A ${plan.runId}`, timezone: "America/New_York" },
        {
          id: i.centerB,
          name: `TASK-022 B ${plan.runId}`,
          timezone: "America/Argentina/Buenos_Aires",
        },
      ].sort((x, y) => x.id.localeCompare(y.id)),
    );
    const professional = (
      await client.query(
        "select id::text,first_name,last_name,document_number,email from public.professionals where id=$1",
        [i.professionalA],
      )
    ).rows[0];
    assert.deepEqual(professional, {
      id: i.professionalA,
      first_name: "Task022",
      last_name: "Professional A",
      document_number: `T022-P-A-${plan.runId}`,
      email: `task022-prof-a-${plan.runId}@example.test`,
    });
    const professionalCenter = (
      await client.query(
        "select id::text,professional_id::text,center_id::text from public.professional_centers where id=$1",
        [i.pcA],
      )
    ).rows[0];
    assert.deepEqual(professionalCenter, {
      id: i.pcA,
      professional_id: i.professionalA,
      center_id: i.centerA,
    });
    const specialty = (
      await client.query(
        "select id::text,center_id::text,name from public.specialties where id=$1",
        [i.specialtyA],
      )
    ).rows[0];
    assert.deepEqual(specialty, {
      id: i.specialtyA,
      center_id: i.centerA,
      name: `TASK-022 Specialty A ${plan.runId}`,
    });
    const memberships = (
      await client.query(
        "select id::text,center_id::text,user_id::text,role::text,professional_center_id::text from public.center_memberships where center_id=any($1::uuid[]) order by id",
        [[i.centerA, i.centerB]],
      )
    ).rows;
    assert.deepEqual(
      memberships,
      [
        {
          id: i.receptionMembershipA,
          center_id: i.centerA,
          user_id: a.receptionA.id,
          role: "RECEPTION",
          professional_center_id: null,
        },
        {
          id: i.professionalMembershipA,
          center_id: i.centerA,
          user_id: a.professionalA.id,
          role: "PROFESSIONAL",
          professional_center_id: i.pcA,
        },
        {
          id: i.adminMembershipB,
          center_id: i.centerB,
          user_id: a.adminB.id,
          role: "ADMIN",
          professional_center_id: null,
        },
      ].sort((x, y) => x.id.localeCompare(y.id)),
      "Focused membership roles or center isolation differ",
    );
    for (const [table, centerKey] of [
      ["public.appointments", "center_id"],
      ["public.patient_centers", "center_id"],
      ["public.professional_centers", "center_id"],
      ["public.specialties", "center_id"],
    ]) {
      const actual = (
        await client.query(
          `select id::text from ${table} where ${centerKey}=any($1::uuid[]) order by id`,
          [[i.centerA, i.centerB]],
        )
      ).rows.map((row) => row.id);
      assert.deepEqual(
        actual,
        [...owned[table]].sort(),
        `${table} has unowned fixture-center rows`,
      );
    }
    const relations = (
      await client.query(
        "select professional_center_id::text || '/' || specialty_id::text as id from public.professional_center_specialties where center_id=any($1::uuid[]) order by id",
        [[i.centerA, i.centerB]],
      )
    ).rows.map((row) => row.id);
    assert.deepEqual(relations, owned["public.professional_center_specialties"]);
    const auth = (
      await client.query(
        "select id::text,email,raw_user_meta_data->>'gate' as gate,raw_user_meta_data->>'runId' as run_id from auth.users where id=any($1::uuid[]) order by id",
        [owned["auth.users"]],
      )
    ).rows;
    assert.deepEqual(
      auth,
      Object.values(a)
        .map((actor) => ({
          id: actor.id,
          email: actor.email,
          gate: "TASK-022",
          run_id: plan.runId,
        }))
        .sort((x, y) => x.id.localeCompare(y.id)),
    );
    const users = (
      await client.query(
        "select id::text,email from public.users where id=any($1::uuid[]) order by id",
        [owned["public.users"]],
      )
    ).rows;
    assert.deepEqual(
      users,
      Object.values(a)
        .map((actor) => ({ id: actor.id, email: actor.email }))
        .sort((x, y) => x.id.localeCompare(y.id)),
    );
    const patient = (
      await client.query(
        "select pc.id::text,pc.center_id::text,pc.person_id::text,pc.email,p.first_name,p.last_name,p.document_number from public.patient_centers pc join public.persons p on p.id=pc.person_id where pc.id=$1",
        [i.patientA],
      )
    ).rows[0];
    assert.deepEqual(patient, {
      id: i.patientA,
      center_id: i.centerA,
      person_id: i.personA,
      email: `task022-patient-a-${plan.runId}@example.test`,
      first_name: "Task022",
      last_name: "Patient A",
      document_number: `T022-PAT-A-${plan.runId}`,
    });
    const appointment = (
      await client.query(
        "select id::text,center_id::text,patient_center_id::text,professional_center_id::text,specialty_id::text,starts_at,status::text from public.appointments where id=$1",
        [plan.appointments[0].id],
      )
    ).rows[0];
    assert.equal(appointment.center_id, i.centerA);
    assert.equal(appointment.patient_center_id, i.patientA);
    assert.equal(appointment.professional_center_id, i.pcA);
    assert.equal(appointment.specialty_id, i.specialtyA);
    assert.equal(new Date(appointment.starts_at).toISOString(), plan.appointments[0].startsAt);
    assert.equal(appointment.status, "CONFIRMED");
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
