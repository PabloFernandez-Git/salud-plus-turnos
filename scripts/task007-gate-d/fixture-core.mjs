import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";

// Playwright clears test-results before loading specs. Ownership must live outside it.
export const ledgerPath = resolve(".task007-gate-d/fixture-ledger.json");
export const expectedDigest = "24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359";
const cli = resolve("node_modules/supabase/dist/supabase.js");

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function readLedger(path = ledgerPath) {
  assert(existsSync(path), `Missing fixture ledger: ${path}`);
  const ledger = JSON.parse(readFileSync(path, "utf8"));
  assert(ledger.projectRef === "ehllxymqyzrofydrvtzo", "Fixture ledger targets another project");
  return ledger;
}

export function ledgerDigest(path = ledgerPath) {
  assert(existsSync(path), `Missing fixture ledger: ${path}`);
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function saveLedger(ledger, path = ledgerPath) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function devClients() {
  const dev = loadSupabaseDevConfig();
  assertLinkedSupabaseProject();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  assert(secretKey, "SUPABASE_SECRET_KEY is required in the local DEV environment");
  const authAdmin = createClient(dev.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { dev, authAdmin };
}

export function databaseConfig(dev) {
  // The CLI supplies a transient connection without printing or persisting its password.
  const output = execFileSync(
    process.execPath,
    [cli, "db", "dump", "--linked", "--dry-run", "--schema", "public"],
    {
      encoding: "utf8",
      env: { ...process.env, CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const variables = Object.fromEntries(
    [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
  );
  const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
  assert(
    variables.PGHOST === `db.${dev.projectRef}.supabase.co` ||
      (variables.PGHOST === pooler.hostname && variables.PGUSER?.endsWith(`.${dev.projectRef}`)),
    "Database connection does not target approved DEV",
  );
  for (const key of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"])
    assert(variables[key], `CLI did not provide ${key}`);
  return {
    host: variables.PGHOST,
    port: Number(variables.PGPORT),
    database: variables.PGDATABASE,
    user: variables.PGUSER,
    password: variables.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  };
}

export async function openDatabase(dev, name) {
  const client = new pg.Client({ ...databaseConfig(dev), application_name: `task007d-${name}` });
  await client.connect();
  await client.query("set role postgres");
  const project = await client.query(
    "select current_database() as database, current_user as db_user",
  );
  assert(project.rows[0].database === "postgres", "Unexpected database");
  return client;
}

export async function asActor(database, actorId, action) {
  await database.query("begin");
  try {
    await database.query("set local role authenticated");
    await database.query("select set_config('request.jwt.claim.sub',$1,true)", [actorId]);
    const result = await action();
    await database.query("commit");
    return result;
  } catch (error) {
    await database.query("rollback").catch(() => undefined);
    throw error;
  }
}

export async function inventory(database) {
  const tables = [
    "auth.users",
    "public.users",
    "public.centers",
    "public.center_memberships",
    "public.persons",
    "public.patient_centers",
    "public.professionals",
    "public.professional_centers",
    "public.platform_admins",
    "public.appointments",
  ];
  const result = {};
  for (const table of tables) {
    const column = table === "public.platform_admins" ? "user_id" : "id";
    result[table] = (
      await database.query(`select ${column} from ${table} order by ${column}`)
    ).rows.map((row) => row[column]);
  }
  return result;
}

export function newLedger(projectRef, before) {
  const runId = randomUUID();
  const ids = Object.fromEntries(
    [
      "centerA",
      "centerB",
      "centerInactive",
      "membershipAdminA",
      "membershipReceptionA",
      "membershipAdminB",
      "membershipProfessionalA",
      "membershipInactiveA",
      "membershipInactiveCenter",
      "professional",
      "professionalCenter",
      "privacyPerson",
      "privacyPatientA",
      "unlinkedPerson",
      "manualUnlinkedPerson",
      "racePerson",
      "racePatientA",
    ].map((key) => [key, randomUUID()]),
  );
  return {
    version: 1,
    projectRef,
    expectedDigest,
    runId,
    createdAt: new Date().toISOString(),
    stage: "planned",
    ids,
    before,
    password: `Task007d-${randomBytes(24).toString("base64url")}`,
    actors: Object.fromEntries(
      ["adminA", "receptionA", "adminB", "professionalA", "inactiveA", "platformOnly"].map(
        (name) => [
          name,
          { id: null, email: `task007d-${runId}-${name.toLowerCase()}@example.test` },
        ],
      ),
    ),
    owned: {
      authUsers: [],
      publicUsers: [],
      centers: [],
      memberships: [],
      professionals: [],
      professionalCenters: [],
      platformAdmins: [],
      persons: [],
      patientCenters: [],
    },
    generated: { smokeDocument: `SMOKE-${runId}`, manualUnlinkedDocument: `MANUAL-LINK-${runId}` },
    authDeleted: [],
    evidence: [],
  };
}

export function addOwned(ledger, kind, id) {
  assert(typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id), `Invalid ${kind} UUID`);
  if (!ledger.owned[kind].includes(id)) ledger.owned[kind].push(id);
  saveLedger(ledger);
}
