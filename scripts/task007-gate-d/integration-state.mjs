import { assert, ledgerPath, saveLedger } from "./fixture-core.mjs";

export function completeIntegration(ledger, scenarios, path = ledgerPath) {
  assert(ledger.stage === "fixtures_ready", `Expected fixtures_ready, got ${ledger.stage}`);
  ledger.stage = "integrated";
  ledger.evidence.push({
    at: new Date().toISOString(),
    event: "db_integration_pass",
    scenarios,
  });
  saveLedger(ledger, path);
}
