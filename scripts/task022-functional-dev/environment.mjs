import { projectRef } from "./plan.mjs";

const runtimeKeys = [
  "PATH",
  "Path",
  "SystemRoot",
  "windir",
  "ComSpec",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "SystemDrive",
  "NODE_EXTRA_CA_CERTS",
];

function pick(source, keys) {
  return Object.fromEntries(
    keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );
}

export function browserEnvironment(source, dev, password) {
  return {
    ...pick(source, [...runtimeKeys, "PLAYWRIGHT_BROWSERS_PATH"]),
    CI: "1",
    APP_ENV: "development",
    SUPABASE_DEV_PROJECT_REF: projectRef,
    NEXT_PUBLIC_SUPABASE_URL: dev.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: dev.publishableKey,
    TASK022_FIXTURE_PASSWORD: password,
  };
}

export function nextEnvironment(source) {
  return {
    ...pick(source, [
      ...runtimeKeys,
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "APP_ENV",
      "SUPABASE_DEV_PROJECT_REF",
    ]),
    DO_NOT_TRACK: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
