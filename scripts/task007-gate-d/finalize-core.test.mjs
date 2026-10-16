import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import {
  assertDbLint,
  assertDryRun,
  finalizerDigest,
  finalizerRunId,
  finalizerVerifierSha256,
  parseBaselineVerdict,
  parseMigrationParity,
  parseSchemaVerdict,
  runFinalizationFlow,
  sanitizedFinalizerError,
  validateFinalizerLedger,
} from "./finalize-core.mjs";
import { renderFinalDocs, smokeDisposition } from "./finalize-docs.mjs";
import { expectedOwned, knownRecovery } from "./recovery-known.mjs";

function cleanedFinalizerLedger() {
  const owned = expectedOwned();
  owned.persons.push("528bbf95-4b09-4300-9f7e-16f23e01cdfc");
  owned.patientCenters.push(
    "51cac708-049e-4b14-9788-693dd76b61a5",
    "e9a98766-2772-43f0-99c1-6313067d0c44",
  );
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
    ].map((table, index) => [
      table,
      index < 4 || index === 8
        ? [`00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`]
        : [],
    ]),
  );
  return {
    runId: finalizerRunId,
    projectRef: knownRecovery.projectRef,
    expectedDigest: finalizerDigest,
    stage: "cleaned",
    ids: { ...knownRecovery.ids },
    actors: Object.fromEntries(
      Object.entries(knownRecovery.actorIds).map(([name, id]) => [
        name,
        { id, email: `task007d-${finalizerRunId}-${name.toLowerCase()}@example.test` },
      ]),
    ),
    owned,
    before,
    generated: {
      uiDocument: `UI-${finalizerRunId}`,
      smokeDocument: `SMOKE-${finalizerRunId}`,
      manualUnlinkedDocument: `MANUAL-LINK-${finalizerRunId}`,
    },
    authDeleted: [...owned.authUsers],
    evidence: [
      "ownership_recovered_from_exact_live_inventory",
      "recovered_fixture_auth_password_assigned_by_exact_user_id",
      "e2e_pass_composite_recovery",
      "ownership_and_references_pass",
      "db_cleanup_pass",
      "inventory_restored_pass",
    ].map((event) => ({ event })),
    password: "test-only-password",
  };
}

test("one-shot finalizer accepts only this run's exact owned UUID graph", () => {
  const ledger = cleanedFinalizerLedger();
  assert.equal(validateFinalizerLedger(ledger).stage, "cleaned");
  const wrongRun = structuredClone(ledger);
  wrongRun.runId = "00000000-0000-4000-8000-000000000000";
  assert.throws(() => validateFinalizerLedger(wrongRun), /Wrong fixture runId/);
  const foreignId = structuredClone(ledger);
  foreignId.owned.persons.push("00000000-0000-4000-8000-000000000001");
  assert.throws(() => validateFinalizerLedger(foreignId), /exact recorded fixture UUIDs/);
});

test("cleaned run resumes at migration parity without touching deleted fixtures", async () => {
  const calls = [];
  const reports = [];
  const operations = {
    preflight: async () => (calls.push("preflight"), "cleaned"),
    auditOwned: async () => assert.fail("Owned fixtures no longer exist"),
    cleanup: async () => assert.fail("Cleanup must not run twice"),
    auditClean: async () => assert.fail("Post-cleanup audit already passed"),
    migrations: async () => (calls.push("migrations"), { local: 19, remote: 19, exact: true }),
    dryRun: async () => calls.push("dryRun"),
    lint: async () => calls.push("lint"),
    schema: async () => (calls.push("schema"), { verdict: "PASS" }),
    baseline: async () => (calls.push("baseline"), { digest: finalizerDigest }),
    verifyNextEnv: async () => calls.push("verifyNextEnv"),
    updateDocs: async () => calls.push("updateDocs"),
    commitAndPush: async () => calls.push("commitAndPush"),
  };
  await runFinalizationFlow(operations, (report) => reports.push(report));
  assert.deepEqual(calls, [
    "preflight",
    "migrations",
    "dryRun",
    "lint",
    "schema",
    "baseline",
    "verifyNextEnv",
    "updateDocs",
    "commitAndPush",
  ]);
  assert.deepEqual(
    reports.map((report) => [report.stage, report.status]),
    [
      ["preflight", "PASS"],
      ["migration-parity", "PASS"],
      ["db-push-dry-run", "PASS"],
      ["db-lint", "PASS"],
      ["schema-api-verifier", "PASS"],
      ["baseline-v2", "PASS"],
      ["next-env-verification", "PASS"],
      ["documentation", "PASS"],
      ["git-stage-commit-push", "PASS"],
    ],
  );
});

test("migration failure reports only stage and sanitized diagnostics", async () => {
  const secret = "postgres://user:password@database.invalid/token";
  const reports = [];
  const operations = {
    preflight: async () => "cleaned",
    migrations: async () => {
      throw new Error(secret);
    },
  };
  await assert.rejects(runFinalizationFlow(operations, (report) => reports.push(report)));
  assert.deepEqual(reports, [
    { stage: "preflight", status: "PASS" },
    {
      stage: "migration-parity",
      status: "FAIL",
      error: "validation failed; diagnostic details withheld to protect DEV credentials",
    },
  ]);
  assert.ok(!JSON.stringify(reports).includes(secret));
  assert.equal(
    sanitizedFinalizerError(
      "migration-parity",
      new Error("Expected exactly 19 migration parity rows"),
    ),
    "migration-list output did not contain exactly 19 parseable pairs",
  );
  assert.equal(
    sanitizedFinalizerError("migration-parity", {
      safeCode: "COMMAND_EXIT",
      exitCode: 1,
      message: secret,
    }),
    "migration-list CLI exited nonzero (1)",
  );
});

test("migration parser accepts the 19-version CLI table and human-observed final rows", () => {
  const versions = readdirSync("supabase/migrations")
    .map((file) => file.match(/^(\d{14})_.*\.sql$/)?.[1])
    .filter((version) => version && version <= "20261013200000")
    .sort();
  // The final two rows are verbatim from the human DEV evidence. Earlier versions
  // come from the checked-in migration filenames; the wrapper exercises CLI noise.
  const output = `Initialising login role...
Connecting to remote database...
Ignoring .gitkeep...
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
${versions
  .slice(0, -2)
  .map((version) => `  \`${version}\` | \`${version}\` | 2026-10-14 00:00:00`)
  .join("\n")}
20261013190000 | 20261013190000
20261013200000 | 20261013200000`;
  assert.deepEqual(parseMigrationParity(output, versions), {
    local: 19,
    remote: 19,
    exact: true,
  });
  const bordered = output.replaceAll(/^(\s*`\d{14}`\s*\|)/gm, "│ $1");
  assert.deepEqual(parseMigrationParity(bordered, versions), {
    local: 19,
    remote: 19,
    exact: true,
  });
  assert.throws(
    () =>
      parseMigrationParity(
        output.replace("20261013200000 | 20261013200000", "20261013200000 | "),
        versions,
      ),
    /without counterpart/,
  );
  assert.throws(
    () =>
      parseMigrationParity(
        output.replace("20261013200000 | 20261013200000", " | 20261013200000"),
        versions,
      ),
    /without counterpart/,
  );
  assert.throws(
    () => parseMigrationParity(output.replace("20261013200000 | 20261013200000", ""), versions),
    /exactly 19 migration parity rows/,
  );
  assert.throws(
    () =>
      parseMigrationParity(
        output.replace("20261013200000 | 20261013200000", "20261013200000"),
        versions,
      ),
    /without counterpart/,
  );
});

test("final DEV gates parse strict parity, schema and exact baseline evidence", () => {
  const versions = readdirSync("supabase/migrations")
    .map((file) => file.match(/^(\d{14})_.*\.sql$/)?.[1])
    .filter((version) => version && version <= "20261013200000")
    .sort();
  const listing = versions.map((version) => `  ${version} | ${version} | 2026-10-14`).join("\n");
  assert.deepEqual(parseMigrationParity(listing, versions), { local: 19, remote: 19, exact: true });
  const unicodeListing = listing.replaceAll(" | ", " │ ");
  assert.deepEqual(parseMigrationParity(unicodeListing, versions), {
    local: 19,
    remote: 19,
    exact: true,
  });
  assert.deepEqual(
    parseMigrationParity(
      unicodeListing
        .split("\n")
        .map((row) => ` │ ${row}`)
        .join("\n"),
      versions,
    ),
    { local: 19, remote: 19, exact: true },
  );
  assert.throws(
    () => parseMigrationParity(listing.replace(versions[0], "00000000000000"), versions),
    /differs/,
  );
  assert.equal(assertDryRun("Remote database is up to date."), true);
  assert.equal(assertDbLint("No schema errors found"), true);
  assert.throws(() => assertDryRun("Would apply migrations"), /not up to date/);
  const schema = JSON.stringify({
    dev_project_ref: "ehllxymqyzrofydrvtzo",
    verdict: "PASS",
    tables: Array(4).fill({}),
    rpcs: Array(7).fill({}),
  });
  assert.equal(parseSchemaVerdict(schema).verdict, "PASS");
  const baseline = `TASK-007A BASELINE V2 exact reference comparison PASS.\n${JSON.stringify({
    verifier_script_sha256: finalizerVerifierSha256,
    global_sha256: finalizerDigest,
    stable: true,
    mismatched_components: [],
    domain_errors: [],
    read_1: Object.fromEntries(Array.from({ length: 15 }, (_, index) => [index, {}])),
    read_2: Object.fromEntries(Array.from({ length: 15 }, (_, index) => [index, {}])),
  })}`;
  assert.equal(parseBaselineVerdict(baseline).digest, finalizerDigest);
  assert.throws(
    () => parseBaselineVerdict(baseline.replace(finalizerDigest, "0".repeat(64))),
    /BASELINE V2 DRIFT/,
  );
});

test("one-shot flow stops before documentation and commit on baseline drift", async () => {
  const calls = [];
  const operations = Object.fromEntries(
    [
      "auditOwned",
      "cleanup",
      "auditClean",
      "dryRun",
      "lint",
      "verifyNextEnv",
      "updateDocs",
      "commitAndPush",
    ].map((name) => [name, async () => calls.push(name)]),
  );
  operations.preflight = async () => (calls.push("preflight"), "e2e_pass");
  operations.migrations = async () => (
    calls.push("migrations"),
    { local: 19, remote: 19, exact: true }
  );
  operations.schema = async () => (calls.push("schema"), { verdict: "PASS" });
  operations.baseline = async () => {
    calls.push("baseline");
    throw new Error("TASK-007A BASELINE V2 DRIFT");
  };
  await assert.rejects(runFinalizationFlow(operations), /BASELINE V2 DRIFT/);
  assert.deepEqual(calls, [
    "preflight",
    "auditOwned",
    "cleanup",
    "auditClean",
    "migrations",
    "dryRun",
    "lint",
    "schema",
    "baseline",
  ]);
});

test("final documentation keeps human smoke deferred without writing files", () => {
  const paths = [
    "docs/status.md",
    "docs/modules/patients.md",
    ".harness/tasks/active/TASK-007/implementation-report.md",
    ".harness/tasks/active/TASK-007/plan.md",
    ".harness/knowledge/improvements.md",
  ];
  const source = Object.fromEntries(
    paths.map((path) => [
      path,
      readFileSync(path.replace("tasks/active/TASK-007", "tasks/archive/TASK-007"), "utf8"),
    ]),
  );
  const result = renderFinalDocs(source, {
    migrations: { local: 19, remote: 19, exact: true },
    schema: { verdict: "PASS" },
    baseline: { digest: finalizerDigest, components: 15 },
  });
  assert.ok(paths.slice(0, 4).every((path) => result[path].includes(smokeDisposition)));
  assert.match(result[paths[4]], /one-shot workflows/);
  assert.ok(
    !Object.values(result).some((body) =>
      body.includes("TASK007_TEST_ONLY_PASSWORD_DO_NOT_RENDER"),
    ),
  );
});
