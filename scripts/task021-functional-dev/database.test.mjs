import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  assertInventoriesEqual,
  authRecoverySnapshot,
  canonicalInventory,
  inventoryRows,
} from "./database.mjs";
import { resources } from "./plan.mjs";
const digest = (value) => createHash("md5").update(value).digest("hex");

const gateAOrder = [
  "auth.users",
  "private.provisioning_operations",
  "public.users",
  "public.platform_admins",
  "public.centers",
  "public.center_memberships",
  "public.professionals",
  "public.professional_centers",
  "public.specialties",
  "public.professional_center_specialties",
  "public.availabilities",
  "public.persons",
  "public.patient_centers",
  "public.appointments",
];
const row = (table) => ({
  table,
  count: "1",
  digest: createHash("md5").update(table).digest("hex"),
});

test("the Gate A and Gate B inventory orders differ, but the same snapshot canonicalizes exactly", () => {
  const fromGateA = gateAOrder.map(row);
  const fromGateB = resources.map(([table]) => row(table));
  assert.equal(fromGateA[1].table, "private.provisioning_operations");
  assert.equal(fromGateB[1].table, "public.users");
  assert.notDeepEqual(fromGateA, fromGateB);
  assert.deepEqual(canonicalInventory(fromGateA), fromGateB);
  assert.doesNotThrow(() => assertInventoriesEqual(fromGateA, fromGateB));
});

test("a real count or digest change still stops the baseline/final inventory check", () => {
  const baseline = gateAOrder.map(row);
  const changedCount = baseline.map((entry) => ({ ...entry }));
  changedCount[0].count = "2";
  assert.throws(() => assertInventoriesEqual(baseline, changedCount), /auth\.users/);
  const changedDigest = baseline.map((entry) => ({ ...entry }));
  changedDigest[0].digest = "0".repeat(32);
  assert.throws(() => assertInventoriesEqual(baseline, changedDigest), /auth\.users/);
});

test("missing, duplicated or malformed inventory rows stop", () => {
  const baseline = gateAOrder.map(row);
  assert.throws(() => canonicalInventory(baseline.slice(1)), /resource count differs/);
  assert.throws(
    () => canonicalInventory([...baseline.slice(0, -1), baseline[0]]),
    /Duplicate inventory table/,
  );
  assert.throws(
    () => canonicalInventory([{ ...baseline[0], digest: "bad" }, ...baseline.slice(1)]),
    /Invalid digest/,
  );
});
test("the secondary inventory reader uses only SELECTs inside the caller snapshot", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      assert.match(sql, /^select count\(\*\)::text/i);
      const table = / from ([a-z_.]+)$/.exec(sql)?.[1];
      assert(table);
      return { rows: [{ count: "1", digest: createHash("md5").update(table).digest("hex") }] };
    },
  };
  const observed = await inventoryRows(client);
  assert.deepEqual(
    observed,
    resources.map(([table]) => row(table)),
  );
  assert.equal(queries.length, 14);
});

test("Auth recovery reads exact IDs, emails and runId with one repeatable read-only snapshot", async () => {
  const queries = [];
  const plan = {
    runId: "c8c10bdb-705b-405e-8990-070edcd8bde6",
    actors: {
      adminA: { id: "fb317884-7b96-4050-b363-f05e8af7d73e", email: "synthetic@example.test" },
    },
  };
  const client = {
    async query(sql, args) {
      queries.push({ sql, args });
      if (/^(BEGIN|SET LOCAL|ROLLBACK)/.test(sql)) return { rows: [] };
      if (sql.startsWith("select id::text,email"))
        return {
          rows: [
            {
              id: plan.actors.adminA.id,
              email: plan.actors.adminA.email,
              gate: "TASK-021",
              run_id: plan.runId,
            },
          ],
        };
      if (sql.includes("where id<>all($1::uuid[])"))
        return { rows: [{ count: "1", digest: digest("baseline") }] };
      const table = / from ([a-z_.]+)$/.exec(sql)?.[1];
      assert(table);
      return { rows: [{ count: table === "auth.users" ? "2" : "0", digest: digest(table) }] };
    },
  };
  const result = await authRecoverySnapshot(client, plan);
  assert.equal(result.identities.length, 1);
  assert.equal(result.current.length, 14);
  assert.equal(result.withoutOwnedAuth[0].count, "1");
  assert.equal(queries[0].sql, "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(queries.at(-1).sql, "ROLLBACK");
  assert.deepEqual(queries[2].args, [
    [plan.actors.adminA.id],
    [plan.actors.adminA.email],
    plan.runId,
  ]);
  assert(queries.every(({ sql }) => /^(BEGIN|SET LOCAL|ROLLBACK|select)/.test(sql)));
});
