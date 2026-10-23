import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  openSync,
  closeSync,
  unlinkSync,
  mkdirSync,
  lstatSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { connect, inspect, localChecks } from "../task021-dev/gate.mjs";
import { assertPlan, buildPlan, ownedRows, projectRef, resources } from "./plan.mjs";
import {
  absent,
  authRecoverySnapshot,
  assertInventoriesEqual,
  canonicalInventory,
  cleanupDatabase,
  insertFixtures,
  inventory,
  inventoryRows,
  ownership,
} from "./database.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const directory = resolve(root, ".task021-functional-dev");
const lockPath = resolve(directory, "active.lock");
const devUrl = `https://${projectRef}.supabase.co`;
const rolledBackRunId = "c8c10bdb-705b-405e-8990-070edcd8bde6";
const rolledBackLedgerSha256 = "1B03FAF23A83D7777012C6A8593C49CCCF92EA2E91F492924B2994C0716A2D29";
const rolledBackLockCreatedAt = "2026-10-22T22:37:55.611Z";
const rolledBackAuthIds = Object.freeze({
  adminA: "fb317884-7b96-4050-b363-f05e8af7d73e",
  receptionA: "b7acd5d6-befc-4d97-b479-81168063a235",
  professionalA: "86d1a252-a771-4471-bf1e-800d508071f7",
  professionalA2: "b2e6b1de-cc45-46f1-bc31-718459ca8336",
  adminB: "8bc9a90c-44b9-4b8b-8e71-885b582c2e54",
  unlinked: "74eefdb1-2467-4548-9651-2ade663ddf80",
});
function stop(message) {
  throw new Error(`STOP TASK-021 Gate B: ${message}`);
}
function ledgerPath(runId) {
  assert.match(runId, /^[0-9a-f-]{36}$/i);
  return resolve(directory, `run-${runId}.json`);
}
function save(ledger) {
  const path = ledgerPath(ledger.plan.runId);
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}
function releaseLock(runId) {
  if (!existsSync(lockPath)) {
    assert.notEqual(runId, rolledBackRunId, "Gate B recovery lock disappeared");
    return;
  }
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.runId, runId, "Gate B lock belongs to another run");
  if (runId === rolledBackRunId)
    assert.equal(lock.createdAt, rolledBackLockCreatedAt, "Gate B recovery lock differs");
  unlinkSync(lockPath);
}
function assertRecoveryLock(runId) {
  assert(existsSync(lockPath), "Gate B recovery lock is missing");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.runId, runId, "Gate B recovery lock belongs to another run");
  assert.equal(lock.createdAt, rolledBackLockCreatedAt, "Gate B recovery lock differs");
}
function readLedger(runId, { requireOriginal = false } = {}) {
  const path = ledgerPath(runId);
  assert(existsSync(path), "No ledger for runId");
  const source = readFileSync(path);
  if (requireOriginal) {
    assert.equal(runId, rolledBackRunId);
    assert.equal(
      createHash("sha256").update(source).digest("hex").toUpperCase(),
      rolledBackLedgerSha256,
      "Original rollback ledger was modified",
    );
  }
  const ledger = JSON.parse(source.toString("utf8"));
  assert.equal(ledger.plan.runId, runId);
  assert.equal(ledger.plan.projectRef, projectRef);
  return ledger;
}
function client(key) {
  assert(key && key.trim(), "Supabase key required");
  return createClient(devUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function adminProbe(admin) {
  const result = await admin.auth.admin.getUserById("00000000-0000-4000-8000-000000000000");
  assert(!result.data?.user && result.error?.status === 404, "Auth Admin read-only probe failed");
}
async function remotePreflight(db, local) {
  const state = await inspect(db, local, true, async (client, gateAInventory) => {
    const readOnly = (
      await client.query("select current_setting('transaction_read_only') as value")
    ).rows[0].value;
    assert.equal(readOnly, "on", "Inventory comparison is not read-only");
    const gateBInventory = await inventoryRows(client);
    assertInventoriesEqual(gateAInventory, gateBInventory);
  });
  return { catalog: state.catalog, data: canonicalInventory(state.data) };
}
async function createAuth(admin, ledger, password) {
  for (const [name, actor] of Object.entries(ledger.plan.actors)) {
    ledger.stage = `auth_create_attempt:${name}`;
    save(ledger);
    const { data, error } = await admin.auth.admin.createUser({
      email: actor.email,
      password,
      email_confirm: true,
      user_metadata: { gate: "TASK-021", runId: ledger.plan.runId, actor: name },
    });
    if (error || !data?.user?.id || data.user.email !== actor.email)
      stop(`Auth creation outcome uncertain for ${name}; reconcile read-only`);
    actor.id = data.user.id;
    ledger.stage = `auth_created:${name}`;
    save(ledger);
  }
}
async function authenticate(key, actor, password) {
  const session = client(key);
  const { data, error } = await session.auth.signInWithPassword({ email: actor.email, password });
  assert(!error && data?.session?.access_token, "Synthetic login failed");
  assert.equal(data.user.id, actor.id);
  return session;
}
async function rpc(session, name, center, expectedCode = null) {
  const { data, error } = await session.rpc(name, { p_center_id: center });
  if (expectedCode) {
    assert.equal(error?.code, expectedCode, `RPC ${name} denial differs`);
    return null;
  }
  assert.equal(error, null, `RPC ${name} error`);
  assert(Array.isArray(data) && data.length === 1, `RPC ${name} row count differs`);
  return data[0];
}
function assertRow(row, expected, plan, scope) {
  for (const key of [
    "pending_count",
    "confirmed_count",
    "attended_count",
    "no_show_count",
    "cancelled_count",
  ])
    assert.equal(row[key], expected[key], `RPC ${scope} ${key}`);
  if (scope === "staff") assert.equal(row.professional_centers_with_appointments_count, 2);
  else assert(!("professional_centers_with_appointments_count" in row));
  assert.equal(row.local_date, plan.localDate);
  assert.equal(row.timezone, "America/Argentina/Buenos_Aires");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: row.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(row.as_of));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  assert.equal(`${part("year")}-${part("month")}-${part("day")}`, plan.localDate);
  assert.deepEqual(
    row.upcoming.map((x) => x.appointment_id),
    expected.upcoming,
  );
  for (const item of row.upcoming) {
    const expectedKeys =
      scope === "staff"
        ? [
            "appointment_id",
            "starts_at",
            "ends_at",
            "status",
            "patient_first_name",
            "patient_last_name",
            "specialty_name",
            "professional_center_id",
            "professional_first_name",
            "professional_last_name",
          ]
        : [
            "appointment_id",
            "starts_at",
            "ends_at",
            "status",
            "patient_first_name",
            "patient_last_name",
            "specialty_name",
          ];
    assert.deepEqual(Object.keys(item).sort(), expectedKeys.sort(), `RPC ${scope} projection`);
  }
}
async function updateOne(db, sql, params) {
  const result = await db.query(sql, params);
  assert.equal(result.rowCount, 1, "Exact fixture state mutation affected unexpected rows");
}
async function rpcChecks(db, ledger, password, key) {
  const { plan } = ledger,
    { ids: i, actors: a } = plan;
  const sessions = {};
  try {
    for (const [name, actor] of Object.entries(a))
      sessions[name] = await authenticate(key, actor, password);
    const { expectedRows } = await import("./plan.mjs");
    for (const name of ["adminA", "receptionA"]) {
      const row = await rpc(sessions[name], "staff_get_daily_dashboard", i.centerA);
      assertRow(row, expectedRows(plan, "staff"), plan, "staff");
      await rpc(sessions[name], "professional_get_own_daily_dashboard", i.centerA, "42501");
    }
    for (const [name, pc] of [
      ["professionalA", i.pcA],
      ["professionalA2", i.pcA2],
    ]) {
      const row = await rpc(sessions[name], "professional_get_own_daily_dashboard", i.centerA);
      assertRow(row, expectedRows(plan, pc), plan, "professional");
      await rpc(sessions[name], "staff_get_daily_dashboard", i.centerA, "42501");
    }
    const other = await rpc(sessions.adminB, "staff_get_daily_dashboard", i.centerB);
    assert.equal(other.pending_count, 0);
    assert.equal(other.upcoming.length, 0);
    await rpc(sessions.adminB, "staff_get_daily_dashboard", i.centerA, "42501");
    await rpc(sessions.unlinked, "staff_get_daily_dashboard", i.centerA, "42501");
    await rpc(sessions.unlinked, "professional_get_own_daily_dashboard", i.centerA, "42501");
    await updateOne(
      db,
      "update public.center_memberships set is_active=false where id=$1 and center_id=$2 and is_active=true",
      [i.professionalMembershipA, i.centerA],
    );
    ledger.stage = "professional_membership_inactive";
    save(ledger);
    try {
      await rpc(sessions.professionalA, "professional_get_own_daily_dashboard", i.centerA, "42501");
    } finally {
      await updateOne(
        db,
        "update public.center_memberships set is_active=true where id=$1 and center_id=$2 and is_active=false",
        [i.professionalMembershipA, i.centerA],
      );
      ledger.stage = "membership_restored";
      save(ledger);
    }
    await updateOne(
      db,
      "update public.professional_centers set is_active=false where id=$1 and center_id=$2 and is_active=true",
      [i.pcA, i.centerA],
    );
    ledger.stage = "professional_link_inactive";
    save(ledger);
    try {
      await rpc(sessions.professionalA, "professional_get_own_daily_dashboard", i.centerA, "42501");
    } finally {
      await updateOne(
        db,
        "update public.professional_centers set is_active=true where id=$1 and center_id=$2 and is_active=false",
        [i.pcA, i.centerA],
      );
      ledger.stage = "professional_link_restored";
      save(ledger);
    }
    ledger.stage = "rpc_checks_pass";
    save(ledger);
  } finally {
    for (const session of Object.values(sessions)) await session.auth.signOut().catch(() => {});
  }
}
export function cleanupIsolatedServer(runId) {
  assert.match(runId, /^[0-9a-f-]{36}$/i);
  const tempRoot = resolve(tmpdir());
  const prefix = `task021-next-${runId}-`;
  for (const name of readdirSync(tempRoot)) {
    if (!name.startsWith(prefix) || !/^task021-next-[0-9a-f-]{36}-[A-Za-z0-9]+$/i.test(name))
      continue;
    const target = resolve(tempRoot, name);
    assert.equal(resolve(target, ".."), tempRoot);
    let entry;
    try {
      entry = lstatSync(target);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    assert(entry.isDirectory() && !entry.isSymbolicLink(), "Unexpected isolated Next path");
    const modules = resolve(target, "node_modules");
    if (existsSync(modules)) {
      try {
        unlinkSync(modules);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    try {
      rmSync(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch (error) {
      if (error.code !== "ENOENT" || existsSync(target)) throw error;
    }
    assert(!existsSync(target), "Isolated Next cleanup incomplete");
  }
}
async function browser(ledger, password) {
  const cli = resolve(root, "node_modules/@playwright/test/cli.js");
  const path = ledgerPath(ledger.plan.runId);
  try {
    await new Promise((done, fail) => {
      const child = spawn(
        process.execPath,
        [
          cli,
          "test",
          "tests/e2e/task-021-dashboard-dev.spec.mjs",
          "--config",
          "playwright.task021.config.ts",
          "--workers=1",
        ],
        {
          cwd: root,
          windowsHide: true,
          stdio: "inherit",
          env: {
            ...Object.fromEntries(
              [
                "PATH",
                "Path",
                "SystemRoot",
                "windir",
                "ComSpec",
                "TEMP",
                "TMP",
                "USERPROFILE",
                "APPDATA",
                "LOCALAPPDATA",
                "ProgramFiles",
                "ProgramFiles(x86)",
                "SystemDrive",
                "PLAYWRIGHT_BROWSERS_PATH",
                "TASK021_DEV_DB_PASSWORD",
                "TASK021_DEV_CA_PATH",
                "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
              ]
                .filter((name) => process.env[name] !== undefined)
                .map((name) => [name, process.env[name]]),
            ),
            APP_ENV: "development",
            SUPABASE_DEV_PROJECT_REF: projectRef,
            NEXT_PUBLIC_SUPABASE_URL: devUrl,
            TASK021_LEDGER_PATH: path,
            TASK021_SERVER_RUN_ID: ledger.plan.runId,
            TASK021_FIXTURE_PASSWORD: password,
          },
        },
      );
      child.on("error", fail);
      child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`Chromium exit ${code}`))));
    });
  } finally {
    cleanupIsolatedServer(ledger.plan.runId);
  }
}
async function reconcile(db, ledger) {
  const state = await ownership(db, ledger.plan, { allowPartial: true });
  return state;
}
export function assertRolledBackAuthLedger(ledger) {
  assert.equal(ledger.version, 1);
  assert.equal(ledger.stage, "db_rolled_back", "Recovery requires the original rollback stage");
  assert.equal(ledger.plan.runId, rolledBackRunId);
  assert.equal(ledger.plan.projectRef, projectRef);
  assert.deepEqual(Object.keys(ledger.plan.actors).sort(), Object.keys(rolledBackAuthIds).sort());
  assert.equal(ledger.finalInventory, undefined);
  assert.equal(ledger.cleanup, undefined, "Recovery has already been attempted");
  assert(ledger.evidence.includes("FAIL stage=db_rolled_back code=23P01"));
  canonicalInventory(ledger.baseline);
  for (const [name, id] of Object.entries(rolledBackAuthIds)) {
    const actor = ledger.plan.actors[name];
    assert.equal(actor.id, id, `Ledger Auth UUID differs for ${name}`);
    assert.equal(
      actor.email,
      `task021-${rolledBackRunId}-${name.toLowerCase()}@example.test`,
      `Ledger Auth email differs for ${name}`,
    );
  }
  assert.equal(new Set(Object.values(rolledBackAuthIds)).size, 6);
}
function normalizedAuth(rows) {
  return rows
    .map(({ id, email, gate, run_id }) => ({ id, email, gate, run_id }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
export function assertRolledBackAuthRemote(state, snapshot, ledger) {
  const expected = normalizedAuth(
    Object.values(ledger.plan.actors).map((actor) => ({
      id: actor.id,
      email: actor.email,
      gate: "TASK-021",
      run_id: ledger.plan.runId,
    })),
  );
  assert.deepEqual(Object.keys(state.counts).sort(), resources.map(([table]) => table).sort());
  assert.equal(state.counts["auth.users"], 6);
  for (const [table] of resources)
    if (table !== "auth.users")
      assert.equal(state.counts[table], 0, `SQL fixture remains in ${table}`);
  assert.deepEqual(normalizedAuth(state.auth), expected, "Reconciled Auth ownership differs");
  assert.deepEqual(normalizedAuth(snapshot.identities), expected, "Auth recovery snapshot differs");
  assertInventoriesEqual(ledger.baseline, snapshot.withoutOwnedAuth);
  const originalAuth = canonicalInventory(ledger.baseline).find(
    (row) => row.table === "auth.users",
  );
  const currentAuth = canonicalInventory(snapshot.current).find(
    (row) => row.table === "auth.users",
  );
  assert.equal(BigInt(currentAuth.count), BigInt(originalAuth.count) + 6n);
}
export async function cleanupRolledBackAuth(db, admin, ledger, options = {}) {
  const {
    readOwnership = reconcile,
    readSnapshot = authRecoverySnapshot,
    confirmAbsent = absent,
    postcheck = (client) => remotePreflight(client, localChecks()),
    saveLedger = save,
    checkLock = assertRecoveryLock,
    release = releaseLock,
    log = console.log,
  } = options;
  assertRolledBackAuthLedger(ledger);
  checkLock(ledger.plan.runId);
  const state = await readOwnership(db, ledger);
  const snapshot = await readSnapshot(db, ledger.plan);
  assertRolledBackAuthRemote(state, snapshot, ledger);
  for (const actor of Object.values(ledger.plan.actors)) {
    const { data, error } = await admin.auth.admin.getUserById(actor.id);
    assert(!error && data?.user?.id === actor.id && data.user.email === actor.email);
    assert.equal(data.user.user_metadata?.gate, "TASK-021");
    assert.equal(data.user.user_metadata?.runId, ledger.plan.runId);
  }
  checkLock(ledger.plan.runId);
  ledger.cleanup = { kind: "rolled_back_auth_only", results: [] };
  for (const [name, actor] of Object.entries(ledger.plan.actors)) {
    const result = { name, id: actor.id, status: "attempted" };
    ledger.cleanup.results.push(result);
    ledger.stage = `auth_cleanup_attempt:${name}`;
    saveLedger(ledger);
    try {
      const outcome = await admin.auth.admin.deleteUser(actor.id);
      if (outcome.error) throw outcome.error;
      result.status = "delete_ack";
      ledger.stage = `auth_cleaned:${name}`;
      saveLedger(ledger);
    } catch (error) {
      result.status = "uncertain";
      result.errorCode = String(error?.code ?? error?.status ?? "UNKNOWN");
      ledger.stage = `auth_cleanup_uncertain:${name}`;
      ledger.evidence.push(`Auth cleanup uncertain for ${name} code=${result.errorCode}`);
      saveLedger(ledger);
      stop(`Auth cleanup uncertain for ${name}; reconcile read-only before any new write`);
    }
  }
  let post;
  try {
    await confirmAbsent(db, ledger.plan);
    const final = await readSnapshot(db, ledger.plan);
    assert.deepEqual(final.identities, [], "Synthetic Auth identity remains after cleanup");
    assertInventoriesEqual(ledger.baseline, final.current);
    post = await postcheck(db);
    assert.deepEqual(
      post.catalog.existing,
      ledger.catalog.existing,
      "Catalog changed during cleanup",
    );
    assertInventoriesEqual(ledger.baseline, post.data);
  } catch (error) {
    ledger.stage = "cleanup_verification_failed";
    ledger.evidence.push(`Auth cleanup verification failed code=${error?.code ?? "CHECK"}`);
    saveLedger(ledger);
    throw error;
  }
  ledger.finalInventory = canonicalInventory(post.data);
  ledger.stage = "cleanup_verified";
  ledger.evidence.push("Exact six Auth cleanup and 14-resource baseline PASS");
  saveLedger(ledger);
  checkLock(ledger.plan.runId);
  release(ledger.plan.runId);
  ledger.stage = "cleaned";
  saveLedger(ledger);
  log(`TASK021_FUNCTIONAL_CLEANUP_PASS runId=${ledger.plan.runId} resources=14 residue=0`);
}
async function cleanup(db, admin, ledger) {
  if (ledger.plan.runId === rolledBackRunId) return cleanupRolledBackAuth(db, admin, ledger);
  const state = await reconcile(db, ledger);
  for (const row of state.auth) {
    const actor = Object.values(ledger.plan.actors).find((x) => x.email === row.email);
    assert(actor);
    actor.id = row.id;
  }
  const o = ownedRows(ledger.plan);
  const dbTables = Object.keys(state.counts).filter((x) => x !== "auth.users");
  const full = dbTables.every((x) => state.counts[x] === o[x].length);
  const empty = dbTables.every((x) => state.counts[x] === 0);
  assert(full || empty, "Partial database fixture state; no cleanup write");
  if (full) {
    await ownership(db, ledger.plan);
    await cleanupDatabase(db, ledger, save);
  }
  for (const [name, actor] of Object.entries(ledger.plan.actors).reverse()) {
    if (!actor.id) continue;
    const { data, error } = await admin.auth.admin.getUserById(actor.id);
    if (error?.status === 404) continue;
    assert(!error && data?.user?.email === actor.email, "Auth ownership read differs");
    assert.equal(data.user.user_metadata?.gate, "TASK-021");
    assert.equal(data.user.user_metadata?.runId, ledger.plan.runId);
    ledger.stage = `auth_cleanup_attempt:${name}`;
    save(ledger);
    const result = await admin.auth.admin.deleteUser(actor.id);
    if (result.error) stop(`Auth cleanup outcome uncertain for ${name}; reconcile read-only`);
    ledger.stage = `auth_cleaned:${name}`;
    save(ledger);
  }
  await absent(db, ledger.plan);
  const final = await inventory(db);
  assertInventoriesEqual(ledger.baseline, final);
  const post = await remotePreflight(db, localChecks());
  assert.deepEqual(post.catalog.existing, ledger.catalog.existing, "Catalog changed during Gate B");
  ledger.finalInventory = final;
  ledger.stage = "cleaned";
  save(ledger);
  releaseLock(ledger.plan.runId);
  console.log(`TASK021_FUNCTIONAL_CLEANUP_PASS runId=${ledger.plan.runId} resources=14 residue=0`);
}
function assertLocalPreflightReadiness() {
  const plan = assertPlan(
    buildPlan("11111111-1111-4111-8111-111111111111", new Date("2026-10-22T15:00:00Z")),
  );
  assert.equal(resources.length, 14, "Gate B inventory resource count changed");
  assert.deepEqual(
    Object.keys(ownedRows(plan)).sort(),
    resources.map(([table]) => table).sort(),
    "Fixture ownership and cleanup inventory differ",
  );
  if (existsSync(directory)) {
    assert(!existsSync(lockPath), "Existing Gate B lock blocks a new run");
    const unfinished = readdirSync(directory)
      .filter((name) => /^run-[0-9a-f-]{36}\.json$/.test(name))
      .map((name) => JSON.parse(readFileSync(resolve(directory, name), "utf8")))
      .filter((ledger) => ledger.stage !== "cleaned");
    assert.equal(unfinished.length, 0, "Existing unfinished Gate B ledger blocks a new run");
  }
  return plan;
}
async function main() {
  const [mode, runId] = process.argv.slice(2);
  assert(["local", "preflight", "run", "reconcile", "cleanup"].includes(mode));
  if (["reconcile", "cleanup"].includes(mode))
    assert(runId && process.argv.length === 4, "RunId required");
  else assert(process.argv.length === 3);
  const local = localChecks();
  const preparedPlan = ["local", "preflight"].includes(mode)
    ? assertLocalPreflightReadiness()
    : null;
  if (mode === "local") {
    const plan = preparedPlan;
    console.log(
      `TASK021_FUNCTIONAL_LOCAL_PASS fixtures=6_auth/2_centers/2_professionals/2_patients/${plan.appointments.length}_appointments`,
    );
    return;
  }
  assert.equal(process.env.TASK021_DEV_CONFIRM_REF, projectRef);
  const db = await connect();
  try {
    const before = await remotePreflight(db, local);
    console.log("TASK021_FUNCTIONAL_PREFLIGHT_PASS migrations=25 project=salud-plus-turnos-dev");
    if (mode === "preflight") return;
    if (mode === "reconcile") {
      const ledger = readLedger(runId);
      const state = await reconcile(db, ledger);
      console.log(JSON.stringify({ runId, stage: ledger.stage, state }));
      return;
    }
    const secret = process.env.TASK021_DEV_SECRET_KEY;
    assert(secret, "Hidden DEV Auth Admin key required");
    const admin = client(secret);
    await adminProbe(admin);
    if (mode === "cleanup") {
      assert.equal(process.env.TASK021_DEV_CLEANUP_REF, projectRef);
      const ledger = readLedger(runId, { requireOriginal: runId === rolledBackRunId });
      assert.deepEqual(before.catalog.existing, ledger.catalog.existing);
      await cleanup(db, admin, ledger);
      return;
    }
    assert.equal(process.env.TASK021_DEV_WRITE_REF, projectRef);
    mkdirSync(directory, { recursive: true });
    const plan = assertPlan(buildPlan());
    const previous = readdirSync(directory)
      .filter((x) => /^run-[0-9a-f-]{36}\.json$/.test(x))
      .map((x) => JSON.parse(readFileSync(resolve(directory, x), "utf8")))
      .filter((x) => x.stage !== "cleaned");
    assert.equal(previous.length, 0, "Existing unfinished Gate B ledger; reconcile/cleanup first");
    const lockFd = openSync(lockPath, "wx", 0o600);
    try {
      writeFileSync(
        lockFd,
        JSON.stringify({ runId: plan.runId, createdAt: new Date().toISOString() }),
      );
    } finally {
      closeSync(lockFd);
    }
    const active = readdirSync(directory)
      .filter((x) => /^run-[0-9a-f-]{36}\.json$/.test(x))
      .map((x) => JSON.parse(readFileSync(resolve(directory, x), "utf8")))
      .filter((x) => x.stage !== "cleaned");
    if (active.length) {
      releaseLock(plan.runId);
      stop("Existing unfinished Gate B ledger; reconcile/cleanup first");
    }
    let lockedBefore;
    try {
      lockedBefore = await remotePreflight(db, local);
      await absent(db, plan);
    } catch (error) {
      releaseLock(plan.runId);
      throw error;
    }
    const ledger = {
      version: 1,
      stage: "planned",
      plan,
      baseline: lockedBefore.data,
      catalog: lockedBefore.catalog,
      evidence: [],
    };
    const path = ledgerPath(plan.runId);
    try {
      writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    } catch (error) {
      releaseLock(plan.runId);
      throw error;
    }
    console.log(`TASK021_RUN_ID=${plan.runId} ledger=${path}`);
    const password = `Task021-${randomBytes(24).toString("base64url")}Aa1!`;
    let failure = null;
    try {
      await createAuth(admin, ledger, password);
      await insertFixtures(db, ledger, save);
      await ownership(db, plan);
      await rpcChecks(db, ledger, password, process.env.TASK021_DEV_PUBLISHABLE_KEY);
      ledger.stage = "fixtures_ready";
      save(ledger);
      await browser(ledger, password);
      ledger.evidence.push("Authenticated RPC and Chromium PASS");
      ledger.stage = "browser_pass";
      save(ledger);
    } catch (e) {
      failure = e;
      ledger.evidence.push(`FAIL stage=${ledger.stage} code=${e.code ?? "CHECK"}`);
      save(ledger);
    }
    if (
      [
        "fixtures_ready",
        "browser_pass",
        "rpc_checks_pass",
        "membership_restored",
        "professional_link_restored",
      ].includes(ledger.stage)
    ) {
      try {
        await cleanup(db, admin, ledger);
      } catch (e) {
        stop(`Cleanup stopped; ledger retained at ${path}; ${e.message}`);
      }
    }
    if (failure) throw failure;
    assert.equal(
      ledger.stage,
      "cleaned",
      "Run stopped before safe cleanup; reconcile/cleanup explicitly",
    );
    console.log(`TASK021_FUNCTIONAL_PASS runId=${plan.runId} residue=0`);
  } finally {
    await db.end().catch(() => {});
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((e) => {
    const message = String(e.message)
      .replaceAll(process.env.TASK021_DEV_DB_PASSWORD ?? "__NO_SECRET__", "[REDACTED]")
      .replaceAll(process.env.TASK021_DEV_SECRET_KEY ?? "__NO_SECRET__", "[REDACTED]")
      .slice(0, 350);
    console.error(
      `STOP TASK-021 Gate B [${/^[A-Z0-9_]{2,32}$/.test(e.code ?? "") ? e.code : "CHECK"}]: ${message}`,
    );
    process.exitCode = 1;
  });
