import { inventory } from "./fixture-core.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function auditClean(database, ledger) {
  assert(ledger.stage === "cleaned", `Clean audit requires cleaned stage, got ${ledger.stage}`);
  assert(
    ledger.authDeleted.length === ledger.owned.authUsers.length &&
      ledger.owned.authUsers.every((id) => ledger.authDeleted.includes(id)),
    "Auth fixture deletion ledger is incomplete",
  );
  for (const [table, column, ids] of [
    ["auth.users", "id", ledger.owned.authUsers],
    ["public.users", "id", ledger.owned.publicUsers],
    ["public.centers", "id", ledger.owned.centers],
    ["public.center_memberships", "id", ledger.owned.memberships],
    ["public.professionals", "id", ledger.owned.professionals],
    ["public.professional_centers", "id", ledger.owned.professionalCenters],
    ["public.platform_admins", "user_id", ledger.owned.platformAdmins],
    ["public.persons", "id", ledger.owned.persons],
    ["public.patient_centers", "id", ledger.owned.patientCenters],
  ]) {
    const rows = await database.query(
      `select count(*)::int as count from ${table} where ${column}=any($1::uuid[])`,
      [ids],
    );
    assert(rows.rows[0].count === 0, `Owned UUID remains after cleanup: ${table}`);
  }
  const after = await inventory(database);
  assert(
    JSON.stringify(after) === JSON.stringify(ledger.before),
    "Persistent inventory differs from pre-fixture baseline",
  );
  return { ownedIdsAbsent: true, inventoryRestored: true };
}
