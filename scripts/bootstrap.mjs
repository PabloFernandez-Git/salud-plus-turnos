import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

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
  const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const pnpmVersion = execFileSync(pnpmExecutable, ["--version"], {
    encoding: "utf8",
  }).trim();

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

const envPath = new URL("../.env.local", import.meta.url);
if (!existsSync(envPath)) {
  warnings.push(".env.local no existe. Es esperado hasta configurar Supabase DEV.");
} else {
  const envText = readFileSync(envPath, "utf8");
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DEV_PROJECT_REF",
  ]) {
    if (!new RegExp(`^${key}=.+$`, "m").test(envText)) {
      warnings.push(`${key} no está configurada en .env.local`);
    }
  }
}

console.log("Bootstrap check");
for (const line of info) console.log(`  OK   ${line}`);
for (const line of warnings) console.log(`  WARN ${line}`);
for (const line of errors) console.error(`  FAIL ${line}`);

if (errors.length > 0) process.exit(1);
