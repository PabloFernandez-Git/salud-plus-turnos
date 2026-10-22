import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { nextEnvironment } from "./environment.mjs";

const root = resolve(".");
const temporary = mkdtempSync(join(tmpdir(), "task022-next-"));
const relativeToTemp = relative(resolve(tmpdir()), temporary);
if (
  !relativeToTemp ||
  relativeToTemp.startsWith("..") ||
  relativeToTemp.includes(`..${sep}`) ||
  !/^task022-next-[A-Za-z0-9]+$/.test(relativeToTemp)
) {
  throw new Error("TASK-022 isolated Next path escaped temp directory");
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
  if (existsSync(join(root, name)))
    cpSync(join(root, name), join(temporary, name), { recursive: true });
}
const modulesLink = join(temporary, "node_modules");
symlinkSync(join(root, "node_modules"), modulesLink, "junction");
const child = spawn(
  process.execPath,
  [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", "31009"],
  {
    cwd: temporary,
    env: nextEnvironment(process.env),
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
  } catch {
    process.stderr.write(
      "TASK-022 isolated Next cleanup failed; inspect its temporary directory\n",
    );
  }
}
process.on("exit", cleanup);
child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 1);
});
