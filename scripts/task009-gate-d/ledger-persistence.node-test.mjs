import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { replaceLedgerFile } from "./ledger.mjs";

function paths() {
  const name = `task009-ledger-${randomUUID()}`;
  return { target: join(tmpdir(), `${name}.json`), temporary: join(tmpdir(), `${name}.tmp`) };
}

function fakeEperm() {
  return Object.assign(new Error("Windows target temporarily locked"), { code: "EPERM" });
}

test("Windows EPERM during replacement retries and preserves the newest ledger", () => {
  const { target, temporary } = paths();
  try {
    writeFileSync(target, "old");
    writeFileSync(temporary, "new");
    let attempts = 0;
    replaceLedgerFile(temporary, target, (source, destination) => {
      if (attempts++ < 2) throw fakeEperm();
      renameSync(source, destination);
    });
    assert.equal(attempts, 3);
    assert.equal(readFileSync(target, "utf8"), "new");
  } finally {
    rmSync(target, { force: true });
    rmSync(temporary, { force: true });
  }
});

test("persistent EPERM leaves both the prior ledger and new snapshot intact", () => {
  const { target, temporary } = paths();
  try {
    writeFileSync(target, "old");
    writeFileSync(temporary, "new");
    assert.throws(
      () =>
        replaceLedgerFile(temporary, target, () => {
          throw fakeEperm();
        }),
      {
        code: "EPERM",
      },
    );
    assert.equal(readFileSync(target, "utf8"), "old");
    assert.equal(readFileSync(temporary, "utf8"), "new");
  } finally {
    rmSync(target, { force: true });
    rmSync(temporary, { force: true });
  }
});
