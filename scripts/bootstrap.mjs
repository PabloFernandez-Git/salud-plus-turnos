import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  assertLinkedSupabaseProject,
  loadSupabaseDevConfig,
  SupabaseDevConfigError,
} from "./lib/supabase-dev-env.mjs";

const errors = [];
const warnings = [];
const info = [];

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const expectedPnpm = packageJson.packageManager?.split("@")[1];

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor !== 24) {
  errors.push(`Node 24 requerido; actual: ${process.versions.node}`);
} else {
  info.push(`Node ${process.versions.node}`);
}

try {
  const pnpmVersion =
    process.platform === "win32"
      ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm --version"], {
          encoding: "utf8",
        }).trim()
      : execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();

  if (expectedPnpm && pnpmVersion !== expectedPnpm) {
    errors.push(`pnpm ${expectedPnpm} requerido; actual: ${pnpmVersion}`);
  } else {
    info.push(`pnpm ${pnpmVersion}`);
  }
} catch {
  errors.push("pnpm no está disponible en PATH");
}

if (!existsSync(new URL("../pnpm-lock.yaml", import.meta.url))) {
  warnings.push("pnpm-lock.yaml todavía no existe. Ejecutar pnpm install y versionarlo.");
}

if (!existsSync(new URL("../node_modules", import.meta.url))) {
  warnings.push("node_modules no existe. Ejecutar pnpm install.");
}

try {
  loadSupabaseDevConfig();
  assertLinkedSupabaseProject();
  info.push("configuración Supabase DEV coherente y proyecto linkeado");
} catch (error) {
  errors.push(
    error instanceof SupabaseDevConfigError
      ? error.message
      : "No se pudo validar la configuración Supabase DEV.",
  );
}

console.log("Bootstrap check");
for (const line of info) console.log(`  OK   ${line}`);
for (const line of warnings) console.log(`  WARN ${line}`);
for (const line of errors) console.error(`  FAIL ${line}`);

if (errors.length > 0) process.exit(1);
