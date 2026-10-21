import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { executeValidation } from "./flow.mjs";
import { readLedger, saveLedger } from "./ledger.mjs";
import { makePlan } from "./plan.mjs";

const actorId = "77777777-7777-4777-8777-777777777777";
const createdAppointmentId = "88888888-8888-4888-8888-888888888888";

function mockAdapters({ failBrowser = false, failInsert = false, unownedReference = false } = {}) {
  const state = { auth: false, db: false, browserAppointment: false, calls: [] };
  const note = (name) => state.calls.push(name);
  return {
    state,
    adapters: {
      async preflight() {
        note("preflight");
      },
      async captureInventory() {
        note("inventory");
        return { auth: state.auth, db: state.db, browserAppointment: state.browserAppointment };
      },
      async compareInventory(after, before) {
        note("compare");
        assert.deepEqual(after, before);
      },
      async assertPlanAbsent() {
        note("absent");
        assert.equal(state.db, false);
      },
      async createAuth() {
        note("auth-create");
        state.auth = true;
        return actorId;
      },
      async assertAuthAbsent() {
        note("auth-absent");
        assert.equal(state.auth, false);
      },
      async deleteAuth() {
        note("auth-delete");
        state.auth = false;
      },
      async insertFixture(ledger, path) {
        note("fixture-create");
        if (failInsert) throw new Error("simulated transaction rollback");
        state.db = true;
        ledger.stage = "fixtures_ready";
        saveLedger(ledger, path);
      },
      async runBrowser() {
        note("browser");
        state.browserAppointment = true;
        if (failBrowser) throw new Error("simulated lost response");
      },
      async reconcileBrowserAppointment(ledger, path) {
        note("reconcile");
        if (state.browserAppointment) {
          ledger.browserAppointmentId = createdAppointmentId;
          saveLedger(ledger, path);
        }
      },
      async inspectFixtureState() {
        note("inspect");
        return state.db ? "complete" : "absent";
      },
      async cleanupDatabase(ledger, path) {
        note("audit-and-delete");
        if (unownedReference) throw new Error("unowned Center row; STOP");
        assert.equal(ledger.browserAppointmentId, createdAppointmentId);
        state.browserAppointment = false;
        state.db = false;
        ledger.stage = "database_cleaned";
        saveLedger(ledger, path);
      },
    },
  };
}

function withTempLedger(callback) {
  const root = mkdtempSync(join(tmpdir(), "task013-sim-"));
  const relativeToTemp = relative(resolve(tmpdir()), resolve(root));
  if (
    !relativeToTemp ||
    relativeToTemp.startsWith("..") ||
    relativeToTemp.includes(`..${sep}`) ||
    !/^task013-sim-[A-Za-z0-9]+$/.test(relativeToTemp)
  )
    throw new Error("Simulation path escaped the system temp directory");
  const path = join(root, "ledger.json");
  return Promise.resolve()
    .then(() => callback(path))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

test("minimal synthetic plan is bounded and DST instants are distinct", () => {
  const plan = makePlan({
    now: new Date("2026-10-21T12:00:00Z"),
    runId: "99999999-9999-4999-8999-999999999999",
  });
  assert.equal(plan.date, "2026-10-28");
  assert.equal(plan.centerTimezone, "America/New_York");
  assert.equal(plan.appointments.length, 6);
  assert.equal(plan.availabilities.length, 5);
  assert.deepEqual(
    plan.appointments.slice(-2).map((row) => row.instant),
    ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"],
  );
  assert.equal(plan.authEmail, "task013-99999999-9999-4999-8999-999999999999@example.test");
});

test("simulation creates, reconciles and cleans only owned rows", () =>
  withTempLedger(async (ledgerPath) => {
    const { adapters, state } = mockAdapters();
    const result = await executeValidation({
      adapters,
      ledgerPath,
      now: new Date("2026-10-21T12:00:00Z"),
    });
    assert.equal(result.stage, "cleaned");
    assert.equal(result.browserAppointmentId, createdAppointmentId);
    assert.deepEqual(
      result.cleanup && [result.cleanup.residueZero, result.cleanup.inventoryRestored],
      [true, true],
    );
    assert.deepEqual([state.auth, state.db, state.browserAppointment], [false, false, false]);
    assert.ok(state.calls.indexOf("preflight") < state.calls.indexOf("auth-create"));
    assert.ok(state.calls.indexOf("reconcile") < state.calls.indexOf("audit-and-delete"));
  }));

test("lost browser response is reconciled and cleaned before reporting failure", () =>
  withTempLedger(async (ledgerPath) => {
    const { adapters, state } = mockAdapters({ failBrowser: true });
    await assert.rejects(
      executeValidation({ adapters, ledgerPath, now: new Date("2026-10-21T12:00:00Z") }),
      /browser validation failed and cleaned/,
    );
    assert.equal(readLedger(ledgerPath).stage, "cleaned");
    assert.equal(readLedger(ledgerPath).browserAppointmentId, createdAppointmentId);
    assert.deepEqual([state.auth, state.db, state.browserAppointment], [false, false, false]);
  }));

test("rolled-back fixture setup deletes only the synthetic Auth user", () =>
  withTempLedger(async (ledgerPath) => {
    const { adapters, state } = mockAdapters({ failInsert: true });
    await assert.rejects(
      executeValidation({ adapters, ledgerPath, now: new Date("2026-10-21T12:00:00Z") }),
      /run stopped and cleaned/,
    );
    assert.equal(readLedger(ledgerPath).stage, "cleaned");
    assert.deepEqual([state.auth, state.db], [false, false]);
    assert.equal(state.calls.includes("audit-and-delete"), false);
  }));

test("an unowned reference stops cleanup and preserves the recovery ledger", () =>
  withTempLedger(async (ledgerPath) => {
    const { adapters, state } = mockAdapters({ unownedReference: true });
    await assert.rejects(
      executeValidation({ adapters, ledgerPath, now: new Date("2026-10-21T12:00:00Z") }),
      /cleanup stopped: unowned Center row/,
    );
    const preserved = readLedger(ledgerPath);
    assert.equal(preserved.browserAppointmentId, createdAppointmentId);
    assert.equal(state.auth, true);
    assert.equal(state.db, true);
    assert.equal(JSON.parse(readFileSync(ledgerPath, "utf8")).authUserId, actorId);
  }));
