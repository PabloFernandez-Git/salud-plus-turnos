import assert from "node:assert/strict";
import { inspect, localChecks } from "../task022-dev/gate.mjs";
import { ownedRows, resourceColumns } from "./plan.mjs";

export function localContract() {
  const local = localChecks();
  assert.equal(local.priorVersions.length, 23);
  return local;
}

async function snapshotInTransaction(client) {
  const resources = [];
  for (const [table, columns] of resourceColumns) {
    const key = columns.includes(",")
      ? "professional_center_id::text || '/' || specialty_id::text"
      : `${columns}::text`;
    const row = (
      await client.query(
        `select count(*)::int as count, md5(coalesce(string_agg((${key})::text,',' order by (${key})::text),'')) as digest from ${table}`,
      )
    ).rows[0];
    resources.push({ table, count: row.count, digest: row.digest });
  }
  return resources;
}

export async function readOnlyPreflight(client, local = localContract()) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    const catalog = await inspect(client, local.priorVersions, true);
    assert.equal(catalog.identity.read_only, "on");
    const resources = await snapshotInTransaction(client);
    await client.query("ROLLBACK");
    return { catalog, resources };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function readOnlyInventory(client) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    const resources = await snapshotInTransaction(client);
    await client.query("ROLLBACK");
    return resources;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export function compareInventory(actual, expected) {
  assert.deepEqual(actual, expected, "DEV inventory differs from initial 14-resource snapshot");
}

function keyExpression(table) {
  if (table === "public.professional_center_specialties")
    return "professional_center_id::text || '/' || specialty_id::text";
  return `${resourceColumns.find(([name]) => name === table)[1]}::text`;
}

export async function verifyExactFixtureScope(client, plan, { allowMissing = false } = {}) {
  const owned = ownedRows(plan);
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    for (const [table, expected] of Object.entries(owned)) {
      if (!expected.length) continue;
      const key = keyExpression(table);
      const actual = (
        await client.query(
          `select (${key})::text as id from ${table} where (${key})::text = any($1::text[]) order by id`,
          [expected],
        )
      ).rows.map((row) => row.id);
      if (!allowMissing)
        assert.deepEqual(actual, [...expected].sort(), `${table} exact UUID scope differs`);
      else assert(actual.every((id) => expected.includes(id)));
    }
    const i = plan.ids;
    const centers = (
      await client.query(
        "select id::text,name,timezone from public.centers where id=any($1::uuid[])",
        [[i.centerA, i.centerB]],
      )
    ).rows;
    assert.deepEqual(
      centers.sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: i.centerA, name: `TASK-022 A ${plan.runId}`, timezone: "America/New_York" },
        {
          id: i.centerB,
          name: `TASK-022 B ${plan.runId}`,
          timezone: "America/Argentina/Buenos_Aires",
        },
      ].sort((a, b) => a.id.localeCompare(b.id)),
      "Center fixture labels differ",
    );
    for (const [table, expectations] of [
      [
        "public.professionals",
        [
          [i.professionalA, `T022-P-A-${plan.runId}`, `task022-prof-a-${plan.runId}@example.test`],
          [i.professionalB, `T022-P-B-${plan.runId}`, `task022-prof-b-${plan.runId}@example.test`],
        ],
      ],
      [
        "public.persons",
        [
          [i.personA, `T022-PAT-A-${plan.runId}`, null],
          [i.personEmpty, `T022-PAT-Empty-${plan.runId}`, null],
          [i.personB, `T022-PAT-B-${plan.runId}`, null],
        ],
      ],
    ]) {
      const rows = (
        await client.query(
          `select id::text,document_number,${table === "public.professionals" ? "email" : "null::text as email"} from ${table} where id=any($1::uuid[])`,
          [expectations.map(([id]) => id)],
        )
      ).rows;
      assert.deepEqual(
        rows.sort((a, b) => a.id.localeCompare(b.id)),
        expectations
          .map(([id, document_number, email]) => ({ id, document_number, email }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        `${table} runId markers differ`,
      );
    }
    const specialties = (
      await client.query("select id::text,name from public.specialties where id=any($1::uuid[])", [
        [i.specialtyA, i.specialtyB],
      ])
    ).rows;
    assert.deepEqual(
      specialties.sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: i.specialtyA, name: `TASK-022 Specialty A ${plan.runId}` },
        { id: i.specialtyB, name: `TASK-022 Specialty B ${plan.runId}` },
      ].sort((a, b) => a.id.localeCompare(b.id)),
      "Specialty runId markers differ",
    );
    const patients = (
      await client.query(
        "select id::text,email from public.patient_centers where id=any($1::uuid[])",
        [[i.patientA, i.patientEmpty, i.patientB]],
      )
    ).rows;
    assert.deepEqual(
      patients.sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: i.patientA, email: `task022-patient-a-${plan.runId}@example.test` },
        { id: i.patientEmpty, email: `task022-patient-empty-${plan.runId}@example.test` },
        { id: i.patientB, email: `task022-patient-b-${plan.runId}@example.test` },
      ].sort((a, b) => a.id.localeCompare(b.id)),
      "PatientCenter runId markers differ",
    );
    const publicUsers = (
      await client.query("select id::text,email from public.users where id=any($1::uuid[])", [
        owned["public.users"],
      ])
    ).rows;
    assert.deepEqual(
      publicUsers.sort((a, b) => a.id.localeCompare(b.id)),
      Object.values(plan.actors)
        .map((actor) => ({ id: actor.id, email: actor.email }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      "Public user runId emails differ",
    );
    for (const [table, column, expected] of [
      ["public.appointments", "center_id", owned["public.appointments"]],
      ["public.patient_centers", "center_id", owned["public.patient_centers"]],
      ["public.center_memberships", "center_id", owned["public.center_memberships"]],
      ["public.professional_centers", "center_id", owned["public.professional_centers"]],
      ["public.specialties", "center_id", owned["public.specialties"]],
    ]) {
      const actual = (
        await client.query(
          `select id::text as id from ${table} where ${column}=any($1::uuid[]) order by id`,
          [[i.centerA, i.centerB]],
        )
      ).rows.map((row) => row.id);
      if (!allowMissing)
        assert.deepEqual(actual, [...expected].sort(), `${table} has unowned fixture-center rows`);
      else
        assert(
          actual.every((id) => expected.includes(id)),
          `${table} has unowned fixture-center rows`,
        );
    }
    const relations = (
      await client.query(
        "select professional_center_id::text || '/' || specialty_id::text as id from public.professional_center_specialties where center_id=any($1::uuid[]) order by id",
        [[i.centerA, i.centerB]],
      )
    ).rows.map((row) => row.id);
    assert.deepEqual(
      relations,
      [...owned["public.professional_center_specialties"]].sort(),
      "Professional/Specialty fixture centers contain unowned relations",
    );
    const userIds = owned["auth.users"];
    if (userIds.length) {
      const auth = (
        await client.query(
          "select id::text,email,raw_user_meta_data->>'gate' as gate,raw_user_meta_data->>'runId' as run_id from auth.users where id=any($1::uuid[])",
          [userIds],
        )
      ).rows;
      for (const row of auth) {
        assert.equal(row.gate, "TASK-022");
        assert.equal(row.run_id, plan.runId);
        assert(
          Object.values(plan.actors).some(
            (actor) => actor.id === row.id && actor.email === row.email,
          ),
        );
      }
      const members = (
        await client.query(
          "select id::text from public.center_memberships where user_id=any($1::uuid[]) order by id",
          [userIds],
        )
      ).rows.map((row) => row.id);
      assert.deepEqual(members, [...owned["public.center_memberships"]].sort());
    }
    const appointments = (
      await client.query(
        "select id::text,center_id::text,patient_center_id::text,professional_center_id::text,specialty_id::text,starts_at,status::text from public.appointments where id=any($1::uuid[])",
        [owned["public.appointments"]],
      )
    ).rows;
    assert.equal(appointments.length, plan.appointments.length);
    for (const row of appointments) {
      const planned = plan.appointments.find((item) => item.id === row.id);
      assert(planned);
      assert.equal(row.center_id, i[planned.center]);
      assert.equal(row.patient_center_id, i[planned.patient]);
      assert.equal(row.professional_center_id, i[planned.professionalCenter]);
      assert.equal(row.specialty_id, i[planned.specialty]);
      assert.equal(new Date(row.starts_at).toISOString(), planned.startsAt);
      assert.equal(row.status, planned.status);
    }
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function assertNoFixtureResidue(client, plan) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    for (const [table, ids] of Object.entries(ownedRows(plan))) {
      if (!ids.length) continue;
      const key = keyExpression(table);
      const count = (
        await client.query(
          `select count(*)::int as n from ${table} where (${key})::text=any($1::text[])`,
          [ids],
        )
      ).rows[0].n;
      assert.equal(count, 0, `${table} retains fixture UUIDs`);
    }
    const emails = Object.values(plan.actors).map((actor) => actor.email);
    const authByEmail = (
      await client.query("select count(*)::int as n from auth.users where email=any($1::text[])", [
        emails,
      ])
    ).rows[0].n;
    assert.equal(authByEmail, 0, "Auth retains runId-tagged emails");
    const userIds = ownedRows(plan)["auth.users"];
    if (userIds.length) {
      for (const table of ["auth.identities", "auth.sessions", "auth.refresh_tokens"]) {
        const n = (
          await client.query(
            `select count(*)::int as n from ${table} where user_id::text=any($1::text[])`,
            [userIds],
          )
        ).rows[0].n;
        assert.equal(n, 0, `${table} retains synthetic user references`);
      }
    }
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
