import fs from "node:fs";
import { createHash } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { resolve } from "node:path";

// Preload with: node --import ./scripts/compare-task007a-baseline-v2.mjs scripts/verify-task007a-baseline-v2.mjs
// Keeps the approved verifier and manifest immutable while comparing a fresh capture.
const manifestPath = resolve(".harness/tasks/active/TASK-007/baseline-v2-manifest.json");
const verifierPath = resolve("scripts/verify-task007a-baseline-v2.mjs");
const reference = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const currentScriptSha = createHash("sha256").update(fs.readFileSync(verifierPath)).digest("hex");
if (reference.verifier_script_sha256 !== currentScriptSha)
  throw new Error("V2 verifier script SHA differs from approved manifest");
if (
  reference.stable_data.global_sha256 !==
  "24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359"
) {
  throw new Error("Approved V2 manifest global digest changed");
}
const originalWrite = fs.writeFileSync;
fs.writeFileSync = (path, contents, options) => {
  if (resolve(path) !== manifestPath) return originalWrite(path, contents, options);
  const actual = JSON.parse(String(contents));
  const drift = [];
  if (!actual.verification.stable) drift.push("fresh READ #1 / READ #2 unstable");
  if (!actual.verification.domain_invariants_pass) drift.push("domain invariant failure");
  if (actual.stable_data.global_sha256 !== reference.stable_data.global_sha256)
    drift.push("global stable-data digest");
  for (const [name, expected] of Object.entries(reference.stable_data.components)) {
    const found = actual.stable_data.components[name];
    if (!found) {
      drift.push(`${name}: missing component`);
      continue;
    }
    if (found.row_count !== expected.row_count)
      drift.push(`${name}: row count ${expected.row_count} -> ${found.row_count}`);
    if (found.component_sha256 !== expected.component_sha256)
      drift.push(`${name}: component digest`);
    const expectedRows = new Map(expected.rows.map((row) => [row.row_key_sha256, row]));
    const actualRows = new Map(found.rows.map((row) => [row.row_key_sha256, row]));
    for (const [key, row] of expectedRows) {
      const newer = actualRows.get(key);
      if (!newer) {
        drift.push(`${name}: missing row ${key}`);
        continue;
      }
      for (const [field, hash] of Object.entries(row.field_sha256)) {
        if (newer.field_sha256[field] !== hash) drift.push(`${name}: row ${key} field ${field}`);
      }
    }
    for (const key of actualRows.keys())
      if (!expectedRows.has(key)) drift.push(`${name}: extra row ${key}`);
  }
  if (drift.length)
    throw new Error(`TASK-007A BASELINE V2 DRIFT: ${drift.slice(0, 30).join("; ")}`);
  process.stdout.write("TASK-007A BASELINE V2 exact reference comparison PASS.\n");
};
syncBuiltinESMExports();
