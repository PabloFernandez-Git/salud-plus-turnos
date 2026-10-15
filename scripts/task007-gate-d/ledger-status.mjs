import { assert, ledgerDigest, ledgerPath, readLedger } from "./fixture-core.mjs";

const expectedRunId = process.argv[2];
assert(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedRunId ?? ""),
  "Pass the exact expected runId",
);
const ledger = readLedger();
assert(ledger.runId === expectedRunId, "Ledger belongs to another run; STOP");
assert(ledger.ids?.centerA && ledger.ids?.centerB, "Center ownership IDs are missing");
assert(ledger.owned && typeof ledger.owned === "object", "Owned UUID sets are missing");
const ownership = Object.fromEntries(
  Object.entries(ledger.owned).map(([table, ids]) => {
    assert(Array.isArray(ids), `Invalid owned UUID list: ${table}`);
    assert(new Set(ids).size === ids.length, `Duplicate owned UUID: ${table}`);
    return [table, ids.length];
  }),
);
console.log(
  JSON.stringify({
    gate: "TASK-007D",
    ledger: ledgerPath,
    ledgerSha256: ledgerDigest(),
    projectRef: ledger.projectRef,
    runId: ledger.runId,
    stage: ledger.stage,
    centerA: ledger.ids.centerA,
    centerB: ledger.ids.centerB,
    ownership,
    credentialsPresent: typeof ledger.password === "string" && ledger.password.length > 20,
  }),
);
