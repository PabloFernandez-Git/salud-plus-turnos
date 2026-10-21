import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { projectRef } from "./ledger.mjs";

const resources = Object.freeze([
  ["auth.users", "id"],
  ["public.users", "id"],
  ["public.platform_admins", "user_id"],
  ["public.centers", "id"],
  ["public.center_memberships", "id"],
  ["public.professionals", "id"],
  ["public.professional_centers", "id"],
  ["public.specialties", "id"],
  ["public.professional_center_specialties", "professional_center_id, specialty_id"],
  ["public.availabilities", "id"],
  ["public.persons", "id"],
  ["public.patient_centers", "id"],
  ["public.appointments", "id"],
  ["private.provisioning_operations", "id"],
]);

export const resourceNames = Object.freeze(resources.map(([name]) => name).sort());

export function localMigrationVersions() {
  const versions = readdirSync(resolve("supabase/migrations"))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, 14))
    .sort();
  if (versions.length !== 23 || versions.at(-1) !== "20261019170000") {
    throw new Error("Local migration inventory is not the approved 23-version contract");
  }
  return versions;
}

export function validateInventory(snapshot) {
  if (snapshot.projectRef !== projectRef) throw new Error("Inventory project mismatch");
  if (snapshot.database !== "postgres" || snapshot.role !== "postgres") {
    throw new Error("Inventory PostgreSQL identity mismatch");
  }
  if (snapshot.readOnly !== "on") throw new Error("Inventory was not captured READ ONLY");
  if (!Array.isArray(snapshot.resources) || snapshot.resources.length !== resources.length) {
    throw new Error("Inventory must contain exactly fourteen resources");
  }
  const names = snapshot.resources.map((row) => row.resource).sort();
  if (JSON.stringify(names) !== JSON.stringify(resourceNames)) {
    throw new Error("Inventory resource set differs from the approved scope");
  }
  for (const row of snapshot.resources) {
    if (!Number.isSafeInteger(row.rowCount) || row.rowCount < 0) {
      throw new Error(`Invalid inventory count for ${row.resource}`);
    }
    if (!/^[0-9a-f]{32}$/.test(row.idDigest)) {
      throw new Error(`Invalid inventory digest for ${row.resource}`);
    }
  }
  if (
    !Array.isArray(snapshot.migrations) ||
    JSON.stringify(snapshot.migrations) !== JSON.stringify(localMigrationVersions())
  ) {
    throw new Error("Inventory migration ledger differs from the approved 23 versions");
  }
  return snapshot;
}

export function validateManualBaseline(baseline) {
  if (
    baseline.schemaVersion !== 1 ||
    baseline.projectRefReportedByUser !== projectRef ||
    !Array.isArray(baseline.resources) ||
    baseline.resources.length !== resources.length
  ) {
    throw new Error("Manual DEV baseline shape or project differs; STOP");
  }
  const names = baseline.resources.map((row) => row.resource).sort();
  if (JSON.stringify(names) !== JSON.stringify(resourceNames)) {
    throw new Error("Manual DEV baseline resource set differs; STOP");
  }
  for (const row of baseline.resources) {
    if (!Number.isSafeInteger(row.rowCount) || row.rowCount < 0) {
      throw new Error(`Invalid manual baseline count for ${row.resource}`);
    }
    if (!/^[0-9a-f]{32}$/.test(row.idDigest)) {
      throw new Error(`Invalid manual baseline digest for ${row.resource}`);
    }
    if (row.rowCount === 0 && row.idDigest !== "d41d8cd98f00b204e9800998ecf8427e") {
      throw new Error(`Empty manual baseline has nonempty digest for ${row.resource}`);
    }
  }
  return baseline;
}

export async function captureInventory(client) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    const identity = (
      await client.query(
        "select current_database() as database, current_user as role, current_setting('transaction_read_only') as read_only",
      )
    ).rows[0];
    const rows = [];
    for (const [resource, columns] of resources) {
      const expression =
        columns === "professional_center_id, specialty_id"
          ? "professional_center_id::text || '/' || specialty_id::text"
          : `${columns}::text`;
      const result = await client.query(
        `select count(*)::int as row_count, md5(coalesce(string_agg(${expression}, ',' order by ${columns}), '')) as id_digest from ${resource}`,
      );
      rows.push({
        resource,
        rowCount: result.rows[0].row_count,
        idDigest: result.rows[0].id_digest,
      });
    }
    const migrations = (
      await client.query(
        "select version from supabase_migrations.schema_migrations order by version",
      )
    ).rows.map((row) => row.version);
    const snapshot = {
      projectRef,
      database: identity.database,
      role: identity.role,
      readOnly: identity.read_only,
      resources: rows.sort((a, b) => a.resource.localeCompare(b.resource)),
      migrations,
    };
    return validateInventory(snapshot);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }
}

export function compareInventory(actual, expected) {
  validateInventory(actual);
  validateInventory(expected);
  for (const resource of resourceNames) {
    const a = actual.resources.find((row) => row.resource === resource);
    const b = expected.resources.find((row) => row.resource === resource);
    if (a.rowCount !== b.rowCount || a.idDigest !== b.idDigest) {
      throw new Error(`${resource} differs from the pre-fixture inventory; STOP`);
    }
  }
  return true;
}

export function compareInventoryToManual(actual, manual) {
  validateInventory(actual);
  validateManualBaseline(manual);
  for (const resource of resourceNames) {
    const a = actual.resources.find((row) => row.resource === resource);
    const b = manual.resources.find((row) => row.resource === resource);
    if (a.rowCount !== b.rowCount || a.idDigest !== b.idDigest) {
      throw new Error(`${resource} differs from the user-captured baseline; STOP before writes`);
    }
  }
  return true;
}
