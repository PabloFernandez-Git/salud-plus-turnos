import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { openDevDatabase } from "../task009-gate-d/dev-connection.mjs";
import { loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";
import {
  assertNoFixtureResidue,
  compareInventory,
  localContract,
  readOnlyInventory,
  readOnlyPreflight,
  verifyExactFixtureScope,
} from "./database.mjs";
import { browserEnvironment } from "./environment.mjs";
import { assertClosureActorEvidence } from "./actor-evidence.mjs";
import { insertFocusedDatabaseFixtures, verifyFocusedFixtureScope } from "./focused-fixtures.mjs";
import { runRpcChecks } from "./checks.mjs";
import {
  assertPlanAbsent,
  cleanupAuthFixtures,
  cleanupDatabaseFixtures,
  createAuthFixtures,
  insertDatabaseFixtures,
} from "./fixtures.mjs";
import {
  assertFixtureLimits,
  assertFocusedFixtureLimits,
  buildFixturePlan,
  ownedRows,
  projectRef,
} from "./plan.mjs";

const ledgerPath = resolve(".task022-functional-dev/ledger.json");
const reportPath = resolve(".task022-functional-dev/report.json");
const focusedLedgerPath = resolve(".task022-functional-dev/focused-ledger.json");
const focusedReportPath = resolve(".task022-functional-dev/focused-report.json");
const focusedPlanPath = resolve(".task022-functional-dev/focused-plan.json");
const focusedBrowserEvidencePath = resolve(".task022-functional-dev/focused-browser-evidence.json");
const finalLedgerPath = resolve(".task022-functional-dev/final-ledger.json");
const finalReportPath = resolve(".task022-functional-dev/final-report.json");
const finalPlanPath = resolve(".task022-functional-dev/final-plan.json");
const finalBrowserEvidencePath = resolve(".task022-functional-dev/final-browser-evidence.json");
const finalPlaywrightResultsPath = resolve(".task022-functional-dev/final-playwright-results");
const closureLedgerPath = resolve(".task022-functional-dev/closure-ledger.json");
const closureReportPath = resolve(".task022-functional-dev/closure-report.json");
const closurePlanPath = resolve(".task022-functional-dev/closure-plan.json");
const closureBrowserEvidencePath = resolve(".task022-functional-dev/closure-browser-evidence.json");
const closurePlaywrightResultsPath = resolve(".task022-functional-dev/closure-playwright-results");
const finalRunId = "605a2632-9453-4d56-8cad-fd19379506b2";
const closureRunId = "9b581bb1-e2be-44e4-b33d-77efbc594982";
const approvedFocusedPlanSha256 =
  "0DAE3BFB6EACD63422F3F7B1A9A921F99B9C55B02CEB4E502EE4FD8A4427B476";
const approvedFinalPlanSha256 = "6312E6D70A2F1EABD8A02D915E52621A3A4CAF6630404E1EEB8E2212E6AD34B0";
const approvedClosurePlanSha256 =
  "46D02A0C5D7F9DD65AE61BAE13584DD07C9229EB0568C0D41B2AAB4918565F99";

function focusedPlan(final = false, requireFuture = true, closure = false) {
  const bytes = readFileSync(closure ? closurePlanPath : final ? finalPlanPath : focusedPlanPath);
  const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  assert.equal(
    actual,
    closure
      ? approvedClosurePlanSha256
      : final
        ? approvedFinalPlanSha256
        : approvedFocusedPlanSha256,
    "Focused fixture plan changed since review",
  );
  const plan = JSON.parse(bytes.toString("utf8"));
  assertFocusedFixtureLimits(plan);
  if (closure) assert.equal(plan.runId, closureRunId);
  else if (final) assert.equal(plan.runId, finalRunId);
  if (requireFuture)
    assert(
      Date.parse(plan.appointments[0].startsAt) > Date.now() + 86_400_000,
      "Focused future appointment is too close or past; prepare a new reviewed plan",
    );
  const previousPath = closure ? finalLedgerPath : final ? focusedLedgerPath : ledgerPath;
  assert(existsSync(previousPath), "Previous TASK-022 ledger missing");
  const previous = JSON.parse(readFileSync(previousPath, "utf8"));
  assert.equal(previous.stage, "cleaned", "Previous run is not cleaned");
  assert.equal(
    previous.plan.runId,
    closure
      ? finalRunId
      : final
        ? "952b509b-2c03-42b6-849f-a15822b1905e"
        : "5597e6db-ddfb-43fa-8b99-5a8406a6ab16",
  );
  if (final || closure) {
    assert.equal(previous.cleanupEvidence?.residue, 0);
    assert.equal(previous.cleanupEvidence?.resourcesMatched, 14);
    compareInventory(previous.finalInventory, previous.baseline);
  }
  assert.notEqual(plan.runId, previous.plan.runId);
  if (closure) {
    for (const path of [ledgerPath, focusedLedgerPath, finalLedgerPath]) {
      const prior = JSON.parse(readFileSync(path, "utf8"));
      assert.notEqual(
        prior.plan.runId,
        plan.runId,
        "Closure runId already exists in a prior ledger",
      );
    }
  }
  const e2e = readFileSync(resolve("tests/e2e/task-022-functional-dev.spec.mjs"), "utf8");
  assert.equal(
    e2e.split('test("RECEPTION puede leer; PROFESSIONAL y otro centro no acceden"').length - 1,
    1,
    "Focused Chromium scenario selector is not unique",
  );
  return plan;
}

function save(ledger) {
  const path =
    ledger.plan.runId === closureRunId
      ? closureLedgerPath
      : ledger.plan.runId === finalRunId
        ? finalLedgerPath
        : ledger.plan.scope === "denial"
          ? focusedLedgerPath
          : ledgerPath;
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  renameSync(temporary, path);
}

function report(ledger, status, error = null, focused = false, plannedRunId = null) {
  const scoped = focused || ledger?.plan.scope === "denial";
  const closure = (ledger?.plan.runId ?? plannedRunId) === closureRunId;
  const final = (ledger?.plan.runId ?? plannedRunId) === finalRunId;
  const path = closure
    ? closureReportPath
    : final
      ? finalReportPath
      : scoped
        ? focusedReportPath
        : reportPath;
  mkdirSync(dirname(path), { recursive: true });
  const output = {
    task: "TASK-022",
    ...(scoped ? { scope: "denial" } : {}),
    projectRef,
    runId: ledger?.plan.runId ?? plannedRunId,
    status,
    stage: ledger?.stage ?? "preflight",
    evidence: ledger?.evidence ?? [],
    ...(scoped && ledger
      ? {
          inventory: { initial: ledger.baseline, final: ledger.finalInventory ?? null },
          cleanup: ledger.cleanupEvidence ?? null,
          browser: ledger.browserEvidence ?? null,
        }
      : {}),
    error: error
      ? `${error.name ?? "Error"}:${/^[A-Z0-9_]{2,32}$/.test(error.code ?? "") ? error.code : "STOP"}`
      : null,
  };
  writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
  console.log(
    `TASK022_FUNCTIONAL_${status} stage=${output.stage} ledger=${closure ? closureLedgerPath : final ? finalLedgerPath : scoped ? focusedLedgerPath : ledgerPath}`,
  );
}

function evidence(ledger, label) {
  ledger.evidence.push({ at: new Date().toISOString(), label });
  save(ledger);
}

function focusedCleanupEvidence(ledger) {
  return {
    verifiedAbsentIds: ownedRows(ledger.plan),
    authUsersAbsent: Object.keys(ledger.plan.actors).length,
    residue: 0,
    resourcesMatched: 14,
    catalogUnchanged: true,
  };
}

async function authAdminProbe(admin) {
  const result = await admin.auth.admin.getUserById("00000000-0000-4000-8000-000000000000");
  assert(!result.data?.user && result.error?.status === 404, "Auth Admin read-only probe failed");
}

async function publishableProbe(dev) {
  const anon = createClient(dev.url, dev.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = await anon.rpc("staff_list_patient_appointments", {
    p_center_id: "00000000-0000-4000-8000-000000000000",
    p_patient_center_id: "00000000-0000-4000-8000-000000000000",
    p_section: "HISTORY",
    p_as_of: new Date().toISOString(),
    p_cursor_starts_at: null,
    p_cursor_id: null,
    p_limit: 1,
  });
  assert.equal(result.error?.code, "42501", "DEV publishable key or anon RPC denial differs");
}

async function browser(ledger, password, dev) {
  const cli = resolve("node_modules/@playwright/test/cli.js");
  const closure = ledger.plan.runId === closureRunId;
  const final = ledger.plan.runId === finalRunId;
  await new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        "test",
        "tests/e2e/task-022-functional-dev.spec.mjs",
        "--config",
        "playwright.task022.config.ts",
        "--workers=1",
        ...(ledger.plan.scope === "denial"
          ? [
              "--grep",
              "RECEPTION puede leer; PROFESSIONAL y otro centro no acceden",
              "--output",
              closure
                ? ".task022-functional-dev/closure-playwright-results"
                : final
                  ? ".task022-functional-dev/final-playwright-results"
                  : ".task022-functional-dev/focused-playwright-results",
            ]
          : []),
      ],
      {
        cwd: resolve("."),
        windowsHide: true,
        stdio: "inherit",
        env: {
          ...browserEnvironment(process.env, dev, password),
          ...(ledger.plan.scope === "denial"
            ? {
                TASK022_FUNCTIONAL_SCOPE: closure
                  ? "denial-closure"
                  : final
                    ? "denial-final"
                    : "denial",
              }
            : {}),
        },
      },
    );
    child.on("error", fail);
    child.on("exit", (code) =>
      code === 0
        ? done()
        : fail(new Error(`Isolated Chromium tests failed with exit code ${code}`)),
    );
  });
  if (!closure)
    evidence(
      ledger,
      ledger.plan.scope === "denial"
        ? "Focused authenticated Chromium denial scenario PASS"
        : "Authenticated Chromium UI PASS",
    );
}

async function reconcileReadOnly(client, ledger) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    const auth = [];
    for (const [name, actor] of Object.entries(ledger.plan.actors)) {
      const rows = (
        await client.query(
          "select id::text,email,raw_user_meta_data->>'gate' as gate,raw_user_meta_data->>'runId' as run_id from auth.users where email=$1",
          [actor.email],
        )
      ).rows;
      assert(rows.length <= 1);
      if (rows.length) {
        assert.equal(rows[0].gate, "TASK-022");
        assert.equal(rows[0].run_id, ledger.plan.runId);
        auth.push({ actor: name, id: rows[0].id, present: true });
      } else auth.push({ actor: name, id: actor.id, present: false });
    }
    const counts = {};
    for (const [table, ids] of Object.entries(ownedRows(ledger.plan))) {
      if (!ids.length || table === "auth.users") continue;
      const key =
        table === "public.professional_center_specialties"
          ? "professional_center_id::text || '/' || specialty_id::text"
          : table === "public.platform_admins"
            ? "user_id::text"
            : "id::text";
      counts[table] = (
        await client.query(
          `select count(*)::int as n from ${table} where (${key})::text=any($1::text[])`,
          [ids],
        )
      ).rows[0].n;
    }
    await client.query("ROLLBACK");
    return { auth, counts };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function main() {
  const mode = process.argv[2];
  const closure = mode?.startsWith("closure-") ?? false;
  const final = mode?.startsWith("final-") ?? false;
  const focused = closure || final || (mode?.startsWith("focused-") ?? false);
  const operation = closure
    ? mode.slice("closure-".length)
    : final
      ? mode.slice("final-".length)
      : focused
        ? mode.slice("focused-".length)
        : mode;
  assert(
    ["local", "preflight", "run", "reconcile", "cleanup"].includes(operation) &&
      (!focused || operation !== "preflight") &&
      process.argv.length === 3,
    "Usage: node scripts/task022-functional-dev/gate.mjs local|preflight|run|reconcile|cleanup|focused-local|focused-run|focused-reconcile|focused-cleanup|final-local|final-run|final-reconcile|final-cleanup|closure-local|closure-run|closure-reconcile|closure-cleanup",
  );
  const local = localContract();
  const preparedPlan = focused
    ? focusedPlan(final, operation === "local" || operation === "run", closure)
    : null;
  const scopedLedgerPath = closure
    ? closureLedgerPath
    : final
      ? finalLedgerPath
      : focusedLedgerPath;
  const scopedBrowserEvidencePath = closure
    ? closureBrowserEvidencePath
    : final
      ? finalBrowserEvidencePath
      : focusedBrowserEvidencePath;
  if (operation === "local") {
    if (final || closure) {
      assert(!existsSync(scopedLedgerPath), "Focused runId already has a ledger");
      assert(
        !existsSync(closure ? closureReportPath : finalReportPath),
        "Focused runId already has a report",
      );
      assert(!existsSync(scopedBrowserEvidencePath), "Focused runId already has browser evidence");
      assert(
        !existsSync(closure ? closurePlaywrightResultsPath : finalPlaywrightResultsPath),
        "Focused runId already has Chromium results",
      );
    }
    const plan = preparedPlan ?? buildFixturePlan();
    if (!focused) assertFixtureLimits(plan);
    console.log(
      focused
        ? `TASK022_FOCUSED_LOCAL_PASS project=${projectRef} runId=${plan.runId} fixtures=4/2/1/1 planSha256=${closure ? approvedClosurePlanSha256 : final ? approvedFinalPlanSha256 : approvedFocusedPlanSha256}`
        : `TASK022_FUNCTIONAL_LOCAL_PASS project=${projectRef} migrations=24 fixtures=5/2/3/30 sha256=${local.actualSha256}`,
    );
    return;
  }
  const dev = loadSupabaseDevConfig();
  assert.equal(dev.projectRef, projectRef);
  if (operation === "run") {
    assert.equal(
      process.env.TASK022_FUNCTIONAL_DEV_WRITE_AUTHORIZATION,
      projectRef,
      "Explicit DEV fixture write authorization missing",
    );
    assert(
      !existsSync(focused ? scopedLedgerPath : ledgerPath),
      "Existing TASK-022 ledger; STOP, reconcile before any new run",
    );
    if (final || closure)
      assert(
        !existsSync(closure ? closureReportPath : finalReportPath),
        "Existing focused report; STOP",
      );
    if (final || closure)
      assert(
        !existsSync(closure ? closurePlaywrightResultsPath : finalPlaywrightResultsPath),
        "Existing focused Chromium results; STOP",
      );
    if (focused)
      assert(!existsSync(scopedBrowserEvidencePath), "Existing focused browser evidence; STOP");
    assert(process.env.SUPABASE_SECRET_KEY?.trim(), "DEV Auth Admin credential unavailable");
    if (focused)
      assert.equal(
        process.env.TASK022_FOCUSED_RUN_ID,
        preparedPlan.runId,
        "Focused runId confirmation differs",
      );
  }
  if (operation === "cleanup") {
    assert.equal(
      process.env.TASK022_FUNCTIONAL_DEV_CLEANUP_AUTHORIZATION,
      projectRef,
      "Explicit exact-fixture cleanup authorization missing",
    );
    assert(process.env.SUPABASE_SECRET_KEY?.trim(), "DEV Auth Admin credential unavailable");
    if (focused)
      assert.equal(
        process.env.TASK022_FOCUSED_RUN_ID,
        preparedPlan.runId,
        "Focused cleanup runId confirmation differs",
      );
  }
  const client = await openDevDatabase(`task022-functional-${mode}`);
  let ledger = null;
  let status = "BLOCKED";
  let problem = null;
  let alreadyReported = false;
  try {
    const before = await readOnlyPreflight(client, local);
    await publishableProbe(dev);
    if (focused && operation === "run") {
      const previous = JSON.parse(
        readFileSync(closure ? finalLedgerPath : final ? focusedLedgerPath : ledgerPath, "utf8"),
      );
      assert.deepEqual(before.catalog.existingCatalog, previous.catalog.existingCatalog);
      await assertNoFixtureResidue(client, previous.plan);
      compareInventory(before.resources, previous.baseline);
    }
    const preflightPass = `TASK022_FUNCTIONAL_PREFLIGHT_PASS project=salud-plus-turnos-dev ref=${projectRef} database=postgres role=postgres migrations=${before.catalog.versions.length}`;
    if (!(focused && operation === "run")) console.log(preflightPass);
    if (operation === "preflight") return;
    if (operation === "reconcile") {
      const path = focused ? scopedLedgerPath : ledgerPath;
      assert(existsSync(path), "No ledger to reconcile");
      ledger = JSON.parse(readFileSync(path, "utf8"));
      assert.equal(ledger.plan.scope === "denial", focused);
      assert.equal(ledger.plan.projectRef, projectRef);
      if (focused) assert.equal(ledger.plan.runId, preparedPlan.runId);
      const state = await reconcileReadOnly(client, ledger);
      if (ledger.stage === "cleaned") {
        assert.deepEqual(before.catalog.existingCatalog, ledger.catalog.existingCatalog);
        await assertNoFixtureResidue(client, ledger.plan);
        compareInventory(before.resources, ledger.baseline);
        console.log(
          `TASK022_READ_ONLY_CLEAN_STATE_PASS runId=${ledger.plan.runId} resources=14 residue=0`,
        );
      }
      console.log(JSON.stringify({ runId: ledger.plan.runId, stage: ledger.stage, state }));
      return;
    }
    if (operation === "cleanup") {
      const path = focused ? scopedLedgerPath : ledgerPath;
      assert(existsSync(path), "No TASK-022 ledger for cleanup");
      ledger = JSON.parse(readFileSync(path, "utf8"));
      assert.equal(ledger.plan.scope === "denial", focused);
      assert.equal(ledger.plan.projectRef, projectRef);
      if (focused) assert.equal(ledger.plan.runId, preparedPlan.runId);
      assert.deepEqual(before.catalog.existingCatalog, ledger.catalog.existingCatalog);
      const state = await reconcileReadOnly(client, ledger);
      for (const row of state.auth) if (row.present) ledger.plan.actors[row.actor].id = row.id;
      const expected = ownedRows(ledger.plan);
      const nonAuthTables = Object.keys(state.counts).filter((table) => table !== "public.users");
      const full = Object.entries(state.counts).every(
        ([table, count]) => count === expected[table].length,
      );
      const empty = Object.entries(state.counts).every(([, count]) => count === 0);
      assert(full || empty, "Partial database fixture state; manual review required");
      assert(
        state.auth.every((row) => !row.present || row.id === ledger.plan.actors[row.actor].id),
      );
      ledger.stage = "read_only_reconciled";
      save(ledger);
      const admin = createClient(dev.url, process.env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      await authAdminProbe(admin);
      if (full) {
        if (focused) await verifyFocusedFixtureScope(client, ledger.plan);
        else await verifyExactFixtureScope(client, ledger.plan);
        await cleanupDatabaseFixtures(client, ledger, save);
      } else {
        assert(nonAuthTables.every((table) => state.counts[table] === 0));
        ledger.stage = "database_cleaned";
        save(ledger);
      }
      await cleanupAuthFixtures(client, admin, ledger, save, true);
      await assertNoFixtureResidue(client, ledger.plan);
      const finalInventory = await readOnlyInventory(client);
      compareInventory(finalInventory, ledger.baseline);
      if (focused) {
        ledger.finalInventory = finalInventory;
        ledger.cleanupEvidence = focusedCleanupEvidence(ledger);
      }
      ledger.stage = "cleaned";
      save(ledger);
      report(
        ledger,
        ledger.testOutcome === "PASS" ? "PASS" : ledger.testOutcome === "FAIL" ? "FAIL" : "BLOCKED",
        null,
        focused,
        preparedPlan?.runId,
      );
      alreadyReported = true;
      console.log("TASK022_FUNCTIONAL_CLEANUP_PASS exact fixture rows absent; baseline restored");
      return;
    }
    const admin = createClient(dev.url, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await authAdminProbe(admin);
    ledger = {
      version: 1,
      stage: "planned",
      baseline: before.resources,
      catalog: before.catalog,
      plan: preparedPlan ?? buildFixturePlan(),
      evidence: [],
    };
    if (focused) assertFocusedFixtureLimits(ledger.plan);
    else assertFixtureLimits(ledger.plan);
    await assertPlanAbsent(client, ledger.plan);
    if (focused) console.log(preflightPass);
    save(ledger);
    const password = `Task022-${randomBytes(24).toString("base64url")}Aa1!`;
    let testError = null;
    try {
      await createAuthFixtures(client, admin, ledger, password, save);
      if (focused) {
        await insertFocusedDatabaseFixtures(client, ledger, save);
        await verifyFocusedFixtureScope(client, ledger.plan);
      } else {
        await insertDatabaseFixtures(client, ledger, save);
        await verifyExactFixtureScope(client, ledger.plan);
        await runRpcChecks(dev, ledger.plan, password, (label) => evidence(ledger, label));
      }
      await browser(ledger, password, dev);
    } catch (error) {
      testError = error;
    }
    if (focused && existsSync(scopedBrowserEvidencePath)) {
      try {
        const result = JSON.parse(readFileSync(scopedBrowserEvidencePath, "utf8"));
        assert.equal(result.runId, ledger.plan.runId);
        if (closure) {
          if (!testError) assertClosureActorEvidence(result, ledger.plan);
        } else if (!testError) {
          assert.deepEqual(
            result.observations.map((row) => row.actor),
            ["receptionA", "professionalA", "adminB", "unlinked"],
          );
          assert.equal(result.observations[0].patientVisible, true);
          assert.equal(result.observations[0].upcoming, 1);
          for (const row of result.observations.slice(1)) {
            assert.equal(row.notFoundVisible, true);
            assert.equal(row.protectedDataInResponse, false);
            assert.equal(row.administrativeActionsVisible, false);
          }
        }
        ledger.browserEvidence = result;
        if (!testError)
          evidence(ledger, "Focused Chromium actor-level denial evidence PASS (4 actors)");
        else save(ledger);
      } catch (error) {
        testError ??= error;
      }
    } else if (focused && !testError) {
      testError = new Error("Focused Chromium evidence missing");
    }
    ledger.testOutcome = testError
      ? testError.name === "AssertionError" ||
        (closure && ledger.browserEvidence?.observations?.some((row) => row.outcome === "FAIL"))
        ? "FAIL"
        : "BLOCKED"
      : "PASS";
    save(ledger);
    if (ledger.stage === "fixtures_ready") {
      try {
        if (focused) await verifyFocusedFixtureScope(client, ledger.plan);
        else await verifyExactFixtureScope(client, ledger.plan);
        await cleanupDatabaseFixtures(client, ledger, save);
        await cleanupAuthFixtures(client, admin, ledger, save);
        await assertNoFixtureResidue(client, ledger.plan);
        const after = await readOnlyPreflight(client, local);
        assert.deepEqual(after.catalog.existingCatalog, before.catalog.existingCatalog);
        compareInventory(after.resources, before.resources);
        if (focused) {
          ledger.finalInventory = after.resources;
          ledger.cleanupEvidence = focusedCleanupEvidence(ledger);
        }
        ledger.stage = "cleaned";
        evidence(ledger, "Exact cleanup, no residue, 14-resource inventory restored PASS");
      } catch (error) {
        status = "CLEANUP_PENDING";
        problem = error;
      }
    } else if (ledger.stage === "db_rolled_back") {
      // Known rollback leaves only Auth users. Ownership remains explicit, but
      // cleanup is deferred to manual read-only reconciliation.
      status = "CLEANUP_PENDING";
    } else if (ledger.stage !== "cleaned") status = "CLEANUP_PENDING";
    if (ledger.stage === "cleaned") status = ledger.testOutcome;
    if (testError) problem = testError;
  } catch (error) {
    problem = error;
    if (ledger) status = "CLEANUP_PENDING";
  } finally {
    await client.end().catch(() => undefined);
    if ((operation === "run" || operation === "cleanup") && !alreadyReported) {
      report(ledger, status, problem, focused, preparedPlan?.runId);
    }
  }
  if (operation === "run" && status !== "PASS")
    throw new Error(`TASK-022 functional DEV ${status}; inspect retained ledger/report`);
  if (problem && operation !== "run")
    throw new Error(`TASK-022 ${mode} stopped; inspect retained ledger/report`);
}

main().catch((error) => {
  console.error(
    `STOP TASK-022: ${error.name ?? "Error"} (details retained in local stage; no secret values printed)`,
  );
  process.exitCode = 1;
});
