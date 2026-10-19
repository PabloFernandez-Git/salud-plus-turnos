import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

const mode = process.argv[2];
if (mode === "--shadow" || mode === "--post-apply-dev") {
  await verifyCatalog(mode);
  process.exit(0);
}
if (mode === "--dev-integration") {
  await verifyDevIntegration();
  process.exit(0);
}
assert.equal(
  mode,
  "--preflight-dev",
  "Supported modes: --preflight-dev, --shadow, --post-apply-dev, --dev-integration",
);
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
const variables = Object.fromEntries(
  [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
);
const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
assert(
  variables.PGHOST === `db.${dev.projectRef}.supabase.co` ||
    (variables.PGHOST === pooler.hostname && variables.PGUSER?.endsWith(`.${dev.projectRef}`)),
  "Database target is not approved DEV",
);
const client = new pg.Client({
  host: variables.PGHOST,
  port: Number(variables.PGPORT),
  database: variables.PGDATABASE,
  user: variables.PGUSER,
  password: variables.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
  application_name: "task009-readonly-preflight",
});

try {
  await client.connect();
  await client.query("begin transaction isolation level repeatable read read only");
  await client.query("set local role postgres");
  const catalog = await client.query(
    `
    select c.relname as table_name, c.relrowsecurity as rls, c.relacl::text as grants,
      has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
      has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE') as authenticated_dml,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_access,
      (select array_agg(a.attname || ':' || format_type(a.atttypid,a.atttypmod) order by a.attnum)
       from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
      (select array_agg(k.conname || ':' || pg_get_constraintdef(k.oid) order by k.conname)
       from pg_constraint k where k.conrelid=c.oid) as constraints,
      (select array_agg(i.relname || ':' || pg_get_indexdef(x.indexrelid) order by i.relname)
       from pg_index x join pg_class i on i.oid=x.indexrelid where x.indrelid=c.oid) as indexes,
      (select array_agg(t.tgname || ':' || pg_get_triggerdef(t.oid) order by t.tgname)
       from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
      (select array_agg(p.polname || ':' || p.polcmd::text || ':' || pg_get_expr(p.polqual,p.polrelid) order by p.polname)
       from pg_policy p where p.polrelid=c.oid) as policies
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname = any($1::text[]) and c.relkind='r'
    order by c.relname`,
    [
      [
        "appointments",
        "availabilities",
        "centers",
        "center_memberships",
        "professional_centers",
        "professional_center_specialties",
        "specialties",
        "patient_centers",
      ],
    ],
  );
  const functions = await client.query(`
    select n.nspname || '.' || p.proname as name, pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer, p.proconfig as settings,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
      and (p.proname like '%appointment%' or p.proname='set_task006_cas_updated_at')
    order by n.nspname,p.proname`);
  const inventory = await client.query(`
    select
      (select jsonb_agg(jsonb_build_object('timezone',timezone,'count',n) order by timezone)
       from (select timezone,count(*) n from public.centers group by timezone) z) as timezones,
      (select count(*) from public.appointments) as appointment_count,
      (select jsonb_agg(jsonb_build_object('status',status,'count',n) order by status)
       from (select status,count(*) n from public.appointments group by status) s) as appointment_statuses,
      (select count(*) from public.appointments a join public.professional_centers pc on pc.id=a.professional_center_id where not pc.is_active) as inactive_pc_appointments,
      (select count(*) from public.appointments a join public.specialties s on s.id=a.specialty_id where not s.is_active) as inactive_specialty_appointments,
      (select count(*) from public.availabilities where is_active) as active_availabilities,
      (select count(*) from public.professional_centers where not is_active) as inactive_professional_centers,
      (select count(*) from public.specialties where not is_active) as inactive_specialties`);
  const migrations = await client.query(
    "select version from supabase_migrations.schema_migrations order by version",
  );
  const version = await client.query("select version(), current_setting('TimeZone') as timezone");
  await client.query("commit");
  const appointment = catalog.rows.find((row) => row.table_name === "appointments");
  assert(
    appointment?.rls &&
      !appointment.authenticated_select &&
      !appointment.authenticated_dml &&
      !appointment.anon_access,
  );
  assert.equal(appointment.policies, null);
  assert(
    appointment.constraints.some(
      (value) =>
        value.startsWith("appointments_no_blocking_overlap:") &&
        value.includes("gist") &&
        value.includes("PENDING") &&
        value.includes("NO_SHOW"),
    ),
  );
  assert(
    appointment.triggers.some(
      (value) =>
        value.includes("appointments_set_updated_at") && value.includes("private.set_updated_at()"),
    ),
  );
  assert.equal(migrations.rows.length, 20);
  console.log(
    JSON.stringify(
      {
        projectRef: dev.projectRef,
        version: version.rows[0],
        migrationVersions: migrations.rows.map((row) => row.version),
        catalog: catalog.rows,
        functions: functions.rows.map(({ definition, ...row }) => ({
          ...row,
          definition_length: definition.length,
        })),
        inventory: inventory.rows[0],
      },
      null,
      2,
    ),
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch {}
  throw error;
} finally {
  await client.end();
}

function devConnection() {
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
  const variables = Object.fromEntries(
    [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
  );
  const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
  assert(
    variables.PGHOST === `db.${dev.projectRef}.supabase.co` ||
      (variables.PGHOST === pooler.hostname && variables.PGUSER?.endsWith(`.${dev.projectRef}`)),
    "Database target is not approved DEV",
  );
  return {
    host: variables.PGHOST,
    port: Number(variables.PGPORT),
    database: variables.PGDATABASE,
    user: variables.PGUSER,
    password: variables.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
    application_name: "task009-post-apply-catalog",
  };
}

async function verifyDevIntegration() {
  const client = new pg.Client(devConnection());
  const inventorySql = `
    select jsonb_build_object(
      'centers', (select count(*) from public.centers),
      'users', (select count(*) from public.users),
      'memberships', (select count(*) from public.center_memberships),
      'professionals', (select count(*) from public.professionals),
      'professional_centers', (select count(*) from public.professional_centers),
      'specialties', (select count(*) from public.specialties),
      'assignments', (select count(*) from public.professional_center_specialties),
      'availabilities', (select count(*) from public.availabilities),
      'persons', (select count(*) from public.persons),
      'patient_centers', (select count(*) from public.patient_centers),
      'appointments', (select count(*) from public.appointments)
    ) as inventory`;
  await client.connect();
  try {
    await client.query("set role postgres");
    const before = (await client.query(inventorySql)).rows[0].inventory;
    const sql = readFileSync(resolve("supabase/tests/task-009-appointments.sql"), "utf8");
    assert.match(sql, /^begin;/i);
    assert.match(sql, /rollback;\s*$/i);
    // The CLI connects as a temporary login role. Restore its delegated postgres
    // role between test identities instead of resetting to that login role.
    const devSql = sql.replace(/\breset role;/gi, "set role postgres;");
    try {
      await client.query(devSql);
    } finally {
      await client.query("rollback");
    }
    const after = (await client.query(inventorySql)).rows[0].inventory;
    assert.deepEqual(after, before, "DEV fixture inventory changed after rollback");
    console.log(
      JSON.stringify({
        result: "TASK009_DEV_INTEGRATION_PASS",
        inventoryBefore: before,
        inventoryAfter: after,
      }),
    );
  } finally {
    await client.end();
  }
}

async function verifyCatalog(targetMode) {
  const isDev = targetMode === "--post-apply-dev";
  let connection;
  if (isDev) {
    connection = devConnection();
  } else {
    const rawUrl = process.env.TASK009_SHADOW_DATABASE_URL;
    assert(rawUrl, "TASK009_SHADOW_DATABASE_URL is required");
    const url = new URL(rawUrl);
    assert.equal(url.protocol, "postgres:");
    assert(["127.0.0.1", "localhost"].includes(url.hostname), "Shadow must be loopback");
    assert.equal(url.pathname, "/postgres");
    assert.equal(url.username, "postgres");
    connection = { connectionString: rawUrl, application_name: "task009-shadow-catalog" };
  }
  const migrationFiles = readdirSync(resolve("supabase/migrations"))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
  assert.equal(migrationFiles.length, 21);
  assert.equal(migrationFiles.at(-1), "20261016190000_add_appointment_foundation.sql");

  const shadow = new pg.Client(connection);
  try {
    await shadow.connect();
    await shadow.query("begin transaction isolation level repeatable read read only");
    if (isDev) await shadow.query("set local role postgres");
    const version = (await shadow.query("select version() as version")).rows[0].version;
    assert.match(version, /^PostgreSQL 17\.6\b/);
    if (isDev) {
      const applied = (
        await shadow.query(
          "select version from supabase_migrations.schema_migrations order by version",
        )
      ).rows.map((row) => row.version);
      assert.deepEqual(
        applied,
        migrationFiles.map((name) => name.slice(0, 14)),
      );
    }
    const tables = (
      await shadow.query(`
        select c.relname, c.relrowsecurity,
          has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_access,
          has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
          (select count(*)::integer from pg_policy p where p.polrelid=c.oid) as policy_count
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname in
          ('appointments','professionals','specialties','persons')`)
    ).rows;
    assert.equal(tables.length, 4);
    const appointments = tables.find((row) => row.relname === "appointments");
    assert(appointments.relrowsecurity);
    assert(!appointments.authenticated_access && !appointments.anon_access);
    assert.equal(appointments.policy_count, 0);
    const functions = (
      await shadow.query(`
        select n.nspname, p.proname, p.oid::regprocedure::text as signature,
          p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner,
          has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
          has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
          has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute,
          p.proacl::text as acl, pg_get_function_result(p.oid) as result_type,
          pg_get_functiondef(p.oid) as definition
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where (n.nspname='public' and p.proname in (
          'staff_list_bookable_specialties','staff_bookable_professional_centers_for_specialty',
          'staff_search_appointment_slots','staff_list_appointments','staff_get_appointment',
          'professional_list_own_appointments','professional_get_own_appointment'))
          or (n.nspname='private' and p.proname in (
          'appointment_booking_context','appointment_utc_offsets',
          'classify_appointment_local_time','appointment_slot_candidates'))
        order by n.nspname,p.proname,p.oid::regprocedure::text`)
    ).rows;
    const expectedPublic = [
      "professional_get_own_appointment(uuid,uuid)",
      "professional_list_own_appointments(uuid,date,date,appointment_status,timestamp with time zone,uuid,integer)",
      "staff_bookable_professional_centers_for_specialty(uuid,uuid)",
      "staff_get_appointment(uuid,uuid)",
      "staff_list_appointments(uuid,date,date,appointment_status,uuid,timestamp with time zone,uuid,integer)",
      "staff_list_bookable_specialties(uuid)",
      "staff_search_appointment_slots(uuid,uuid,uuid,date)",
    ];
    const expectedPrivate = [
      "private.appointment_booking_context(uuid,uuid,uuid)",
      "private.appointment_slot_candidates(uuid,uuid,uuid,date)",
      "private.appointment_utc_offsets(text,date)",
      "private.classify_appointment_local_time(timestamp without time zone,text,integer[])",
    ];
    assert.deepEqual(
      functions.filter((row) => row.nspname === "public").map((row) => row.signature),
      expectedPublic,
    );
    assert.deepEqual(
      functions.filter((row) => row.nspname === "private").map((row) => row.signature),
      expectedPrivate,
    );
    for (const fn of functions) {
      assert.equal(fn.owner, "postgres", `${fn.signature}: owner`);
      assert.deepEqual(fn.proconfig, ['search_path=""'], `${fn.signature}: search_path`);
      assert(
        !fn.anon_execute && !fn.service_role_execute && !/(?:\{|,)=X\//.test(fn.acl),
        `${fn.signature}: PUBLIC/anon/service_role`,
      );
      if (fn.nspname === "public") {
        assert(fn.prosecdef && fn.authenticated_execute, `${fn.signature}: public security`);
      } else {
        assert(!fn.prosecdef && !fn.authenticated_execute, `${fn.signature}: private security`);
      }
    }
    for (const fn of functions.filter((row) => row.proname.startsWith("professional_"))) {
      assert(
        !/administrative_note|document|nationality|phone|email|birth_date|insurance/i.test(
          fn.result_type,
        ),
      );
    }
    const slotRpc = functions.find((row) => row.proname === "staff_search_appointment_slots");
    assert.equal(
      slotRpc.result_type,
      "TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone)",
    );
    for (const name of ["staff_list_appointments", "professional_list_own_appointments"]) {
      const definition = functions.find((row) => row.proname === name).definition;
      assert.match(
        definition,
        /v_lower_utc\s*:=\s*\(p_from_date::timestamp(?: without time zone)? AT TIME ZONE 'UTC'\)\s*-\s*(?:interval\s*)?'(?:15 hours|15:00:00)'(?:::interval)?/i,
        `${name}: conservative lower UTC bound`,
      );
      assert.match(
        definition,
        /v_upper_utc\s*:=\s*\(\(p_to_date::timestamp(?: without time zone)?\s*\+\s*(?:interval\s*)?'1 day'(?:::interval)?\)\s*AT TIME ZONE 'UTC'\)\s*\+\s*(?:interval\s*)?'(?:15 hours|15:00:00)'(?:::interval)?/i,
        `${name}: conservative exclusive upper UTC bound`,
      );
      assert.match(definition, /appointment\.starts_at\s*>=\s*v_lower_utc/i);
      assert.match(definition, /appointment\.starts_at\s*<\s*v_upper_utc/i);
      assert.match(
        definition,
        /\(appointment\.starts_at AT TIME ZONE v_timezone\)::date\s+BETWEEN p_from_date AND p_to_date/i,
        `${name}: exact Center-local date filter`,
      );
    }
    const offsets = functions.find((row) => row.proname === "appointment_utc_offsets");
    assert.equal([...offsets.definition.matchAll(/generate_series\(0, 3240\)/g)].length, 1);
    const candidates = functions.find((row) => row.proname === "appointment_slot_candidates");
    assert.match(candidates.definition, /WITH offsets AS MATERIALIZED/i);
    assert.match(candidates.definition, /v_candidate_count > 288/i);
    assert.match(candidates.definition, /NO_SHOW/);
    const foundation = (
      await shadow.query(`
        select
          (select t.tgfoid='private.set_task006_cas_updated_at()'::regprocedure
           from pg_trigger t where t.tgrelid='public.appointments'::regclass
             and t.tgname='appointments_set_updated_at') as cas_trigger,
          (select c.contype='x' and pg_get_constraintdef(c.oid) like '%gist%'
            and pg_get_constraintdef(c.oid) like '%PENDING%'
            and pg_get_constraintdef(c.oid) like '%NO_SHOW%'
           from pg_constraint c where c.conrelid='public.appointments'::regclass
             and c.conname='appointments_no_blocking_overlap') as blocking_gist,
          (select count(*)::integer from pg_index i
           where i.indrelid='public.appointments'::regclass) as appointment_indexes`)
    ).rows[0];
    assert(foundation.cas_trigger && foundation.blocking_gist);
    assert.equal(foundation.appointment_indexes, 7);
    await shadow.query("commit");
    console.log(
      JSON.stringify(
        {
          result: isDev ? "TASK009_DEV_CATALOG_PASS" : "TASK009_SHADOW_CATALOG_PASS",
          postgresVersion: version,
          migrations: migrationFiles.length,
          publicRpcSignatures: expectedPublic,
          privateHelperSignatures: expectedPrivate,
          rls: true,
          genericAppointmentAccess: false,
          appointmentPolicyCount: 0,
          monotonicCasTrigger: true,
          blockingGistPreserved: true,
          appointmentIndexes: foundation.appointment_indexes,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    try {
      await shadow.query("rollback");
    } catch {}
    throw error;
  } finally {
    await shadow.end();
  }
}
