import assert from "node:assert/strict";
import { ownedRows, resources } from "./plan.mjs";

export function canonicalInventory(rows) {
  assert(Array.isArray(rows), "Inventory rows must be an array");
  const expectedTables = resources.map(([table]) => table);
  assert.equal(new Set(expectedTables).size, expectedTables.length, "Duplicate inventory resource");
  assert.equal(rows.length, expectedTables.length, "Inventory resource count differs");
  const byTable = new Map();
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ["count", "digest", "table"]);
    assert(expectedTables.includes(row.table), `Unexpected inventory table ${row.table}`);
    assert(!byTable.has(row.table), `Duplicate inventory table ${row.table}`);
    assert.match(row.count, /^(?:0|[1-9]\d*)$/, `Invalid count for ${row.table}`);
    assert.match(row.digest, /^[0-9a-f]{32}$/, `Invalid digest for ${row.table}`);
    byTable.set(row.table, row);
  }
  assert.equal(byTable.size, expectedTables.length, "Inventory table missing");
  return expectedTables.map((table) => byTable.get(table));
}

export function assertInventoriesEqual(expected, observed) {
  const baseline = canonicalInventory(expected);
  const current = canonicalInventory(observed);
  for (let index = 0; index < baseline.length; index++)
    assert.deepEqual(
      current[index],
      baseline[index],
      `Inventory differs for ${baseline[index].table}`,
    );
}
export async function inventoryRows(client) {
  const rows = [];
  for (const [table, key] of resources) {
    const value = (
      await client.query(
        `select count(*)::text as count,md5(coalesce(string_agg((${key})::text,',' order by (${key})::text),'')) as digest from ${table}`,
      )
    ).rows[0];
    rows.push({ table, ...value });
  }
  return rows;
}
export async function inventory(client) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='15s'");
    const rows = await inventoryRows(client);
    await client.query("ROLLBACK");
    return rows;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }
}
export async function authRecoverySnapshot(client, plan) {
  const actors = Object.values(plan.actors);
  const ids = actors.map((actor) => actor.id);
  const emails = actors.map((actor) => actor.email);
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='15s'");
    const identities = (
      await client.query(
        "select id::text,email,raw_user_meta_data->>'gate' as gate,raw_user_meta_data->>'runId' as run_id from auth.users where id=any($1::uuid[]) or email=any($2::text[]) or raw_user_meta_data->>'runId'=$3 order by id",
        [ids, emails, plan.runId],
      )
    ).rows;
    const current = await inventoryRows(client);
    const withoutOwnedAuth = (
      await client.query(
        "select count(*)::text as count,md5(coalesce(string_agg(id::text,',' order by id::text),'')) as digest from auth.users where id<>all($1::uuid[])",
        [ids],
      )
    ).rows[0];
    await client.query("ROLLBACK");
    return {
      identities,
      current,
      withoutOwnedAuth: current.map((row) =>
        row.table === "auth.users" ? { table: row.table, ...withoutOwnedAuth } : row,
      ),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
async function one(client, sql, args) {
  const result = await client.query(sql, args);
  assert.equal(result.rowCount, 1, "Fixture DML affected unexpected rows");
}
export async function absent(client, plan) {
  const owned = ownedRows(plan);
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    for (const [table, ids] of Object.entries(owned)) {
      if (!ids.length) continue;
      const key = resources.find((x) => x[0] === table)[1];
      const rows = (
        await client.query(
          `select (${key})::text as id from ${table} where (${key})::text=any($1::text[])`,
          [ids],
        )
      ).rows;
      assert.equal(rows.length, 0, `Planned fixture key exists in ${table}`);
    }
    const emails = Object.values(plan.actors).map((x) => x.email);
    assert.equal(
      (
        await client.query(
          "select count(*)::int as n from auth.users where email=any($1::text[])",
          [emails],
        )
      ).rows[0].n,
      0,
    );
    await client.query("ROLLBACK");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }
}
export async function insertFixtures(client, ledger, save) {
  const { plan } = ledger,
    { ids: i, actors: a } = plan;
  assert(Object.values(a).every((x) => x.id));
  ledger.stage = "db_begin";
  save(ledger);
  await client.query("BEGIN");
  let commit = false;
  try {
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    for (const [name, actor] of Object.entries(a))
      await one(
        client,
        "insert into public.users(id,email,first_name,last_name) values($1,$2,$3,'Fixture')",
        [actor.id, actor.email, `Task021 ${name}`],
      );
    for (const [id, label] of [
      [i.centerA, "A"],
      [i.centerB, "B"],
    ])
      await one(
        client,
        "insert into public.centers(id,name,timezone) values($1,$2,'America/Argentina/Buenos_Aires')",
        [id, `TASK-021 ${label} ${plan.runId}`],
      );
    for (const [id, label] of [
      [i.professionalA, "A"],
      [i.professionalA2, "A2"],
    ])
      await one(
        client,
        "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'Task021',$2,'AR',$3,$4)",
        [
          id,
          `Professional ${label}`,
          `T021-P-${label}-${plan.runId}`,
          `task021-prof-${label.toLowerCase()}-${plan.runId}@example.test`,
        ],
      );
    for (const [id, professional] of [
      [i.pcA, i.professionalA],
      [i.pcA2, i.professionalA2],
    ])
      await one(
        client,
        "insert into public.professional_centers(id,professional_id,center_id,usual_appointment_duration_minutes) values($1,$2,$3,30)",
        [id, professional, i.centerA],
      );
    await one(client, "insert into public.specialties(id,center_id,name) values($1,$2,$3)", [
      i.specialtyA,
      i.centerA,
      `TASK-021 Specialty ${plan.runId}`,
    ]);
    for (const pc of [i.pcA, i.pcA2])
      await one(
        client,
        "insert into public.professional_center_specialties(professional_center_id,specialty_id,center_id) values($1,$2,$3)",
        [pc, i.specialtyA, i.centerA],
      );
    for (const [id, center, actor, role, pc] of [
      [i.adminMembershipA, i.centerA, a.adminA.id, "ADMIN", null],
      [i.receptionMembershipA, i.centerA, a.receptionA.id, "RECEPTION", null],
      [i.professionalMembershipA, i.centerA, a.professionalA.id, "PROFESSIONAL", i.pcA],
      [i.professionalMembershipA2, i.centerA, a.professionalA2.id, "PROFESSIONAL", i.pcA2],
      [i.adminMembershipB, i.centerB, a.adminB.id, "ADMIN", null],
    ])
      await one(
        client,
        "insert into public.center_memberships(id,center_id,user_id,role,professional_center_id) values($1,$2,$3,$4,$5)",
        [id, center, actor, role, pc],
      );
    for (const [id, label] of [
      [i.personA, "A"],
      [i.personA2, "A2"],
    ])
      await one(
        client,
        "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Task021',$2,'1990-01-01','AR',$3)",
        [id, `Patient ${label}`, `T021-PAT-${label}-${plan.runId}`],
      );
    for (const [id, person, label] of [
      [i.patientA, i.personA, "a"],
      [i.patientA2, i.personA2, "a2"],
    ])
      await one(
        client,
        "insert into public.patient_centers(id,person_id,center_id,phone,email) values($1,$2,$3,'0000000000',$4)",
        [id, person, i.centerA, `task021-patient-${label}-${plan.runId}@example.test`],
      );
    for (const row of plan.appointments)
      await one(
        client,
        "insert into public.appointments(id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          row.id,
          i.centerA,
          i[row.patient],
          i[row.professionalCenter],
          i.specialtyA,
          row.startsAt,
          row.endsAt,
          row.status,
        ],
      );
    ledger.stage = "db_commit_attempt";
    save(ledger);
    commit = true;
    await client.query("COMMIT");
    ledger.stage = "fixtures_ready";
    save(ledger);
  } catch (e) {
    if (commit)
      throw new Error("Database COMMIT outcome uncertain; reconcile read-only before cleanup");
    await client.query("ROLLBACK").catch(() => {});
    ledger.stage = "db_rolled_back";
    save(ledger);
    throw e;
  }
}
export async function ownership(client, plan, { allowPartial = false } = {}) {
  const o = ownedRows(plan),
    i = plan.ids;
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='15s'");
    const counts = {};
    for (const [table, ids] of Object.entries(o)) {
      if (!ids.length) {
        counts[table] = 0;
        continue;
      }
      const key = resources.find((x) => x[0] === table)[1];
      const actual = (
        await client.query(
          `select (${key})::text as id from ${table} where (${key})::text=any($1::text[]) order by id`,
          [ids],
        )
      ).rows.map((x) => x.id);
      assert(
        actual.every((x) => ids.includes(x)),
        `Unowned key in ${table}`,
      );
      if (!allowPartial) assert.deepEqual(actual, [...ids].sort(), `Missing fixture in ${table}`);
      counts[table] = actual.length;
    }
    const auth = (
      await client.query(
        "select id::text,email,raw_user_meta_data->>'gate' as gate,raw_user_meta_data->>'runId' as run_id from auth.users where email=any($1::text[])",
        [Object.values(plan.actors).map((x) => x.email)],
      )
    ).rows;
    for (const row of auth) {
      assert.equal(row.gate, "TASK-021");
      assert.equal(row.run_id, plan.runId);
      const actor = Object.values(plan.actors).find((x) => x.email === row.email);
      assert(actor && (!actor.id || actor.id === row.id), "Auth ownership mismatch");
    }
    const users = (
      await client.query(
        "select id::text,email,first_name,last_name from public.users where id=any($1::uuid[])",
        [
          Object.values(plan.actors)
            .map((actor) => actor.id)
            .filter(Boolean),
        ],
      )
    ).rows;
    for (const row of users) {
      const entry = Object.entries(plan.actors).find(([, actor]) => actor.id === row.id);
      assert(
        entry &&
          row.email === entry[1].email &&
          row.first_name === `Task021 ${entry[0]}` &&
          row.last_name === "Fixture",
        "Public user ownership mismatch",
      );
    }
    const professionals = (
      await client.query(
        "select id::text,document_number,email from public.professionals where id=any($1::uuid[])",
        [[i.professionalA, i.professionalA2]],
      )
    ).rows;
    for (const row of professionals) {
      const label = row.id === i.professionalA ? "A" : "A2";
      assert.equal(row.document_number, `T021-P-${label}-${plan.runId}`);
      assert.equal(row.email, `task021-prof-${label.toLowerCase()}-${plan.runId}@example.test`);
    }
    const pcs = (
      await client.query(
        "select id::text,professional_id::text,center_id::text from public.professional_centers where id=any($1::uuid[])",
        [[i.pcA, i.pcA2]],
      )
    ).rows;
    for (const row of pcs)
      assert.equal(row.professional_id, row.id === i.pcA ? i.professionalA : i.professionalA2);
    for (const row of pcs) assert.equal(row.center_id, i.centerA);
    const specialty = (
      await client.query(
        "select id::text,center_id::text,name from public.specialties where id=$1",
        [i.specialtyA],
      )
    ).rows;
    for (const row of specialty)
      assert(row.center_id === i.centerA && row.name === `TASK-021 Specialty ${plan.runId}`);
    const persons = (
      await client.query(
        "select id::text,document_number from public.persons where id=any($1::uuid[])",
        [[i.personA, i.personA2]],
      )
    ).rows;
    for (const row of persons)
      assert.equal(
        row.document_number,
        `T021-PAT-${row.id === i.personA ? "A" : "A2"}-${plan.runId}`,
      );
    const patients = (
      await client.query(
        "select id::text,person_id::text,center_id::text,email from public.patient_centers where id=any($1::uuid[])",
        [[i.patientA, i.patientA2]],
      )
    ).rows;
    for (const row of patients) {
      const first = row.id === i.patientA;
      assert.equal(row.person_id, first ? i.personA : i.personA2);
      assert.equal(row.center_id, i.centerA);
      assert.equal(row.email, `task021-patient-${first ? "a" : "a2"}-${plan.runId}@example.test`);
    }
    const centers = (
      await client.query(
        "select id::text,name,timezone from public.centers where id=any($1::uuid[])",
        [[i.centerA, i.centerB]],
      )
    ).rows;
    for (const row of centers) {
      assert.equal(row.name, `TASK-021 ${row.id === i.centerA ? "A" : "B"} ${plan.runId}`);
      assert.equal(row.timezone, "America/Argentina/Buenos_Aires");
    }
    for (const [table, column] of [
      ["public.appointments", "center_id"],
      ["public.patient_centers", "center_id"],
      ["public.center_memberships", "center_id"],
      ["public.professional_centers", "center_id"],
      ["public.specialties", "center_id"],
    ]) {
      const actual = (
        await client.query(
          `select id::text as id from ${table} where ${column}=any($1::uuid[]) order by id`,
          [[i.centerA, i.centerB]],
        )
      ).rows.map((x) => x.id);
      assert(
        actual.every((id) => o[table].includes(id)),
        `Unowned ${table} row in fixture centers`,
      );
    }
    const assignments = (
      await client.query(
        "select professional_center_id::text || '/' || specialty_id::text as id from public.professional_center_specialties where center_id=any($1::uuid[])",
        [[i.centerA, i.centerB]],
      )
    ).rows.map((x) => x.id);
    assert(
      assignments.every((id) => o["public.professional_center_specialties"].includes(id)),
      "Unowned assignment in fixture centers",
    );
    const appointments = (
      await client.query(
        "select id::text,center_id::text,patient_center_id::text,professional_center_id::text,specialty_id::text from public.appointments where id=any($1::uuid[])",
        [o["public.appointments"]],
      )
    ).rows;
    for (const row of appointments) {
      const planned = plan.appointments.find((x) => x.id === row.id);
      assert(
        planned &&
          row.center_id === i.centerA &&
          row.patient_center_id === i[planned.patient] &&
          row.professional_center_id === i[planned.professionalCenter] &&
          row.specialty_id === i.specialtyA,
      );
    }
    const members = (
      await client.query(
        "select id::text,user_id::text,center_id::text,role::text,professional_center_id::text from public.center_memberships where id=any($1::uuid[])",
        [o["public.center_memberships"]],
      )
    ).rows;
    const expected = [
      [i.adminMembershipA, plan.actors.adminA.id, i.centerA, "ADMIN", null],
      [i.receptionMembershipA, plan.actors.receptionA.id, i.centerA, "RECEPTION", null],
      [i.professionalMembershipA, plan.actors.professionalA.id, i.centerA, "PROFESSIONAL", i.pcA],
      [
        i.professionalMembershipA2,
        plan.actors.professionalA2.id,
        i.centerA,
        "PROFESSIONAL",
        i.pcA2,
      ],
      [i.adminMembershipB, plan.actors.adminB.id, i.centerB, "ADMIN", null],
    ];
    for (const row of members)
      assert(
        expected.some(
          ([id, user, center, role, pc]) =>
            row.id === id &&
            row.user_id === user &&
            row.center_id === center &&
            row.role === role &&
            row.professional_center_id === pc,
        ),
        "Membership ownership mismatch",
      );
    await client.query("ROLLBACK");
    return { counts, auth };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }
}
async function exactDelete(client, table, key, ids) {
  if (!ids.length) return;
  const rows = (
    await client.query(
      `delete from ${table} where (${key})::text=any($1::text[]) returning (${key})::text as id`,
      [ids],
    )
  ).rows
    .map((x) => x.id)
    .sort();
  assert.deepEqual(rows, [...ids].sort(), `Exact cleanup failed for ${table}`);
}
export async function cleanupDatabase(client, ledger, save) {
  const o = ownedRows(ledger.plan);
  ledger.stage = "db_cleanup_begin";
  save(ledger);
  await client.query("BEGIN");
  let commit = false;
  try {
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    for (const table of [
      "public.appointments",
      "public.patient_centers",
      "public.persons",
      "public.center_memberships",
    ])
      await exactDelete(client, table, "id", o[table]);
    await exactDelete(
      client,
      "public.professional_center_specialties",
      "professional_center_id::text || '/' || specialty_id::text",
      o["public.professional_center_specialties"],
    );
    for (const table of [
      "public.specialties",
      "public.professional_centers",
      "public.professionals",
      "public.centers",
      "public.users",
    ])
      await exactDelete(client, table, "id", o[table]);
    ledger.stage = "db_cleanup_commit_attempt";
    save(ledger);
    commit = true;
    await client.query("COMMIT");
    ledger.stage = "database_cleaned";
    save(ledger);
  } catch (e) {
    if (commit) throw new Error("Cleanup COMMIT outcome uncertain; read-only reconcile required");
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }
}
