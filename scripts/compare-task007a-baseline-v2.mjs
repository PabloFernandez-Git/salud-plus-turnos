import fs from "node:fs";
import { createHash } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { resolve } from "node:path";
import { compareBaselineV2 } from "./lib/compare-task007a-baseline-v2.mjs";

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
  const drift = compareBaselineV2(reference, actual);
  if (drift.length)
    throw new Error(`TASK-007A BASELINE V2 DRIFT: ${drift.slice(0, 30).join("; ")}`);
  process.stdout.write("TASK-007A BASELINE V2 exact reference comparison PASS.\n");
};
syncBuiltinESMExports();
