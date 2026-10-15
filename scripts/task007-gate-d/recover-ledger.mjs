// Recovers only the interrupted run, after a fresh exact read-only DEV match.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assert,
  devClients,
  expectedDigest,
  inventory,
  ledgerPath,
  openDatabase,
  saveLedger,
} from "./fixture-core.mjs";
import { readScopedInventory } from "./recovery-inventory.mjs";
import { expectedOwned, knownRecovery, verifyRecoverySnapshot } from "./recovery-known.mjs";

assert(!existsSync(ledgerPath), `Existing durable ledger must be inspected: ${ledgerPath}`);
assert(
  !existsSync(resolve("test-results/task007-gate-d/fixture-ledger.json")),
  "Old ledger unexpectedly exists; STOP recovery",
);
const { dev } = devClients();
assert(dev.projectRef === knownRecovery.projectRef, "Unexpected DEV project");
const database = await openDatabase(dev, "recover-ledger");
let snapshot;
let before;
try {
  await database.query("begin isolation level repeatable read, read only");
  snapshot = await readScopedInventory(database, dev.projectRef);
  const actors = verifyRecoverySnapshot(snapshot);
  const current = await inventory(database);
  const owned = expectedOwned();
  const tableOwnership = {
    "auth.users": owned.authUsers,
    "public.users": owned.publicUsers,
    "public.centers": owned.centers,
    "public.center_memberships": owned.memberships,
    "public.persons": owned.persons,
    "public.patient_centers": owned.patientCenters,
    "public.professionals": owned.professionals,
    "public.professional_centers": owned.professionalCenters,
    "public.platform_admins": owned.platformAdmins,
    "public.appointments": [],
  };
  before = {};
  for (const [table, ownedIds] of Object.entries(tableOwnership)) {
    const ids = current[table];
    assert(ids.length === snapshot.counts[table], `Inventory drift in ${table}; STOP recovery`);
    assert(new Set(ids).size === ids.length, `Duplicate inventory ID in ${table}; STOP recovery`);
    assert(
      ownedIds.every((id) => ids.includes(id)),
      `Missing exact owned ID in ${table}; STOP recovery`,
    );
    before[table] = ids.filter((id) => !ownedIds.includes(id));
  }
  const baselineCounts = {
    "auth.users": 1,
    "public.users": 1,
    "public.centers": 1,
    "public.center_memberships": 1,
    "public.persons": 0,
    "public.patient_centers": 0,
    "public.professionals": 0,
    "public.professional_centers": 0,
    "public.platform_admins": 1,
    "public.appointments": 0,
  };
  assert(
    Object.entries(baselineCounts).every(([table, count]) => before[table].length === count),
    "Residual IDs differ from human-captured preflight; STOP recovery",
  );
  assert(
    before["auth.users"][0] === before["public.users"][0] &&
      before["auth.users"][0] === before["public.platform_admins"][0],
    "Residual baseline actor graph differs; STOP recovery",
  );
  await database.query("rollback");
  const ledger = {
    version: 1,
    projectRef: dev.projectRef,
    expectedDigest,
    runId: knownRecovery.runId,
    createdAt: null,
    recoveredAt: new Date().toISOString(),
    stage: "integrated",
    ids: knownRecovery.ids,
    before,
    password: null,
    credentialsRecovered: false,
    actors,
    owned,
    generated: {
      smokeDocument: `SMOKE-${knownRecovery.runId}`,
      manualUnlinkedDocument: `MANUAL-LINK-${knownRecovery.runId}`,
    },
    authDeleted: [],
    evidence: [
      {
        at: new Date().toISOString(),
        event: "ownership_recovered_from_exact_live_inventory",
        inventorySha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
        source:
          "human-captured run ID, setup counts, integration PASS, and fresh live DEV inventory",
      },
    ],
  };
  assert(!existsSync(ledgerPath), "Ledger appeared during recovery; STOP");
  saveLedger(ledger);
  console.log(
    JSON.stringify({
      gate: "TASK-007D",
      stage: "integrated",
      runId: ledger.runId,
      ledger: ledgerPath,
      ownership: Object.fromEntries(Object.entries(owned).map(([key, ids]) => [key, ids.length])),
      baselineCounts,
      credentialsRecovered: false,
      next: "node scripts/task007-gate-d.mjs audit",
    }),
  );
} finally {
  await database.query("rollback").catch(() => undefined);
  await database.end();
}
