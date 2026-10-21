import { existsSync } from "node:fs";
import { makePlan } from "./plan.mjs";
import { readLedger, saveLedger } from "./ledger.mjs";

// The same sequence is exercised by the local simulation and the DEV adapters.
// A failed browser assertion still triggers exact cleanup; an uncertain owner
// or a new reference in the isolated Center stops cleanup and preserves ledger.
export async function executeValidation({ adapters, ledgerPath, now, runId }) {
  if (existsSync(ledgerPath))
    throw new Error("TASK-013 ledger already exists; inspect before any write");
  const ledger = makePlan({ now, runId });
  await adapters.preflight(ledger);
  ledger.baseline = await adapters.captureInventory();
  await adapters.assertPlanAbsent(ledger);
  saveLedger(ledger, ledgerPath);

  let browserError = null;
  let runError = null;
  let cleanupError = null;
  try {
    ledger.authUserId = await adapters.createAuth(ledger);
    ledger.stage = "auth_ready";
    saveLedger(ledger, ledgerPath);
    await adapters.insertFixture(ledger, ledgerPath);
    ledger.stage = "browser_running";
    saveLedger(ledger, ledgerPath);
    try {
      await adapters.runBrowser(ledger, ledgerPath);
      ledger.stage = "browser_complete";
      saveLedger(ledger, ledgerPath);
    } catch (error) {
      browserError = error;
    }
  } catch (error) {
    runError = error;
  }

  try {
    await cleanupOwned({ adapters, ledger, ledgerPath });
  } catch (error) {
    cleanupError = error;
  }

  if (cleanupError) throw new Error(`TASK-013 cleanup stopped: ${cleanupError.message}`);
  if (runError) throw new Error(`TASK-013 run stopped and cleaned: ${runError.message}`);
  if (browserError)
    throw new Error(`TASK-013 browser validation failed and cleaned: ${browserError.message}`);
  return readLedger(ledgerPath);
}

export async function cleanupOwned({ adapters, ledger, ledgerPath }) {
  if (ledger.stage === "cleaned") {
    await adapters.compareInventory(await adapters.captureInventory(), ledger.baseline);
    return ledger;
  }
  // Browser may have committed CREATE immediately before a lost response.
  // Resolve its exact synthetic slot before checking Center ownership.
  if (ledger.authUserId) await adapters.reconcileBrowserAppointment(ledger, ledgerPath);
  const state = await adapters.inspectFixtureState(ledger);
  if (state === "complete") {
    await adapters.cleanupDatabase(ledger, ledgerPath);
  } else if (state !== "absent") {
    throw new Error("Fixture state is uncertain; preserve ledger");
  }
  if (ledger.authUserId && !ledger.authDeleted) {
    await adapters.deleteAuth(ledger);
    ledger.authDeleted = true;
    saveLedger(ledger, ledgerPath);
  } else {
    await adapters.assertAuthAbsent(ledger);
  }
  const after = await adapters.captureInventory();
  await adapters.compareInventory(after, ledger.baseline);
  ledger.cleanup = { residueZero: true, inventoryRestored: true, at: new Date().toISOString() };
  ledger.stage = "cleaned";
  saveLedger(ledger, ledgerPath);
  return ledger;
}
