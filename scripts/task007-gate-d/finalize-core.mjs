import { expectedOwned, knownRecovery } from "./recovery-known.mjs";

export const finalizerRunId = "c9818e40-2d4d-4c1b-a392-14a9404a5111";
export const finalizerDigest = "24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359";
export const finalizerVerifierSha256 =
  "f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c";
export const finalizerManifestSha256 =
  "915b5fcfc21851e59a211f83d10f7f7dedc477a4c8879c4a946d7c3b40ce33a8";
export const finalizerNextEnvSha256 =
  "0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC";
export const finalizerInitialLedgerSha256 =
  "572f62a8875c25682437000df13be9ac5c129c86119677f951f2d2c53fc0297d";
export const finalizerPostCleanupLedgerSha256 =
  "5d664a4f40e1626ab931fa997ba063e5bdf0cea9a8e73a9b9dd48510ec29e1fd";
export const finalizerCommitMessage = "feat(task-007): complete patient management implementation";

const uiPersonId = "528bbf95-4b09-4300-9f7e-16f23e01cdfc";
const uiPatientCenterId = "51cac708-049e-4b14-9788-693dd76b61a5";
const uiLinkedPatientCenterId = "e9a98766-2772-43f0-99c1-6313067d0c44";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameSet(actual, expected, label) {
  assert(Array.isArray(actual), `${label} is not an ID list`);
  assert(new Set(actual).size === actual.length, `${label} contains duplicate IDs`);
  assert(
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
    `${label} differs from the exact recorded fixture UUIDs; STOP`,
  );
}

export function validateFinalizerLedger(ledger) {
  assert(ledger.runId === finalizerRunId, "Wrong fixture runId; STOP");
  assert(ledger.projectRef === knownRecovery.projectRef, "Wrong DEV project; STOP");
  assert(ledger.expectedDigest === finalizerDigest, "Ledger baseline target changed; STOP");
  assert(["e2e_pass", "db_cleaned", "cleaned"].includes(ledger.stage), "E2E stage missing; STOP");
  for (const [key, id] of Object.entries(knownRecovery.ids)) {
    assert(ledger.ids?.[key] === id, `Exact fixture ID differs: ${key}; STOP`);
  }
  for (const [name, id] of Object.entries(knownRecovery.actorIds)) {
    const actor = ledger.actors?.[name];
    assert(actor?.id === id, `Exact Auth fixture ID differs: ${name}; STOP`);
    assert(
      actor.email === `task007d-${finalizerRunId}-${name.toLowerCase()}@example.test`,
      `Exact Auth fixture email differs: ${name}; STOP`,
    );
  }
  const original = expectedOwned();
  for (const [key, ids] of Object.entries(original)) {
    const extras =
      key === "persons"
        ? [uiPersonId]
        : key === "patientCenters"
          ? [uiPatientCenterId, uiLinkedPatientCenterId]
          : [];
    sameSet(ledger.owned?.[key], [...ids, ...extras], `owned.${key}`);
  }
  assert(
    Object.keys(ledger.owned).length === Object.keys(original).length,
    "Unexpected owned relation group; STOP",
  );
  assert(ledger.generated?.uiDocument === `UI-${finalizerRunId}`, "UI document differs; STOP");
  assert(
    ledger.generated?.smokeDocument === `SMOKE-${finalizerRunId}` &&
      ledger.generated?.manualUnlinkedDocument === `MANUAL-LINK-${finalizerRunId}`,
    "Reserved manual fixture identities differ; STOP",
  );
  const expectedBefore = {
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
  for (const [table, count] of Object.entries(expectedBefore)) {
    assert(ledger.before?.[table]?.length === count, `Baseline inventory differs: ${table}; STOP`);
  }
  const events = new Set(ledger.evidence?.map((item) => item.event));
  for (const event of [
    "ownership_recovered_from_exact_live_inventory",
    "recovered_fixture_auth_password_assigned_by_exact_user_id",
    "e2e_pass_composite_recovery",
  ]) {
    assert(events.has(event), `Missing fixture evidence: ${event}; STOP`);
  }
  assert(Array.isArray(ledger.authDeleted), "Auth deletion ledger is missing; STOP");
  const deleted = ledger.authDeleted;
  assert(new Set(deleted).size === deleted.length, "Duplicate Auth deletion record; STOP");
  assert(
    deleted.every((id) => ledger.owned.authUsers.includes(id)),
    "Foreign Auth deletion record; STOP",
  );
  if (ledger.stage === "e2e_pass")
    assert(deleted.length === 0, "Auth deletion began before cleanup");
  if (ledger.stage === "cleaned") {
    sameSet(deleted, ledger.owned.authUsers, "authDeleted");
    for (const event of [
      "ownership_and_references_pass",
      "db_cleanup_pass",
      "inventory_restored_pass",
    ])
      assert(events.has(event), `Missing cleanup evidence: ${event}; STOP`);
  }
  return { runId: ledger.runId, stage: ledger.stage, owned: Object.keys(original).length };
}

export function parseMigrationParity(output, localVersions) {
  const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  const version = (cell) => {
    const text = cell.trim();
    const match = text.match(/^(?:`(\d{14})`|(\d{14}))$/);
    return match?.[1] ?? match?.[2] ?? null;
  };
  const pairs = [];
  for (const line of clean.split(/\r?\n/)) {
    if (!/[|│]/.test(line)) {
      assert(!version(line), "Migration row has a version without counterpart");
      continue;
    }
    const cells = line.split(/[|│]/);
    if (cells[0].trim() === "") cells.shift(); // Optional leading table border.
    const [localCell = "", remoteCell = ""] = cells;
    const local = version(localCell);
    const remote = version(remoteCell);
    if (!local && !remote) {
      assert(!/\b\d{14}\b/.test(line), "Migration row contains an unrecognized version cell");
      continue; // Header, separator, connection message, or .gitkeep.
    }
    assert(local && remote, "Migration row has a version without counterpart");
    pairs.push({ local, remote });
  }
  assert(localVersions.length === 19, "Expected exactly 19 local migrations");
  assert(pairs.length === 19, "Expected exactly 19 migration parity rows");
  assert(new Set(localVersions).size === 19, "Duplicate local migration version");
  assert(
    new Set(pairs.map((pair) => pair.local)).size === 19 &&
      new Set(pairs.map((pair) => pair.remote)).size === 19,
    "Duplicate migration pair version",
  );
  assert(
    JSON.stringify(pairs.map((pair) => pair.local).sort()) ===
      JSON.stringify([...localVersions].sort()),
    "Local migration listing differs from versioned files",
  );
  assert(
    pairs.every((pair) => pair.local === pair.remote),
    "DEV migration parity mismatch",
  );
  return { local: 19, remote: 19, exact: true };
}

export function assertDryRun(output) {
  assert(output.includes("Remote database is up to date."), "DB push dry-run is not up to date");
  return true;
}

export function assertDbLint(output) {
  assert(output.includes("No schema errors found"), "DB lint did not report a clean schema");
  return true;
}

function parseJsonOutput(output, label) {
  const start = output.indexOf("{");
  assert(start !== -1, `${label} did not emit JSON`);
  try {
    return JSON.parse(output.slice(start, output.lastIndexOf("}") + 1));
  } catch {
    throw new Error(`${label} emitted invalid JSON`);
  }
}

export function parseSchemaVerdict(output) {
  const result = parseJsonOutput(output, "Schema/API verifier");
  assert(result.dev_project_ref === knownRecovery.projectRef, "Schema verifier targeted wrong DEV");
  assert(result.verdict === "PASS", "Schema/API verifier did not pass");
  assert(result.tables?.length === 4 && result.rpcs?.length === 7, "Schema/API scope incomplete");
  return { verdict: "PASS", tables: 4, rpcs: 7 };
}

export function parseBaselineVerdict(output) {
  assert(
    output.includes("TASK-007A BASELINE V2 exact reference comparison PASS."),
    "Baseline V2 exact comparison did not pass",
  );
  const result = parseJsonOutput(output, "Baseline V2 verifier");
  assert(result.verifier_script_sha256 === finalizerVerifierSha256, "Verifier SHA mismatch");
  assert(result.global_sha256 === finalizerDigest, "TASK-007A BASELINE V2 DRIFT: global digest");
  assert(result.stable === true, "TASK-007A BASELINE V2 DRIFT: unstable reads");
  assert(result.mismatched_components?.length === 0, "TASK-007A BASELINE V2 DRIFT: components");
  assert(result.domain_errors?.length === 0, "TASK-007A BASELINE V2 DRIFT: domain invariants");
  assert(
    Object.keys(result.read_1 ?? {}).length === 15 &&
      Object.keys(result.read_2 ?? {}).length === 15,
    "TASK-007A BASELINE V2 DRIFT: component count",
  );
  return { digest: result.global_sha256, stable: true, components: 15 };
}

export function sanitizedFinalizerError(stage, error) {
  if (error?.safeCode === "BASELINE_DRIFT") return "exact Baseline V2 reference drift";
  if (error?.safeCode === "CLI_AUTH") return "Supabase CLI authentication unavailable";
  if (error?.safeCode === "OWNERSHIP") return "exact UUID ownership or reference guard failed";
  if (error?.safeCode === "COMMAND_EXIT")
    return `${stage === "migration-parity" ? "migration-list CLI" : "subprocess"} exited nonzero (${Number.isInteger(error.exitCode) ? error.exitCode : "unknown"})`;
  const message = error instanceof Error ? error.message : "";
  if (stage === "migration-parity") {
    if (message === "Expected exactly 19 migration parity rows")
      return "migration-list output did not contain exactly 19 parseable pairs";
    if (message === "Migration row has a version without counterpart")
      return "migration-list contains a local or remote version without counterpart";
    if (message === "Migration row contains an unrecognized version cell")
      return "migration-list contains an unrecognized migration row";
    if (message === "Duplicate migration pair version")
      return "migration-list contains duplicate local or remote versions";
    if (message === "DEV migration parity mismatch")
      return "local and DEV migration versions differ";
    if (message.startsWith("Local migration listing differs from versioned files"))
      return "listed local migrations differ from repository files";
    if (message === "Expected exactly 19 local migrations")
      return "repository does not contain exactly 19 migrations";
  }
  if (stage === "db-push-dry-run" && message === "DB push dry-run is not up to date")
    return "remote database is not up to date";
  if (stage === "db-lint" && message === "DB lint did not report a clean schema")
    return "schema lint did not report zero errors";
  if (stage === "baseline-v2" && message.startsWith("TASK-007A BASELINE V2 DRIFT:"))
    return "exact Baseline V2 reference drift";
  return "validation failed; diagnostic details withheld to protect DEV credentials";
}

export async function runFinalizationFlow(operations, report = () => undefined) {
  async function step(stage, action) {
    try {
      const result = await action();
      report({ stage, status: "PASS" });
      return result;
    } catch (error) {
      report({ stage, status: "FAIL", error: sanitizedFinalizerError(stage, error) });
      if (error && typeof error === "object") error.stageLogged = true;
      throw error;
    }
  }
  const stage = await step("preflight", () => operations.preflight());
  if (stage === "e2e_pass") await step("ownership-audit", () => operations.auditOwned());
  if (stage !== "cleaned") await step("cleanup", () => operations.cleanup());
  if (stage !== "cleaned") await step("post-cleanup-audit", () => operations.auditClean());
  const migrations = await step("migration-parity", () => operations.migrations());
  await step("db-push-dry-run", () => operations.dryRun());
  await step("db-lint", () => operations.lint());
  const schema = await step("schema-api-verifier", () => operations.schema());
  const baseline = await step("baseline-v2", () => operations.baseline());
  await step("next-env-verification", () => operations.verifyNextEnv());
  await step("documentation", () => operations.updateDocs({ migrations, schema, baseline }));
  await step("git-stage-commit-push", () => operations.commitAndPush());
  return { migrations, schema, baseline };
}
