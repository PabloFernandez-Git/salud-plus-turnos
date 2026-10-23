import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { splitTopLevelSql } from "../task022-dev/gate.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ref = "ehllxymqyzrofydrvtzo";
const version = "20261022130000";
const name = "add_daily_dashboard_rpcs";
const filename = `${version}_${name}.sql`;
const sha256 = "7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1";
const functions = [
  [
    "staff_get_daily_dashboard",
    [
      "as_of",
      "local_date",
      "timezone",
      "pending_count",
      "confirmed_count",
      "attended_count",
      "no_show_count",
      "cancelled_count",
      "professional_centers_with_appointments_count",
      "upcoming",
    ],
  ],
  [
    "professional_get_own_daily_dashboard",
    [
      "as_of",
      "local_date",
      "timezone",
      "pending_count",
      "confirmed_count",
      "attended_count",
      "no_show_count",
      "cancelled_count",
      "upcoming",
    ],
  ],
];
const tables = [
  ["auth.users", "id"],
  ["private.provisioning_operations", "id"],
  ["public.users", "id"],
  ["public.platform_admins", "user_id"],
  ["public.centers", "id"],
  ["public.center_memberships", "id"],
  ["public.professionals", "id"],
  ["public.professional_centers", "id"],
  ["public.specialties", "id"],
  [
    "public.professional_center_specialties",
    "professional_center_id::text || '/' || specialty_id::text",
  ],
  ["public.availabilities", "id"],
  ["public.persons", "id"],
  ["public.patient_centers", "id"],
  ["public.appointments", "id"],
];
function stop(message) {
  throw new Error(`STOP TASK-021: ${message}`);
}
function leading(statement) {
  return statement.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, "").trim();
}
export function approvedHelperBody(helper) {
  assert(["has_active_center_role", "active_professional_center_id"].includes(helper));
  const source = readFileSync(
    resolve(root, "supabase/migrations/20260922121000_add_auth_access_helpers_and_policies.sql"),
    "utf8",
  );
  const expression = new RegExp(
    `create function private\\.${helper}\\([\\s\\S]*?as \\$function\\$([\\s\\S]*?)\\$function\\$;`,
    "i",
  );
  const body = expression.exec(source)?.[1];
  assert(body, `Approved helper source unavailable: ${helper}`);
  return body;
}
export function localChecks() {
  assert.equal(
    execFileSync("git", ["branch", "--show-current"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
    "codex/task-021-dashboard-sql",
  );
  for (const helper of ["has_active_center_role", "active_professional_center_id"])
    approvedHelperBody(helper);
  const files = readdirSync(resolve(root, "supabase/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort();
  assert.equal(files.length, 25, "Expected 24 previous migrations plus TASK-021");
  assert.equal(files.at(-1), filename);
  assert(files.every((x) => /^\d{14}_.+\.sql$/.test(x)));
  const bytes = readFileSync(resolve(root, "supabase/migrations", filename));
  const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  assert.equal(actual, sha256, "Approved migration SHA-256 changed");
  const statements = splitTopLevelSql(bytes.toString("utf8"));
  assert.equal(statements.length, 8);
  assert.match(leading(statements[0]), /^begin;$/i);
  assert.match(leading(statements[1]), /^create function public\.staff_get_daily_dashboard\b/i);
  assert.match(
    leading(statements[2]),
    /^create function public\.professional_get_own_daily_dashboard\b/i,
  );
  assert.match(
    leading(statements[3]),
    /^revoke all on function public\.staff_get_daily_dashboard\b/i,
  );
  assert.match(
    leading(statements[4]),
    /^revoke all on function public\.professional_get_own_daily_dashboard\b/i,
  );
  assert.match(
    leading(statements[5]),
    /^grant execute on function public\.staff_get_daily_dashboard\b/i,
  );
  assert.match(
    leading(statements[6]),
    /^grant execute on function public\.professional_get_own_daily_dashboard\b/i,
  );
  assert.match(leading(statements[7]), /^commit;$/i);
  return {
    versions: files.slice(0, -1).map((x) => x.slice(0, 14)),
    statements,
    body: statements.slice(1, -1),
    sha256: actual,
  };
}
function targetNames() {
  return functions.map(([n]) => n);
}
export function normalizeArgModes(value) {
  if (Array.isArray(value)) {
    assert(
      value.every((mode) => typeof mode === "string" && /^[a-z]$/.test(mode)),
      "Invalid argument modes array",
    );
    return value;
  }
  assert.equal(typeof value, "string", "Invalid argument modes representation");
  assert.match(value, /^\{[a-z](?:,[a-z])*\}$/, "Invalid PostgreSQL argument modes literal");
  return value.slice(1, -1).split(",");
}
export function assertTargetArgModes(value, outputCount) {
  assert(Number.isSafeInteger(outputCount) && outputCount > 0);
  assert.deepEqual(normalizeArgModes(value), ["i", ...Array(outputCount).fill("t")]);
}
async function catalog(client, versions, applied) {
  const identity = (
    await client.query(
      "select current_database() as db,current_user as role,current_setting('server_version') as version,current_setting('transaction_read_only') as read_only",
    )
  ).rows[0];
  assert.equal(identity.db, "postgres");
  assert.equal(identity.role, "postgres");
  assert.match(identity.version, /^17\.6(?:\D|$)/);
  const ledgerColumns = (
    await client.query(
      "select attname,format_type(atttypid,atttypmod) as type from pg_attribute where attrelid='supabase_migrations.schema_migrations'::regclass and attnum>0 and not attisdropped",
    )
  ).rows;
  for (const [column, type] of [
    ["version", "text"],
    ["name", "text"],
    ["statements", "text[]"],
  ])
    assert(
      ledgerColumns.some((x) => x.attname === column && x.type === type),
      `ledger column ${column} changed`,
    );
  const remote = (
    await client.query("select version from supabase_migrations.schema_migrations order by version")
  ).rows.map((x) => x.version);
  assert.deepEqual(
    remote,
    applied ? [...versions, version] : versions,
    "Remote migration sequence differs",
  );
  const relations = (
    await client.query(
      "select name,to_regclass(name)::text as found from unnest($1::text[]) name",
      [tables.map((x) => x[0])],
    )
  ).rows;
  assert(
    relations.every((x) => x.found),
    "Required relation missing",
  );
  const required = [
    ["centers", "id", "uuid"],
    ["centers", "timezone", "text"],
    ["centers", "is_active", "bool"],
    ["center_memberships", "center_id", "uuid"],
    ["center_memberships", "user_id", "uuid"],
    ["center_memberships", "role", "membership_role"],
    ["center_memberships", "is_active", "bool"],
    ["appointments", "id", "uuid"],
    ["appointments", "center_id", "uuid"],
    ["appointments", "professional_center_id", "uuid"],
    ["appointments", "patient_center_id", "uuid"],
    ["appointments", "specialty_id", "uuid"],
    ["appointments", "starts_at", "timestamptz"],
    ["appointments", "ends_at", "timestamptz"],
    ["appointments", "status", "appointment_status"],
    ["patient_centers", "person_id", "uuid"],
    ["persons", "first_name", "text"],
    ["persons", "last_name", "text"],
    ["professional_centers", "professional_id", "uuid"],
    ["professional_centers", "is_active", "bool"],
    ["professionals", "first_name", "text"],
    ["professionals", "last_name", "text"],
    ["specialties", "name", "text"],
    ["professional_center_specialties", "center_id", "uuid"],
    ["professional_center_specialties", "professional_center_id", "uuid"],
    ["professional_center_specialties", "specialty_id", "uuid"],
  ];
  const columns = (
    await client.query(
      "select table_name,column_name,udt_name from information_schema.columns where table_schema='public'",
    )
  ).rows;
  for (const [table, column, type] of required)
    assert(
      columns.some(
        (x) => x.table_name === table && x.column_name === column && x.udt_name === type,
      ),
      `column ${table}.${column} changed`,
    );
  const enums = (
    await client.query(
      "select enumlabel from pg_enum where enumtypid='public.appointment_status'::regtype order by enumsortorder",
    )
  ).rows.map((x) => x.enumlabel);
  assert.deepEqual(enums, ["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED", "NO_SHOW"]);
  const helpers = (
    await client.query(
      "select to_regprocedure('auth.uid()')::text as uid,to_regprocedure('private.has_active_center_role(uuid,public.membership_role[])')::text as membership,to_regprocedure('private.active_professional_center_id(uuid)')::text as professional",
    )
  ).rows[0];
  assert(Object.values(helpers).every(Boolean), "Authorization helper missing");
  for (const [helper, signature, result] of [
    [
      "has_active_center_role",
      "private.has_active_center_role(uuid,public.membership_role[])",
      "boolean",
    ],
    ["active_professional_center_id", "private.active_professional_center_id(uuid)", "uuid"],
  ]) {
    const approved = approvedHelperBody(helper);
    const row = (
      await client.query(
        `select pg_get_userbyid(p.proowner) as owner,l.lanname as language,p.prosecdef,p.provolatile,p.proconfig,p.prosrc,
        has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
        has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
        exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
        pg_get_function_result(p.oid) as result
      from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure($1)`,
        [signature],
      )
    ).rows[0];
    assert(
      row &&
        row.owner === "postgres" &&
        row.language === "sql" &&
        row.prosecdef &&
        row.provolatile === "s" &&
        row.result === result &&
        row.authenticated_execute &&
        !row.anon_execute &&
        !row.public_execute,
      `Authorization helper attributes/grants changed: ${helper}`,
    );
    assert.deepEqual(row.proconfig, ['search_path=""']);
    assert.equal(
      row.prosrc.replace(/\s+/g, " ").trim(),
      approved.replace(/\s+/g, " ").trim(),
      `Authorization helper body changed: ${helper}`,
    );
  }
  for (const signature of [
    "public.staff_list_appointments(uuid,date,date,public.appointment_status,uuid,timestamptz,uuid,integer)",
    "public.professional_list_own_appointments(uuid,date,date,public.appointment_status,timestamptz,uuid,integer)",
  ]) {
    const row = (
      await client.query(
        `select pg_get_userbyid(proowner) as owner,prosecdef,provolatile,proconfig,
      has_function_privilege('authenticated',oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('anon',oid,'EXECUTE') as anon_execute,
      has_function_privilege('service_role',oid,'EXECUTE') as service_execute
      from pg_proc where oid=to_regprocedure($1)`,
        [signature],
      )
    ).rows[0];
    assert(
      row &&
        row.owner === "postgres" &&
        row.prosecdef &&
        row.provolatile === "s" &&
        row.authenticated_execute &&
        !row.anon_execute &&
        !row.service_execute,
      `Existing appointment RPC permissions changed: ${signature}`,
    );
    assert.deepEqual(row.proconfig, ['search_path=""']);
  }
  const appointment = (
    await client.query(
      "select relrowsecurity,has_table_privilege('authenticated',oid,'SELECT') as auth_select,has_table_privilege('anon',oid,'SELECT') as anon_select from pg_class where oid='public.appointments'::regclass",
    )
  ).rows[0];
  assert(
    appointment.relrowsecurity && !appointment.auth_select && !appointment.anon_select,
    "Appointment RLS/grants changed",
  );
  for (const index of [
    "appointments_center_starts_at_idx",
    "appointments_professional_center_starts_at_idx",
    "appointments_center_status_starts_at_idx",
  ])
    assert(
      (await client.query("select to_regclass($1)::text as found", [`public.${index}`])).rows[0]
        .found,
      `index ${index} missing`,
    );
  const target = (
    await client.query(
      `select p.proname,n.nspname as function_schema,p.pronargs,(p.proargtypes[0]='uuid'::regtype) as one_uuid,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,p.proargnames,p.proargmodes,pg_get_function_result(p.oid) as result,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
    exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
    (select array_agg(format_type(t.oid,null) order by t.ord) from unnest(p.proallargtypes) with ordinality t(oid,ord)) as all_types
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any($1::text[]) order by p.proname`,
      [targetNames()],
    )
  ).rows;
  assert.equal(target.length, applied ? 2 : 0, "Target RPC presence/overload differs");
  if (applied)
    for (const [fn, outputs] of functions) {
      const item = target.find((x) => x.proname === fn);
      assert(
        item && item.function_schema === "public" && item.pronargs === 1 && item.one_uuid,
        `signature ${fn}`,
      );
      assert.equal(item.owner, "postgres");
      assert.equal(item.prosecdef, true);
      assert.equal(item.provolatile, "s");
      assert.deepEqual(item.proconfig, ['search_path=""']);
      assert.deepEqual(item.proargnames, ["p_center_id", ...outputs]);
      assertTargetArgModes(item.proargmodes, outputs.length);
      assert.deepEqual(item.all_types, [
        "uuid",
        "timestamp with time zone",
        "date",
        "text",
        ...outputs.slice(3, -1).map(() => "bigint"),
        "jsonb",
      ]);
      assert(
        item.authenticated_execute &&
          !item.anon_execute &&
          !item.service_execute &&
          !item.public_execute,
        `grants ${fn}`,
      );
      assert.match(item.result, /^TABLE\(/);
    }
  const existing = (
    await client.query(
      `select 'function' as kind,p.oid::regprocedure::text as id,md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||coalesce(p.proconfig::text,'')) as hash
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth') and p.prokind='f' and not (n.nspname='public' and p.proname=any($1::text[]))
    union all select 'relation',n.nspname||'.'||c.relname,md5(coalesce(c.relacl::text,'')||c.relrowsecurity::text||c.relforcerowsecurity::text)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth') and c.relkind in ('r','p','v','m')
    union all select 'policy',n.nspname||'.'||c.relname||'.'||p.polname,md5(coalesce(pg_get_expr(p.polqual,p.polrelid),'')||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')||p.polroles::text||p.polcmd::text||p.polpermissive::text)
    from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth')
    union all select 'index',schemaname||'.'||indexname,md5(indexdef) from pg_indexes where schemaname in ('public','private','auth')
    union all select 'default_acl',pg_get_userbyid(d.defaclrole)||'.'||coalesce(n.nspname,'global')||'.'||d.defaclobjtype::text,md5(coalesce(d.defaclacl::text,''))
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclnamespace=0 or n.nspname in ('public','private','auth')
    union all select 'role',rolname,md5(rolcanlogin::text||rolsuper::text||rolbypassrls::text||rolcreaterole::text||rolcreatedb::text)
    from pg_roles
    union all select 'role_membership',pg_get_userbyid(m.roleid)||'->'||pg_get_userbyid(m.member),
      md5(pg_get_userbyid(m.grantor)||m.admin_option::text||m.inherit_option::text||m.set_option::text)
    from pg_auth_members m    order by kind,id`,
      [targetNames()],
    )
  ).rows;
  return { identity, existing };
}
async function inventory(client) {
  const rows = [];
  for (const [table, key] of tables) {
    const row = (
      await client.query(
        `select count(*)::text as count,md5(coalesce(string_agg((${key})::text,',' order by (${key})::text),'')) as digest from ${table}`,
      )
    ).rows[0];
    rows.push({ table, ...row });
  }
  return rows;
}
export async function inspect(client, local, applied, verifyInventory = null) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='15s'");
    const state = {
      catalog: await catalog(client, local.versions, applied),
      data: await inventory(client),
    };
    assert.equal(state.catalog.identity.read_only, "on");
    if (verifyInventory) await verifyInventory(client, state.data);
    if (applied) {
      const record = (
        await client.query(
          "select name,statements from supabase_migrations.schema_migrations where version=$1",
          [version],
        )
      ).rows[0];
      assert.equal(record?.name, name);
      assert.deepEqual(record?.statements, local.statements);
    }
    await client.query("ROLLBACK");
    return state;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }
}
export async function apply(client, local, before) {
  assert.equal(localChecks().sha256, local.sha256);
  await client.query("BEGIN");
  let commitAttempted = false;
  try {
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query(
      "LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE",
    );
    const fresh = {
      catalog: await catalog(client, local.versions, false),
      data: await inventory(client),
    };
    assert.deepEqual(
      fresh.catalog.existing,
      before.catalog.existing,
      "Catalog changed before write",
    );
    assert.deepEqual(fresh.data, before.data, "Data inventory changed before write");
    for (const sql of local.body) await client.query(sql);
    await client.query(
      "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])",
      [version, name, local.statements],
    );
    const after = {
      catalog: await catalog(client, local.versions, true),
      data: await inventory(client),
    };
    assert.deepEqual(after.catalog.existing, before.catalog.existing, "Existing catalog changed");
    assert.deepEqual(after.data, before.data, "Data inventory changed");
    commitAttempted = true;
    await client.query("COMMIT");
  } catch (e) {
    if (commitAttempted)
      stop(
        "COMMIT outcome uncertain; read-only inspection required, never retry apply automatically",
      );
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }
  const post = await inspect(client, local, true);
  assert.deepEqual(post.catalog.existing, before.catalog.existing, "Postcheck catalog changed");
  assert.deepEqual(post.data, before.data, "Postcheck data changed");
}
export async function connect() {
  const password = process.env.TASK021_DEV_DB_PASSWORD;
  const caPath = process.env.TASK021_DEV_CA_PATH;
  assert(password && caPath, "Hidden password and approved CA are required");
  const client = new pg.Client({
    host: "aws-0-sa-east-1.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: `postgres.${ref}`,
    password,
    ssl: { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true },
    connectionTimeoutMillis: 20000,
    application_name: "task021-dashboard-dev",
  });
  await client.connect();
  return client;
}
async function main() {
  const mode = process.argv[2];
  assert(
    ["local", "preflight", "apply"].includes(mode) && process.argv.length === 3,
    "Usage: local|preflight|apply",
  );
  const local = localChecks();
  console.log(
    `LOCAL PASS project=salud-plus-turnos-dev ref=${ref} prior=24 target=${filename} sha256=${local.sha256}`,
  );
  if (mode === "local") return;
  assert.equal(process.env.TASK021_DEV_CONFIRM_REF, ref, "Explicit DEV ref confirmation required");
  const client = await connect();
  try {
    const before = await inspect(client, local, false);
    console.log(
      "PREFLIGHT PASS PostgreSQL=17.6 role=postgres migrations=24 target_only_pending=true",
    );
    if (mode === "apply") {
      await apply(client, local, before);
      console.log(
        `APPLY_AND_POSTCHECK PASS version=${version} sha256=${local.sha256} migrations=25`,
      );
    }
  } finally {
    await client.end().catch(() => {});
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(
      `STOP TASK-021 [${/^[A-Z0-9_]{2,32}$/.test(e.code ?? "") ? e.code : "CHECK"}]: ${String(
        e.message,
      )
        .replaceAll(process.env.TASK021_DEV_DB_PASSWORD ?? "__NO_SECRET__", "[REDACTED]")
        .slice(0, 300)}`,
    );
    process.exitCode = 1;
  });
