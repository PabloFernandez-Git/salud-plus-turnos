import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { assertTargetArgModes, normalizeArgModes } from "./gate.mjs";

function expected(outputCount) {
  return ["i", ...Array(outputCount).fill("t")];
}

test("pg returns catalog char[] as a PostgreSQL literal while text[] becomes a JS array", () => {
  assert.equal(pg.types.getTypeParser(1002, "text")("{i,t,t}"), "{i,t,t}");
  assert.equal(pg.types.getTypeParser(18, "text")("s"), "s");
  assert.equal(pg.types.getTypeParser(21, "text")("1"), 1);
  assert.equal(pg.types.getTypeParser(16, "text")("t"), true);
  assert.deepEqual(pg.types.getTypeParser(1009, "text")("{p_center_id,as_of}"), [
    "p_center_id",
    "as_of",
  ]);
});

test("Gate A accepts both actual pg char[] and an already parsed array", () => {
  for (const outputCount of [9, 10]) {
    const modes = expected(outputCount);
    assert.deepEqual(normalizeArgModes(`{${modes.join(",")}}`), modes);
    assertTargetArgModes(`{${modes.join(",")}}`, outputCount);
    assertTargetArgModes(modes, outputCount);
  }
});

test("Gate A rejects missing, extra, reordered and changed argument modes", () => {
  const modes = expected(10);
  for (const wrong of [
    modes.slice(0, -1),
    [...modes, "t"],
    ["t", ...modes.slice(1)],
    ["i", "o", ...modes.slice(2)],
    `{${modes.slice(0, -1).join(",")}}`,
    `{${["t", ...modes.slice(1)].join(",")}}`,
    `{${["i", "o", ...modes.slice(2)].join(",")}}`,
  ])
    assert.throws(() => assertTargetArgModes(wrong, 10), { code: "ERR_ASSERTION" });
  for (const malformed of ["{i,,t}", "i,t", "{}", null, { 0: "i" }, ["i", "tt"]])
    assert.throws(() => normalizeArgModes(malformed), { code: "ERR_ASSERTION" });
});
