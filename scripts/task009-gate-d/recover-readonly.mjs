import assert from "node:assert/strict";
import { auditFixtureOwnership } from "./cleanup.mjs";
import { localMigrationVersions, validateInventory } from "./inventory.mjs";
import { validateLedger } from "./ledger.mjs";

const resources = [
  ["auth.users", "authUsers", "id"],
  ["private.provisioning_operations", null, "id"],
  ["public.appointments", "appointments", "id"],
  ["public.availabilities", "availabilities", "id"],
  ["public.center_memberships", "memberships", "id"],
  ["public.centers", "centers", "id"],
  ["public.patient_centers", "patientCenters", "id"],
  ["public.persons", "persons", "id"],
  ["public.platform_admins", "platformAdmins", "user_id"],
  ["public.professional_center_specialties", "professionalCenterSpecialties", null],
  ["public.professional_centers", "professionalCenters", "id"],
  ["public.professionals", "professionals", "id"],
  ["public.specialties", "specialties", "id"],
  ["public.users", "publicUsers", "id"],
];

function same(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} differs from the preserved run; STOP`);
}

export function candidateLedger(main, temporary) {
  validateLedger(main);
  validateLedger(temporary);
  assert.equal(main.stage, "creating");
  assert.equal(temporary.stage, "creating");
  same(main.runId, temporary.runId, "runId");
  same(main.baseline, temporary.baseline, "baseline");
  same(main.planned, temporary.planned, "planned UUIDs");
  same(main.actors, temporary.actors, "Auth actor IDs");
  same(main.authUserEmailsById, temporary.authUserEmailsById, "Auth mappings");
  same(main.appointmentIntents, {}, "main appointment intents");
  same(temporary.appointmentIntents, {}, "temporary appointment intents");
  assert.equal(main.owned.authUsers.length, 8);
  const candidate = structuredClone(main);
  for (const kind of Object.keys(candidate.planned)) {
    if (kind === "authUsers" || kind === "appointments") continue;
    candidate.owned[kind] = [...candidate.planned[kind]];
    assert(
      main.owned[kind].every((id) => candidate.owned[kind].includes(id)) &&
        temporary.owned[kind].every((id) => candidate.owned[kind].includes(id)),
      `${kind} local ownership snapshot diverged; STOP`,
    );
  }
  candidate.stage = "fixtures_ready";
  return validateLedger(candidate);
}

export async function verifyRecoveredFixturesReadOnly(client, candidate) {
  validateLedger(candidate);
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    const identity = (
      await client.query(
        "select current_database() as database, current_user as role, current_setting('transaction_read_only') as read_only",
      )
    ).rows[0];
    same(identity, { database: "postgres", role: "postgres", read_only: "on" }, "DEV identity");
    const versions = (
      await client.query(
        "select version from supabase_migrations.schema_migrations order by version",
      )
    ).rows.map((row) => row.version);
    same(versions, localMigrationVersions(), "migration parity");
    same(versions, candidate.baseline.migrations, "baseline migration parity");

    await auditFixtureOwnership(client, candidate);

    const markerChecks = [
      [
        "public.centers",
        "id",
        candidate.planned.centers,
        "name like $2 and timezone in ('America/Argentina/Buenos_Aires','America/New_York','Australia/Lord_Howe')",
        [`TASK-009 % ${candidate.runId}`],
      ],
      [
        "public.professionals",
        "id",
        candidate.planned.professionals,
        "document_number like $2 and email like $3",
        [`T009-P-%-${candidate.runId}`, `task009-prof-%-${candidate.runId}@example.test`],
      ],
      [
        "public.persons",
        "id",
        candidate.planned.persons,
        "document_number like $2",
        [`T009-PAT-%-${candidate.runId}`],
      ],
      [
        "public.specialties",
        "id",
        candidate.planned.specialties,
        "name like $2",
        [`TASK-009 Specialty % ${candidate.runId}`],
      ],
      [
        "public.patient_centers",
        "id",
        candidate.planned.patientCenters,
        "email like $2 and person_id=any($3::uuid[]) and center_id=any($4::uuid[])",
        [
          `task009-patient-%-${candidate.runId}@example.test`,
          candidate.planned.persons,
          candidate.planned.centers,
        ],
      ],
    ];
    for (const [table, key, ids, condition, parameters] of markerChecks) {
      const matching = await client.query(
        `select count(*)::int as count from ${table} where ${key}=any($1::uuid[]) and ${condition}`,
        [ids, ...parameters],
      );
      assert.equal(
        matching.rows[0].count,
        ids.length,
        `${table} runId ownership marker differs; STOP`,
      );
    }
    const appUsers = await client.query(
      "select id,email from public.users where id=any($1::uuid[])",
      [candidate.planned.publicUsers],
    );
    same(
      appUsers.rows.map((row) => [row.id, row.email]).sort(),
      Object.entries(candidate.authUserEmailsById).sort(),
      "synthetic app user emails",
    );

    const baseRows = [];
    for (const [table, kind, column] of resources) {
      const ids = kind ? candidate.owned[kind] : [];
      const compound = column === null;
      const expression = compound
        ? "professional_center_id::text || '/' || specialty_id::text"
        : `${column}::text`;
      const ordering = compound ? "professional_center_id, specialty_id" : column;
      const predicate = compound
        ? "not ((professional_center_id::text || '/' || specialty_id::text)=any($1::text[]))"
        : `not (${column}=any($1::uuid[]))`;
      const result = await client.query(
        `select count(*)::int as row_count, md5(coalesce(string_agg(${expression}, ',' order by ${ordering}), '')) as id_digest from ${table} where ${predicate}`,
        [ids],
      );
      baseRows.push({
        resource: table,
        rowCount: result.rows[0].row_count,
        idDigest: result.rows[0].id_digest,
      });
    }
    for (const row of baseRows) {
      const before = candidate.baseline.resources.find((item) => item.resource === row.resource);
      assert(before, `${row.resource} was absent from original baseline`);
      assert.equal(
        row.rowCount,
        before.rowCount,
        `${row.resource} unrelated row count drift; STOP`,
      );
      assert.equal(row.idDigest, before.idDigest, `${row.resource} unrelated UUID drift; STOP`);
    }
    validateInventory(candidate.baseline);
    return {
      runId: candidate.runId,
      migrations: versions.length,
      resourcesVerified: resources.length,
      authUsers: candidate.owned.authUsers.length,
      databaseRows: Object.entries(candidate.owned)
        .filter(([kind]) => kind !== "authUsers" && kind !== "appointments")
        .reduce((sum, [, ids]) => sum + ids.length, 0),
      unrelatedBaselineRestoredByExclusion: true,
    };
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }
}
