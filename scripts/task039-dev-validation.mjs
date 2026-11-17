// Exact-ID, synthetic-only TASK-039 validation on the approved Supabase DEV project.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { loadSupabaseDevConfig, validateLinkedSupabaseProject } from "./lib/supabase-dev-env.mjs";

const projectRef = "ehllxymqyzrofydrvtzo";
const localEnvPath = existsSync(resolve(".env.local"))
  ? resolve(".env.local")
  : resolve("../../.env.local");
const linkedRefPath = existsSync(resolve("supabase/.temp/project-ref"))
  ? resolve("supabase/.temp/project-ref")
  : resolve("../../supabase/.temp/project-ref");
const dev = loadSupabaseDevConfig(process.env, localEnvPath);
assert.equal(dev.projectRef, projectRef);
validateLinkedSupabaseProject(readFileSync(linkedRefPath, "utf8").trim());
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
assert(secret, "DEV Auth Admin credential missing");
const file = resolve(".task039-dev/manifest.json");
const mode = process.argv[2];
assert(["setup", "test", "cleanup"].includes(mode), "Expected setup, test or cleanup");
const authAdmin = createClient(dev.url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const cli = resolve("node_modules/supabase/dist/supabase.js");
const output = execFileSync(
  process.execPath,
  [cli, "db", "dump", "--linked", "--project-ref", projectRef, "--dry-run", "--schema", "public"],
  {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" },
  },
);
const vars = Object.fromEntries(
  [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((m) => [m[1], m[2]]),
);
assert(
  vars.PGHOST === `db.${projectRef}.supabase.co` || vars.PGUSER?.endsWith(`.${projectRef}`),
  "Unexpected DB target",
);
for (const key of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"])
  assert(vars[key], `Missing ${key}`);
const db = new pg.Client({
  host: vars.PGHOST,
  port: Number(vars.PGPORT),
  user: vars.PGUSER,
  password: vars.PGPASSWORD,
  database: vars.PGDATABASE,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  application_name: "task039-dev-validation",
});
const read = () => {
  assert(existsSync(file), "Missing owned fixture manifest");
  const value = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(value.projectRef, projectRef);
  return value;
};
const save = (value) => {
  mkdirSync(resolve(".task039-dev"), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
};
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const rpc = async (client, name, args) => {
  const { data, error } = await client.rpc(name, args);
  assert.ifError(error);
  assert.equal(data.length, 1, `${name} must return one row`);
  return data[0];
};
const resolveArgs = (center, document, birth = "1990-01-01") => ({
  p_center_id: center,
  p_nationality_code: "AR",
  p_document_number: document,
  p_birth_date: birth,
});
const publicClient = () =>
  createClient(dev.url, dev.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
async function actor(m, name) {
  const client = publicClient();
  const { error } = await client.auth.signInWithPassword({
    email: m.users[name].email,
    password: m.password,
  });
  assert.ifError(error);
  return client;
}
async function denied(client, center, document, code) {
  const { data, error } = await client.rpc(
    "staff_resolve_patient_identity",
    resolveArgs(center, document),
  );
  assert.equal(data, null);
  assert.equal(error?.code, code, error?.message);
}
async function setup() {
  assert(!existsSync(file), "Existing TASK-039 fixtures require audit before setup");
  const runId = randomBytes(8).toString("hex");
  const ids = Object.fromEntries(
    [
      "centerA",
      "centerB",
      "unlinked",
      "active",
      "inactive",
      "otherCenter",
      "activePc",
      "inactivePc",
      "otherPc",
    ].map((key) => [key, randomUUID()]),
  );
  const m = {
    projectRef,
    runId,
    ids,
    password: `Task039-${randomBytes(24).toString("base64url")}`,
    users: {},
    persons: [ids.unlinked, ids.active, ids.inactive, ids.otherCenter],
    patientCenters: [ids.activePc, ids.inactivePc, ids.otherPc],
    stage: "preparing",
  };
  save(m);
  for (const name of ["adminA", "receptionA", "adminB", "inactiveA"]) {
    const email = `task039-${runId}-${name.toLowerCase()}@example.test`;
    const { data, error } = await authAdmin.auth.admin.createUser({
      email,
      password: m.password,
      email_confirm: true,
    });
    assert.ifError(error);
    m.users[name] = { id: data.user.id, email };
    save(m);
  }
  await db.query("begin");
  try {
    for (const user of Object.values(m.users))
      await query(
        "insert into public.users(id,email,first_name,last_name) values($1,$2,'Task039','Fixture')",
        [user.id, user.email],
      );
    await query(
      "insert into public.centers(id,name,timezone) values($1,$2,'America/Argentina/Buenos_Aires'),($3,$4,'America/Argentina/Buenos_Aires')",
      [ids.centerA, `TASK039-${runId}-A`, ids.centerB, `TASK039-${runId}-B`],
    );
    for (const [center, name, role, active] of [
      [ids.centerA, "adminA", "ADMIN", true],
      [ids.centerA, "receptionA", "RECEPTION", true],
      [ids.centerB, "adminB", "ADMIN", true],
      [ids.centerA, "inactiveA", "RECEPTION", false],
    ])
      await query(
        "insert into public.center_memberships(center_id,user_id,role,is_active) values($1,$2,$3,$4)",
        [center, m.users[name].id, role, active],
      );
    for (const [name, id] of [
      ["unlinked", ids.unlinked],
      ["active", ids.active],
      ["inactive", ids.inactive],
      ["otherCenter", ids.otherCenter],
    ])
      await query(
        "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Task039','Synthetic','1990-01-01','AR',$2)",
        [id, `${name}-${runId}`],
      );
    for (const [pc, person, center, active] of [
      [ids.activePc, ids.active, ids.centerA, true],
      [ids.inactivePc, ids.inactive, ids.centerA, false],
      [ids.otherPc, ids.otherCenter, ids.centerB, true],
    ])
      await query(
        "insert into public.patient_centers(id,person_id,center_id,phone,is_active) values($1,$2,$3,'1001',$4)",
        [pc, person, center, active],
      );
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  m.stage = "ready";
  save(m);
  console.log(
    `SETUP PASS: synthetic DEV fixtures ${runId}; 4 Auth users, 2 centers, 4 persons, 3 links`,
  );
}
async function functional() {
  const m = read();
  assert.equal(m.stage, "ready");
  const { ids, runId } = m;
  const a = await actor(m, "adminA"),
    b = await actor(m, "adminB"),
    reception = await actor(m, "receptionA"),
    inactive = await actor(m, "inactiveA");
  const fields = [
    "first_name",
    "last_name",
    "relationship_state",
    "person_id",
    "patient_center_id",
    "patient_center_updated_at",
  ];
  for (const [kind, center] of [
    ["unlinked", ids.centerA],
    ["active", ids.centerA],
    ["inactive", ids.centerA],
    ["otherCenter", ids.centerA],
  ]) {
    const row = await rpc(
      reception,
      "staff_resolve_patient_identity",
      resolveArgs(center, `${kind}-${runId}`, "1991-01-01"),
    );
    assert.equal(row.identity_status, "UNVERIFIED");
    assert.equal(row.birth_date_matches, false);
    for (const field of fields) assert.equal(row[field], null, `${kind}: ${field} leaked`);
  }
  const miss = await rpc(
    a,
    "staff_resolve_patient_identity",
    resolveArgs(ids.centerA, `missing-${runId}`),
  );
  assert.equal(miss.identity_status, "NOT_FOUND");
  assert.equal(miss.birth_date_matches, null);
  for (const field of fields) assert.equal(miss[field], null);
  for (const [kind, state] of [
    ["unlinked", "NOT_LINKED"],
    ["active", "ACTIVE"],
    ["inactive", "INACTIVE"],
  ]) {
    const row = await rpc(
      a,
      "staff_resolve_patient_identity",
      resolveArgs(ids.centerA, `${kind}-${runId}`),
    );
    assert.equal(row.identity_status, "FOUND");
    assert.equal(row.birth_date_matches, true);
    assert.equal(row.relationship_state, state);
    assert.equal(row.person_id, ids[kind]);
  }
  const cross = await rpc(
    a,
    "staff_resolve_patient_identity",
    resolveArgs(ids.centerA, `otherCenter-${runId}`),
  );
  assert.equal(cross.relationship_state, "NOT_LINKED");
  assert.equal(cross.patient_center_id, null);
  await denied(b, ids.centerA, `active-${runId}`, "42501");
  await denied(inactive, ids.centerA, `active-${runId}`, "42501");
  await denied(publicClient(), ids.centerA, `active-${runId}`, "42501");
  const catalog = await query(
    "select oid::text as oid, pg_get_function_identity_arguments(oid) as args, prosecdef, proconfig, has_function_privilege('authenticated',oid,'EXECUTE') as auth_execute, has_function_privilege('anon',oid,'EXECUTE') as anon_execute from pg_proc where oid='public.staff_resolve_patient_identity(uuid,text,text,date)'::regprocedure",
  );
  assert.equal(catalog.length, 1);
  assert.equal(
    catalog[0].args,
    "p_center_id uuid, p_nationality_code text, p_document_number text, p_birth_date date",
  );
  assert(catalog[0].prosecdef && catalog[0].auth_execute && !catalog[0].anon_execute);
  assert(catalog[0].proconfig.some((item) => item.startsWith("search_path=")));
  const created = await rpc(a, "staff_create_patient_with_center", {
    p_center_id: ids.centerA,
    p_first_name: "Task039",
    p_last_name: "Created",
    p_birth_date: "1990-01-01",
    p_nationality_code: "AR",
    p_document_number: `created-${runId}`,
    p_phone: "1002",
    p_email: null,
    p_insurance_name: null,
    p_administrative_notes: null,
  });
  assert.equal(created.outcome, "CREATED");
  m.persons.push(created.person_id);
  m.patientCenters.push(created.patient_center_id);
  save(m);
  const duplicate = await a.rpc("staff_create_patient_with_center", {
    p_center_id: ids.centerA,
    p_first_name: "Task039",
    p_last_name: "Duplicate",
    p_birth_date: "1990-01-01",
    p_nationality_code: "AR",
    p_document_number: `created-${runId}`,
    p_phone: "1002",
    p_email: null,
    p_insurance_name: null,
    p_administrative_notes: null,
  });
  assert.equal(duplicate.error?.message, "PATIENT_IDENTITY_ALREADY_EXISTS");
  const linked = await rpc(reception, "staff_link_person_to_center", {
    p_center_id: ids.centerA,
    p_person_id: ids.unlinked,
    p_nationality_code: "AR",
    p_document_number: `unlinked-${runId}`,
    p_birth_date: "1990-01-01",
    p_phone: "1003",
    p_email: null,
    p_insurance_name: null,
    p_administrative_notes: null,
    p_confirmed: true,
  });
  assert.equal(linked.outcome, "LINKED");
  assert.equal(linked.person_id, ids.unlinked);
  m.patientCenters.push(linked.patient_center_id);
  save(m);
  const before = await rpc(
    a,
    "staff_resolve_patient_identity",
    resolveArgs(ids.centerA, `inactive-${runId}`),
  );
  const reactivated = await rpc(a, "staff_reactivate_patient_center", {
    p_center_id: ids.centerA,
    p_patient_center_id: ids.inactivePc,
    p_nationality_code: "AR",
    p_document_number: `inactive-${runId}`,
    p_birth_date: "1990-01-01",
    p_expected_updated_at: before.patient_center_updated_at,
    p_confirmed: true,
  });
  assert.equal(reactivated.outcome, "REACTIVATED");
  const after = await rpc(
    a,
    "staff_resolve_patient_identity",
    resolveArgs(ids.centerA, `inactive-${runId}`),
  );
  assert.equal(after.relationship_state, "ACTIVE");
  const counts = await query(
    "select (select count(*) from public.persons where document_number=$1) as persons,(select count(*) from public.patient_centers where person_id=$2) as links",
    [`created-${runId}`, created.person_id],
  );
  assert.equal(Number(counts[0].persons), 1);
  assert.equal(Number(counts[0].links), 1);
  m.stage = "functional_pass";
  save(m);
  console.log(
    "FUNCTIONAL PASS: UNVERIFIED x4, NOT_FOUND, FOUND x3, cross-center, unauthorized x3, grants, create/deduplicate/link/reactivate",
  );
}
async function cleanup() {
  const m = read();
  const { ids } = m;
  if (m.uiDocument) {
    const uiRows = await query(
      "select p.id as person_id,pc.id as patient_center_id,p.first_name,p.last_name from public.persons p join public.patient_centers pc on pc.person_id=p.id where p.document_number=$1 and pc.center_id=$2",
      [m.uiDocument, ids.centerA],
    );
    assert(uiRows.length <= 1, "Ambiguous UI fixture; stop cleanup");
    for (const row of uiRows) {
      assert.equal(row.first_name, "Task039");
      assert.equal(row.last_name, "Browser");
      if (!m.persons.includes(row.person_id)) m.persons.push(row.person_id);
      if (!m.patientCenters.includes(row.patient_center_id))
        m.patientCenters.push(row.patient_center_id);
    }
    save(m);
  }
  const existing = await query(
    "select id from public.patient_centers where center_id=any($1::uuid[])",
    [[ids.centerA, ids.centerB]],
  );
  assert(
    existing.every((row) => m.patientCenters.includes(row.id)),
    "Unknown patient link in fixture center; stop cleanup",
  );
  const appointments = await query(
    "select id from public.appointments where patient_center_id=any($1::uuid[])",
    [m.patientCenters],
  );
  assert.equal(appointments.length, 0, "Unexpected appointment in fixture; stop cleanup");
  await db.query("begin");
  try {
    await query("delete from public.patient_centers where id=any($1::uuid[])", [m.patientCenters]);
    await query("delete from public.persons where id=any($1::uuid[])", [m.persons]);
    await query("delete from public.center_memberships where center_id=any($1::uuid[])", [
      [ids.centerA, ids.centerB],
    ]);
    await query("delete from public.centers where id=any($1::uuid[])", [
      [ids.centerA, ids.centerB],
    ]);
    for (const user of Object.values(m.users))
      await query("delete from public.users where id=$1", [user.id]);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  for (const user of Object.values(m.users)) {
    const { error } = await authAdmin.auth.admin.deleteUser(user.id);
    assert.ifError(error);
  }
  const counts = await query(
    "select (select count(*) from public.patient_centers where id=any($1::uuid[])) as links,(select count(*) from public.persons where id=any($2::uuid[])) as persons,(select count(*) from public.centers where id=any($3::uuid[])) as centers,(select count(*) from public.users where id=any($4::uuid[])) as users",
    [
      m.patientCenters,
      m.persons,
      [ids.centerA, ids.centerB],
      Object.values(m.users).map((x) => x.id),
    ],
  );
  for (const value of Object.values(counts[0]))
    assert.equal(Number(value), 0, "Fixture DB residue");
  for (const user of Object.values(m.users)) {
    const { data, error } = await authAdmin.auth.admin.getUserById(user.id);
    assert(error || !data.user, "Fixture Auth residue");
  }
  const summary = {
    runId: m.runId,
    authUsers: Object.keys(m.users).length,
    centers: 2,
    persons: m.persons.length,
    patientCenters: m.patientCenters.length,
  };
  unlinkSync(file);
  console.log(`CLEANUP PASS: exact owned IDs removed and audited ${JSON.stringify(summary)}`);
}
await db.connect();
try {
  await db.query("set role postgres");
  if (mode === "setup") await setup();
  if (mode === "test") await functional();
  if (mode === "cleanup") await cleanup();
} finally {
  await db.end();
}
