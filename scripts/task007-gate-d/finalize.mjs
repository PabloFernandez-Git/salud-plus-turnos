import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";
import { ledgerDigest, ledgerPath, readLedger } from "./fixture-core.mjs";
import {
  assertDbLint,
  assertDryRun,
  finalizerCommitMessage,
  finalizerDigest,
  finalizerInitialLedgerSha256,
  finalizerManifestSha256,
  finalizerNextEnvSha256,
  finalizerPostCleanupLedgerSha256,
  finalizerVerifierSha256,
  parseBaselineVerdict,
  parseMigrationParity,
  parseSchemaVerdict,
  runFinalizationFlow,
  validateFinalizerLedger,
} from "./finalize-core.mjs";
import { renderFinalDocs } from "./finalize-docs.mjs";

const cli = resolve("node_modules/supabase/dist/supabase.js");
const finalDocs = [
  "docs/status.md",
  "docs/modules/patients.md",
  ".harness/tasks/active/TASK-007/implementation-report.md",
  ".harness/tasks/active/TASK-007/plan.md",
  ".harness/knowledge/improvements.md",
];
const stageFiles = [
  ".gitignore",
  ...finalDocs,
  ".harness/tasks/active/TASK-007/review.md",
  ".harness/tasks/active/TASK-007/gate-d-runbook.md",
  "package.json",
  "playwright.task007.config.mjs",
  "scripts/task007-gate-d.mjs",
  "scripts/task007-gate-d/audit-clean.mjs",
  "scripts/task007-gate-d/audit-clean.test.mjs",
  "scripts/task007-gate-d/cleanup-isolated.mjs",
  "scripts/task007-gate-d/finalize-core.mjs",
  "scripts/task007-gate-d/finalize-core.test.mjs",
  "scripts/task007-gate-d/finalize-docs.mjs",
  "scripts/task007-gate-d/finalize.mjs",
  "scripts/task007-gate-d/fixture-core.mjs",
  "scripts/task007-gate-d/integration-state.mjs",
  "scripts/task007-gate-d/integration.mjs",
  "scripts/task007-gate-d/isolated-dev-server.mjs",
  "scripts/task007-gate-d/ledger-lifecycle.test.mjs",
  "scripts/task007-gate-d/ledger-status.mjs",
  "scripts/task007-gate-d/recover-credentials.mjs",
  "scripts/task007-gate-d/recover-ledger.mjs",
  "scripts/task007-gate-d/recovery-inventory.mjs",
  "scripts/task007-gate-d/recovery-known.mjs",
  "src/app/centers/[centerId]/patients/page.tsx",
  "src/modules/patients/actions/patient-actions.test.ts",
  "src/modules/patients/actions/patient-actions.ts",
  "src/modules/patients/components/patient-workspace.test.tsx",
  "src/modules/patients/components/patient-workspace.tsx",
  "src/modules/patients/components/patients-screen.test.tsx",
  "src/modules/patients/components/patients-screen.tsx",
  "src/modules/patients/search/patient-search-params.test.ts",
  "src/modules/patients/search/patient-search-params.ts",
  "src/modules/patients/server/patient-errors.test.ts",
  "src/modules/patients/server/patient-errors.ts",
  "src/modules/patients/server/patient-management.test.ts",
  "src/modules/patients/server/patient-management.ts",
  "tests/e2e/task-007-gate-d-denial-recovery.spec.mjs",
  "tests/e2e/task-007-gate-d.spec.mjs",
];
const stageSet = new Set(stageFiles);
const expectedRemote = "https://github.com/PabloFernandez-Git/salud-plus-turnos.git";
const baseCommit = "76206deca44853215f666d6bc4dd327ba611e977";
const safeEnvironment = {
  ...process.env,
  CI: "true",
  DO_NOT_TRACK: "1",
  SUPABASE_TELEMETRY_DISABLED: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "Never",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(label, file, args) {
  const result = spawnSync(file, args, {
    cwd: resolve("."),
    env: safeEnvironment,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const drift = combined.includes("TASK-007A BASELINE V2 DRIFT:");
    const error = new Error(`${label} subprocess failed`);
    error.safeCode = drift
      ? "BASELINE_DRIFT"
      : combined.includes("LegacyPlatformAuthRequiredError")
        ? "CLI_AUTH"
        : combined.includes("Ownership mismatch") || combined.includes("External reference blocks")
          ? "OWNERSHIP"
          : "COMMAND_EXIT";
    error.exitCode = result.status;
    throw error;
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function git(...args) {
  return run(`git ${args[0]}`, "git", args).trimEnd();
}

function node(label, ...args) {
  return run(label, process.execPath, args);
}

function json(output, label) {
  try {
    return JSON.parse(output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1));
  } catch {
    throw new Error(`${label} did not emit a single JSON object`);
  }
}

function changedPaths() {
  return git("status", "--porcelain=v1", "-uall")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({ index: line.slice(0, 2), path: line.slice(3) }));
}

function verifyGitAndFiles() {
  assert(
    !stageFiles.some(
      (path) =>
        path === "next-env.d.ts" ||
        path.startsWith(".task007-gate-d/") ||
        path.startsWith("test-results/") ||
        path.startsWith("supabase/migrations/") ||
        path === ".env.local",
    ),
    "Forbidden path in stage allowlist; STOP",
  );
  assert(git("branch", "--show-current") === "task/007-patients", "Wrong Git branch; STOP");
  assert(git("remote", "get-url", "origin") === expectedRemote, "Wrong Git origin; STOP");
  const head = git("rev-parse", "HEAD");
  const lastSubject = git("log", "-1", "--format=%s");
  assert(
    head === baseCommit || lastSubject === finalizerCommitMessage,
    "Unexpected HEAD before finalization; STOP",
  );
  assert(git("diff", "--cached", "--name-only") === "", "Staged changes already exist; STOP");
  const changed = changedPaths();
  assert(
    changed.some((item) => item.index === " M" && item.path === "next-env.d.ts"),
    "next-env.d.ts must remain modified and unstaged",
  );
  for (const item of changed) {
    assert(item.index[0] === " " || item.index === "??", `Staged file found: ${item.path}`);
    assert(
      item.path === "next-env.d.ts" || stageSet.has(item.path),
      `Unexpected worktree change: ${item.path}; STOP`,
    );
  }
  assert(
    sha("next-env.d.ts").toUpperCase() === finalizerNextEnvSha256,
    "next-env.d.ts SHA changed",
  );
  assert(
    sha("scripts/verify-task007a-baseline-v2.mjs") === finalizerVerifierSha256,
    "Baseline V2 verifier SHA changed",
  );
  assert(
    sha(".harness/tasks/active/TASK-007/baseline-v2-manifest.json") === finalizerManifestSha256,
    "Approved Baseline V2 manifest SHA changed",
  );
  assert(existsSync(ledgerPath), "Persistent ownership ledger missing; STOP");
  assert(
    !ledgerPath.includes("test-results"),
    "Ownership ledger is inside Playwright output; STOP",
  );
  for (const path of stageFiles) assert(existsSync(path), `Legitimate stage file missing: ${path}`);
  git("var", "GIT_AUTHOR_IDENT");
  git("var", "GIT_COMMITTER_IDENT");
  git("diff", "--check");
  return head;
}

function localMigrations() {
  const versions = readdirSync("supabase/migrations")
    .map((file) => file.match(/^(\d{14})_.*\.sql$/)?.[1])
    .filter(Boolean)
    .sort();
  assert(versions.length === 19, "Expected exactly 19 versioned migrations");
  return versions;
}

function readFinalDocs() {
  return Object.fromEntries(finalDocs.map((path) => [path, readFileSync(path, "utf8")]));
}

function writeFinalDocs(evidence, ledger) {
  const source = readFinalDocs();
  const rendered = renderFinalDocs(source, evidence);
  for (const [path, value] of Object.entries(rendered)) {
    assert(!value.includes(ledger.password), `Credential leaked into ${path}; STOP`);
  }
  for (const [path, value] of Object.entries(rendered)) {
    const original = source[path];
    const lineEnding = original.includes("\r\n") ? "\r\n" : "\n";
    const normalized = value.replace(/\r?\n/g, lineEnding);
    if (normalized === original) continue;
    const temporary = `${path}.task007-finalize-tmp`;
    writeFileSync(temporary, normalized, { flag: "wx" });
    renameSync(temporary, path);
  }
}

function stageCommitPush() {
  verifyGitAndFiles();
  git("add", "--", ...stageFiles.map((path) => `:(literal)${path}`));
  const staged = git("diff", "--cached", "--name-only").split(/\r?\n/).filter(Boolean);
  assert(
    staged.every((path) => stageSet.has(path)),
    "Unexpected staged path; STOP",
  );
  assert(!staged.includes("next-env.d.ts"), "next-env.d.ts staged; STOP");
  git("diff", "--cached", "--check");
  if (staged.length > 0) git("commit", "--no-gpg-sign", "-m", finalizerCommitMessage);
  else assert(git("log", "-1", "--format=%s") === finalizerCommitMessage, "No finalization commit");
  git("push", "origin", "HEAD:refs/heads/task/007-patients");
  const remaining = changedPaths();
  assert(
    remaining.length === 1 && remaining[0].index === " M" && remaining[0].path === "next-env.d.ts",
    "Unexpected worktree state after push",
  );
  assert(
    sha("next-env.d.ts").toUpperCase() === finalizerNextEnvSha256,
    "next-env.d.ts changed after commit",
  );
  git("rev-parse", "HEAD");
}

function productionOperations() {
  let ledger;
  return {
    async preflight() {
      verifyGitAndFiles();
      const dev = loadSupabaseDevConfig();
      assertLinkedSupabaseProject();
      assert(dev.projectRef === "ehllxymqyzrofydrvtzo", "Wrong linked DEV; STOP");
      ledger = readLedger();
      validateFinalizerLedger(ledger);
      if (ledger.stage === "e2e_pass")
        assert(ledgerDigest() === finalizerInitialLedgerSha256, "Initial ledger SHA changed; STOP");
      if (ledger.stage === "cleaned")
        assert(
          ledgerDigest() === finalizerPostCleanupLedgerSha256,
          "Post-cleanup ledger SHA changed; STOP",
        );
      localMigrations();
      return ledger.stage;
    },
    async auditOwned() {
      const output = node("exact ownership audit", "scripts/task007-gate-d.mjs", "audit");
      const result = json(output, "Ownership audit");
      assert(result.stage === "e2e_pass", "Ownership audit stage changed");
      assert(
        result.ownership?.persons === 8 && result.ownership?.patientCenters === 8,
        "Owned rows differ",
      );
      assert(result.ledgerSha256 === ledgerDigest(), "Ownership audit ledger hash differs");
    },
    async cleanup() {
      const output = node("exact UUID cleanup", "scripts/task007-gate-d.mjs", "cleanup");
      const result = json(output, "Exact cleanup");
      assert(result.stage === "cleaned" && result.beforeRestored === true, "Cleanup incomplete");
      validateFinalizerLedger(readLedger());
    },
    async auditClean() {
      const output = node("post-cleanup audit", "scripts/task007-gate-d.mjs", "audit-clean");
      const result = json(output, "Post-cleanup audit");
      assert(
        result.stage === "cleaned" && result.ownedIdsAbsent && result.inventoryRestored,
        "Post-cleanup audit failed",
      );
      validateFinalizerLedger(readLedger());
    },
    async migrations() {
      const output = node("migration parity", cli, "migration", "list", "--linked");
      const result = parseMigrationParity(output, localMigrations());
      return result;
    },
    async dryRun() {
      assertDryRun(node("db push dry-run", cli, "db", "push", "--dry-run", "--linked"));
    },
    async lint() {
      assertDbLint(node("db lint", cli, "db", "lint", "--linked"));
    },
    async schema() {
      const result = parseSchemaVerdict(
        node("schema/API verifier", "scripts/verify-task007a-schema-v2.mjs"),
      );
      return result;
    },
    async baseline() {
      const output = node(
        "Baseline V2 exact comparison",
        "--import",
        "./scripts/compare-task007a-baseline-v2.mjs",
        "scripts/verify-task007a-baseline-v2.mjs",
      );
      let result;
      try {
        result = parseBaselineVerdict(output);
      } catch {
        throw new Error("TASK-007A BASELINE V2 DRIFT: exact reference comparison failed");
      }
      return result;
    },
    async verifyNextEnv() {
      assert(
        sha("next-env.d.ts").toUpperCase() === finalizerNextEnvSha256,
        "next-env.d.ts changed",
      );
      assert(
        changedPaths().some((item) => item.index === " M" && item.path === "next-env.d.ts"),
        "next-env.d.ts staging changed",
      );
    },
    async updateDocs(evidence) {
      writeFinalDocs(evidence, readLedger());
    },
    async commitAndPush() {
      stageCommitPush();
    },
  };
}

async function selfTest() {
  verifyGitAndFiles();
  const ledger = readLedger();
  validateFinalizerLedger(ledger);
  assert(ledger.stage === "cleaned", "Local resume test requires cleaned ledger");
  assert(
    ledgerDigest() === finalizerPostCleanupLedgerSha256,
    "Post-cleanup ledger SHA changed; STOP",
  );
  const evidence = {
    migrations: { local: 19, remote: 19, exact: true },
    schema: { verdict: "PASS", tables: 4, rpcs: 7 },
    baseline: { digest: finalizerDigest, stable: true, components: 15 },
  };
  const rendered = renderFinalDocs(readFinalDocs(), evidence);
  assert(
    Object.values(rendered).every((body) => !body.includes(readLedger().password)),
    "Docs leak secret",
  );
  const calls = [];
  const reports = [];
  await runFinalizationFlow(
    {
      preflight: async () => (calls.push("preflight"), "cleaned"),
      auditOwned: async () => assert(false, "Ownership audit must not rerun"),
      cleanup: async () => assert(false, "Cleanup must not rerun"),
      auditClean: async () => assert(false, "Post-cleanup audit must not rerun"),
      migrations: async () => (calls.push("migrations"), evidence.migrations),
      dryRun: async () => calls.push("dryRun"),
      lint: async () => calls.push("lint"),
      schema: async () => (calls.push("schema"), evidence.schema),
      baseline: async () => (calls.push("baseline"), evidence.baseline),
      verifyNextEnv: async () => calls.push("verifyNextEnv"),
      updateDocs: async () => calls.push("updateDocs"),
      commitAndPush: async () => calls.push("commitAndPush"),
    },
    (report) => reports.push(report),
  );
  assert(
    calls.join(",") ===
      "preflight,migrations,dryRun,lint,schema,baseline,verifyNextEnv,updateDocs,commitAndPush",
    "Wrong post-cleanup resume order",
  );
  assert(
    reports.length === calls.length && reports.every((report) => report.status === "PASS"),
    "Wrong resume stage logging",
  );
  console.log(JSON.stringify({ stage: "local-self-test", status: "PASS" }));
}

try {
  if (process.argv[2] === "--self-test") await selfTest();
  else {
    assert(process.argv.length === 2, "Unknown finalizer argument");
    await runFinalizationFlow(productionOperations(), (report) =>
      console.log(JSON.stringify(report)),
    );
    console.log(
      "TASK-007C+D IMPLEMENTATION COMPLETE — GATE C PASS — GATE D PASS — READY FOR FINAL INDEPENDENT IMPLEMENTATION REVIEW",
    );
  }
} catch (error) {
  if (!error?.stageLogged)
    console.error(
      JSON.stringify({
        stage: process.argv[2] === "--self-test" ? "local-self-test" : "startup",
        status: "FAIL",
        error: "validation failed; diagnostic details withheld to protect DEV credentials",
      }),
    );
  process.exitCode = 1;
}
