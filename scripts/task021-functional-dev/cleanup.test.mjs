import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  assertRolledBackAuthLedger,
  assertRolledBackAuthRemote,
  cleanupRolledBackAuth,
} from "./gate.mjs";
import { resources } from "./plan.mjs";

const runId = "c8c10bdb-705b-405e-8990-070edcd8bde6";
const ids = {
  adminA: "fb317884-7b96-4050-b363-f05e8af7d73e",
  receptionA: "b7acd5d6-befc-4d97-b479-81168063a235",
  professionalA: "86d1a252-a771-4471-bf1e-800d508071f7",
  professionalA2: "b2e6b1de-cc45-46f1-bc31-718459ca8336",
  adminB: "8bc9a90c-44b9-4b8b-8e71-885b582c2e54",
  unlinked: "74eefdb1-2467-4548-9651-2ade663ddf80",
};
const digest = (value) => createHash("md5").update(value).digest("hex");
function ledger() {
  return {
    version: 1,
    stage: "db_rolled_back",
    plan: {
      runId,
      projectRef: "ehllxymqyzrofydrvtzo",
      actors: Object.fromEntries(
        Object.entries(ids).map(([name, id]) => [
          name,
          { id, email: `task021-${runId}-${name.toLowerCase()}@example.test` },
        ]),
      ),
    },
    baseline: resources.map(([table]) => ({
      table,
      count: table === "auth.users" ? "1" : "0",
      digest: digest(table),
    })),
    catalog: { existing: Array.from({ length: 25 }, (_, index) => String(index)) },
    evidence: ["FAIL stage=db_rolled_back code=23P01"],
  };
}
function authRows(value) {
  return Object.values(value.plan.actors).map((actor) => ({
    id: actor.id,
    email: actor.email,
    gate: "TASK-021",
    run_id: runId,
  }));
}
function remote(value) {
  const auth = authRows(value);
  const current = value.baseline.map((row) =>
    row.table === "auth.users" ? { ...row, count: "7", digest: digest("current auth") } : row,
  );
  return {
    state: {
      counts: Object.fromEntries(
        resources.map(([table]) => [table, table === "auth.users" ? 6 : 0]),
      ),
      auth,
    },
    snapshot: { identities: auth, current, withoutOwnedAuth: structuredClone(value.baseline) },
  };
}
function harness(value, changes = {}) {
  const events = [];
  const { state, snapshot } = remote(value);
  const deleted = [];
  const admin = {
    auth: {
      admin: {
        async getUserById(id) {
          events.push(`get:${id}`);
          const actor = Object.values(value.plan.actors).find((entry) => entry.id === id);
          return {
            data: {
              user: {
                id,
                email: actor.email,
                user_metadata: { gate: changes.badAdminMetadata ? "OTHER" : "TASK-021", runId },
              },
            },
          };
        },
        async deleteUser(id) {
          events.push(`delete:${id}`);
          if (changes.failDeleteAt === deleted.length + 1)
            return { error: { code: "AUTH_FAILURE" } };
          deleted.push(id);
          return { error: null };
        },
      },
    },
  };
  let snapshots = 0;
  const options = {
    readOwnership: async () => state,
    readSnapshot: async () => {
      snapshots++;
      if (snapshots === 1) return snapshot;
      if (changes.finalIdentityRemains) return snapshot;
      if (changes.finalInventoryDrift) {
        const changed = structuredClone(value.baseline);
        changed[1].digest = digest("final drift");
        return { identities: [], current: changed, withoutOwnedAuth: changed };
      }
      return { identities: [], current: value.baseline, withoutOwnedAuth: value.baseline };
    },
    confirmAbsent: async () => {
      events.push("absent");
      assert.equal(deleted.length, 6);
    },
    postcheck: async () => {
      events.push("postcheck");
      return { catalog: value.catalog, data: value.baseline };
    },
    saveLedger: (entry) => events.push(`save:${entry.stage}`),
    checkLock: () => {
      events.push("check-lock");
      if (changes.badLock) throw new Error("Wrong lock");
    },
    release: () => events.push("release-lock"),
    log: (message) => events.push(message),
  };
  return { admin, options, events, deleted, state, snapshot };
}

test("exact six Auth cleanup verifies absence and baseline before marking clean and releasing lock", async () => {
  const value = ledger();
  const { admin, options, events, deleted } = harness(value);
  await cleanupRolledBackAuth({}, admin, value, options);
  assert.deepEqual(deleted, Object.values(ids));
  assert.equal(value.stage, "cleaned");
  assert.deepEqual(
    value.cleanup.results.map((row) => row.status),
    Array(6).fill("delete_ack"),
  );
  assert(events.indexOf("absent") < events.indexOf("postcheck"));
  assert(events.indexOf("postcheck") < events.indexOf("save:cleanup_verified"));
  assert(events.indexOf("save:cleanup_verified") < events.indexOf("release-lock"));
  assert(events.indexOf("release-lock") < events.indexOf("save:cleaned"));
  assert.match(events.at(-1), /residue=0/);
});

test("ledger UUID, runId, stage and lock mismatches stop before deletion", async () => {
  for (const mutate of [
    (value) => (value.plan.actors.adminA.id = "00000000-0000-4000-8000-000000000000"),
    (value) => (value.plan.runId = "11111111-1111-4111-8111-111111111111"),
    (value) => (value.stage = "auth_cleanup_attempt:adminA"),
  ]) {
    const value = ledger();
    mutate(value);
    assert.throws(() => assertRolledBackAuthLedger(value));
  }
  const value = ledger();
  const { admin, options, events } = harness(value, { badLock: true });
  await assert.rejects(cleanupRolledBackAuth({}, admin, value, options), /Wrong lock/);
  assert(!events.some((event) => event.startsWith("delete:")));
});

test("wrong Auth UUID, runId, gate, missing or unrelated identity stop before deletion", () => {
  const mutations = [
    (snapshot) => (snapshot.identities[0].id = "00000000-0000-4000-8000-000000000000"),
    (snapshot) => (snapshot.identities[0].run_id = "other-run"),
    (snapshot) => (snapshot.identities[0].gate = "OTHER"),
    (snapshot) => snapshot.identities.pop(),
    (snapshot) =>
      snapshot.identities.push({
        id: "00000000-0000-4000-8000-000000000000",
        email: "other@example.test",
        gate: "TASK-021",
        run_id: runId,
      }),
  ];
  for (const mutate of mutations) {
    const value = ledger();
    const { state, snapshot } = remote(value);
    mutate(snapshot);
    assert.throws(() => assertRolledBackAuthRemote(state, snapshot, value));
  }
});

test("SQL residue or unrelated inventory drift stops before deletion", () => {
  const value = ledger();
  const { state, snapshot } = remote(value);
  state.counts["public.users"] = 1;
  assert.throws(() => assertRolledBackAuthRemote(state, snapshot, value), /SQL fixture remains/);
  state.counts["public.users"] = 0;
  snapshot.withoutOwnedAuth[1] = { ...snapshot.withoutOwnedAuth[1], digest: digest("drift") };
  assert.throws(() => assertRolledBackAuthRemote(state, snapshot, value), /Inventory differs/);
});

test("partial Auth Admin failure is recorded, preserves lock and cannot be retried automatically", async () => {
  const value = ledger();
  const { admin, options, events, deleted } = harness(value, { failDeleteAt: 3 });
  await assert.rejects(cleanupRolledBackAuth({}, admin, value, options), /Auth cleanup uncertain/);
  assert.equal(deleted.length, 2);
  assert.equal(value.stage, "auth_cleanup_uncertain:professionalA");
  assert.deepEqual(
    value.cleanup.results.map((row) => row.status),
    ["delete_ack", "delete_ack", "uncertain"],
  );
  assert(!events.includes("release-lock"));
  assert(!events.includes("save:cleaned"));
  await assert.rejects(cleanupRolledBackAuth({}, admin, value, options), /original rollback stage/);
});

test("Auth Admin metadata disagreement stops before the first delete", async () => {
  const value = ledger();
  const { admin, options, events } = harness(value, { badAdminMetadata: true });
  await assert.rejects(cleanupRolledBackAuth({}, admin, value, options));
  assert.equal(value.stage, "db_rolled_back");
  assert(!events.some((event) => event.startsWith("delete:")));
  assert(!events.includes("release-lock"));
});

test("unconfirmed residue prevents cleanup PASS and keeps ledger and lock", async () => {
  const value = ledger();
  const { admin, options, events } = harness(value, { finalIdentityRemains: true });
  await assert.rejects(cleanupRolledBackAuth({}, admin, value, options), /identity remains/);
  assert.equal(value.stage, "cleanup_verification_failed");
  assert(value.evidence.some((entry) => entry.startsWith("Auth cleanup verification failed")));
  assert(!events.includes("release-lock"));
  assert(!events.includes("save:cleaned"));
});

test("final inventory drift prevents residue zero and lock release", async () => {
  const value = ledger();
  const { admin, options, events } = harness(value, { finalInventoryDrift: true });
  await assert.rejects(cleanupRolledBackAuth({}, admin, value, options), /Inventory differs/);
  assert.equal(value.stage, "cleanup_verification_failed");
  assert(!events.includes("release-lock"));
  assert(!events.includes("save:cleaned"));
});
