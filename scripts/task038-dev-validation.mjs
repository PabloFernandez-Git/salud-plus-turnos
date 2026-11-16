// Temporary, exact-ID TASK-038 validation against the linked DEV project.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

pg.types.setTypeParser(1184, (value) => value);
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
assert.equal(dev.projectRef, "ehllxymqyzrofydrvtzo");
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
assert(secret, "Missing DEV Auth Admin credential");
const manifestPath = resolve(".harness/tasks/active/TASK-038/dev-validation-manifest.json");
const prior = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
assert(
  !prior || process.argv.includes("--cleanup") || process.argv.includes("--catalog"),
  "Previous manifest requires cleanup audit",
);
if (prior) assert.equal(prior.projectRef, dev.projectRef);
const runId = prior?.runId ?? randomBytes(8).toString("hex");
const ids =
  prior?.ids ??
  Object.fromEntries(
    [
      "centerA",
      "centerB",
      "professional",
      "pcA",
      "pcB",
      "specialtyA",
      "specialtyB",
      "person",
      "patientA",
      "patientB",
      "adminA",
      "adminB",
      "receptionA",
      "proA",
      "proB",
    ].map((key) => [key, randomUUID()]),
  );
const manifest = prior ?? {
  projectRef: dev.projectRef,
  runId,
  ids,
  authUsers: [],
  blockIds: [],
  appointmentIds: [],
  status: "prepared",
};
const save = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

function dbConfig() {
  let output;
  try {
    output = execFileSync(
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
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" },
      },
    );
  } catch {
    throw new Error("Supabase CLI could not obtain DEV database connection metadata");
  }
  const variables = Object.fromEntries(
    [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
  );
  const poolerFile = resolve("supabase/.temp/pooler-url");
  const pooler = existsSync(poolerFile) ? new URL(readFileSync(poolerFile, "utf8").trim()) : null;
  assert(
    variables.PGHOST === `db.${dev.projectRef}.supabase.co` ||
      (pooler &&
        variables.PGHOST === pooler.hostname &&
        variables.PGUSER?.endsWith(`.${dev.projectRef}`)),
    "Database connection does not target approved DEV",
  );
  assert(variables.PGPASSWORD && variables.PGUSER && variables.PGDATABASE && variables.PGPORT);
  return {
    host: variables.PGHOST,
    port: Number(variables.PGPORT),
    database: variables.PGDATABASE,
    user: variables.PGUSER,
    password: variables.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  };
}

const db = new pg.Client(dbConfig());
const authAdmin = createClient(dev.url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const passwords = new Map();
async function actor(name) {
  const user = manifest.authUsers.find((item) => item.name === name);
  assert(user, `Missing actor ${name}`);
  const client = createClient(dev.url, dev.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: passwords.get(name),
  });
  if (error) throw new Error(`Login failed: ${name}: ${error.code ?? error.message}`);
  return client;
}
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.code} ${error.message}`);
  return data;
}
async function denied(client, name, args, code) {
  const { error } = await client.rpc(name, args);
  assert(error, `${name} unexpectedly succeeded`);
  assert.equal(error.code, code, `${name}: ${error.message}`);
}
async function query(sql, params = []) {
  return (await db.query(sql, params)).rows;
}
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const dates = Array.from({ length: 12 }, (_, index) => day(40 + index));
const args = (center, pc, start, end, reason = "VACATION", expected = 0, confirm = false) => ({
  p_center_id: center,
  p_professional_center_id: pc,
  p_start_date: start,
  p_end_date: end,
  p_reason: reason,
  p_expected_affected_count: expected,
  p_confirm_affected: confirm,
});
const listArgs = (center, pc = null, from = null, to = null) => ({
  p_center_id: center,
  p_professional_center_id: pc,
  p_from_date: from,
  p_to_date: to,
});

async function catalog() {
  const rows = await query(`select c.relname, c.relrowsecurity,
    has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
    has_table_privilege('authenticated', c.oid, 'INSERT') as auth_insert,
    has_table_privilege('authenticated', c.oid, 'UPDATE') as auth_update,
    has_table_privilege('anon', c.oid, 'SELECT') as anon_select
    from pg_class c where c.oid = 'public.availability_blocks'::regclass`);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    relname: "availability_blocks",
    relrowsecurity: true,
    auth_select: true,
    auth_insert: false,
    auth_update: false,
    anon_select: false,
  });
  const constraints = await query(`select conname, pg_get_constraintdef(oid) as definition
    from pg_constraint where conrelid = 'public.availability_blocks'::regclass`);
  for (const name of [
    "availability_blocks_dates_check",
    "availability_blocks_reason_check",
    "availability_blocks_no_active_overlap",
    "availability_blocks_professional_center_fk",
  ])
    assert(
      constraints.some((row) => row.conname === name),
      `Missing ${name}`,
    );
  assert.match(
    constraints.find((row) => row.conname === "availability_blocks_dates_check").definition,
    /isfinite\(start_date\).*isfinite\(end_date\)/,
  );
  assert(
    /WHERE \(is_active\)/i.test(
      constraints.find((row) => row.conname === "availability_blocks_no_active_overlap").definition,
    ),
    "Active-only exclusion constraint",
  );
  const indexes = await query(
    `select indexname, indexdef from pg_indexes where schemaname='public' and tablename='availability_blocks'`,
  );
  assert(
    indexes.some(
      (row) =>
        row.indexname === "availability_blocks_center_dates_idx" &&
        /WHERE is_active/i.test(row.indexdef),
    ),
    "Active-only date index",
  );
  const policies = await query(
    `select policyname, cmd, roles, qual from pg_policies where schemaname='public' and tablename='availability_blocks'`,
  );
  assert.equal(policies.length, 1);
  assert.equal(policies[0].policyname, "availability_blocks_select_active_tenant");
  assert.equal(policies[0].cmd, "SELECT");
  assert.equal(policies[0].roles, "{authenticated}");
  assert(
    /is_active/.test(policies[0].qual) && /can_view_active_availability/.test(policies[0].qual),
    "Tenant SELECT policy",
  );
  const functions = await query(
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args,
    p.prosecdef, p.provolatile, pg_get_functiondef(p.oid) as definition,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname = any($1)`,
    [
      [
        "staff_list_availability_blocks",
        "staff_preview_availability_block",
        "staff_create_availability_block",
        "staff_deactivate_availability_block",
      ],
    ],
  );
  assert.equal(functions.length, 4);
  for (const fn of functions) {
    assert(fn.prosecdef && fn.auth_execute && !fn.anon_execute, `Grants/security of ${fn.proname}`);
    assert(/set search_path (?:to|=) ''/i.test(fn.definition), `Search path of ${fn.proname}`);
  }
  for (const name of ["staff_preview_availability_block", "staff_create_availability_block"])
    assert(
      /isfinite\(p_start_date\).*isfinite\(p_end_date\)/s.test(
        functions.find((fn) => fn.proname === name).definition,
      ),
      `Finite date validation of ${name}`,
    );
  const expectedArgs = {
    staff_list_availability_blocks:
      "p_center_id uuid, p_professional_center_id uuid, p_from_date date, p_to_date date",
    staff_preview_availability_block:
      "p_center_id uuid, p_professional_center_id uuid, p_start_date date, p_end_date date",
    staff_create_availability_block:
      "p_center_id uuid, p_professional_center_id uuid, p_start_date date, p_end_date date, p_reason text, p_expected_affected_count integer, p_confirm_affected boolean",
    staff_deactivate_availability_block:
      "p_center_id uuid, p_professional_center_id uuid, p_block_id uuid, p_expected_updated_at timestamp with time zone",
  };
  for (const fn of functions) assert.equal(fn.args, expectedArgs[fn.proname]);
  console.log(
    "CATALOG PASS: table, constraints, index, RLS, grants and four RPC signatures on DEV",
  );
}

async function setup() {
  save();
  const password = `Task038-${randomBytes(20).toString("base64url")}`;
  for (const name of ["adminA", "adminB", "receptionA", "proA", "proB"]) {
    const email = `task038-${runId}-${name.toLowerCase()}@example.test`;
    const { data, error } = await authAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error(`Auth fixture ${name}: ${error?.code ?? error?.message}`);
    manifest.authUsers.push({ name, id: data.user.id, email });
    passwords.set(name, password);
    save();
  }
  await db.query("begin");
  try {
    for (const user of manifest.authUsers) {
      await query(
        "insert into public.users (id,email,first_name,last_name) values ($1,$2,'Task038','Synthetic')",
        [user.id, user.email],
      );
    }
    await query(
      "insert into public.centers (id,name,timezone) values ($1,$2,'America/Argentina/Buenos_Aires'),($3,$4,'Pacific/Auckland')",
      [ids.centerA, `TASK038-${runId}-A`, ids.centerB, `TASK038-${runId}-B`],
    );
    await query(
      "insert into public.professionals (id,first_name,last_name,nationality_code,document_number,email) values ($1,'Task038','Professional','AR',$2,$3)",
      [ids.professional, `TASK038-${runId}`, `task038-${runId}-professional@example.test`],
    );
    await query(
      "insert into public.professional_centers (id,professional_id,center_id) values ($1,$3,$4),($2,$3,$5)",
      [ids.pcA, ids.pcB, ids.professional, ids.centerA, ids.centerB],
    );
    await query(
      "insert into public.specialties (id,center_id,name) values ($1,$3,'Task038 General'),($2,$4,'Task038 General')",
      [ids.specialtyA, ids.specialtyB, ids.centerA, ids.centerB],
    );
    await query(
      "insert into public.professional_center_specialties (professional_center_id,specialty_id,center_id) values ($1,$3,$5),($2,$4,$6)",
      [ids.pcA, ids.pcB, ids.specialtyA, ids.specialtyB, ids.centerA, ids.centerB],
    );
    await query(
      "insert into public.persons (id,first_name,last_name,birth_date,nationality_code,document_number) values ($1,'Task038','Patient','1990-01-01','AR',$2)",
      [ids.person, `P-${runId}`],
    );
    await query(
      "insert into public.patient_centers (id,person_id,center_id,phone) values ($1,$3,$4,'123456789'),($2,$3,$5,'123456789')",
      [ids.patientA, ids.patientB, ids.person, ids.centerA, ids.centerB],
    );
    const user = (name) => manifest.authUsers.find((item) => item.name === name).id;
    await query(
      "insert into public.center_memberships (center_id,user_id,role,professional_center_id) values ($1,$2,'ADMIN',null),($3,$4,'ADMIN',null),($1,$5,'PROFESSIONAL',$7),($3,$6,'PROFESSIONAL',$8)",
      [
        ids.centerA,
        user("adminA"),
        ids.centerB,
        user("adminB"),
        user("proA"),
        user("proB"),
        ids.pcA,
        ids.pcB,
      ],
    );
    await query(
      "insert into public.center_memberships (center_id,user_id,role) values ($1,$2,'RECEPTION')",
      [ids.centerA, user("receptionA")],
    );
    for (const [center, pc] of [
      [ids.centerA, ids.pcA],
      [ids.centerB, ids.pcB],
    ])
      await query(
        "insert into public.availabilities (center_id,professional_center_id,weekday,start_time,end_time) select $1,$2,weekday,'09:00','11:00' from generate_series(1,7) as weekday",
        [center, pc],
      );
    await db.query("commit");
    manifest.status = "fixtures_created";
    save();
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

async function tests() {
  const adminA = await actor("adminA");
  const adminB = await actor("adminB");
  const reception = await actor("receptionA");
  const proA = await actor("proA");
  const proB = await actor("proB");
  const anonymous = createClient(dev.url, dev.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const slot = (client, center, pc, specialty, date) =>
    rpc(client, "staff_search_appointment_slots", {
      p_center_id: center,
      p_professional_center_id: pc,
      p_specialty_id: specialty,
      p_local_date: date,
    });
  const create = (client, center, patient, pc, specialty, date) =>
    rpc(client, "staff_create_appointment", {
      p_center_id: center,
      p_patient_center_id: patient,
      p_professional_center_id: pc,
      p_specialty_id: specialty,
      p_local_date: date,
      p_local_start_time: "09:00",
      p_administrative_note: null,
    });
  const block = async (client, input) => {
    const result = (await rpc(client, "staff_create_availability_block", input))[0];
    manifest.blockIds.push(result.block_id);
    save();
    return result;
  };
  const appointment = async (...input) => {
    const result = (await create(...input))[0];
    manifest.appointmentIds.push(result.appointment_id);
    save();
    return result;
  };
  const remove = (client, block) =>
    rpc(client, "staff_deactivate_availability_block", {
      p_center_id: ids.centerA,
      p_professional_center_id: ids.pcA,
      p_block_id: block.block_id,
      p_expected_updated_at: block.updated_at,
    });
  assert((await slot(adminA, ids.centerA, ids.pcA, ids.specialtyA, dates[0])).length > 0);
  await denied(anonymous, "staff_list_availability_blocks", listArgs(ids.centerA), "42501");
  await denied(
    proA,
    "staff_preview_availability_block",
    {
      p_center_id: ids.centerA,
      p_professional_center_id: ids.pcA,
      p_start_date: dates[0],
      p_end_date: dates[0],
    },
    "42501",
  );
  await denied(
    proA,
    "staff_create_availability_block",
    args(ids.centerA, ids.pcA, dates[0], dates[0]),
    "42501",
  );
  await denied(proA, "staff_list_availability_blocks", listArgs(ids.centerB), "42501");
  await denied(
    adminA,
    "staff_create_availability_block",
    args(ids.centerA, ids.pcB, dates[0], dates[0]),
    "P0002",
  );
  for (const invalid of ["infinity", "-infinity"]) {
    await denied(
      adminA,
      "staff_preview_availability_block",
      {
        p_center_id: ids.centerA,
        p_professional_center_id: ids.pcA,
        p_start_date: invalid,
        p_end_date: dates[0],
      },
      "22023",
    );
    await denied(
      adminA,
      "staff_create_availability_block",
      args(ids.centerA, ids.pcA, dates[0], invalid),
      "22023",
    );
  }
  const receptionBlock = await block(reception, args(ids.centerA, ids.pcA, dates[7], dates[7]));
  assert.equal(
    (await rpc(reception, "staff_list_availability_blocks", listArgs(ids.centerA, ids.pcA))).length,
    1,
  );
  await remove(reception, receptionBlock);
  const single = await block(adminA, args(ids.centerA, ids.pcA, dates[0], dates[0]));
  assert.equal((await slot(adminA, ids.centerA, ids.pcA, ids.specialtyA, dates[0])).length, 0);
  await denied(
    adminA,
    "staff_create_appointment",
    {
      p_center_id: ids.centerA,
      p_patient_center_id: ids.patientA,
      p_professional_center_id: ids.pcA,
      p_specialty_id: ids.specialtyA,
      p_local_date: dates[0],
      p_local_start_time: "09:00",
      p_administrative_note: null,
    },
    "22023",
  );
  const multi = await block(adminA, args(ids.centerA, ids.pcA, dates[2], dates[4]));
  assert.equal((await slot(adminA, ids.centerA, ids.pcA, ids.specialtyA, dates[2])).length, 0);
  assert.equal((await slot(adminA, ids.centerA, ids.pcA, ids.specialtyA, dates[4])).length, 0);
  assert((await slot(adminA, ids.centerA, ids.pcA, ids.specialtyA, dates[5])).length > 0);
  const existing = await appointment(
    adminA,
    ids.centerA,
    ids.patientA,
    ids.pcA,
    ids.specialtyA,
    dates[5],
  );
  const before = (
    await query(
      "select id,status,starts_at,ends_at,updated_at from public.appointments where id=$1",
      [existing.appointment_id],
    )
  )[0];
  assert.equal(before.status, "PENDING");
  const preview = await rpc(adminA, "staff_preview_availability_block", {
    p_center_id: ids.centerA,
    p_professional_center_id: ids.pcA,
    p_start_date: dates[5],
    p_end_date: dates[5],
  });
  assert.equal(preview, 1);
  await denied(
    adminA,
    "staff_create_availability_block",
    args(ids.centerA, ids.pcA, dates[5], dates[5], "OTHER", 1, false),
    "P0001",
  );
  const affected = await block(
    adminA,
    args(ids.centerA, ids.pcA, dates[5], dates[5], "OTHER", 1, true),
  );
  assert.equal(affected.affected_count, 1);
  const after = (
    await query(
      "select id,status,starts_at,ends_at,updated_at from public.appointments where id=$1",
      [existing.appointment_id],
    )
  )[0];
  assert.deepEqual(after, before);
  await denied(
    adminA,
    "staff_reschedule_appointment",
    {
      p_center_id: ids.centerA,
      p_appointment_id: existing.appointment_id,
      p_expected_updated_at: before.updated_at,
      p_professional_center_id: ids.pcA,
      p_specialty_id: ids.specialtyA,
      p_local_date: dates[2],
      p_local_start_time: "09:00",
    },
    "22023",
  );
  const own = await rpc(proA, "staff_list_availability_blocks", listArgs(ids.centerA));
  assert(own.length >= 3 && own.every((row) => row.professional_center_id === ids.pcA));
  await denied(
    proA,
    "staff_deactivate_availability_block",
    {
      p_center_id: ids.centerA,
      p_professional_center_id: ids.pcA,
      p_block_id: multi.block_id,
      p_expected_updated_at: multi.updated_at,
    },
    "42501",
  );
  const bBlock = await block(adminB, args(ids.centerB, ids.pcB, dates[8], dates[8]));
  const bOwn = await rpc(proB, "staff_list_availability_blocks", listArgs(ids.centerB));
  assert(bOwn.some((row) => row.block_id === bBlock.block_id));
  const cross = await proA.from("availability_blocks").select("id").eq("id", bBlock.block_id);
  if (cross.error) throw cross.error;
  assert.equal(cross.data.length, 0);
  await remove(adminA, single);
  assert((await slot(adminA, ids.centerA, ids.pcA, ids.specialtyA, dates[0])).length > 0);
  assert(
    (await rpc(adminA, "staff_list_availability_blocks", listArgs(ids.centerA, ids.pcA))).every(
      (row) => row.block_id !== single.block_id,
    ),
  );
  console.log(
    "FUNCTIONAL PASS: ADMIN, RECEPTION, PROFESSIONAL; single/multi-day, appointments, blocked booking/reschedule, restoration and center isolation",
  );
}

async function cleanup() {
  const foundAppointments = await query(
    "select id from public.appointments where patient_center_id in ($1,$2)",
    [ids.patientA, ids.patientB],
  );
  for (const row of foundAppointments)
    if (!manifest.appointmentIds.includes(row.id)) manifest.appointmentIds.push(row.id);
  const foundBlocks = await query(
    "select id from public.availability_blocks where professional_center_id in ($1,$2)",
    [ids.pcA, ids.pcB],
  );
  for (const row of foundBlocks)
    if (!manifest.blockIds.includes(row.id)) manifest.blockIds.push(row.id);
  save();
  await query("delete from public.appointments where patient_center_id in ($1,$2)", [
    ids.patientA,
    ids.patientB,
  ]);
  await query("delete from public.availability_blocks where professional_center_id in ($1,$2)", [
    ids.pcA,
    ids.pcB,
  ]);
  await query("delete from public.availabilities where professional_center_id in ($1,$2)", [
    ids.pcA,
    ids.pcB,
  ]);
  await query("delete from public.center_memberships where center_id in ($1,$2)", [
    ids.centerA,
    ids.centerB,
  ]);
  await query("delete from public.patient_centers where id in ($1,$2)", [
    ids.patientA,
    ids.patientB,
  ]);
  await query("delete from public.persons where id=$1", [ids.person]);
  await query(
    "delete from public.professional_center_specialties where professional_center_id in ($1,$2)",
    [ids.pcA, ids.pcB],
  );
  await query("delete from public.specialties where id in ($1,$2)", [
    ids.specialtyA,
    ids.specialtyB,
  ]);
  await query("delete from public.professional_centers where id in ($1,$2)", [ids.pcA, ids.pcB]);
  await query("delete from public.professionals where id=$1", [ids.professional]);
  await query("delete from public.centers where id in ($1,$2)", [ids.centerA, ids.centerB]);
  for (const user of manifest.authUsers)
    await query("delete from public.users where id=$1", [user.id]);
  for (const user of manifest.authUsers) {
    const { error } = await authAdmin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Auth cleanup ${user.name}: ${error.code ?? error.message}`);
  }
  const remaining = await query(
    `select
    (select count(*) from public.centers where id in ($1,$2)) as centers,
    (select count(*) from public.professional_centers where id in ($3,$4)) as professional_centers,
    (select count(*) from public.availability_blocks where professional_center_id in ($3,$4)) as blocks,
    (select count(*) from public.appointments where patient_center_id in ($5,$6)) as appointments,
    (select count(*) from public.users where id = any($7::uuid[])) as users`,
    [
      ids.centerA,
      ids.centerB,
      ids.pcA,
      ids.pcB,
      ids.patientA,
      ids.patientB,
      manifest.authUsers.map((u) => u.id),
    ],
  );
  assert(
    Object.values(remaining[0]).every((count) => Number(count) === 0),
    `Cleanup residues: ${JSON.stringify(remaining[0])}`,
  );
  for (const user of manifest.authUsers) {
    const { data, error } = await authAdmin.auth.admin.getUserById(user.id);
    assert(error || !data.user, `Auth user ${user.name} still exists`);
  }
  manifest.status = "cleaned_and_audited";
  save();
  console.log(
    `CLEANUP PASS: exact synthetic IDs audited; ${manifest.authUsers.length} Auth users, ${manifest.blockIds.length} blocks, ${manifest.appointmentIds.length} appointments removed`,
  );
}

async function main() {
  await db.connect();
  try {
    await db.query("set role postgres");
    await catalog();
    if (process.argv.includes("--catalog")) return;
    if (process.argv.includes("--cleanup")) {
      await cleanup();
      return;
    }
    try {
      await setup();
      await tests();
    } finally {
      await cleanup();
    }
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error("TASK038 DEV FAIL:", error.message);
  process.exitCode = 1;
});
