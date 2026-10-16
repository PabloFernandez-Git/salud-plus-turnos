import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

// CAS tokens have microsecond precision; pg's default Date parser truncates them.
pg.types.setTypeParser(1184, (value) => value);

const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
assert(secretKey, "Temporary Auth fixtures require the existing DEV secret key.");
const manifestPath = resolve(".harness/tasks/active/TASK-008/dev-fixture-manifest.json");
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
const variables = Object.fromEntries(
  [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
);
const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
assert(
  variables.PGHOST === `db.${dev.projectRef}.supabase.co` ||
    (variables.PGHOST === pooler.hostname && variables.PGUSER?.endsWith(`.${dev.projectRef}`)),
  "Temporary DB credentials do not target approved DEV.",
);
const config = {
  host: variables.PGHOST,
  port: Number(variables.PGPORT),
  database: variables.PGDATABASE,
  user: variables.PGUSER,
  password: variables.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
};
const authAdmin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const cleanupOnly = process.argv.includes("--cleanup");
const previousManifest = cleanupOnly ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
assert(
  cleanupOnly || !existsSync(manifestPath),
  "A previous TASK-008 fixture manifest needs auditing before a new run.",
);
if (previousManifest) assert.equal(previousManifest.projectRef, dev.projectRef);
const runId = previousManifest?.runId ?? randomBytes(8).toString("hex");
const ids =
  previousManifest?.ids ??
  Object.fromEntries(
    [
      "centerA",
      "centerB",
      "centerInactive",
      "professionalA",
      "professionalB",
      "professionalInactive",
      "pcA",
      "pcB",
      "pcOtherCenter",
      "pcInactive",
      "specialty",
      "association",
      "person",
      "patientCenter",
      "appointment",
      "cancelledAppointment",
      "memberAdminA",
      "memberReception",
      "memberProfessional",
      "memberInactive",
      "memberAdminB",
      "memberInactiveCenter",
      "platformOnly",
    ].map((key) => [key, randomUUID()]),
  );
const owned = previousManifest?.owned ?? {
  authUsers: [],
  users: [],
  centers: [ids.centerA, ids.centerB, ids.centerInactive],
  professionals: [ids.professionalA, ids.professionalB, ids.professionalInactive],
  professionalCenters: [ids.pcA, ids.pcB, ids.pcOtherCenter, ids.pcInactive],
  memberships: [
    ids.memberAdminA,
    ids.memberReception,
    ids.memberProfessional,
    ids.memberInactive,
    ids.memberAdminB,
    ids.memberInactiveCenter,
  ],
  availabilities: [],
  appointments: [ids.appointment, ids.cancelledAppointment],
  specialties: [ids.specialty],
  persons: [ids.person],
  patientCenters: [ids.patientCenter],
};
const actors = {};
const actorCredentials = {};
function saveManifest() {
  writeFileSync(
    manifestPath,
    JSON.stringify({ projectRef: dev.projectRef, runId, ids, owned }, null, 2),
    { mode: 0o600 },
  );
}
if (!cleanupOnly) saveManifest();

async function connect(name) {
  const client = new pg.Client({ ...config, application_name: `task008-${runId}-${name}` });
  await client.connect();
  await client.query("set role postgres");
  return client;
}
async function asUser(client, userId, action) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = await action(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
async function expectSqlState(action, code, token) {
  await assert.rejects(
    action,
    (error) => error?.code === code && (!token || error?.message === token),
  );
}
async function createActor(name) {
  const email = `task008-${runId}-${name.toLowerCase()}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Could not create ${name} Auth fixture.`);
  actors[name] = data.user.id;
  actorCredentials[name] = { email, password };
  owned.authUsers.push(data.user.id);
  owned.users.push(data.user.id);
  saveManifest();
}
function createInterval(client, actor, centerId, pcId, weekday, start, end) {
  return asUser(client, actor, (db) =>
    db.query(
      "select * from public.staff_create_availability($1,$2,$3::smallint,$4::time,$5::time)",
      [centerId, pcId, weekday, start, end],
    ),
  );
}
function updateInterval(client, actor, centerId, pcId, row, start, end) {
  return asUser(client, actor, (db) =>
    db.query(
      "select * from public.staff_update_availability($1,$2,$3,$4::timestamptz,$5::time,$6::time)",
      [centerId, pcId, row.availability_id, row.updated_at, start, end],
    ),
  );
}
function deactivateInterval(client, actor, centerId, pcId, row) {
  return asUser(client, actor, (db) =>
    db.query("select * from public.staff_deactivate_availability($1,$2,$3,$4::timestamptz)", [
      centerId,
      pcId,
      row.availability_id,
      row.updated_at,
    ]),
  );
}
function duration(client, actor, centerId, pcId, token, minutes) {
  return asUser(client, actor, (db) =>
    db.query(
      "select * from public.staff_update_usual_appointment_duration($1,$2,$3::timestamptz,$4)",
      [centerId, pcId, token, minutes],
    ),
  );
}
function ownAvailability(result) {
  const row = result.rows[0];
  assert(row?.availability_id, "RPC did not return an availability ID.");
  owned.availabilities.push(row.availability_id);
  saveManifest();
  return row;
}

async function setup(control) {
  for (const name of [
    "adminA",
    "reception",
    "professional",
    "inactiveMember",
    "adminB",
    "platformOnly",
  ])
    await createActor(name);
  for (const [name, userId] of Object.entries(actors)) {
    await control.query(
      "insert into public.users(id,email,first_name,last_name) values($1,$2,'TASK008','Fixture')",
      [userId, `task008-${runId}-${name.toLowerCase()}@example.test`],
    );
  }
  await control.query("insert into public.platform_admins(user_id) values($1)", [
    actors.platformOnly,
  ]);
  await control.query(
    "insert into public.centers(id,name,timezone,is_active) values($1,$2,'America/Argentina/Buenos_Aires',true),($3,$4,'America/Argentina/Buenos_Aires',true),($5,$6,'America/Argentina/Buenos_Aires',false)",
    [
      ids.centerA,
      `TASK008 A ${runId}`,
      ids.centerB,
      `TASK008 B ${runId}`,
      ids.centerInactive,
      `TASK008 inactive ${runId}`,
    ],
  );
  for (const [index, professionalId] of [
    ids.professionalA,
    ids.professionalB,
    ids.professionalInactive,
  ].entries()) {
    await control.query(
      "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'TASK008',$2,'AR',$3,$4)",
      [
        professionalId,
        `Professional${index}`,
        `T008-${runId}-${index}`,
        `task008-${runId}-p${index}@example.test`,
      ],
    );
  }
  for (const [pcId, professionalId, centerId, active] of [
    [ids.pcA, ids.professionalA, ids.centerA, true],
    [ids.pcB, ids.professionalB, ids.centerA, true],
    [ids.pcOtherCenter, ids.professionalA, ids.centerB, true],
    [ids.pcInactive, ids.professionalInactive, ids.centerA, false],
  ])
    await control.query(
      "insert into public.professional_centers(id,professional_id,center_id,is_active) values($1,$2,$3,$4)",
      [pcId, professionalId, centerId, active],
    );
  const memberships = [
    [ids.memberAdminA, ids.centerA, actors.adminA, "ADMIN", null, true],
    [ids.memberReception, ids.centerA, actors.reception, "RECEPTION", null, true],
    [ids.memberProfessional, ids.centerA, actors.professional, "PROFESSIONAL", ids.pcA, true],
    [ids.memberInactive, ids.centerA, actors.inactiveMember, "ADMIN", null, false],
    [ids.memberAdminB, ids.centerB, actors.adminB, "ADMIN", null, true],
    [ids.memberInactiveCenter, ids.centerInactive, actors.adminB, "ADMIN", null, true],
  ];
  for (const row of memberships)
    await control.query(
      "insert into public.center_memberships(id,center_id,user_id,role,professional_center_id,is_active) values($1,$2,$3,$4,$5,$6)",
      row,
    );
}

async function catalogChecks(control) {
  const result = await control.query(`select
    (select relrowsecurity from pg_class where oid='public.availabilities'::regclass) as rls,
    has_table_privilege('authenticated','public.availabilities','SELECT') as can_read,
    has_table_privilege('authenticated','public.availabilities','INSERT,UPDATE,DELETE') as can_write,
    has_table_privilege('anon','public.availabilities','SELECT,INSERT,UPDATE,DELETE') as anon_access,
    (select count(*)::integer from pg_policies where schemaname='public' and tablename='availabilities' and policyname='availabilities_select_active_tenant' and cmd='SELECT' and roles=array['authenticated']::name[]) as policy_count,
    (select tgfoid='private.set_task006_cas_updated_at()'::regprocedure from pg_trigger where tgrelid='public.availabilities'::regclass and tgname='availabilities_set_updated_at') as monotonic_trigger`);
  assert.deepEqual(result.rows[0], {
    rls: true,
    can_read: true,
    can_write: false,
    anon_access: false,
    policy_count: 1,
    monotonic_trigger: true,
  });
  for (const signature of [
    "staff_list_availability_professional_centers(uuid)",
    "staff_create_availability(uuid,uuid,smallint,time,time)",
    "staff_update_availability(uuid,uuid,uuid,timestamptz,time,time)",
    "staff_deactivate_availability(uuid,uuid,uuid,timestamptz)",
    "staff_update_usual_appointment_duration(uuid,uuid,timestamptz,integer)",
  ]) {
    const { rows } = await control.query(
      `select prosecdef, proconfig @> array['search_path=""']::text[] as safe_path, has_function_privilege('authenticated',$1,'EXECUTE') as authenticated, has_function_privilege('anon',$1,'EXECUTE') as anon from pg_proc where oid=$1::regprocedure`,
      [`public.${signature}`],
    );
    assert.deepEqual(
      rows[0],
      { prosecdef: true, safe_path: true, authenticated: true, anon: false },
      signature,
    );
  }
  const privateHelper = await control.query(
    "select has_function_privilege('authenticated','private.has_future_appointments_outside_availability(uuid,uuid)','EXECUTE') as authenticated, has_function_privilege('anon','private.has_future_appointments_outside_availability(uuid,uuid)','EXECUTE') as anon",
  );
  assert.deepEqual(privateHelper.rows[0], { authenticated: false, anon: false });
}

async function roleAndIntervalChecks(control) {
  const list = (actor, centerId) =>
    asUser(control, actor, (db) =>
      db.query("select * from public.staff_list_availability_professional_centers($1)", [centerId]),
    );
  assert.equal((await list(actors.adminA, ids.centerA)).rows.length, 2);
  assert.equal((await list(actors.reception, ids.centerA)).rows.length, 2);
  assert.deepEqual(
    (await list(actors.professional, ids.centerA)).rows.map((row) => row.professional_center_id),
    [ids.pcA],
  );
  await expectSqlState(
    () => list(actors.platformOnly, ids.centerA),
    "42501",
    "AVAILABILITY_ACCESS_DENIED",
  );
  await expectSqlState(
    () => list(actors.inactiveMember, ids.centerA),
    "42501",
    "AVAILABILITY_ACCESS_DENIED",
  );
  await expectSqlState(
    () => list(actors.adminB, ids.centerInactive),
    "42501",
    "AVAILABILITY_ACCESS_DENIED",
  );
  const monday = ownAvailability(
    await createInterval(control, actors.adminA, ids.centerA, ids.pcA, 1, "09:00", "13:00"),
  );
  assert.equal(monday.has_future_outside_availability, false);
  const adjacent = ownAvailability(
    await createInterval(control, actors.reception, ids.centerA, ids.pcA, 1, "13:00", "17:00"),
  );
  ownAvailability(
    await createInterval(control, actors.adminA, ids.centerA, ids.pcA, 2, "09:00", "13:00"),
  );
  ownAvailability(
    await createInterval(control, actors.reception, ids.centerA, ids.pcB, 1, "09:00", "13:00"),
  );
  ownAvailability(
    await createInterval(
      control,
      actors.adminB,
      ids.centerB,
      ids.pcOtherCenter,
      1,
      "09:00",
      "13:00",
    ),
  );
  await expectSqlState(
    () => createInterval(control, actors.adminA, ids.centerA, ids.pcA, 1, "12:00", "14:00"),
    "23P01",
  );
  await expectSqlState(
    () => createInterval(control, actors.adminA, ids.centerA, ids.pcA, 1, "13:00", "13:00"),
    "22023",
    "INVALID_AVAILABILITY_INTERVAL",
  );
  await expectSqlState(
    () => createInterval(control, actors.professional, ids.centerA, ids.pcA, 3, "09:00", "13:00"),
    "42501",
    "AVAILABILITY_MUTATION_DENIED",
  );
  await expectSqlState(
    () =>
      createInterval(control, actors.adminA, ids.centerA, ids.pcOtherCenter, 3, "09:00", "13:00"),
    "P0002",
    "RESOURCE_NOT_FOUND",
  );
  await expectSqlState(
    () =>
      createInterval(control, actors.adminA, ids.centerB, ids.pcOtherCenter, 3, "09:00", "13:00"),
    "42501",
    "AVAILABILITY_MUTATION_DENIED",
  );
  await expectSqlState(
    () => createInterval(control, actors.inactiveMember, ids.centerA, ids.pcA, 3, "09:00", "13:00"),
    "42501",
    "AVAILABILITY_MUTATION_DENIED",
  );
  await expectSqlState(
    () => createInterval(control, actors.adminA, ids.centerA, ids.pcInactive, 3, "09:00", "13:00"),
    "P0002",
    "RESOURCE_NOT_FOUND",
  );
  await expectSqlState(
    () => createInterval(control, actors.adminB, ids.centerInactive, ids.pcA, 3, "09:00", "13:00"),
    "42501",
    "AVAILABILITY_MUTATION_DENIED",
  );
  const read = (actor, centerId) =>
    asUser(control, actor, (db) =>
      db.query("select id from public.availabilities where center_id=$1 order by id", [centerId]),
    );
  assert.equal((await read(actors.adminA, ids.centerA)).rows.length, 4);
  assert.equal((await read(actors.reception, ids.centerA)).rows.length, 4);
  assert.equal((await read(actors.professional, ids.centerA)).rows.length, 3);
  assert.equal((await read(actors.professional, ids.centerB)).rows.length, 0);
  assert.equal((await read(actors.platformOnly, ids.centerA)).rows.length, 0);
  await expectSqlState(
    () =>
      asUser(control, actors.adminA, (db) =>
        db.query(
          "insert into public.availabilities(center_id,professional_center_id,weekday,start_time,end_time) values($1,$2,5,'09:00','13:00')",
          [ids.centerA, ids.pcA],
        ),
      ),
    "42501",
  );
  const edited = (
    await updateInterval(
      control,
      actors.reception,
      ids.centerA,
      ids.pcA,
      adjacent,
      "14:00",
      "17:00",
    )
  ).rows[0];
  assert.equal(
    (
      await control.query("select $1::timestamptz > $2::timestamptz as advanced", [
        edited.updated_at,
        adjacent.updated_at,
      ])
    ).rows[0].advanced,
    true,
  );
  await expectSqlState(
    () => updateInterval(control, actors.adminA, ids.centerA, ids.pcA, adjacent, "15:00", "17:00"),
    "P0001",
    "STALE_AVAILABILITY_STATE",
  );
  await expectSqlState(
    () => deactivateInterval(control, actors.adminA, ids.centerA, ids.pcA, adjacent),
    "P0001",
    "STALE_AVAILABILITY_STATE",
  );
  const removed = (
    await deactivateInterval(control, actors.reception, ids.centerA, ids.pcA, monday)
  ).rows[0];
  assert.equal(removed.is_active, false);
  assert.equal((await read(actors.adminA, ids.centerA)).rows.length, 3);
  ownAvailability(
    await createInterval(control, actors.adminA, ids.centerA, ids.pcA, 1, "09:00", "13:00"),
  );
  const currentPc = await control.query(
    "select updated_at from public.professional_centers where id=$1",
    [ids.pcA],
  );
  const first = (
    await duration(control, actors.adminA, ids.centerA, ids.pcA, currentPc.rows[0].updated_at, 5)
  ).rows[0];
  const second = (
    await duration(control, actors.reception, ids.centerA, ids.pcA, first.updated_at, 480)
  ).rows[0];
  assert.equal(second.usual_appointment_duration_minutes, 480);
  assert.equal(
    (
      await control.query("select $1::timestamptz > $2::timestamptz as advanced", [
        second.updated_at,
        first.updated_at,
      ])
    ).rows[0].advanced,
    true,
  );
  await expectSqlState(
    () => duration(control, actors.adminA, ids.centerA, ids.pcA, first.updated_at, 30),
    "P0001",
    "STALE_PROFESSIONAL_CENTER_STATE",
  );
  for (const invalid of [4, 481, 11])
    await expectSqlState(
      () => duration(control, actors.adminA, ids.centerA, ids.pcA, second.updated_at, invalid),
      "22023",
      "INVALID_APPOINTMENT_DURATION",
    );
  await expectSqlState(
    () => duration(control, actors.professional, ids.centerA, ids.pcA, second.updated_at, 30),
    "42501",
    "AVAILABILITY_MUTATION_DENIED",
  );
  return { list, read };
}

async function warningChecks(control) {
  await control.query(
    "insert into public.specialties(id,center_id,name) values($1,$2,'TASK008 Test')",
    [ids.specialty, ids.centerA],
  );
  await control.query(
    "insert into public.professional_center_specialties(professional_center_id,specialty_id,center_id) values($1,$2,$3)",
    [ids.pcB, ids.specialty, ids.centerA],
  );
  await control.query(
    "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'TASK008','Patient','1990-01-01','AR',$2)",
    [ids.person, `T008-P-${runId}`],
  );
  await control.query(
    "insert into public.patient_centers(id,person_id,center_id,phone) values($1,$2,$3,'123456')",
    [ids.patientCenter, ids.person, ids.centerA],
  );
  const when = await control.query(
    "select ((date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') + interval '7 days 19 hours 30 minutes') at time zone 'America/Argentina/Buenos_Aires') as starts_at, extract(isodow from (now() at time zone 'America/Argentina/Buenos_Aires') + interval '7 days')::integer as weekday",
  );
  const { starts_at: startsAt, weekday } = when.rows[0];
  const inside = ownAvailability(
    await createInterval(control, actors.adminA, ids.centerA, ids.pcB, weekday, "19:00", "20:00"),
  );
  await control.query(
    "insert into public.appointments(id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status) values($1,$2,$3,$4,$5,$6,$6::timestamptz + interval '30 minutes','PENDING'),($7,$2,$3,$4,$5,$6::timestamptz + interval '2 hours',$6::timestamptz + interval '2 hours 30 minutes','CANCELLED')",
    [
      ids.appointment,
      ids.centerA,
      ids.patientCenter,
      ids.pcB,
      ids.specialty,
      startsAt,
      ids.cancelledAppointment,
    ],
  );
  const before = await control.query(
    "select starts_at,ends_at,status from public.appointments where id=$1",
    [ids.appointment],
  );
  const same = (
    await updateInterval(control, actors.adminA, ids.centerA, ids.pcB, inside, "19:00", "20:00")
  ).rows[0];
  assert.equal(same.has_future_outside_availability, false);
  assert.equal(same.updated_at, inside.updated_at);
  const outside = (
    await updateInterval(control, actors.reception, ids.centerA, ids.pcB, inside, "20:00", "21:00")
  ).rows[0];
  assert.equal(outside.has_future_outside_availability, true);
  const after = await control.query(
    "select starts_at,ends_at,status from public.appointments where id=$1",
    [ids.appointment],
  );
  assert.deepEqual(after.rows, before.rows, "Availability RPC changed an appointment.");
}

async function concurrencyCheck(control) {
  const first = await connect("race-first");
  const second = await connect("race-second");
  try {
    await first.query("begin");
    await first.query("set local role authenticated");
    await first.query("select set_config('request.jwt.claim.sub',$1,true)", [actors.adminA]);
    const firstRow = (
      await first.query(
        "select * from public.staff_create_availability($1,$2,3::smallint,'10:00'::time,'12:00'::time)",
        [ids.centerA, ids.pcA],
      )
    ).rows[0];
    owned.availabilities.push(firstRow.availability_id);
    saveManifest();
    await second.query("begin");
    await second.query("set local role authenticated");
    await second.query("select set_config('request.jwt.claim.sub',$1,true)", [actors.reception]);
    const secondPid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
    const pending = second
      .query(
        "select * from public.staff_create_availability($1,$2,3::smallint,'11:00'::time,'13:00'::time)",
        [ids.centerA, ids.pcA],
      )
      .then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
    let observed = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const { rows } = await control.query(
        "select wait_event_type from pg_stat_activity where pid=$1",
        [secondPid],
      );
      if (rows[0]?.wait_event_type === "Lock") {
        observed = true;
        break;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
    }
    assert(observed, "Concurrent GiST wait was not observed.");
    await first.query("commit");
    const result = await pending;
    assert.equal(result.error?.code, "23P01", "Concurrent overlap must fail under GiST.");
    await second.query("rollback");
  } finally {
    await first.query("rollback").catch(() => undefined);
    await second.query("rollback").catch(() => undefined);
    await first.end();
    await second.end();
  }
}

async function waitForLock(control, pid, label) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const { rows } = await control.query(
      "select wait_event_type from pg_stat_activity where pid=$1",
      [pid],
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  throw new Error(`${label} did not reach an observable lock wait.`);
}

async function beginActor(client, actorId) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actorId]);
}

async function staleConcurrentCheck(control) {
  const target = (
    await control.query(
      "select id,updated_at from public.availabilities where professional_center_id=$1 and weekday=1 and start_time='14:00' and is_active",
      [ids.pcA],
    )
  ).rows[0];
  assert(target, "Expected a fixture availability for concurrent stale check.");
  const first = await connect("stale-first");
  const second = await connect("stale-second");
  try {
    await beginActor(first, actors.adminA);
    await first.query(
      "select * from public.staff_update_availability($1,$2,$3,$4::timestamptz,'14:00'::time,'18:00'::time)",
      [ids.centerA, ids.pcA, target.id, target.updated_at],
    );
    await beginActor(second, actors.reception);
    const pid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
    const pending = second
      .query(
        "select * from public.staff_update_availability($1,$2,$3,$4::timestamptz,'14:00'::time,'19:00'::time)",
        [ids.centerA, ids.pcA, target.id, target.updated_at],
      )
      .then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
    await waitForLock(control, pid, "Concurrent Availability update");
    await first.query("commit");
    const result = await pending;
    assert.equal(result.error?.code, "P0001");
    assert.equal(result.error?.message, "STALE_AVAILABILITY_STATE");
  } finally {
    await first.query("rollback").catch(() => undefined);
    await second.query("rollback").catch(() => undefined);
    await first.end();
    await second.end();
  }
}

async function professionalCenterDeactivationRace(control) {
  const token = (
    await control.query("select updated_at from public.professional_centers where id=$1", [ids.pcB])
  ).rows[0].updated_at;
  const first = await connect("deactivate-first");
  const second = await connect("create-after-deactivate");
  try {
    await beginActor(first, actors.adminA);
    await first.query(
      "select * from public.admin_set_professional_center_active($1,$2,$3::timestamptz,false)",
      [ids.centerA, ids.pcB, token],
    );
    await beginActor(second, actors.reception);
    const pid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
    const pending = second
      .query(
        "select * from public.staff_create_availability($1,$2,6::smallint,'09:00'::time,'10:00'::time)",
        [ids.centerA, ids.pcB],
      )
      .then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
    await waitForLock(control, pid, "ProfessionalCenter deactivation versus create");
    await first.query("commit");
    const result = await pending;
    assert.equal(result.error?.code, "P0002");
    assert.equal(result.error?.message, "RESOURCE_NOT_FOUND");
  } finally {
    await first.query("rollback").catch(() => undefined);
    await second.query("rollback").catch(() => undefined);
    await first.end();
    await second.end();
  }
}

async function uiChecks() {
  const root = resolve(".");
  const temporary = mkdtempSync(join(tmpdir(), "task008-ui-"));
  const relativeToTemp = relative(resolve(tmpdir()), temporary);
  assert(
    relativeToTemp && !relativeToTemp.startsWith("..") && !relativeToTemp.includes(`..${sep}`),
  );
  const modulesLink = join(temporary, "node_modules");
  let server;
  let browser;
  try {
    for (const name of [
      "src",
      "public",
      "package.json",
      "next.config.ts",
      "postcss.config.mjs",
      "tsconfig.json",
      "next-env.d.ts",
      "vitest.setup.ts",
    ]) {
      cpSync(join(root, name), join(temporary, name), { recursive: true });
    }
    symlinkSync(join(root, "node_modules"), modulesLink, "junction");
    const build = spawn(
      process.execPath,
      [join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
      {
        cwd: temporary,
        env: { ...process.env, DO_NOT_TRACK: "1", NEXT_TELEMETRY_DISABLED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let buildDiagnostic = "";
    for (const stream of [build.stdout, build.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        buildDiagnostic = (buildDiagnostic + chunk).slice(-4000);
      });
    }
    const buildExit = await new Promise((resolveExit, rejectExit) => {
      build.once("error", rejectExit);
      build.once("exit", resolveExit);
    });
    assert.equal(buildExit, 0, `Isolated production UI build failed: ${buildDiagnostic}`);
    const port = 31008;
    const base = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)],
      {
        cwd: temporary,
        env: { ...process.env, DO_NOT_TRACK: "1", NEXT_TELEMETRY_DISABLED: "1" },
        stdio: "ignore",
        windowsHide: true,
      },
    );
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      assert(server.exitCode === null, "Isolated UI server exited early.");
      try {
        const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) break;
      } catch {
        /* Server is still starting. */
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
    }
    assert((await fetch(`${base}/login`)).ok, "Isolated UI server did not become ready.");
    browser = await chromium.launch({ headless: true });
    async function login(name, viewport) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(`${base}/login`);
      await page.getByLabel("Email").fill(actorCredentials[name].email);
      await page.getByLabel("Contraseña", { exact: true }).fill(actorCredentials[name].password);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await expect(page).not.toHaveURL(/\/login$/, { timeout: 60_000 });
      return { context, page };
    }
    const detail = `${base}/centers/${ids.centerA}/professionals/${ids.pcA}/availability`;
    const admin = await login("adminA", { width: 1280, height: 800 });
    const clientErrors = [];
    admin.page.on("pageerror", (error) => clientErrors.push(error.message));
    admin.page.on("console", (message) => {
      if (message.type() === "error") clientErrors.push(message.text());
    });
    try {
      await admin.page.goto(`${base}/centers/${ids.centerA}`);
      await admin.page
        .getByRole("navigation", { name: "Navegación del centro" })
        .getByRole("link", { name: "Disponibilidad" })
        .click();
      await expect(admin.page).toHaveURL(new RegExp(`/centers/${ids.centerA}/availability$`));
      await expect(
        admin.page
          .getByRole("region", { name: "Profesionales con disponibilidad" })
          .getByRole("link", { name: "Ver disponibilidad" }),
      ).toHaveCount(2);
      await admin.page.goto(detail);
      await expect(admin.page.getByRole("heading", { name: "Disponibilidad" })).toBeVisible();
      await expect(admin.page.getByRole("heading", { level: 2 })).toHaveCount(8);
      await expect(admin.page.getByText("America/Argentina/Buenos_Aires")).toBeVisible();
      await admin.page.waitForLoadState("networkidle");
      const sunday = admin.page.getByRole("region", { name: "Domingo" });
      await sunday.getByRole("button", { name: /Agregar horario/ }).click();
      try {
        await expect(sunday.getByLabel("Hora desde")).toBeFocused();
      } catch (error) {
        const reactKeys = await sunday
          .getByRole("button", { name: /Agregar horario/ })
          .evaluate((node) => Object.keys(node).filter((key) => key.startsWith("__react")));
        throw new Error(
          `Availability editor did not open; React keys: ${reactKeys.join(",")}; browser errors: ${clientErrors.join(" | ")}`,
          { cause: error },
        );
      }
      await sunday.getByLabel("Hora desde").fill("10:00");
      await sunday.getByLabel("Hora hasta").fill("11:00");
      await sunday.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(sunday.getByText("10:00–11:00")).toBeVisible();
      await sunday.getByRole("button", { name: "Editar" }).click();
      await sunday.getByLabel("Hora desde").fill("10:30");
      await sunday.getByLabel("Hora hasta").fill("11:30");
      await sunday.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(sunday.getByText("10:30–11:30")).toBeVisible();
      admin.page.once("dialog", (dialog) => dialog.accept());
      await sunday.getByRole("button", { name: "Quitar horario" }).click();
      await expect(sunday.getByText("Sin disponibilidad")).toBeVisible();
      await admin.page.getByLabel("Minutos").fill("25");
      await admin.page.getByRole("button", { name: "Guardar duración" }).click();
      await expect(admin.page.getByRole("status")).toContainText("Duración habitual actualizada");
      await admin.page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        "390px viewport has horizontal overflow.",
      );
    } finally {
      await admin.context.close();
    }
    const reception = await login("reception", { width: 390, height: 844 });
    try {
      await reception.page.goto(detail);
      await expect(reception.page.getByRole("button", { name: /Agregar horario/ })).toHaveCount(7);
      assert.equal(
        await reception.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    } finally {
      await reception.context.close();
    }
    const professional = await login("professional", { width: 390, height: 844 });
    try {
      await professional.page.goto(`${base}/centers/${ids.centerA}/availability`);
      await expect(professional.page).toHaveURL(detail);
      await expect(
        professional.page.getByRole("heading", { name: "Disponibilidad" }),
      ).toBeVisible();
      await expect(
        professional.page.getByRole("button", {
          name: /Agregar horario|Editar|Quitar horario|Guardar duración/,
        }),
      ).toHaveCount(0);
      await professional.page.goto(
        `${base}/centers/${ids.centerA}/professionals/${ids.pcB}/availability`,
      );
      await expect(professional.page.getByRole("heading", { name: "Disponibilidad" })).toHaveCount(
        0,
      );
    } finally {
      await professional.context.close();
    }
    const platform = await login("platformOnly", { width: 1280, height: 800 });
    try {
      await platform.page.goto(`${base}/centers/${ids.centerA}/availability`);
      await expect(platform.page.getByRole("heading", { name: "Disponibilidad" })).toHaveCount(0);
    } finally {
      await platform.context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server) {
      server.kill();
      await Promise.race([
        new Promise((resolveExit) => server.once("exit", resolveExit)),
        new Promise((resolveDelay) => setTimeout(resolveDelay, 5000)),
      ]);
    }
    if (existsSync(modulesLink)) unlinkSync(modulesLink);
    rmSync(temporary, { recursive: true, force: true });
  }
}

const inventoryTables = [
  "auth.users",
  "public.users",
  "public.platform_admins",
  "public.centers",
  "public.center_memberships",
  "public.professionals",
  "public.professional_centers",
  "public.availabilities",
  "public.appointments",
  "public.persons",
  "public.patient_centers",
  "public.specialties",
  "public.professional_center_specialties",
];
async function readInventory(control) {
  const snapshot = {};
  for (const table of inventoryTables) {
    const { rows } = await control.query(`select count(*)::integer as count,
      md5(coalesce(jsonb_agg(to_jsonb(record) order by to_jsonb(record)::text)::text, '[]')) as digest
      from ${table} as record`);
    snapshot[table] = rows[0];
  }
  return snapshot;
}

async function cleanup(control, baselineInventory) {
  const failures = [];
  const attempt = async (label, action) => {
    try {
      await action();
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  await attempt("capture availability owned by fixture professional centers", async () => {
    const result = await control.query(
      "select id from public.availabilities where professional_center_id=any($1::uuid[])",
      [owned.professionalCenters],
    );
    for (const row of result.rows) {
      if (!owned.availabilities.includes(row.id)) owned.availabilities.push(row.id);
    }
    saveManifest();
  });
  for (const [table, column, values] of [
    ["appointments", "id", owned.appointments],
    ["availabilities", "id", owned.availabilities],
    ["patient_centers", "id", owned.patientCenters],
    ["persons", "id", owned.persons],
  ])
    await attempt(`delete ${table}`, () =>
      control.query(`delete from public.${table} where ${column}=any($1::uuid[])`, [values]),
    );
  await attempt("delete association", () =>
    control.query(
      "delete from public.professional_center_specialties where professional_center_id=$1 and specialty_id=$2",
      [ids.pcB, ids.specialty],
    ),
  );
  for (const [table, column, values] of [
    ["specialties", "id", owned.specialties],
    ["center_memberships", "id", owned.memberships],
    ["professional_centers", "id", owned.professionalCenters],
    ["professionals", "id", owned.professionals],
    ["platform_admins", "user_id", owned.authUsers],
    ["centers", "id", owned.centers],
    ["users", "id", owned.users],
  ])
    await attempt(`delete ${table}`, () =>
      control.query(`delete from public.${table} where ${column}=any($1::uuid[])`, [values]),
    );
  for (const id of owned.authUsers)
    await attempt(`delete Auth user ${id}`, async () => {
      const { error } = await authAdmin.auth.admin.deleteUser(id);
      if (error) throw error;
    });
  if (failures.length)
    throw new AggregateError(failures, "TASK-008 exact cleanup failed; manifest retained.");
  const tables = [
    ["auth.users", "id", owned.authUsers],
    ["public.users", "id", owned.users],
    ["public.centers", "id", owned.centers],
    ["public.center_memberships", "id", owned.memberships],
    ["public.professionals", "id", owned.professionals],
    ["public.professional_centers", "id", owned.professionalCenters],
    ["public.availabilities", "id", owned.availabilities],
    ["public.appointments", "id", owned.appointments],
    ["public.persons", "id", owned.persons],
    ["public.patient_centers", "id", owned.patientCenters],
    ["public.specialties", "id", owned.specialties],
    ["public.platform_admins", "user_id", owned.authUsers],
  ];
  for (const [table, column, values] of tables) {
    const count = await control.query(
      `select count(*)::integer as count from ${table} where ${column}=any($1::uuid[])`,
      [values],
    );
    assert.equal(count.rows[0].count, 0, `Fixture residue in ${table}`);
  }
  const association = await control.query(
    "select count(*)::integer as count from public.professional_center_specialties where professional_center_id=$1 and specialty_id=$2",
    [ids.pcB, ids.specialty],
  );
  assert.equal(association.rows[0].count, 0);
  if (baselineInventory)
    assert.deepEqual(
      await readInventory(control),
      baselineInventory,
      "DEV persistent inventory changed after TASK-008 fixture cleanup.",
    );
  unlinkSync(manifestPath);
}

let control;
let scenarioError;
let baselineInventory;
try {
  control = await connect("control");
  if (!cleanupOnly) {
    await catalogChecks(control);
    baselineInventory = await readInventory(control);
    await setup(control);
    await roleAndIntervalChecks(control);
    await warningChecks(control);
    await concurrencyCheck(control);
    if (process.argv.includes("--ui")) await uiChecks();
    await staleConcurrentCheck(control);
    await professionalCenterDeactivationRace(control);
  }
} catch (error) {
  scenarioError = error;
} finally {
  if (control) {
    try {
      await cleanup(control, baselineInventory);
    } catch (error) {
      scenarioError = scenarioError
        ? new AggregateError([scenarioError, error], "Scenario and cleanup failed.")
        : error;
    }
    await control.end();
  }
}
if (scenarioError) throw scenarioError;
console.log(
  cleanupOnly
    ? "TASK-008 DEV fixture cleanup audited."
    : `TASK-008 DEV catalog, RLS, RPC, warning, and three lock-observed races passed${process.argv.includes("--ui") ? "; production UI smoke passed" : ""}; exact cleanup and persistent inventory audited.`,
);
