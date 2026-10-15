import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { connect } from "node:net";
import { join, relative, resolve, sep } from "node:path";

const recordPath = resolve("test-results/task007-gate-d/server-temp.json");
const ledgerPath = resolve(".task007-gate-d/fixture-ledger.json");
const ledgerSha256 = existsSync(ledgerPath)
  ? createHash("sha256").update(readFileSync(ledgerPath)).digest("hex")
  : null;
function verifyLedgerSurvived() {
  if (ledgerSha256 === null) return;
  if (!existsSync(ledgerPath)) throw new Error(`Ownership ledger disappeared: ${ledgerPath}`);
  const after = createHash("sha256").update(readFileSync(ledgerPath)).digest("hex");
  if (after !== ledgerSha256) throw new Error(`Ownership ledger changed: ${ledgerPath}`);
  console.log(`Ownership ledger preserved: ${ledgerPath} sha256=${after}`);
}
if (!existsSync(recordPath)) {
  console.log("No isolated TASK-007D server temp record remains.");
  verifyLedgerSurvived();
  process.exit(0);
}
const record = JSON.parse(readFileSync(recordPath, "utf8"));
const temporary = resolve(record.temporary);
const withinTemp = relative(resolve(tmpdir()), temporary);
if (
  !withinTemp ||
  withinTemp.startsWith("..") ||
  withinTemp.includes(`..${sep}`) ||
  !/^task007d-next-[A-Za-z0-9]+$/.test(withinTemp)
)
  throw new Error("Unsafe isolated temp path; STOP");
const portOpen = await new Promise((done) => {
  const socket = connect({ host: "127.0.0.1", port: record.port });
  socket.once("connect", () => {
    socket.destroy();
    done(true);
  });
  socket.once("error", () => done(false));
  socket.setTimeout(1000, () => {
    socket.destroy();
    done(false);
  });
});
if (portOpen)
  throw new Error("Isolated DEV server still listens on its port; stop it before temp cleanup");
const modulesLink = join(temporary, "node_modules");
if (existsSync(modulesLink)) unlinkSync(modulesLink);
rmSync(temporary, { recursive: true, force: true });
unlinkSync(recordPath);
console.log("Isolated TASK-007D server temp copy removed.");
verifyLedgerSurvived();
