import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import net from "node:net";

const root = resolve(".");
const port = 31021;
await new Promise((done, fail) => {
  const probe = net.createServer();
  probe.once("error", fail);
  probe.listen(port, "127.0.0.1", () => probe.close(done));
});
const runId = process.env.TASK021_SERVER_RUN_ID ?? "local";
if (!/^(?:local|[0-9a-f-]{36})$/i.test(runId)) throw new Error("Invalid isolated server run ID");
const temporary = mkdtempSync(join(tmpdir(), `task021-next-${runId}-`));
const relativePath = relative(resolve(tmpdir()), temporary);
if (
  !relativePath ||
  relativePath.startsWith("..") ||
  relativePath.includes(`..${sep}`) ||
  !/^task021-next-(?:local|[0-9a-f-]{36})-[A-Za-z0-9]+$/i.test(relativePath)
)
  throw new Error("Isolated Next path escaped temp directory");
for (const name of [
  "src",
  "public",
  "package.json",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "next-env.d.ts",
])
  if (existsSync(join(root, name)))
    cpSync(join(root, name), join(temporary, name), { recursive: true });
const modules = join(temporary, "node_modules");
symlinkSync(join(root, "node_modules"), modules, "junction");
const allow = [
  "PATH",
  "Path",
  "SystemRoot",
  "windir",
  "ComSpec",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "SystemDrive",
  "NODE_EXTRA_CA_CERTS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "APP_ENV",
  "SUPABASE_DEV_PROJECT_REF",
];
const env = Object.fromEntries(
  allow.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]),
);
const child = spawn(
  process.execPath,
  [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(port)],
  {
    cwd: temporary,
    env: { ...env, DO_NOT_TRACK: "1", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
    windowsHide: true,
  },
);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    child.kill(signal);
  });
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  try {
    if (existsSync(modules)) unlinkSync(modules);
    rmSync(temporary, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    cleaned = true;
  } catch {
    process.stderr.write(`TASK-021 isolated Next cleanup failed: ${temporary}\n`);
  }
}
process.on("exit", cleanup);
child.on("close", (code) => {
  cleanup();
  process.exitCode = code ?? 1;
});
