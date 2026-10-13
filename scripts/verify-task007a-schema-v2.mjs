import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
const output = execFileSync(
  process.execPath,
  [
    resolve("node_modules/supabase/dist/supabase.js"),
    "db",
    "dump",
    "--linked",
    "--dry-run",
    "--schema",
    "public",
  ],
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
  application_name: "task007a-schema-readonly",
});
const expectedRpcs = [
  "staff_search_patient_centers",
  "staff_resolve_patient_identity",
  "staff_create_patient_with_center",
  "staff_link_person_to_center",
  "staff_reactivate_patient_center",
  "staff_update_patient_center",
  "staff_deactivate_patient_center",
];
try {
  await client.connect();
  await client.query("begin transaction isolation level repeatable read read only");
  await client.query("set local role postgres");
  const tables = (
    await client.query(
      `
    select c.relname as table_name, c.relrowsecurity as rls,
      has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
      has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE') as authenticated_write,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_access,
      (select array_agg(a.attname::text order by a.attnum) from pg_attribute a
       where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
      (select array_agg(k.conname::text order by k.conname) from pg_constraint k where k.conrelid = c.oid) as constraints,
      (select array_agg(i.relname::text order by i.relname) from pg_index x join pg_class i on i.oid=x.indexrelid where x.indrelid=c.oid) as indexes,
      (select array_agg(t.tgname::text order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
      (select array_agg(p.polname || ':' || p.polcmd::text order by p.polname) from pg_policy p where p.polrelid=c.oid) as policies
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname = any($1::text[]) and c.relkind='r'
    order by c.relname`,
      [["persons", "patient_centers", "centers", "center_memberships"]],
    )
  ).rows;
  const rpcs = (
    await client.query(
      `
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any($1::text[])
    order by p.proname`,
      [expectedRpcs],
    )
  ).rows;
  await client.query("commit");
  const byName = Object.fromEntries(tables.map((row) => [row.table_name, row]));
  if (tables.length !== 4 || tables.some((row) => !row.rls))
    throw new Error("Relevant table/RLS catalog mismatch");
  for (const name of ["persons", "patient_centers"]) {
    const row = byName[name];
    const expectedPolicy =
      name === "persons"
        ? "persons_select_linked_tenant_staff:r"
        : "patient_centers_select_tenant_staff:r";
    if (
      !row.authenticated_select ||
      row.authenticated_write ||
      row.anon_access ||
      JSON.stringify(row.policies) !== JSON.stringify([expectedPolicy])
    ) {
      throw new Error(`${name}: policy/grant mismatch`);
    }
  }
  if (!byName.patient_centers.triggers.includes("patient_centers_set_updated_at"))
    throw new Error("PatientCenter CAS trigger missing");
  for (const constraint of [
    "patient_centers_center_person_key",
    "patient_centers_id_center_key",
    "patient_centers_person_fk",
    "patient_centers_center_fk",
  ]) {
    if (!byName.patient_centers.constraints.includes(constraint))
      throw new Error(`Missing ${constraint}`);
  }
  if (!byName.persons.constraints.includes("persons_nationality_document_key"))
    throw new Error("Person identity uniqueness missing");
  if (
    !byName.patient_centers.columns.includes("updated_at") ||
    !byName.patient_centers.columns.includes("is_active") ||
    !byName.persons.columns.includes("normalized_document")
  ) {
    throw new Error("Patient catalog fields missing");
  }
  if (
    rpcs.length !== 7 ||
    JSON.stringify(rpcs.map((row) => row.name)) !== JSON.stringify([...expectedRpcs].sort()) ||
    rpcs.some((row) => !row.security_definer || !row.authenticated_execute || row.anon_execute)
  ) {
    throw new Error("Patient RPC signature/security/grant mismatch");
  }
  console.log(
    JSON.stringify({ dev_project_ref: dev.projectRef, tables, rpcs, verdict: "PASS" }, null, 2),
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch {}
  throw error;
} finally {
  await client.end();
}
