import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const protectedNames = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "DATABASE_URL",
];
const sourceRoots = [resolve("src"), resolve("next.config.ts")];
const sentinels = Object.fromEntries(
  protectedNames.map((name) => [name, `TASK003_CLIENT_SECRET_SENTINEL_${name}`]),
);

function listFiles(path) {
  const entry = statSync(path);
  if (entry.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((child) =>
    listFiles(resolve(path, child.name)),
  );
}

for (const path of sourceRoots.flatMap(listFiles)) {
  const source = readFileSync(path, "utf8");
  const protectedName = protectedNames.find((name) => source.includes(name));
  if (protectedName) {
    throw new Error(
      `Frontera de secretos inválida: ${protectedName} aparece en ${relative(process.cwd(), path)}.`,
    );
  }
}

const buildEnv = { ...process.env, ...sentinels };
const buildCommand = ["run", "build"];

if (process.platform === "win32") {
  execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm", ...buildCommand], {
    env: buildEnv,
    stdio: "inherit",
  });
} else {
  execFileSync("pnpm", buildCommand, { env: buildEnv, stdio: "inherit" });
}

const clientArtifacts = resolve(".next/static");
for (const path of listFiles(clientArtifacts)) {
  const artifact = readFileSync(path);
  const leakedName = Object.entries(sentinels).find(([, sentinel]) =>
    artifact.includes(Buffer.from(sentinel)),
  )?.[0];

  if (leakedName) {
    throw new Error(
      `Frontera de secretos inválida: el centinela de ${leakedName} apareció en un artefacto cliente.`,
    );
  }
}

console.log("Frontera de secretos verificada en fuentes y artefactos cliente.");
