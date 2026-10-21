import { saveLedger } from "./ledger.mjs";

const plannedTables = [
  ["public.centers", "id", (p) => [p.ids.center]],
  ["public.users", "id", (p) => (p.authUserId ? [p.authUserId] : [])],
  ["public.center_memberships", "id", (p) => [p.ids.membership]],
  ["public.professionals", "id", (p) => [p.ids.professionalA, p.ids.professionalB]],
  ["public.professional_centers", "id", (p) => [p.ids.pcA, p.ids.pcB]],
  ["public.specialties", "id", (p) => [p.ids.specialtyA, p.ids.specialtyB]],
  ["public.availabilities", "id", (p) => p.availabilities.map((row) => row.id)],
  ["public.persons", "id", (p) => [p.ids.person]],
  ["public.patient_centers", "id", (p) => [p.ids.patient]],
  [
    "public.appointments",
    "id",
    (p) => [
      ...p.appointments.map((row) => row.id),
      ...(p.browserAppointmentId ? [p.browserAppointmentId] : []),
    ],
  ],
];

function sameSet(actual, expected, label) {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort()))
    throw new Error(`${label} differs from exact TASK-013 owned UUIDs; STOP`);
}

async function selectIds(client, table, column, ids) {
  if (!ids.length) return [];
  const result = await client.query(
    `select ${column} from ${table} where ${column}=any($1::uuid[])`,
    [ids],
  );
  return result.rows.map((row) => row[column]);
}

export async function assertPlanAbsent(client, plan) {
  for (const [table, column, values] of plannedTables) {
    const ids = values(plan);
    sameSet(await selectIds(client, table, column, ids), [], `${table} planned`);
  }
  const auth = await client.query("select id from auth.users where email=$1", [plan.authEmail]);
  if (auth.rowCount) throw new Error("Synthetic Auth email already exists; STOP");
  const assignments = await client.query(
    "select 1 from public.professional_center_specialties where (professional_center_id=$1 and specialty_id=$2) or (professional_center_id=$3 and specialty_id=$4)",
    [plan.ids.pcA, plan.ids.specialtyA, plan.ids.pcB, plan.ids.specialtyB],
  );
  if (assignments.rowCount) throw new Error("Planned Specialty assignments already exist; STOP");
}

export async function inspectFixtureState(client, plan) {
  const expected = plannedTables.flatMap(([, , values]) => values(plan)).length + 2;
  let found = 0;
  for (const [table, column, values] of plannedTables) {
    found += (await selectIds(client, table, column, values(plan))).length;
  }
  const assignments = await client.query(
    "select professional_center_id, specialty_id from public.professional_center_specialties where center_id=$1",
    [plan.ids.center],
  );
  found += assignments.rowCount;
  if (found === 0) return "absent";
  if (found === expected) return "complete";
  throw new Error(`TASK-013 fixture is partial (${found}/${expected}); STOP`);
}

export async function insertFixture(client, ledger, path) {
  if (!ledger.authUserId) throw new Error("Synthetic Auth user is not recorded; STOP");
  if ((await inspectFixtureState(client, ledger)) !== "absent")
    throw new Error("Fixture already exists; STOP");
  ledger.stage = "creating";
  saveLedger(ledger, path);
  const { ids: id, runId } = ledger;
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query(
      "insert into public.centers(id,name,timezone,is_active) values($1,$2,'America/New_York',true)",
      [id.center, `TASK-013 Visual ${runId}`],
    );
    await client.query(
      "insert into public.users(id,email,first_name,last_name) values($1,$2,'Task013','Fixture')",
      [ledger.authUserId, ledger.authEmail],
    );
    await client.query(
      "insert into public.center_memberships(id,center_id,user_id,role,is_active) values($1,$2,$3,'ADMIN',true)",
      [id.membership, id.center, ledger.authUserId],
    );
    for (const [label, professionalId] of [
      ["A", id.professionalA],
      ["B", id.professionalB],
    ]) {
      await client.query(
        "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'Task013',$2,'AR',$3,$4)",
        [
          professionalId,
          `Profesional ${label}`,
          `T013-${label}-${runId}`,
          `task013-prof-${label.toLowerCase()}-${runId}@example.test`,
        ],
      );
    }
    for (const [pc, professional] of [
      [id.pcA, id.professionalA],
      [id.pcB, id.professionalB],
    ]) {
      await client.query(
        "insert into public.professional_centers(id,professional_id,center_id,usual_appointment_duration_minutes) values($1,$2,$3,30)",
        [pc, professional, id.center],
      );
    }
    for (const [specialty, label] of [
      [id.specialtyA, "Clínica"],
      [id.specialtyB, "Cardiología"],
    ]) {
      await client.query(
        "insert into public.specialties(id,center_id,name,is_active) values($1,$2,$3,true)",
        [specialty, id.center, `TASK-013 ${label} ${runId}`],
      );
    }
    for (const [pc, specialty] of [
      [id.pcA, id.specialtyA],
      [id.pcB, id.specialtyB],
    ]) {
      await client.query(
        "insert into public.professional_center_specialties(professional_center_id,specialty_id,center_id,is_active) values($1,$2,$3,true)",
        [pc, specialty, id.center],
      );
    }
    for (const row of ledger.availabilities) {
      await client.query(
        "insert into public.availabilities(id,professional_center_id,center_id,weekday,start_time,end_time,is_active) values($1,$2,$3,$4,$5,$6,true)",
        [row.id, row.pc, id.center, row.weekday, row.start, row.end],
      );
    }
    await client.query(
      "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Paciente','Sintético','1990-01-01','AR',$2)",
      [id.person, `T013-PAT-${runId}`],
    );
    await client.query(
      "insert into public.patient_centers(id,person_id,center_id,phone,email,is_active) values($1,$2,$3,'0000000000',$4,true)",
      [id.patient, id.person, id.center, `task013-patient-${runId}@example.test`],
    );
    for (const row of ledger.appointments) {
      const start = row.instant
        ? { sql: "$6::timestamptz", value: row.instant }
        : { sql: "(($6::date + $7::time) at time zone 'America/New_York')", value: row.date };
      const params = row.instant
        ? [row.id, id.center, id.patient, row.pc, row.specialty, start.value, row.status]
        : [row.id, id.center, id.patient, row.pc, row.specialty, start.value, row.time, row.status];
      const status = row.instant ? "$7" : "$8";
      await client.query(
        `insert into public.appointments(id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status) values($1,$2,$3,$4,$5,${start.sql},${start.sql} + interval '30 minutes',${status})`,
        params,
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  if ((await inspectFixtureState(client, ledger)) !== "complete")
    throw new Error("Committed fixture cannot be verified; STOP");
  ledger.stage = "fixtures_ready";
  saveLedger(ledger, path);
}

export async function reconcileBrowserAppointment(client, ledger, path) {
  const rows = await client.query(
    "select id from public.appointments where center_id=$1 and patient_center_id=$2 and professional_center_id=$3 and specialty_id=$4 and (starts_at at time zone 'America/New_York')::date=$5::date and to_char(starts_at at time zone 'America/New_York','HH24:MI')='12:00'",
    [ledger.ids.center, ledger.ids.patient, ledger.ids.pcA, ledger.ids.specialtyA, ledger.date],
  );
  if (rows.rowCount > 1) throw new Error("Multiple browser CREATE candidates; STOP");
  const found = rows.rows[0]?.id ?? null;
  if (ledger.browserAppointmentId && found !== ledger.browserAppointmentId)
    throw new Error("Browser Appointment ownership differs from ledger; STOP");
  if (found && !ledger.browserAppointmentId) {
    ledger.browserAppointmentId = found;
    saveLedger(ledger, path);
  }
  return found;
}

export async function auditOwnership(client, ledger) {
  if ((await inspectFixtureState(client, ledger)) !== "complete")
    throw new Error("Fixture is not complete; STOP before cleanup");
  for (const [table, column, values] of plannedTables) {
    sameSet(await selectIds(client, table, column, values(ledger)), values(ledger), table);
  }
  for (const [table, values] of [
    ["public.center_memberships", [ledger.ids.membership]],
    ["public.professional_centers", [ledger.ids.pcA, ledger.ids.pcB]],
    ["public.specialties", [ledger.ids.specialtyA, ledger.ids.specialtyB]],
    ["public.availabilities", ledger.availabilities.map((row) => row.id)],
    ["public.patient_centers", [ledger.ids.patient]],
    [
      "public.appointments",
      [
        ...ledger.appointments.map((row) => row.id),
        ...(ledger.browserAppointmentId ? [ledger.browserAppointmentId] : []),
      ],
    ],
  ]) {
    const rows = await client.query(`select id from ${table} where center_id=$1`, [
      ledger.ids.center,
    ]);
    sameSet(
      rows.rows.map((row) => row.id),
      values,
      `${table} attached to Center`,
    );
  }
  const assignment = await client.query(
    "select professional_center_id::text || '/' || specialty_id::text as key from public.professional_center_specialties where center_id=$1",
    [ledger.ids.center],
  );
  sameSet(
    assignment.rows.map((row) => row.key),
    [`${ledger.ids.pcA}/${ledger.ids.specialtyA}`, `${ledger.ids.pcB}/${ledger.ids.specialtyB}`],
    "Specialty assignments attached to Center",
  );
  for (const [table, column, ids, expected] of [
    [
      "public.professional_centers",
      "professional_id",
      [ledger.ids.professionalA, ledger.ids.professionalB],
      [ledger.ids.pcA, ledger.ids.pcB],
    ],
    ["public.patient_centers", "person_id", [ledger.ids.person], [ledger.ids.patient]],
    ["public.center_memberships", "user_id", [ledger.authUserId], [ledger.ids.membership]],
  ]) {
    const rows = await client.query(`select id from ${table} where ${column}=any($1::uuid[])`, [
      ids,
    ]);
    sameSet(
      rows.rows.map((row) => row.id),
      expected,
      `${table} external links`,
    );
  }
  const auth = await client.query(
    "select id,email,raw_user_meta_data ->> 'taskId' as task_id,raw_user_meta_data ->> 'runId' as run_id from auth.users where id=$1",
    [ledger.authUserId],
  );
  if (
    auth.rowCount !== 1 ||
    auth.rows[0].email !== ledger.authEmail ||
    auth.rows[0].task_id !== "TASK-013" ||
    auth.rows[0].run_id !== ledger.runId
  )
    throw new Error("Synthetic Auth ownership differs; STOP");
}

async function deleteExact(client, table, column, values) {
  const rows = await client.query(
    `delete from ${table} where ${column}=any($1::uuid[]) returning ${column}`,
    [values],
  );
  sameSet(
    rows.rows.map((row) => row[column]),
    values,
    `${table} cleanup`,
  );
}

export async function cleanupDatabase(client, ledger, path) {
  await auditOwnership(client, ledger);
  ledger.stage = "cleanup_started";
  saveLedger(ledger, path);
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    await deleteExact(client, "public.appointments", "id", [
      ...ledger.appointments.map((row) => row.id),
      ...(ledger.browserAppointmentId ? [ledger.browserAppointmentId] : []),
    ]);
    await deleteExact(
      client,
      "public.availabilities",
      "id",
      ledger.availabilities.map((row) => row.id),
    );
    await deleteExact(client, "public.patient_centers", "id", [ledger.ids.patient]);
    await deleteExact(client, "public.persons", "id", [ledger.ids.person]);
    const assignments = await client.query(
      "delete from public.professional_center_specialties where center_id=$1 returning professional_center_id::text || '/' || specialty_id::text as key",
      [ledger.ids.center],
    );
    sameSet(
      assignments.rows.map((row) => row.key),
      [`${ledger.ids.pcA}/${ledger.ids.specialtyA}`, `${ledger.ids.pcB}/${ledger.ids.specialtyB}`],
      "Specialty assignment cleanup",
    );
    await deleteExact(client, "public.specialties", "id", [
      ledger.ids.specialtyA,
      ledger.ids.specialtyB,
    ]);
    await deleteExact(client, "public.center_memberships", "id", [ledger.ids.membership]);
    await deleteExact(client, "public.professional_centers", "id", [
      ledger.ids.pcA,
      ledger.ids.pcB,
    ]);
    await deleteExact(client, "public.professionals", "id", [
      ledger.ids.professionalA,
      ledger.ids.professionalB,
    ]);
    await deleteExact(client, "public.centers", "id", [ledger.ids.center]);
    await deleteExact(client, "public.users", "id", [ledger.authUserId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  ledger.stage = "database_cleaned";
  saveLedger(ledger, path);
}
