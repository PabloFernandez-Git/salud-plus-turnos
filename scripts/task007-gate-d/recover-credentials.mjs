// The deleted ledger contained the only copy of the fixture password.
// Reassign one fresh password only after exact ownership is revalidated.
import { randomBytes } from "node:crypto";
import { assert, devClients, openDatabase, readLedger, saveLedger } from "./fixture-core.mjs";
import { readScopedInventory } from "./recovery-inventory.mjs";
import { expectedOwned, knownRecovery, verifyRecoverySnapshot } from "./recovery-known.mjs";

const ledger = readLedger();
assert(ledger.runId === knownRecovery.runId, "Unexpected run ID; STOP");
assert(ledger.stage === "integrated", "Credentials can only be recovered at integrated stage");
assert(
  ledger.password === null && ledger.credentialsRecovered === false,
  "Credentials already set; STOP",
);
assert(
  JSON.stringify(ledger.owned) === JSON.stringify(expectedOwned()),
  "Recovered ownership changed; STOP",
);
const { dev, authAdmin } = devClients();
assert(dev.projectRef === knownRecovery.projectRef, "Unexpected DEV project");
const database = await openDatabase(dev, "recover-credentials");
try {
  await database.query("begin read only");
  const snapshot = await readScopedInventory(database, dev.projectRef);
  const expectedActors = verifyRecoverySnapshot(snapshot);
  assert(
    JSON.stringify(ledger.actors) === JSON.stringify(expectedActors),
    "Recovered actor IDs/emails changed; STOP",
  );
  await database.query("rollback");
} finally {
  await database.query("rollback").catch(() => undefined);
  await database.end();
}

for (const actor of Object.values(ledger.actors)) {
  const { data, error } = await authAdmin.auth.admin.getUserById(actor.id);
  assert(!error && data.user?.email === actor.email, `Auth actor ${actor.id} changed; STOP`);
}

const password = `Task007d-${randomBytes(24).toString("base64url")}`;
for (const actor of Object.values(ledger.actors)) {
  const { data, error } = await authAdmin.auth.admin.updateUserById(actor.id, { password });
  assert(
    !error && data.user?.id === actor.id && data.user.email === actor.email,
    `Auth password update failed for exact actor ${actor.id}; STOP`,
  );
}
ledger.password = password;
ledger.credentialsRecovered = true;
ledger.evidence.push({
  at: new Date().toISOString(),
  event: "recovered_fixture_auth_password_assigned_by_exact_user_id",
  actorIds: Object.values(ledger.actors).map((actor) => actor.id),
});
saveLedger(ledger);
console.log(
  JSON.stringify({
    gate: "TASK-007D",
    runId: ledger.runId,
    credentialRecovery: "PASS",
    actorCount: Object.values(ledger.actors).length,
    passwordPrinted: false,
    next: "node node_modules/@playwright/test/cli.js test tests/e2e/task-007-gate-d.spec.mjs --config=playwright.task007.config.mjs --project=chromium --workers=1",
  }),
);
