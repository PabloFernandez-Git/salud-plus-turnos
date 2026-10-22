import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDevDatabase, safeConnectionDiagnostic } from "../task009-gate-d/dev-connection.mjs";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const version = "20261022120000";
const migrationName = "add_patient_appointment_history";
const filename = `${version}_${migrationName}.sql`;
const expectedSha256 = "A846341BD7C252EA782F20793F943EBBEE1010D0A2C64B21BCAF3C782137A6B3";
const projectRef = "ehllxymqyzrofydrvtzo";
const rpcSignature =
  "public.staff_list_patient_appointments(uuid,uuid,text,timestamptz,timestamptz,uuid,integer)";
const rpcResult =
  "TABLE(appointment_id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, status appointment_status, professional_first_name text, professional_last_name text, specialty_name text, has_more boolean)";
const existingRpcSignatures = [
  "public.staff_list_appointments(uuid,date,date,public.appointment_status,uuid,timestamptz,uuid,integer)",
  "public.staff_get_appointment(uuid,uuid)",
];

function fail(message) {
  throw new Error(`STOP TASK-022: ${message}`);
}

class CommitOutcomeUnknownError extends Error {}

// The approved file has six top-level statements. Dollar-quoted function bodies
// contain semicolons, so splitting on ";" without a lexer would change the SQL.
export function splitTopLevelSql(sql) {
  const result = [];
  let start = 0;
  let state = "normal";
  let dollarTag = "";
  for (let i = 0; i < sql.length; i += 1) {
    const next = sql[i + 1];
    if (state === "line-comment") {
      if (sql[i] === "\n") state = "normal";
    } else if (state === "block-comment") {
      if (sql[i] === "*" && next === "/") {
        state = "normal";
        i += 1;
      }
    } else if (state === "single-quote") {
      if (sql[i] === "'" && next === "'") i += 1;
      else if (sql[i] === "'") state = "normal";
    } else if (state === "double-quote") {
      if (sql[i] === '"' && next === '"') i += 1;
      else if (sql[i] === '"') state = "normal";
    } else if (state === "dollar-quote") {
      if (sql.startsWith(dollarTag, i)) {
        i += dollarTag.length - 1;
        state = "normal";
      }
    } else if (sql[i] === "-" && next === "-") {
      state = "line-comment";
      i += 1;
    } else if (sql[i] === "/" && next === "*") {
      state = "block-comment";
      i += 1;
    } else if (sql[i] === "'") {
      state = "single-quote";
    } else if (sql[i] === '"') {
      state = "double-quote";
    } else if (sql[i] === "$") {
      const match = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
      if (match) {
        dollarTag = match[0];
        state = "dollar-quote";
        i += dollarTag.length - 1;
      }
    } else if (sql[i] === ";") {
      result.push(sql.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  assert.equal(state, "normal", "SQL quote or comment is unclosed");
  assert.equal(sql.slice(start).trim(), "", "SQL has a trailing unterminated statement");
  return result;
}

function leadingSql(statement) {
  let value = statement.trimStart();
  while (value.startsWith("--") || value.startsWith("/*")) {
    const lineComment = value.startsWith("--");
    const end = value.indexOf(lineComment ? "\n" : "*/");
    assert(end >= 0, "SQL comment is unclosed");
    value = value.slice(end + (lineComment ? 1 : 2)).trimStart();
  }
  return value;
}

export function readApprovedMigration(path) {
  const bytes = readFileSync(path);
  const actualSha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  assert.equal(actualSha256, expectedSha256, "Approved migration SHA-256 changed");
  const statements = splitTopLevelSql(bytes.toString("utf8"));
  assert.equal(statements.length, 6, "Expected exactly six top-level SQL statements");
  assert.match(leadingSql(statements[0]), /^begin;$/i);
  assert.match(
    leadingSql(statements[1]),
    /^create index appointments_patient_center_starts_at_id_idx\b/i,
  );
  assert.match(
    leadingSql(statements[2]),
    /^create function public\.staff_list_patient_appointments\b/i,
  );
  assert.match(
    leadingSql(statements[3]),
    /^revoke all on function public\.staff_list_patient_appointments\b/i,
  );
  assert.match(
    leadingSql(statements[4]),
    /^grant execute on function public\.staff_list_patient_appointments\b/i,
  );
  assert.match(leadingSql(statements[5]), /^commit;$/i);
  return { statements: statements.slice(1, 5), ledgerStatements: statements, actualSha256 };
}

export function localChecks() {
  const branch = execFileSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  assert.equal(branch, "codex/task-022-patient-history", "Unexpected Git branch");
  const dev = loadSupabaseDevConfig(process.env, resolve(root, ".env.local"));
  assertLinkedSupabaseProject(resolve(root, "supabase/.temp/project-ref"));
  assert.equal(dev.projectRef, projectRef);
  const linked = JSON.parse(
    readFileSync(resolve(root, "supabase/.temp/linked-project.json"), "utf8"),
  );
  assert.equal(linked.name, "salud-plus-turnos-dev");
  assert.equal(linked.ref, projectRef);
  const pooler = new URL(readFileSync(resolve(root, "supabase/.temp/pooler-url"), "utf8").trim());
  if (
    pooler.protocol !== "postgresql:" ||
    pooler.hostname !== "aws-0-sa-east-1.pooler.supabase.com" ||
    pooler.port !== "5432" ||
    pooler.pathname !== "/postgres" ||
    decodeURIComponent(pooler.username) !== `postgres.${projectRef}` ||
    pooler.password ||
    pooler.search ||
    pooler.hash
  )
    fail("Pooler endpoint differs from approved DEV project");
  const files = readdirSync(resolve(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.equal(files.length, 24, "Expected 23 prior migrations and TASK-022 only");
  assert.equal(files.at(-1), filename);
  assert(files.every((name) => /^\d{14}_.+\.sql$/.test(name)));
  const migration = readApprovedMigration(resolve(root, "supabase/migrations", filename));
  return { ...migration, priorVersions: files.slice(0, -1).map((name) => name.slice(0, 14)) };
}

const requiredColumns = new Map([
  ["appointments.id", "uuid"],
  ["appointments.center_id", "uuid"],
  ["appointments.patient_center_id", "uuid"],
  ["appointments.professional_center_id", "uuid"],
  ["appointments.specialty_id", "uuid"],
  ["appointments.starts_at", "timestamptz"],
  ["appointments.ends_at", "timestamptz"],
  ["appointments.status", "appointment_status"],
  ["patient_centers.id", "uuid"],
  ["patient_centers.center_id", "uuid"],
  ["professional_centers.id", "uuid"],
  ["professional_centers.center_id", "uuid"],
  ["professionals.id", "uuid"],
  ["professionals.first_name", "text"],
  ["professionals.last_name", "text"],
  ["specialties.id", "uuid"],
  ["specialties.center_id", "uuid"],
  ["specialties.name", "text"],
  ["professional_center_specialties.professional_center_id", "uuid"],
  ["professional_center_specialties.specialty_id", "uuid"],
  ["professional_center_specialties.center_id", "uuid"],
  ["center_memberships.center_id", "uuid"],
  ["center_memberships.user_id", "uuid"],
  ["center_memberships.role", "membership_role"],
  ["center_memberships.is_active", "bool"],
  ["centers.id", "uuid"],
  ["centers.is_active", "bool"],
]);

export async function inspect(client, priorVersions, targetApplied) {
  const identity = (
    await client.query(`
    select current_database() as database, current_user as role,
      current_setting('server_version') as server_version,
      current_setting('transaction_read_only') as read_only
  `)
  ).rows[0];
  assert.equal(identity.database, "postgres");
  assert.equal(identity.role, "postgres");
  assert.match(identity.server_version, /^17\.6(?:\D|$)/);

  const ledgerColumns = (
    await client.query(`
    select attname, format_type(atttypid,atttypmod) as type
    from pg_attribute where attrelid='supabase_migrations.schema_migrations'::regclass
      and attnum>0 and not attisdropped order by attnum
  `)
  ).rows;
  for (const [name, type] of [
    ["version", "text"],
    ["name", "text"],
    ["statements", "text[]"],
  ]) {
    assert(
      ledgerColumns.some((column) => column.attname === name && column.type === type),
      `Migration ledger ${name} column differs`,
    );
  }
  const versions = (
    await client.query("select version from supabase_migrations.schema_migrations order by version")
  ).rows.map((row) => row.version);
  assert.deepEqual(
    versions,
    targetApplied ? [...priorVersions, version] : priorVersions,
    "Remote migration versions differ from the exact expected sequence",
  );

  const objectNames = [
    "auth.users",
    "public.appointments",
    "public.patient_centers",
    "public.professional_centers",
    "public.professionals",
    "public.specialties",
    "public.professional_center_specialties",
    "public.center_memberships",
    "public.centers",
  ];
  const objects = (
    await client.query(
      "select name,to_regclass(name)::text as resolved from unnest($1::text[]) as name",
      [objectNames],
    )
  ).rows;
  assert(
    objects.every((object) => object.resolved),
    "A required Auth/domain table is absent",
  );
  const columns = (
    await client.query(`
    select table_name,column_name,udt_name from information_schema.columns
    where table_schema='public'
  `)
  ).rows;
  const columnTypes = new Map(
    columns.map((row) => [`${row.table_name}.${row.column_name}`, row.udt_name]),
  );
  for (const [name, type] of requiredColumns) {
    assert.equal(columnTypes.get(name), type, `Required column ${name} differs`);
  }
  const labels = (
    await client.query(`
    select e.enumlabel from pg_enum e
    where e.enumtypid='public.appointment_status'::regtype order by e.enumsortorder
  `)
  ).rows.map((row) => row.enumlabel);
  assert.deepEqual(labels, ["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED", "NO_SHOW"]);
  const fks = (
    await client.query(`
    select conname from pg_constraint
    where conrelid='public.appointments'::regclass and contype='f'
  `)
  ).rows.map((row) => row.conname);
  for (const name of [
    "appointments_patient_center_fk",
    "appointments_professional_center_fk",
    "appointments_professional_center_specialty_fk",
  ]) {
    assert(fks.includes(name), `Required appointment FK ${name} is absent`);
  }
  const helpers = (
    await client.query(`
    select to_regprocedure('auth.uid()')::text as auth_uid,
      to_regprocedure('private.has_active_center_role(uuid,public.membership_role[])')::text as center_role
  `)
  ).rows[0];
  assert(helpers.auth_uid && helpers.center_role, "Auth or active Center role helper is absent");

  const table = (
    await client.query(`
    select relrowsecurity, relforcerowsecurity,
      has_table_privilege('authenticated',oid,'SELECT') as authenticated_select,
      has_table_privilege('anon',oid,'SELECT') as anon_select
    from pg_class where oid='public.appointments'::regclass
  `)
  ).rows[0];
  assert(
    table.relrowsecurity && !table.authenticated_select && !table.anon_select,
    "Appointment RLS or direct SELECT differs",
  );
  const policyCount = (
    await client.query(
      "select count(*)::integer as n from pg_policy where polrelid='public.appointments'::regclass",
    )
  ).rows[0].n;
  assert.equal(policyCount, 0, "Appointment policies differ");

  for (const signature of existingRpcSignatures) {
    const access = (
      await client.query(
        `
      select p.prosecdef, pg_get_userbyid(p.proowner) as owner,
        has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
        has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
        has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
      from pg_proc p where p.oid=to_regprocedure($1)
    `,
        [signature],
      )
    ).rows[0];
    assert(
      access?.prosecdef &&
        access.owner === "postgres" &&
        access.authenticated_execute &&
        !access.anon_execute &&
        !access.service_execute,
      `Existing RPC contract differs: ${signature}`,
    );
  }
  const oldIndex = (
    await client.query(`
    select pg_get_indexdef(to_regclass('public.appointments_patient_center_starts_at_idx')) as definition
  `)
  ).rows[0].definition;
  assert.match(oldIndex ?? "", /\(patient_center_id, starts_at DESC\)/);

  const target = (
    await client.query(
      `
    select p.oid::regprocedure::text as signature, pg_get_userbyid(p.proowner) as owner,
      p.prosecdef,p.provolatile,p.proconfig,pg_get_function_result(p.oid) as result,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
      exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
    from pg_proc p where p.oid=to_regprocedure($1)
  `,
      [rpcSignature],
    )
  ).rows[0];
  const targetOverloads = (
    await client.query(`
    select count(*)::integer as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='staff_list_patient_appointments'
  `)
  ).rows[0].n;
  const index = (
    await client.query(`
    select pg_get_indexdef(i.indexrelid) as definition,i.indisvalid,i.indisready
    from pg_index i where i.indexrelid=to_regclass('public.appointments_patient_center_starts_at_id_idx')
  `)
  ).rows[0];
  if (!targetApplied) {
    assert.equal(targetOverloads, 0, "Target RPC already exists");
    assert.equal(index, undefined, "Target index already exists");
  } else {
    assert.equal(targetOverloads, 1, "Target RPC overload count differs");
    assert.equal(target?.owner, "postgres");
    assert.equal(target?.prosecdef, true);
    assert.equal(target?.provolatile, "s");
    assert.deepEqual(target?.proconfig, ['search_path=""']);
    assert.equal(target?.result, rpcResult);
    assert(
      target.authenticated_execute &&
        !target.anon_execute &&
        !target.service_execute &&
        !target.public_execute,
      "Target RPC EXECUTE grants differ",
    );
    assert(index?.indisvalid && index?.indisready);
    assert.match(index.definition, /\(patient_center_id, starts_at, id\)/);
  }

  // The approved migration may add one function and one index only. Capture
  // existing definitions, ACLs, RLS flags and policies for exact comparison.
  const existingCatalog = (
    await client.query(`
    select 'function' as kind,n.nspname||'.'||p.oid::regprocedure::text as identity,
      md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||
        coalesce(array_to_string(p.proconfig,','),'')) as fingerprint
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private','auth') and p.prokind='f'
      and not (n.nspname='public' and p.proname='staff_list_patient_appointments')
    union all
    select 'relation',n.nspname||'.'||c.relname,
      md5(coalesce(c.relacl::text,'')||c.relrowsecurity::text||c.relforcerowsecurity::text)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','auth') and c.relkind in ('r','p','v','m')
    union all
    select 'policy',n.nspname||'.'||c.relname||'.'||p.polname,
      md5(pg_get_expr(p.polqual,p.polrelid)||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')||
        p.polroles::text||p.polcmd::text||p.polpermissive::text)
    from pg_policy p join pg_class c on c.oid=p.polrelid
      join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','auth')
    union all
    select 'index',schemaname||'.'||indexname,md5(indexdef)
    from pg_indexes where schemaname in ('public','private','auth')
      and not (schemaname='public' and indexname='appointments_patient_center_starts_at_id_idx')
    union all
    select 'default_acl',pg_get_userbyid(d.defaclrole)||'.'||
      coalesce(n.nspname,'global')||'.'||d.defaclobjtype::text,
      md5(coalesce(d.defaclacl::text,''))
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
    where d.defaclnamespace=0 or n.nspname in ('public','private','auth')
    union all
    select 'role_membership',pg_get_userbyid(m.roleid)||'->'||pg_get_userbyid(m.member),
      md5(pg_get_userbyid(m.grantor)||m.admin_option::text||
        m.inherit_option::text||m.set_option::text)
    from pg_auth_members m
    union all
    select 'role',rolname,md5(rolcanlogin::text||rolsuper::text||
      rolbypassrls::text||rolcreaterole::text||rolcreatedb::text)
    from pg_roles
    order by kind,identity
  `)
  ).rows;
  return { identity, versions, existingCatalog, table };
}

const inventoryTables = [
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

async function inventory(client) {
  const rows = [];
  for (const [table, key] of inventoryTables) {
    const row = (
      await client.query(`
      select count(*)::text as count,
        md5(coalesce(string_agg((${key})::text,',' order by (${key})::text),'')) as id_digest
      from ${table}
    `)
    ).rows[0];
    rows.push({ table, ...row });
  }
  return rows;
}

export async function readOnlyPreflight(client, local) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    const catalog = await inspect(client, local.priorVersions, false);
    assert.equal(catalog.identity.read_only, "on");
    const data = await inventory(client);
    await client.query("ROLLBACK");
    return { catalog, data };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function readOnlyPostflight(client, local, before) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    const catalog = await inspect(client, local.priorVersions, true);
    assert.equal(catalog.identity.read_only, "on");
    assert.deepEqual(
      catalog.existingCatalog,
      before.catalog.existingCatalog,
      "Existing schema/ACL/policy catalog changed",
    );
    const data = await inventory(client);
    assert.deepEqual(data, before.data, "Preexisting table ID inventory changed");
    const record = (
      await client.query(
        `
      select name,statements from supabase_migrations.schema_migrations where version=$1
    `,
        [version],
      )
    ).rows[0];
    assert.equal(record?.name, migrationName);
    assert.deepEqual(record?.statements, local.ledgerStatements);
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function applyExactlyOne(client, local, before) {
  const fresh = readApprovedMigration(resolve(root, "supabase/migrations", filename));
  assert.deepEqual(fresh.statements, local.statements);
  assert.deepEqual(fresh.ledgerStatements, local.ledgerStatements);
  await client.query("BEGIN");
  let commitAttempted = false;
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(
      "LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE",
    );
    const rechecked = await inspect(client, local.priorVersions, false);
    assert.deepEqual(
      rechecked.existingCatalog,
      before.catalog.existingCatalog,
      "Catalog changed since the read-only preflight",
    );
    const data = await inventory(client);
    assert.deepEqual(data, before.data, "Table inventory changed since the read-only preflight");
    for (const statement of fresh.statements) await client.query(statement);
    await client.query(
      `
      insert into supabase_migrations.schema_migrations(version,name,statements)
      values($1,$2,$3::text[])
    `,
      [version, migrationName, fresh.ledgerStatements],
    );
    const after = await inspect(client, local.priorVersions, true);
    assert.deepEqual(
      after.existingCatalog,
      before.catalog.existingCatalog,
      "The migration changed an existing catalog object",
    );
    assert.deepEqual(await inventory(client), data, "The migration changed preexisting table IDs");
    commitAttempted = true;
    await client.query("COMMIT");
  } catch (error) {
    if (commitAttempted) {
      throw new CommitOutcomeUnknownError(
        `COMMIT outcome is unknown; do not retry apply: ${error.message}`,
      );
    }
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  try {
    await readOnlyPostflight(client, local, before);
  } catch (error) {
    fail(`Post-commit verification failed; do not retry automatically: ${error.message}`);
  }
}

async function inspectAmbiguousCommit(local, before) {
  const client = await openDevDatabase("task022", {});
  try {
    await readOnlyPostflight(client, local, before);
    console.log(`READ_ONLY_COMMIT_INSPECTION PASS applied=${version} structural_postcheck=PASS`);
    return;
  } catch (appliedError) {
    try {
      await readOnlyPreflight(client, local);
      fail(
        "COMMIT did not apply; no write was retried. The previous apply command must not be rerun automatically",
      );
    } catch (pendingError) {
      if (pendingError.message.includes("COMMIT did not apply")) throw pendingError;
      fail(
        `COMMIT state remains uncertain after read-only inspection; no write was retried. Applied-state check: ${appliedError.message}; pending-state check: ${pendingError.message}`,
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const mode = process.argv[2];
  if (!["local", "preflight", "apply"].includes(mode) || process.argv.length !== 3) {
    fail("Usage: node scripts/task022-dev/gate.mjs local|preflight|apply");
  }
  const local = localChecks();
  console.log(
    `LOCAL PASS project=salud-plus-turnos-dev ref=${projectRef} prior=23 target=${filename} sha256=${local.actualSha256}`,
  );
  if (mode === "local") return;

  const client = await openDevDatabase("task022", {});
  try {
    const before = await readOnlyPreflight(client, local);
    console.log(
      `PREFLIGHT PASS database=${before.catalog.identity.database} role=${before.catalog.identity.role} PostgreSQL=${before.catalog.identity.server_version} remote_migrations=23 target_pending_only=true catalog_compatible=true`,
    );
    if (mode === "apply") {
      try {
        await applyExactlyOne(client, local, before);
      } catch (error) {
        if (!(error instanceof CommitOutcomeUnknownError)) throw error;
        console.error(`STOP TASK-022: ${error.message}`);
        await inspectAmbiguousCommit(local, before);
      }
      console.log(
        `APPLICATION_AND_STRUCTURAL_POSTCHECK PASS version=${version} sha256=${local.actualSha256} remote_migrations=24`,
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const diagnostic = safeConnectionDiagnostic(
      error,
      process.env.SUPABASE_DB_PASSWORD || "__NO_PASSWORD_IN_PROCESS__",
      "task022",
    );
    console.error(`STOP TASK-022 [${diagnostic.code}]: ${diagnostic.message}`);
    process.exitCode = 1;
  });
}
