import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readLedger } from "./fixture-core.mjs";
import { auditClean } from "./audit-clean.mjs";

function cleanedLedger() {
  const ledger = structuredClone(readLedger());
  ledger.stage = "cleaned";
  ledger.authDeleted = [...ledger.owned.authUsers];
  return ledger;
}

test("post-clean audit reads only exact owned UUIDs and verifies original inventory", async () => {
  const ledger = cleanedLedger();
  const queries = [];
  const database = {
    async query(sql, parameters = []) {
      queries.push({ sql, parameters });
      assert.match(sql, /^select /);
      if (sql.includes("count(*)")) {
        assert.equal(parameters.length, 1);
        assert.ok(Array.isArray(parameters[0]));
        assert.ok(parameters[0].length > 0);
        assert.match(sql, /where (?:id|user_id)=any\(\$1::uuid\[\]\)/);
        return { rows: [{ count: 0 }] };
      }
      const table = sql.match(/from ([a-z_.]+)/)?.[1];
      const column = sql.match(/^select ([a-z_]+)/)?.[1];
      assert.ok(table && column);
      return { rows: ledger.before[table].map((id) => ({ [column]: id })) };
    },
  };
  assert.deepEqual(await auditClean(database, ledger), {
    ownedIdsAbsent: true,
    inventoryRestored: true,
  });
  assert.equal(queries.filter((query) => query.sql.includes("count(*)")).length, 9);
  assert.equal(queries.length, 19);
});

test("post-clean audit stops if any owned UUID remains", async () => {
  const ledger = cleanedLedger();
  const database = {
    async query() {
      return { rows: [{ count: 1 }] };
    },
  };
  await assert.rejects(auditClean(database, ledger), /Owned UUID remains after cleanup/);
});
