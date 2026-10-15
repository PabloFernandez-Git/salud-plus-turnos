import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { loadLocalEnv } from "../lib/supabase-dev-env.mjs";

loadLocalEnv();
const root = resolve(".");
const recordPath = join(root, "test-results/task007-gate-d/server-temp.json");
if (existsSync(recordPath))
  throw new Error("An isolated server temp record already exists; run cleanup-isolated.mjs first");
const temporary = mkdtempSync(join(tmpdir(), "task007d-next-"));
const relativeToTemp = relative(resolve(tmpdir()), temporary);
if (!relativeToTemp || relativeToTemp.startsWith("..") || relativeToTemp.includes(`..${sep}`)) {
  throw new Error("Isolated server path escaped the system temp directory");
}
for (const name of [
  "src",
  "public",
  "package.json",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "next-env.d.ts",
]) {
  cpSync(join(root, name), join(temporary, name), { recursive: true });
}
const modulesLink = join(temporary, "node_modules");
symlinkSync(join(root, "node_modules"), modulesLink, "junction");
mkdirSync(join(root, "test-results/task007-gate-d"), { recursive: true });
writeFileSync(recordPath, `${JSON.stringify({ temporary, port: 31007 })}\n`);
const child = spawn(
  process.execPath,
  [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", "31007"],
  {
    cwd: temporary,
    env: { ...process.env, DO_NOT_TRACK: "1", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
    windowsHide: true,
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    unlinkSync(modulesLink);
    rmSync(temporary, { recursive: true, force: true });
    unlinkSync(recordPath);
  } catch (error) {
    process.stderr.write(`Could not remove isolated ${basename(temporary)}: ${error.message}\n`);
  }
}
process.on("exit", cleanup);
child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 1);
});
