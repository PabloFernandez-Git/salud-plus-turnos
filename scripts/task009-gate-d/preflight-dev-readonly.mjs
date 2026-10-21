import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";
import { expectedMigrations } from "./verify.mjs";

const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
const localMigrations = readdirSync(resolve("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
assert.deepEqual(localMigrations, expectedMigrations);

let cliOutput;
try {
  cliOutput = execFileSync(
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
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" },
      windowsHide: true,
    },
  );
} catch {
  throw new Error("No se pudo obtener internamente la conexión dry-run del proyecto DEV.");
}
const connection = Object.fromEntries(
  [...cliOutput.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
);
const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
const direct =
  connection.PGHOST === `db.${dev.projectRef}.supabase.co` &&
  (connection.PGUSER === "postgres" || connection.PGUSER === "cli_login_postgres");
const pooled =
  connection.PGHOST === pooler.hostname && connection.PGUSER?.endsWith(`.${dev.projectRef}`);
if (!direct && !pooled) {
  console.error(
    JSON.stringify({
      hostMatchesDirect: connection.PGHOST === `db.${dev.projectRef}.supabase.co`,
      hostMatchesPooler: connection.PGHOST === pooler.hostname,
      userMatchesDirect: connection.PGUSER === "postgres",
      userMatchesPooler: connection.PGUSER?.endsWith(`.${dev.projectRef}`),
      userRolePrefix: connection.PGUSER?.split(".")[0],
      databaseMatches: connection.PGDATABASE === "postgres",
    }),
  );
}
assert(direct || pooled, "STOP: la conexión PostgreSQL no corresponde al proyecto DEV aprobado");
assert.equal(connection.PGDATABASE, "postgres");
assert(connection.PGPASSWORD && Number(connection.PGPORT) > 0);

const client = new pg.Client({
  host: connection.PGHOST,
  port: Number(connection.PGPORT),
  database: connection.PGDATABASE,
  user: connection.PGUSER,
  password: connection.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
  application_name: "task009-gate-d-readonly-preflight",
});

let stage = "connect";
try {
  await client.connect();
  stage = "read-only transaction";
  await client.query("begin read only");
  await client.query("set local statement_timeout = '10s'");
  const mode = await client.query("select current_setting('transaction_read_only') as read_only");
  assert.equal(mode.rows[0].read_only, "on");

  stage = "server metadata";
  const server = (
    await client.query(`
    select current_database() as database_name,
      current_user as database_role,
      current_setting('server_version') as server_version,
      current_setting('TimeZone') as session_timezone
  `)
  ).rows[0];
  stage = "rpc catalog";
  const rpc = (
    await client.query(`
    select p.oid, n.nspname as schema_name, p.proname as function_name,
      p.oid::regprocedure::text as signature, p.proargnames as argument_names,
      pg_get_function_arguments(p.oid) as arguments,
      pg_get_function_result(p.oid) as result_type,
      pg_get_userbyid(p.proowner) as owner,
      p.prosecdef as security_definer, p.proconfig as config,
      p.proacl::text as acl,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
      exists (
        select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) as acl
        where acl.grantee=0 and acl.privilege_type='EXECUTE'
      ) as public_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'staff_search_appointment_slots', 'staff_create_appointment',
      'staff_reschedule_appointment', 'staff_transition_appointment_status',
      'staff_update_appointment_note', 'staff_list_appointments',
      'staff_get_appointment', 'professional_list_own_appointments',
      'professional_get_own_appointment', 'staff_list_bookable_specialties',
      'staff_bookable_professional_centers_for_specialty'
    ) order by p.proname, p.oid::regprocedure::text
  `)
  ).rows;
  const target = rpc.filter((row) => row.function_name === "staff_search_appointment_slots");
  assert.equal(target.length, 1);
  assert.equal(target[0].signature, "staff_search_appointment_slots(uuid,uuid,uuid,date)");
  assert.equal(
    target[0].result_type,
    "TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone)",
  );

  stage = "incoming dependencies";
  const dependencies = (
    await client.query(
      `
    select d.deptype, pg_describe_object(d.classid,d.objid,d.objsubid) as dependent_object
    from pg_depend d
    where d.refclassid='pg_proc'::regclass and d.refobjid=$1
    order by d.deptype, dependent_object
  `,
      [target[0].oid],
    )
  ).rows;
  stage = "default function privileges";
  const defaultAcl = (
    await client.query(`
    select pg_get_userbyid(d.defaclrole) as owner,
      n.nspname as schema_name, d.defaclobjtype as object_type,
      d.defaclacl::text as acl
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
    where d.defaclobjtype='f' and (n.nspname='public' or d.defaclnamespace=0)
    order by owner, schema_name
  `)
  ).rows;
  stage = "role reachability";
  const roleReachability = (
    await client.query(`
    select r.rolname, r.rolsuper, r.rolinherit, r.rolcanlogin, r.rolbypassrls,
      pg_has_role(r.oid, a.oid, 'USAGE') as can_use_authenticated,
      pg_has_role(r.oid, a.oid, 'SET') as can_set_authenticated
    from pg_roles r cross join pg_roles a
    where a.rolname='authenticated'
      and (r.rolname in ('anon','authenticated','service_role','authenticator',
        'supabase_storage_admin','supabase_admin')
        or pg_has_role(r.oid,a.oid,'USAGE')
        or pg_has_role(r.oid,a.oid,'SET'))
    order by r.rolname
  `)
  ).rows;
  stage = "role membership graph";
  const roleEdges = (
    await client.query(`
    select parent.rolname as granted_role, member.rolname as member_role,
      grantor.rolname as grantor_role, m.admin_option, m.inherit_option, m.set_option
    from pg_auth_members m
    join pg_roles parent on parent.oid=m.roleid
    join pg_roles member on member.oid=m.member
    join pg_roles grantor on grantor.oid=m.grantor
    where member.rolname in ('authenticator','supabase_storage_admin','anon','authenticated',
      'service_role','cli_login_postgres','supabase_realtime_admin','postgres','supabase_admin')
    order by member_role, granted_role
  `)
  ).rows;
  stage = "table RLS and grants";
  const tables = (
    await client.query(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced,
      has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
      has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
      has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update,
      has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_delete,
      has_table_privilege('anon',c.oid,'SELECT') as anon_select
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in
      ('appointments','centers','center_memberships','patient_centers',
       'professional_centers','specialties','availabilities')
      and c.relkind in ('r','p') order by c.relname
  `)
  ).rows;
  stage = "RLS policies";
  const policies = (
    await client.query(`
    select tablename, policyname, permissive, roles, cmd
    from pg_policies where schemaname='public' and tablename in
      ('appointments','centers','center_memberships','patient_centers',
       'professional_centers','specialties','availabilities')
    order by tablename, policyname
  `)
  ).rows;
  stage = "extensions";
  const extensions = (
    await client.query(`
    select extname, extversion from pg_extension
    where extname in ('btree_gist','plpgsql') order by extname
  `)
  ).rows;
  stage = "timezone names";
  const timezoneNames = (
    await client.query(`
    select name from pg_timezone_names
    where name in ('America/Argentina/Buenos_Aires','America/New_York',
      'Australia/Lord_Howe','Pacific/Auckland') order by name
  `)
  ).rows.map((row) => row.name);

  console.log(
    JSON.stringify(
      {
        result: "TASK009_GATE_D_DEV_METADATA_READ_ONLY",
        projectRef: dev.projectRef,
        region: dev.region,
        connectionKind: direct ? "direct" : "pooler",
        readOnlyTransaction: true,
        server,
        localMigrationCount: localMigrations.length,
        remoteMigrationVersions: "verified separately by Supabase CLI migration list",
        pendingMigration: expectedMigrations[22],
        rpc: rpc.map(({ oid, ...row }) => row),
        incomingDependencies: dependencies,
        defaultFunctionAcl: defaultAcl,
        roleReachability,
        roleEdges,
        tables,
        policies,
        extensions,
        timezoneNames,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (error instanceof assert.AssertionError) {
    console.error(`Preflight detenido: ${error.message}`);
  } else {
    console.error(
      `Preflight detenido en ${stage} (${error?.code ?? "unknown"}): consulta de metadatos no completada.`,
    );
  }
  process.exitCode = 1;
} finally {
  try {
    await client.query("rollback");
  } catch {
    /* connection may already be closed */
  }
  await client.end().catch(() => {});
}
