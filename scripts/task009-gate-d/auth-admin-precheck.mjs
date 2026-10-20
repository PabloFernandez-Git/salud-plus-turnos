import { createClient } from "@supabase/supabase-js";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";

const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
if (dev.projectRef !== "ehllxymqyzrofydrvtzo") {
  throw new Error("Unexpected DEV project ref");
}
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!key) throw new Error("Existing DEV Auth admin key is unavailable");

const admin = createClient(dev.url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const result = await admin.auth.admin.getUserById("00000000-0000-4000-8000-000000000000");
if (result.data?.user) {
  throw new Error("Reserved probe UUID unexpectedly exists; STOP");
}
if (result.error?.status !== 404) {
  throw new Error("DEV Auth admin read-only probe did not return user-not-found; STOP");
}
console.log("TASK009_DEV_AUTH_ADMIN_READONLY_PROBE_PASS");
