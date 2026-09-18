import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} es requerida.`);
  return value;
}

const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production") {
  throw new Error("Seed bloqueado: APP_ENV=production.");
}

const projectRef = requireEnv("SUPABASE_DEV_PROJECT_REF");
const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const host = new URL(url).hostname;
if (!host.startsWith(`${projectRef}.`)) {
  throw new Error("Seed bloqueado: la URL de Supabase no coincide con SUPABASE_DEV_PROJECT_REF.");
}

const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

void supabaseAdmin;

throw new Error(
  "Seed DEV protegido y preparado, pero el dataset se implementará después de crear el schema inicial.",
);
