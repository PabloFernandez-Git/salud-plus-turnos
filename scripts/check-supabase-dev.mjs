import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

const supabaseDev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

try {
  const response = await fetch(new URL("/auth/v1/health", supabaseDev.url), {
    method: "GET",
    headers: {
      Accept: "application/json",
      apikey: supabaseDev.publishableKey,
    },
    redirect: "error",
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`Supabase DEV respondió con estado HTTP ${response.status}.`);
  }

  await response.body?.cancel();
  console.log("Conectividad Supabase DEV verificada mediante el health check de solo lectura.");
} catch (error) {
  if (
    error instanceof Error &&
    /^Supabase DEV respondió con estado HTTP \d{3}\.$/.test(error.message)
  ) {
    throw error;
  }
  throw new Error("No se pudo completar la lectura de conectividad contra Supabase DEV.");
} finally {
  clearTimeout(timeout);
}
