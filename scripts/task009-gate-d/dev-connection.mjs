import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";

const PROJECT_REF = "ehllxymqyzrofydrvtzo";
const POOLER_PATH = resolve("supabase/.temp/pooler-url");
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => value);

export function safeConnectionDiagnostic(error, password, phase) {
  const code = /^[A-Z0-9_]{2,32}$/.test(String(error?.code ?? "")) ? error.code : "UNKNOWN";
  const raw = String(error?.message ?? "Unknown PostgreSQL connection error");
  const message = raw
    .replaceAll(password, "[REDACTED]")
    .replaceAll(encodeURIComponent(password), "[REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s,;]+/gi, "[REDACTED_CONNECTION_STRING]")
    .replace(/\b(password|pwd|token|secret)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "$1=[REDACTED]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 240);
  return { phase, code, message };
}

export function approvedDatabaseConfig({ env = process.env, poolerUrl } = {}) {
  const dev = loadSupabaseDevConfig(env);
  assertLinkedSupabaseProject();
  if (dev.projectRef !== PROJECT_REF) throw new Error("Unexpected DEV project ref");

  const password = env.SUPABASE_DB_PASSWORD;
  if (!password || !password.trim()) {
    throw new Error("SUPABASE_DB_PASSWORD must exist in this process environment");
  }

  const url = new URL(poolerUrl ?? readFileSync(POOLER_PATH, "utf8").trim());
  const username = decodeURIComponent(url.username);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "aws-0-sa-east-1.pooler.supabase.com" ||
    url.port !== "5432" ||
    url.pathname !== "/postgres" ||
    username !== `postgres.${PROJECT_REF}` ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Pooler endpoint does not match the approved DEV project");
  }

  return {
    host: url.hostname,
    port: 5432,
    database: "postgres",
    user: username,
    password,
    ssl: true,
    connectionTimeoutMillis: 20_000,
    application_name: "task009-gate-d",
  };
}

export async function openDevDatabase(name, options) {
  const configuration = approvedDatabaseConfig(options);
  const client = new pg.Client({
    ...configuration,
    application_name: `task009-gate-d-${name}`,
  });
  let phase = "connect";
  let transactionOpen = false;
  try {
    await client.connect();
    phase = "read-only identity";
    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '5s'");
    const result = await client.query(
      "select current_database() as database, current_user as role, current_setting('server_version') as version, current_setting('transaction_read_only') as read_only",
    );
    if (
      result.rows[0]?.database !== "postgres" ||
      result.rows[0]?.role !== "postgres" ||
      result.rows[0]?.read_only !== "on"
    ) {
      throw new Error("Connected database identity differs from approved DEV connection");
    }
    await client.query("ROLLBACK");
    transactionOpen = false;
    return client;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
    if (error.message === "Connected database identity differs from approved DEV connection") {
      throw error;
    }
    const diagnostic = safeConnectionDiagnostic(error, configuration.password, phase);
    throw new Error(
      `DEV PostgreSQL ${diagnostic.phase} failed [${diagnostic.code}]: ${diagnostic.message}`,
    );
  }
}
