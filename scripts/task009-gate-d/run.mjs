import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cleanupFixtures } from "./cleanup.mjs";
import { openDevDatabase } from "./dev-connection.mjs";
import { planFixtures, setupFixtures } from "./fixtures.mjs";
import {
  captureInventory,
  compareInventoryToManual,
  validateManualBaseline,
} from "./inventory.mjs";
import { assertUuid, ledgerPath, newLedger, readLedger, saveLedger } from "./ledger.mjs";
import { reconcilePendingAppointmentIntents } from "./reconcile.mjs";
import { runIntegration } from "./integration.mjs";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";

const manualPath = resolve(".task009-gate-d/manual-baseline.json");
const reportPath = resolve(".task009-gate-d/run-report.json");
const playwrightCli = resolve("node_modules/@playwright/test/cli.js");
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function verifiedPriorIntegration() {
  if (process.env.TASK009_BROWSER_ONLY !== "1") return null;
  const runId = process.env.TASK009_PREVIOUS_RUN_ID;
  assertUuid(runId, "prior runId");
  const archive = resolve(".task009-gate-d-archive", runId);
  const prior = JSON.parse(readFileSync(resolve(archive, "run-report.json"), "utf8"));
  const priorLedger = readLedger(resolve(archive, "fixture-ledger.json"));
  assert(
    prior.runId === runId &&
      priorLedger.runId === runId &&
      prior.projectRef === "ehllxymqyzrofydrvtzo" &&
      prior.integrationPassed === true &&
      prior.evidence?.filter((item) => item.outcome === "PASS").length === 6 &&
      prior.cleanupResult?.residueZero === true &&
      prior.cleanupResult?.inventoryRestored === true &&
      priorLedger.stage === "cleaned" &&
      JSON.stringify(prior.baseline) === JSON.stringify(prior.finalInventory) &&
      JSON.stringify(priorLedger.baseline) === JSON.stringify(priorLedger.finalInventory),
    "Prior integration or cleanup evidence is incomplete; STOP before DEV",
  );
  for (const kind of Object.keys(priorLedger.owned)) {
    assert(
      JSON.stringify([...priorLedger.owned[kind]].sort()) ===
        JSON.stringify([...priorLedger.cleanup[kind]].sort()),
      `Prior cleanup mismatch for ${kind}; STOP before DEV`,
    );
  }
  return { runId, evidenceGroups: 6 };
}

function runChild(args, env, capture = false) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: resolve("."),
      env: { ...process.env, ...env },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
    let output = "";
    if (capture) {
      child.stdout.on("data", (chunk) => (output += chunk.toString()));
      child.stderr.on("data", (chunk) => (output += chunk.toString()));
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveResult(output);
      else reject(new Error(`Local child command failed with exit code ${code}`));
    });
  });
}

async function authAdminReadOnlyProbe(admin) {
  const result = await admin.auth.admin.getUserById("00000000-0000-4000-8000-000000000000");
  assert(
    !result.data?.user && result.error?.status === 404,
    "DEV Auth Admin read-only probe failed; STOP before writes",
  );
}

async function finalDryRunAndLint() {
  const env = { CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" };
  const dryRun = await runChild(
    [supabaseCli, "db", "push", "--linked", "--dry-run", "--skip-vault"],
    env,
    true,
  );
  assert(
    dryRun.includes("DRY RUN: migrations will") && dryRun.includes("Remote database is up to date"),
    "Final DEV migration dry-run is not empty; STOP",
  );
  const lint = await runChild(
    [
      supabaseCli,
      "db",
      "lint",
      "--linked",
      "--schema",
      "public",
      "--level",
      "error",
      "--fail-on",
      "error",
    ],
    env,
    true,
  );
  assert(lint.includes("No schema errors found"), "Final DEV schema lint failed; STOP");
  return { dryRun: "Remote database is up to date", lint: "No schema errors found" };
}

async function main() {
  assert(process.argv.length === 2, "Run TASK-009 Gate D with no extra arguments");
  assert(!existsSync(ledgerPath), "Existing TASK-009 fixture ledger found; STOP and inspect it");
  const priorIntegration = verifiedPriorIntegration();
  assert(existsSync(manualPath), "User-captured DEV baseline is missing");
  const manual = validateManualBaseline(JSON.parse(readFileSync(manualPath, "utf8")));
  const dev = loadSupabaseDevConfig();
  assertLinkedSupabaseProject();
  assert(dev.projectRef === "ehllxymqyzrofydrvtzo", "DEV project ref differs");
  assert(process.env.SUPABASE_DB_PASSWORD?.trim(), "Existing SUPABASE_DB_PASSWORD is required");
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  assert(secretKey, "Existing DEV Auth Admin key is required");
  const admin = createClient(dev.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const database = await openDevDatabase("run");
  let ledger;
  let runError;
  let cleanupError;
  let cleanupResult;
  let finalChecks;
  let integrationPassed = false;
  let browserPassed = false;
  try {
    const before = await captureInventory(database);
    compareInventoryToManual(before, manual);
    await authAdminReadOnlyProbe(admin);
    console.log(
      "TASK009_PREFLIGHT_PASS: DEV identity, READ ONLY, 23 migrations, 14 baseline rows, Auth Admin read-only probe",
    );
    ledger = planFixtures(newLedger(before));
    saveLedger(ledger);
    console.log(`TASK009_RUN_ID=${ledger.runId}; ledger=${ledgerPath}`);
    const password = `Task009-${randomBytes(24).toString("base64url")}Aa1!`;
    await setupFixtures(database, admin, ledger, password);
    console.log("TASK009_SETUP_PASS: synthetic fixtures recorded");
    let browserDate;
    if (priorIntegration) {
      browserDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      console.log(`TASK009_PRIOR_INTEGRATION_REUSED: runId=${priorIntegration.runId}`);
    } else {
      const integration = await runIntegration(database, dev, ledger, password);
      integrationPassed = true;
      browserDate = integration.date;
      console.log(`TASK009_INTEGRATION_PASS: ${integration.testsPassed} evidence groups`);
    }
    await runChild(
      [
        playwrightCli,
        "test",
        "tests/e2e/task-009-gate-d.spec.mjs",
        "--config",
        "playwright.task009.config.ts",
        "--workers=1",
      ],
      {
        TASK009_TEST_PASSWORD: password,
        TASK009_DATE: browserDate,
        ...(priorIntegration ? { TASK009_BROWSER_ONLY: "1" } : {}),
        CI: "1",
      },
    );
    ledger = readLedger();
    ledger.stage = "browser_complete";
    saveLedger(ledger);
    browserPassed = true;
    console.log("TASK009_BROWSER_PASS");
  } catch (error) {
    runError = error;
    console.error(`TASK009_RUN_STOPPED: ${error.message}`);
  }

  try {
    if (ledger) {
      ledger = readLedger();
      if (["fixtures_ready", "integrated", "browser_complete"].includes(ledger.stage)) {
        const reconciled = await reconcilePendingAppointmentIntents(database, ledger);
        console.log(
          `TASK009_INTENTS_RECONCILED: checked=${reconciled.pendingChecked} recovered=${reconciled.recovered}`,
        );
        cleanupResult = await cleanupFixtures(database, admin, ledger);
        console.log("TASK009_CLEANUP_PASS: exact UUID residue zero and baseline restored");
        finalChecks = await finalDryRunAndLint();
        console.log("TASK009_FINAL_DRY_RUN_LINT_PASS");
      } else if (ledger.stage !== "cleaned") {
        throw new Error(
          `Run stopped at ${ledger.stage}; preserve ledger and inspect before cleanup`,
        );
      }
    }
  } catch (error) {
    console.error(`TASK009_CLEANUP_OR_FINAL_CHECK_STOPPED: ${error.message}`);
    cleanupError = error;
    if (!runError) runError = error;
  } finally {
    await database.end().catch(() => undefined);
  }
  const executionPassed =
    !runError &&
    !cleanupError &&
    (integrationPassed || Boolean(priorIntegration)) &&
    browserPassed &&
    ledger?.stage === "cleaned" &&
    cleanupResult?.residueZero === true &&
    cleanupResult?.inventoryRestored === true &&
    Boolean(finalChecks);
  const report = {
    task: "TASK-009",
    projectRef: dev.projectRef,
    runId: ledger?.runId ?? null,
    status: executionPassed ? "EXECUTION_PASS" : "BLOCKED",
    stage: ledger?.stage ?? "preflight",
    integrationPassed,
    priorIntegration,
    browserOnly: Boolean(priorIntegration),
    browserPassed,
    integrationAndBrowserPass: (integrationPassed || Boolean(priorIntegration)) && browserPassed,
    cleanupResult: cleanupResult ?? null,
    finalChecks: finalChecks ?? null,
    baseline: ledger?.baseline ?? null,
    finalInventory: ledger?.finalInventory ?? null,
    stoppedReason: runError?.message ?? null,
    cleanupStoppedReason: cleanupError?.message ?? null,
    evidence: ledger?.evidence ?? [],
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`TASK009_REPORT=${reportPath}`);
  if (!executionPassed)
    throw new Error("TASK-009 Gate D run stopped; inspect report and retained ledger");
  console.log("TASK009_GATE_D_EXECUTION_PASS: independent review and task closure remain separate");
}

await main();
