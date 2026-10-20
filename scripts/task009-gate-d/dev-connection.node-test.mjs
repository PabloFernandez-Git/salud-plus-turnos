import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import "./dev-connection.mjs";

test("Gate D preserves PostgreSQL CAS microseconds from timestamptz", () => {
  const token = "2026-10-20 16:05:41.123456+00";
  const parsed = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ, "text")(token);
  assert.equal(parsed, token);
  assert.equal(new Date(token).toISOString(), "2026-10-20T16:05:41.123Z");
});
