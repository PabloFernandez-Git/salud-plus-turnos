import { strict as assert } from "node:assert";
import { test } from "node:test";
import { auditClean } from "./audit-clean.mjs";

function cleanedLedger() {
  const ownedKeys = [
    "authUsers",
    "publicUsers",
    "centers",
    "memberships",
    "professionals",
    "professionalCenters",
    "platformAdmins",
    "persons",
    "patientCenters",
  ];
  const uuid = (number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
  const owned = Object.fromEntries(ownedKeys.map((key, index) => [key, [uuid(index + 1)]]));
  const before = Object.fromEntries(
    [
      "auth.users",
      "public.users",
      "public.centers",
      "public.center_memberships",
      "public.persons",
      "public.patient_centers",
      "public.professionals",
      "public.professional_centers",
      "public.platform_admins",
      "public.appointments",
    ].map((table, index) => [table, index < 4 || index === 8 ? [uuid(index + 20)] : []]),
  );
  return { stage: "cleaned", owned, before, authDeleted: [...owned.authUsers] };
}

test("post-clean audit reads only exact owned UUIDs and verifies original inventory", async () => {
  const ledger = cleanedLedger();
  const queries = [];
  const ownedByTable = {
    "auth.users": ledger.owned.authUsers,
    "public.users": ledger.owned.publicUsers,
    "public.centers": ledger.owned.centers,
    "public.center_memberships": ledger.owned.memberships,
    "public.professionals": ledger.owned.professionals,
    "public.professional_centers": ledger.owned.professionalCenters,
    "public.platform_admins": ledger.owned.platformAdmins,
    "public.persons": ledger.owned.persons,
    "public.patient_centers": ledger.owned.patientCenters,
  };
  const database = {
    async query(sql, parameters = []) {
      queries.push({ sql, parameters });
      assert.match(sql, /^select /);
      if (sql.includes("count(*)")) {
        const table = sql.match(/from ([a-z_.]+)/)?.[1];
        assert.ok(table);
        assert.equal(parameters.length, 1);
        assert.deepEqual(parameters[0], ownedByTable[table]);
        assert.match(sql, /where (?:id|user_id)=any\(\$1::uuid\[\]\)/);
        return { rows: [{ count: 0 }] };
      }
      const table = sql.match(/from ([a-z_.]+)/)?.[1];
      const column = sql.match(/^select ([a-z_]+)/)?.[1];
      assert.ok(table && column);
      return { rows: ledger.before[table].map((id) => ({ [column]: id })) };
    },
  };
  assert.deepEqual(await auditClean(database, ledger), {
    ownedIdsAbsent: true,
    inventoryRestored: true,
  });
  assert.equal(queries.filter((query) => query.sql.includes("count(*)")).length, 9);
  assert.equal(queries.length, 19);
});

test("post-clean audit stops if any owned UUID remains", async () => {
  const ledger = cleanedLedger();
  const database = {
    async query() {
      return { rows: [{ count: 1 }] };
    },
  };
  await assert.rejects(auditClean(database, ledger), /Owned UUID remains after cleanup/);
});
