import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRef = process.env.SUPABASE_DEV_PROJECT_REF;
if (!projectRef) {
  throw new Error("SUPABASE_DEV_PROJECT_REF es requerida para generar tipos desde DEV.");
}

const pnpmArgs = [
  "exec",
  "supabase",
  "gen",
  "types",
  "typescript",
  "--project-id",
  projectRef,
  "--schema",
  "public",
];

const output =
  process.platform === "win32"
    ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm", ...pnpmArgs], {
        encoding: "utf8",
        env: process.env,
      })
    : execFileSync("pnpm", pnpmArgs, { encoding: "utf8", env: process.env });

const target = resolve("src/lib/supabase/database.types.ts");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, output, "utf8");
console.log(`Tipos generados en ${target}`);
