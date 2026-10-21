import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cleanupFixtures } from "./cleanup.mjs";
import { openDevDatabase } from "./dev-connection.mjs";
import { runIntegration } from "./integration.mjs";
import { ledgerPath, readLedger, saveLedger } from "./ledger.mjs";
import { reconcilePendingAppointmentIntents } from "./reconcile.mjs";
import { candidateLedger, verifyRecoveredFixturesReadOnly } from "./recover-readonly.mjs";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";

const RUN_ID = "f943fe75-0cd4-46b1-814e-f92ef8f8066f";
const root = resolve(".task009-gate-d");
const oldTempPath = resolve(root, "fixture-ledger.json.tmp");
const oldReportPath = resolve(root, "run-report.json");
const evidencePath = resolve(root, "recovery-evidence");
const markerPath = resolve(root, "recovery-run-started.json");
const reportPath = resolve(root, "recovery-report.json");
const playwrightCli = resolve("node_modules/@playwright/test/cli.js");
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function preserveOriginal(path) {
  const bytes = readFileSync(path);
  const digest = hash(bytes);
  const name = path.split(/[\\/]/).at(-1);
  const destination = resolve(evidencePath, `${name}.${digest}.original`);
  mkdirSync(dirname(destination), { recursive: true });
  if (!existsSync(destination)) copyFileSync(path, destination, constants.COPYFILE_EXCL);
  assert.equal(hash(readFileSync(destination)), digest, `Preserved ${name} digest differs; STOP`);
  return { name, sha256: digest };
}

function sanitized(error, fixturePassword = "") {
  let message = String(error?.message ?? error ?? "Unknown error");
  for (const value of [
    process.env.SUPABASE_DB_PASSWORD,
    process.env.SUPABASE_SECRET_KEY,
    fixturePassword,
  ]) {
    if (value) message = message.replaceAll(value, "[REDACTED]");
  }
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s,;]+/gi, "[REDACTED_CONNECTION_STRING]")
    .replace(/\b(password|pwd|token|secret)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "$1=[REDACTED]")
    .slice(0, 300);
}

function runChild(args, extraEnv = {}, capture = false) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: resolve("."),
      env: { ...process.env, ...extraEnv },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
    let output = "";
    if (capture) {
      child.stdout.on("data", (chunk) => (output += chunk.toString()));
      child.stderr.on("data", (chunk) => (output += chunk.toString()));
    }
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolveResult(output)
        : reject(new Error(`Local child command failed with exit code ${code}`)),
    );
  });
}

async function finalChecks() {
  const cliEnv = { CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" };
  const dryRun = await runChild(
    [supabaseCli, "db", "push", "--linked", "--dry-run", "--skip-vault"],
    cliEnv,
    true,
  );
  assert(
    dryRun.includes("DRY RUN: migrations will") && dryRun.includes("Remote database is up to date"),
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
    cliEnv,
    true,
  );
  assert(lint.includes("No schema errors found"));
  return { migrationDryRun: "up to date", schemaLint: "no errors" };
}

async function resetOwnedAuthPasswords(admin, ledger, password) {
  for (const id of ledger.owned.authUsers) {
    const before = await admin.auth.admin.getUserById(id);
    assert(!before.error && before.data?.user?.id === id, "Owned Auth identity changed; STOP");
    assert.equal(before.data.user.email, ledger.authUserEmailsById[id]);
    assert.equal(before.data.user.user_metadata?.runId, ledger.runId);
    assert.equal(before.data.user.user_metadata?.gate, "TASK-009");
    const result = await admin.auth.admin.updateUserById(id, { password });
    assert(!result.error && result.data?.user?.id === id, "Owned Auth password reset failed; STOP");
    assert.equal(result.data.user.email, ledger.authUserEmailsById[id]);
    assert.equal(result.data.user.user_metadata?.runId, ledger.runId);
    assert.equal(result.data.user.user_metadata?.gate, "TASK-009");
  }
}

async function main() {
  assert.equal(process.argv.length, 2, "Run recovery without arguments");
  assert(!existsSync(markerPath) && !existsSync(reportPath), "Recovery was already started; STOP");
  assert(existsSync(ledgerPath) && existsSync(oldTempPath) && existsSync(oldReportPath));
  const mainSnapshot = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const temporarySnapshot = JSON.parse(readFileSync(oldTempPath, "utf8"));
  const candidate = candidateLedger(mainSnapshot, temporarySnapshot);
  assert.equal(candidate.runId, RUN_ID);
  const originalReport = JSON.parse(readFileSync(oldReportPath, "utf8"));
  assert.equal(originalReport.runId, RUN_ID);
  assert.equal(originalReport.stage, "creating");
  assert.match(originalReport.stoppedReason, /^EPERM: operation not permitted, rename /);
  const preserved = [ledgerPath, oldTempPath, oldReportPath].map(preserveOriginal);

  const dev = loadSupabaseDevConfig();
  assertLinkedSupabaseProject();
  assert.equal(dev.projectRef, "ehllxymqyzrofydrvtzo");
  assert(process.env.SUPABASE_DB_PASSWORD?.trim(), "Existing DEV DB password is required");
  assert(process.env.SUPABASE_SECRET_KEY?.trim(), "Existing DEV Auth Admin key is required");
  const admin = createClient(dev.url, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const report = {
    task: "TASK-009",
    projectRef: dev.projectRef,
    runId: RUN_ID,
    originalEvidence: preserved,
    recoveredReadOnly: null,
    authPasswordReset: false,
    integration: false,
    browser: false,
    cleanup: null,
    finalChecks: null,
    status: "BLOCKED",
    error: null,
    cleanupError: null,
  };
  let fixturePassword = "";
  let database;
  let recovered = false;
  try {
    database = await openDevDatabase("recover-existing");
    report.recoveredReadOnly = await verifyRecoveredFixturesReadOnly(database, candidate);
    console.log(`TASK009_RECOVERY_READ_ONLY_PASS runId=${RUN_ID}`);
    writeFileSync(
      markerPath,
      `${JSON.stringify({ runId: RUN_ID, startedAt: new Date().toISOString(), originalEvidence: preserved }, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    saveLedger(candidate);
    recovered = true;
    fixturePassword = `Task009-${randomBytes(24).toString("base64url")}Aa1!`;
    await resetOwnedAuthPasswords(admin, candidate, fixturePassword);
    report.authPasswordReset = true;
    console.log("TASK009_OWNED_AUTH_PASSWORDS_READY");
    const integrated = await runIntegration(database, dev, candidate, fixturePassword);
    report.integration = true;
    console.log(`TASK009_INTEGRATION_PASS groups=${integrated.testsPassed}`);
    await runChild(
      [
        playwrightCli,
        "test",
        "tests/e2e/task-009-gate-d.spec.mjs",
        "--config",
        "playwright.task009.config.ts",
        "--workers=1",
      ],
      { TASK009_TEST_PASSWORD: fixturePassword, TASK009_DATE: integrated.date, CI: "1" },
    );
    const afterBrowser = readLedger();
    afterBrowser.stage = "browser_complete";
    saveLedger(afterBrowser);
    report.browser = true;
    console.log("TASK009_BROWSER_PASS");
  } catch (error) {
    report.error = sanitized(error, fixturePassword);
    console.error(`TASK009_RECOVERY_STOPPED: ${report.error}`);
  }

  if (recovered && database) {
    try {
      const ledger = readLedger();
      if (!["fixtures_ready", "integrated", "browser_complete"].includes(ledger.stage)) {
        throw new Error(`Ledger stage ${ledger.stage} requires audit before cleanup; STOP`);
      }
      const intents = await reconcilePendingAppointmentIntents(database, ledger);
      report.intents = intents;
      report.cleanup = await cleanupFixtures(database, admin, ledger);
      console.log("TASK009_CLEANUP_PASS: exact UUID residue zero and baseline restored");
      report.finalChecks = await finalChecks();
      console.log("TASK009_FINAL_DRY_RUN_LINT_PASS");
    } catch (error) {
      report.cleanupError = sanitized(error, fixturePassword);
      console.error(`TASK009_CLEANUP_STOPPED: ${report.cleanupError}`);
    }
  }
  if (database) await database.end().catch(() => undefined);
  report.status =
    report.recoveredReadOnly &&
    report.integration &&
    report.browser &&
    report.cleanup?.residueZero &&
    report.finalChecks &&
    !report.error &&
    !report.cleanupError
      ? "EXECUTION_PASS"
      : "BLOCKED";
  report.ledgerStage = existsSync(ledgerPath) ? readLedger().stage : "missing";
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`TASK009_RECOVERY_REPORT=${reportPath}`);
  assert.equal(
    report.status,
    "EXECUTION_PASS",
    "Gate D recovery did not complete; preserve ledger and report",
  );
  console.log("TASK009_GATE_D_EXECUTION_PASS: Gate D review and task closure remain separate");
}

await main();
