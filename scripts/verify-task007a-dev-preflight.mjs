import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
const cli = resolve("node_modules/supabase/dist/supabase.js");
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
const config = Object.fromEntries(
  [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
);
const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
if (
  config.PGHOST !== `db.${dev.projectRef}.supabase.co` &&
  !(config.PGHOST === pooler.hostname && config.PGUSER?.endsWith(`.${dev.projectRef}`))
) {
  throw new Error("Database target is not approved DEV.");
}

const client = new pg.Client({
  host: config.PGHOST,
  port: Number(config.PGPORT),
  database: config.PGDATABASE,
  user: config.PGUSER,
  password: config.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  application_name: "task007a-readonly-preflight",
});
const tables = [
  "auth.users",
  "auth.identities",
  "public.users",
  "public.platform_admins",
  "public.centers",
  "public.center_memberships",
  "public.professionals",
  "public.professional_centers",
  "public.specialties",
  "public.professional_center_specialties",
  "public.persons",
  "public.patient_centers",
  "public.availabilities",
  "public.appointments",
  "private.provisioning_operations",
];

try {
  await client.connect();
  await client.query("begin transaction isolation level repeatable read read only");
  await client.query("set local role postgres");
  const snapshot = {};
  for (const table of tables) {
    const result = await client.query(
      `select pg_catalog.to_jsonb(record) as value from ${table} as record`,
    );
    snapshot[table] = result.rows.map((row) => JSON.stringify(row.value)).sort();
  }
  const digest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const counts = Object.fromEntries(tables.map((table) => [table, snapshot[table].length]));
  const catalog = await client.query(
    `
    select c.relname as table_name,
      c.relrowsecurity as rls,
      pg_catalog.array_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid,a.atttypmod) || ':' || a.attnotnull || ':' || a.attgenerated::text order by a.attnum) filter (where a.attnum > 0 and not a.attisdropped) as columns,
      (select pg_catalog.array_agg(pg_catalog.pg_get_constraintdef(k.oid) order by k.conname) from pg_catalog.pg_constraint k where k.conrelid = c.oid) as constraints,
      (select pg_catalog.array_agg(pg_catalog.pg_get_indexdef(i.indexrelid) order by i.indexrelid::text) from pg_catalog.pg_index i where i.indrelid = c.oid) as indexes,
      (select pg_catalog.array_agg(t.tgname || ':' || pg_catalog.pg_get_triggerdef(t.oid) order by t.tgname) from pg_catalog.pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal) as triggers,
      (select pg_catalog.array_agg(p.polname || ':' || pg_catalog.pg_get_expr(p.polqual,p.polrelid) order by p.polname) from pg_catalog.pg_policy p where p.polrelid = c.oid) as policies,
      c.relacl as grants
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relname = any($1::text[])
      and c.relkind = 'r'
    group by c.oid,c.relname,c.relrowsecurity,c.relacl
    order by c.relname`,
    [["persons", "patient_centers", "centers", "center_memberships"]],
  );
  await client.query("commit");
  console.log(
    JSON.stringify({ projectRef: dev.projectRef, digest, counts, catalog: catalog.rows }, null, 2),
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch {}
  throw error;
} finally {
  await client.end();
}
