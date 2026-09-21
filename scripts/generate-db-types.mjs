import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { format, resolveConfig } from "prettier";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

const supabaseDev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

const pnpmArgs = [
  "exec",
  "supabase",
  "gen",
  "types",
  "typescript",
  "--project-id",
  supabaseDev.projectRef,
  "--schema",
  "public",
];

let output;
try {
  output =
    process.platform === "win32"
      ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm", ...pnpmArgs], {
          encoding: "utf8",
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        })
      : execFileSync("pnpm", pnpmArgs, {
          encoding: "utf8",
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        });
} catch {
  throw new Error(
    "No se pudieron generar los tipos desde Supabase DEV. Verifique el login de CLI y el link del proyecto.",
  );
}

if (!output.includes("export type Database")) {
  throw new Error("La CLI no devolvió un contrato Database TypeScript válido.");
}

const target = resolve("src/lib/supabase/database.types.ts");
const prettierConfig = (await resolveConfig(target)) ?? {};
const formattedOutput = await format(output, { ...prettierConfig, filepath: target });
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, formattedOutput, "utf8");
console.log(`Tipos generados en ${target}`);
