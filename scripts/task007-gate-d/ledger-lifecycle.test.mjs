import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { completeIntegration } from "./integration-state.mjs";
import { ledgerDigest, ledgerPath, readLedger, saveLedger } from "./fixture-core.mjs";

test("integrated ownership ledger survives Playwright output cleanup", () => {
  const temporary = mkdtempSync(join(tmpdir(), "task007d-lifecycle-"));
  const withinTemp = relative(resolve(tmpdir()), temporary);
  assert.match(withinTemp, /^task007d-lifecycle-[A-Za-z0-9]+$/);
  assert.ok(!withinTemp.includes(sep));
  try {
    const outputDir = join(temporary, "test-results");
    const durableLedger = join(temporary, ".task007-gate-d", "fixture-ledger.json");
    const relativeFromOutput = relative(resolve("test-results"), ledgerPath);
    assert.ok(relativeFromOutput === ".." || relativeFromOutput.startsWith(`..${sep}`));
    const ownedCenter = randomUUID();
    const ledger = {
      projectRef: "ehllxymqyzrofydrvtzo",
      stage: "fixtures_ready",
      owned: { centers: [ownedCenter] },
      evidence: [],
    };
    saveLedger(ledger, durableLedger);
    completeIntegration(ledger, [{ label: "local lifecycle", outcome: "PASS" }], durableLedger);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "sentinel"), "Playwright clears this tree");
    rmSync(outputDir, { recursive: true });
    const recovered = readLedger(durableLedger);
    assert.equal(recovered.stage, "integrated");
    assert.deepEqual(recovered.owned.centers, [ownedCenter]);
    assert.equal(recovered.evidence[0].event, "db_integration_pass");
    assert.equal(existsSync(outputDir), false);
  } finally {
    rmSync(temporary, { recursive: true });
  }
});

test("ownership ledger survives isolated server cleanup", () => {
  const workspace = mkdtempSync(join(tmpdir(), "task007d-lifecycle-"));
  const temporaryServer = mkdtempSync(join(tmpdir(), "task007d-next-"));
  const workspaceWithinTemp = relative(resolve(tmpdir()), workspace);
  const serverWithinTemp = relative(resolve(tmpdir()), temporaryServer);
  assert.match(workspaceWithinTemp, /^task007d-lifecycle-[A-Za-z0-9]+$/);
  assert.match(serverWithinTemp, /^task007d-next-[A-Za-z0-9]+$/);
  assert.ok(!workspaceWithinTemp.includes(sep) && !serverWithinTemp.includes(sep));
  try {
    const durableLedger = join(workspace, ".task007-gate-d", "fixture-ledger.json");
    const recordPath = join(workspace, "test-results", "task007-gate-d", "server-temp.json");
    saveLedger(
      {
        projectRef: "ehllxymqyzrofydrvtzo",
        runId: randomUUID(),
        stage: "e2e_pass",
        owned: { centers: [randomUUID()] },
      },
      durableLedger,
    );
    const before = ledgerDigest(durableLedger);
    mkdirSync(join(workspace, "test-results", "task007-gate-d"), { recursive: true });
    writeFileSync(recordPath, JSON.stringify({ temporary: temporaryServer, port: 1 }));
    const output = execFileSync(
      process.execPath,
      [resolve("scripts/task007-gate-d/cleanup-isolated.mjs")],
      { cwd: workspace, encoding: "utf8", windowsHide: true },
    );
    assert.match(output, /Ownership ledger preserved:/);
    assert.equal(existsSync(recordPath), false);
    assert.equal(existsSync(temporaryServer), false);
    assert.equal(ledgerDigest(durableLedger), before);
    assert.equal(readLedger(durableLedger).stage, "e2e_pass");
  } finally {
    if (existsSync(temporaryServer)) rmSync(temporaryServer, { recursive: true });
    rmSync(workspace, { recursive: true });
  }
});
