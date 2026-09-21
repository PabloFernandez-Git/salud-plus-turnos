import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { APPROVED_SUPABASE_DEV_PROJECT } from "../config/approved-supabase-dev.mjs";

const DEFAULT_ENV_PATH = resolve(".env.local");
const LINKED_PROJECT_PATH = resolve("supabase/.temp/project-ref");

export class SupabaseDevConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "SupabaseDevConfigError";
  }
}

export function loadLocalEnv(env = process.env, envPath = DEFAULT_ENV_PATH) {
  if (!existsSync(envPath)) {
    throw new SupabaseDevConfigError(".env.local no existe.");
  }

  let parsed;
  try {
    parsed = parseEnv(readFileSync(envPath, "utf8"));
  } catch {
    throw new SupabaseDevConfigError(".env.local no se pudo leer o contiene sintaxis inválida.");
  }

  for (const [name, value] of Object.entries(parsed)) {
    if (env[name] === undefined) env[name] = value;
  }

  return env;
}

function requireEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new SupabaseDevConfigError(`${name} es requerida.`);
  return value;
}

export function validateSupabaseDevEnv(env) {
  const appEnv = requireEnv(env, "APP_ENV");
  if (appEnv !== "development") {
    throw new SupabaseDevConfigError("Operación DEV bloqueada: APP_ENV debe ser development.");
  }

  const projectRef = requireEnv(env, "SUPABASE_DEV_PROJECT_REF");
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new SupabaseDevConfigError("SUPABASE_DEV_PROJECT_REF tiene un formato inválido.");
  }
  if (projectRef !== APPROVED_SUPABASE_DEV_PROJECT.projectRef) {
    throw new SupabaseDevConfigError(
      "SUPABASE_DEV_PROJECT_REF no coincide con el proyecto DEV aprobado.",
    );
  }

  const rawUrl = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SupabaseDevConfigError("NEXT_PUBLIC_SUPABASE_URL tiene un formato inválido.");
  }

  const expectedHost = `${APPROVED_SUPABASE_DEV_PROJECT.projectRef}.supabase.co`;
  const hasUnexpectedUrlParts =
    url.protocol !== "https:" ||
    url.hostname !== expectedHost ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search !== "" ||
    url.hash !== "";

  if (hasUnexpectedUrlParts) {
    throw new SupabaseDevConfigError(
      "NEXT_PUBLIC_SUPABASE_URL no coincide exactamente con SUPABASE_DEV_PROJECT_REF.",
    );
  }

  const publishableKey = requireEnv(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return Object.freeze({
    appEnv,
    projectRef,
    publishableKey,
    region: APPROVED_SUPABASE_DEV_PROJECT.region,
    url: url.origin,
  });
}

export function loadSupabaseDevConfig(env = process.env, envPath = DEFAULT_ENV_PATH) {
  loadLocalEnv(env, envPath);
  return validateSupabaseDevEnv(env);
}

export function validateLinkedSupabaseProject(linkedProjectRef) {
  if (linkedProjectRef !== APPROVED_SUPABASE_DEV_PROJECT.projectRef) {
    throw new SupabaseDevConfigError(
      "El proyecto linkeado no coincide con el proyecto DEV aprobado.",
    );
  }
}

export function assertLinkedSupabaseProject(linkedProjectPath = LINKED_PROJECT_PATH) {
  if (!existsSync(linkedProjectPath)) {
    throw new SupabaseDevConfigError(
      "El repositorio no está linkeado. Ejecutar supabase link con el proyecto DEV esperado.",
    );
  }

  const linkedProjectRef = readFileSync(linkedProjectPath, "utf8").trim();
  validateLinkedSupabaseProject(linkedProjectRef);
}
