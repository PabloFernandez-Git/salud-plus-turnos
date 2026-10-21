import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

const mode = process.argv[2];
assert(
  ["--preflight", "--catalog", "--integration", "--a2-regression", "--historical"].includes(mode),
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
  "STOP — WRONG SUPABASE TARGET",
);
const client = new pg.Client({
  host: variables.PGHOST,
  port: Number(variables.PGPORT),
  database: variables.PGDATABASE,
  user: variables.PGUSER,
  password: variables.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
  application_name: `task009-b0-dev-${mode.slice(2)}`,
});
const a2Names = [
  "professional_get_own_appointment",
  "professional_list_own_appointments",
  "staff_bookable_professional_centers_for_specialty",
  "staff_get_appointment",
  "staff_list_appointments",
  "staff_list_bookable_specialties",
  "staff_search_appointment_slots",
];
const b0Names = [
  "staff_create_appointment",
  "staff_reschedule_appointment",
  "staff_transition_appointment_status",
  "staff_update_appointment_note",
];
const privateNames = [
  "appointment_booking_context",
  "appointment_utc_offsets",
  "classify_appointment_local_time",
  "appointment_slot_candidates",
  "appointment_slot_grid",
  "appointment_lock_booking_entities",
  "appointment_resolve_requested_slot",
];
const expectedB0Signatures = [
  "staff_create_appointment(uuid,uuid,uuid,uuid,date,time without time zone,text)",
  "staff_reschedule_appointment(uuid,uuid,timestamp with time zone,uuid,uuid,date,time without time zone)",
  "staff_transition_appointment_status(uuid,uuid,timestamp with time zone,text)",
  "staff_update_appointment_note(uuid,uuid,timestamp with time zone,text)",
];
const fixturePrefix = "91000000-0000-0000-0000-0000000000";
const tables = [
  "auth.users",
  "public.centers",
  "public.users",
  "public.platform_admins",
  "public.center_memberships",
  "public.professionals",
  "public.professional_centers",
  "public.specialties",
  "public.professional_center_specialties",
  "public.availabilities",
  "public.persons",
  "public.patient_centers",
  "public.appointments",
];

async function inventory() {
  const result = {};
  for (const table of tables) {
    // These small DEV tables include every table touched by the SQL fixture.
    const row = (
      await client.query(`select count(*)::integer as n,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text), '')) as digest
      from ${table} t`)
    ).rows[0];
    result[table] = row;
  }
  return result;
}

async function catalog() {
  const migrations = (
    await client.query("select version from supabase_migrations.schema_migrations order by version")
  ).rows.map((row) => row.version);
  const local = readdirSync(resolve("supabase/migrations"))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()
    .map((name) => name.slice(0, 14));
  const expected = mode === "--preflight" ? local.slice(0, -1) : local;
  assert.deepEqual(migrations, expected);
  assert.equal(migrations.length, mode === "--preflight" ? 21 : 22);
  const version = (await client.query("select version() as version")).rows[0].version;
  assert.match(version, /^PostgreSQL 17\.6\b/);
  const functions = (
    await client.query(
      `select p.oid::regprocedure::text as signature,
    p.proname as name, n.nspname as schema, pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as definer, p.proconfig as settings,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_role,
    coalesce((select bool_or(a.grantee=0) from pg_proc pp,
      lateral aclexplode(coalesce(pp.proacl,acldefault('f',pp.proowner))) a
      where pp.oid=p.oid),false) as public_grant,
    md5(pg_get_functiondef(p.oid)) as definition_digest,
    pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname = any($1::text[]))
      or (n.nspname='private' and p.proname = any($2::text[]))
    order by n.nspname,p.proname`,
      [[...a2Names, ...b0Names], privateNames],
    )
  ).rows;
  const publicFunctions = functions.filter((row) => row.schema === "public");
  assert.deepEqual(
    publicFunctions.map((row) => row.name),
    [...a2Names, ...(mode === "--preflight" ? [] : b0Names)].sort(),
  );
  const allAppointmentNames = (
    await client.query(`select p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and
      (p.proname like '%appointment%' or p.proname like 'staff_list_bookable_%'
       or p.proname='staff_bookable_professional_centers_for_specialty')
      and p.proname <> 'staff_update_usual_appointment_duration'
    order by p.proname`)
  ).rows.map((row) => row.proname);
  assert.deepEqual(
    allAppointmentNames,
    publicFunctions.map((row) => row.name),
  );
  assert.deepEqual(
    functions.filter((row) => row.schema === "private").map((row) => row.name),
    (mode === "--preflight" ? privateNames.slice(0, 4) : privateNames).sort(),
  );
  for (const fn of functions) {
    assert.equal(fn.owner, "postgres", fn.signature);
    assert.equal(fn.public_grant, false, fn.signature);
    assert.equal(fn.anon, false, fn.signature);
    assert.equal(fn.service_role, false, fn.signature);
    if (fn.schema === "public") {
      assert.equal(fn.definer, true, fn.signature);
      assert.deepEqual(fn.settings, ['search_path=""'], fn.signature);
      assert.equal(fn.authenticated, true, fn.signature);
      assert.match(fn.definition, /auth\.uid\(\)|private\./, fn.signature);
    } else {
      assert.equal(fn.authenticated, false, fn.signature);
    }
  }
  if (mode !== "--preflight") {
    assert.deepEqual(
      functions.filter((row) => b0Names.includes(row.name)).map((row) => row.signature),
      expectedB0Signatures,
    );
    for (const name of [
      "appointment_slot_grid",
      "appointment_lock_booking_entities",
      "appointment_resolve_requested_slot",
    ]) {
      assert.equal(
        functions.filter((row) => row.name === name && row.schema === "private").length,
        1,
      );
    }
  }
  const appointment = (
    await client.query(`select c.relrowsecurity as rls,
    c.relacl::text as acl,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_access,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
    (select count(*)::integer from pg_policy p where p.polrelid=c.oid) as policies,
    (select array_agg(conname order by conname) from pg_constraint k where k.conrelid=c.oid) as constraints,
    (select pg_get_triggerdef(t.oid) from pg_trigger t where t.tgrelid=c.oid and t.tgname='appointments_set_updated_at') as trigger,
    (select pg_get_constraintdef(k.oid) from pg_constraint k where k.conrelid=c.oid and k.conname='appointments_no_blocking_overlap') as gist
    from pg_class c where c.oid='public.appointments'::regclass`)
  ).rows[0];
  assert(appointment.rls && !appointment.authenticated_access && !appointment.anon_access);
  assert.equal(appointment.policies, 0);
  assert.match(appointment.trigger, /private\.set_task006_cas_updated_at\(\)/);
  assert.match(appointment.gist, /EXCLUDE USING gist/);
  assert.match(appointment.gist, /PENDING/);
  assert.match(appointment.gist, /NO_SHOW/);
  assert.equal(
    appointment.constraints.includes("appointments_administrative_note_length_check"),
    mode !== "--preflight",
  );
  for (const name of ["staff_list_appointments", "professional_list_own_appointments"]) {
    const def = functions.find((row) => row.name === name).definition;
    assert.match(def, /starts_at >= v_lower_utc/);
    assert.match(def, /starts_at < v_upper_utc/);
  }
  const before = await inventory();
  const fixtureIds = (
    await client.query(
      `select
    (select count(*)::integer from public.centers where id::text like $1) as centers,
    (select count(*)::integer from public.appointments where center_id::text like $1) as appointments,
    (select count(*)::integer from auth.users where id::text like $1) as auth_users`,
      [`${fixturePrefix}%`],
    )
  ).rows[0];
  assert.deepEqual(fixtureIds, { centers: 0, appointments: 0, auth_users: 0 });
  return {
    target: dev.projectRef,
    migrations: migrations.length,
    version,
    publicFunctions: publicFunctions.map(({ name, signature, definition_digest }) => ({
      name,
      signature,
      definition_digest,
    })),
    privateFunctions: functions
      .filter((row) => row.schema === "private")
      .map((row) => row.signature),
    appointment,
    fixtureIds,
    inventory: before,
  };
}

await client.connect();
try {
  await client.query("set role postgres");
  if (mode === "--preflight" || mode === "--catalog") {
    await client.query("begin transaction isolation level repeatable read read only");
    const result = await catalog();
    await client.query("commit");
    console.log(
      JSON.stringify({
        result:
          mode === "--preflight" ? "TASK009_B0_DEV_PREFLIGHT_PASS" : "TASK009_B0_DEV_CATALOG_PASS",
        ...result,
      }),
    );
  } else if (mode === "--historical") {
    const before = await inventory();
    const suites = [
      "initial-domain-schema.sql",
      "auth-access-foundation.sql",
      "task-006b-foundation.sql",
    ];
    for (const suite of suites) {
      const sql = readFileSync(resolve("supabase/tests", suite), "utf8");
      assert.match(sql, /^begin;/i);
      assert.match(sql, /rollback;\s*$/i);
      try {
        await client.query(sql.replace(/\breset role;/gi, "set role postgres;"));
      } finally {
        await client.query("rollback");
      }
      assert.deepEqual(await inventory(), before, `${suite} changed DEV inventory`);
    }
    console.log(JSON.stringify({ result: "TASK009_B0_DEV_HISTORICAL_PASS", suites }));
  } else {
    const before = await inventory();
    const regression = mode === "--a2-regression";
    const source = readFileSync(
      resolve(
        regression
          ? "supabase/tests/task-009-appointments.sql"
          : "supabase/tests/task-009-b0-mutations.sql",
      ),
      "utf8",
    );
    // A2's historical catalog preamble expects exactly seven RPCs. Its runtime
    // section remains intact; the 22-migration catalog is checked above.
    const runtimeStart = source.indexOf("insert into public.centers");
    if (regression) assert(runtimeStart > 0, "A2 runtime section not found");
    const sql = regression ? `begin;\n${source.slice(runtimeStart)}` : source;
    assert.match(sql, /^begin;/i);
    assert.match(sql, /rollback;\s*$/i);
    // The CLI login role delegates postgres. Return to postgres between test identities.
    const devSql = sql.replace(/\breset role;/gi, "set role postgres;");
    try {
      await client.query(devSql);
    } finally {
      await client.query("rollback");
    }
    const after = await inventory();
    assert.deepEqual(after, before, "DEV fixture inventory changed after rollback");
    console.log(
      JSON.stringify({
        result: regression
          ? "TASK009_A2_DEV_RUNTIME_REGRESSION_PASS"
          : "TASK009_B0_DEV_INTEGRATION_PASS",
        inventory: before,
      }),
    );
  }
} catch (error) {
  try {
    await client.query("rollback");
  } catch {}
  throw error;
} finally {
  await client.end();
}
