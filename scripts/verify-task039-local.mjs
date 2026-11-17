import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";

pg.types.setTypeParser(1184, (value) => value);

const exec = promisify(execFile);
const docker =
  process.platform === "win32"
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker";
const image = "ghcr.io/supabase/postgres:17.6.1.166";
const migrationName = "20261117124426_protect_unverified_patient_identity.sql";
const container = `task039-local-${randomBytes(6).toString("hex")}`;
const password = randomBytes(24).toString("base64url");
const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
assert.equal(migrations.at(-1), migrationName, "TASK-039 must be the last migration");

async function runDocker(args, options = {}) {
  return exec(docker, args, { timeout: 120_000, windowsHide: true, ...options });
}

async function asRole(client, role, actor, query, args = []) {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    if (actor) await client.query("select set_config('request.jwt.claim.sub', $1, true)", [actor]);
    const result = await client.query(query, args);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function denied(client, role, actor, centerId, expectedMessage) {
  await assert.rejects(
    asRole(client, role, actor, resolveSql, [centerId, "AR", document, "1991-01-01"]),
    (error) =>
      error.code === "42501" && (expectedMessage ? error.message === expectedMessage : true),
  );
}

const resolveSql = "select * from public.staff_resolve_patient_identity($1,$2,$3,$4)";
const protectedFields = [
  "first_name",
  "last_name",
  "relationship_state",
  "person_id",
  "patient_center_id",
  "patient_center_updated_at",
];
const document = `TASK039-${randomUUID()}`;
const ids = Object.fromEntries(
  [
    "centerA",
    "centerB",
    "adminA",
    "receptionA",
    "adminB",
    "professionalA",
    "inactiveA",
    "platform",
    "professional",
    "professionalCenter",
    "unlinked",
    "otherCenter",
    "active",
    "inactive",
  ].map((key) => [key, randomUUID()]),
);

let client;
let started = false;
try {
  await runDocker(
    [
      "run",
      "--detach",
      "--rm",
      "--pull",
      "never",
      "--name",
      container,
      "--label",
      `task039-owner=${container}`,
      "--env",
      "POSTGRES_PASSWORD",
      "--publish",
      "127.0.0.1::5432",
      image,
    ],
    { env: { ...process.env, POSTGRES_PASSWORD: password } },
  );
  started = true;
  const { stdout } = await runDocker(["port", container, "5432/tcp"]);
  const port = Number(stdout.trim().match(/:(\d+)$/)?.[1]);
  assert(Number.isInteger(port) && port > 0, "Docker did not publish a loopback port");

  const deadline = Date.now() + 90_000;
  while (!client && Date.now() < deadline) {
    const candidate = new pg.Client({
      host: "127.0.0.1",
      port,
      database: "postgres",
      user: "postgres",
      password,
      connectionTimeoutMillis: 1500,
    });
    try {
      await candidate.connect();
      client = candidate;
    } catch {
      await candidate.end().catch(() => undefined);
      await new Promise((done) => setTimeout(done, 250));
    }
  }
  assert(client, "Disposable PostgreSQL did not become ready");

  for (const name of migrations.slice(0, -1)) {
    try {
      await client.query(readFileSync(resolve("supabase/migrations", name), "utf8"));
    } catch (error) {
      throw new Error(`Local migration replay failed at ${name}: ${error.code ?? error.message}`);
    }
  }
  const catalogSql = `select oid::text as oid, pg_get_function_result(oid) as result,
    proacl::text as acl, prosecdef as security_definer, proconfig as config
    from pg_proc where oid = 'public.staff_resolve_patient_identity(uuid,text,text,date)'::regprocedure`;
  const before = (await client.query(catalogSql)).rows[0];
  assert(before, "Old RPC missing before migration");
  await client.query(readFileSync(resolve("supabase/migrations", migrationName), "utf8"));
  const after = (await client.query(catalogSql)).rows[0];
  assert.deepEqual(
    after,
    before,
    "Migration changed RPC identity, signature, grants or security settings",
  );
  const grants = (
    await client.query(`select
    has_function_privilege('authenticated', 'public.staff_resolve_patient_identity(uuid,text,text,date)', 'EXECUTE') as staff,
    has_function_privilege('anon', 'public.staff_resolve_patient_identity(uuid,text,text,date)', 'EXECUTE') as anon`)
  ).rows[0];
  assert.deepEqual(grants, { staff: true, anon: false });

  for (const actor of [
    "adminA",
    "receptionA",
    "adminB",
    "professionalA",
    "inactiveA",
    "platform",
  ]) {
    await client.query(
      "insert into auth.users(id,email,created_at,updated_at) values ($1,$2,now(),now())",
      [ids[actor], `${actor.toLowerCase()}-${ids[actor]}@example.test`],
    );
    await client.query(
      "insert into public.users(id,email,first_name,last_name) values ($1,$2,'Task039','Fixture')",
      [ids[actor], `${actor.toLowerCase()}-${ids[actor]}@example.test`],
    );
  }
  await client.query(
    "insert into public.centers(id,name) values ($1,'Task039 A'),($2,'Task039 B')",
    [ids.centerA, ids.centerB],
  );
  await client.query(
    "insert into public.professionals(id,first_name,last_name,nationality_code,document_number,email) values($1,'Task039','Professional','AR',$2,$3)",
    [ids.professional, `P-${document}`, `p-${ids.professional}@example.test`],
  );
  await client.query(
    "insert into public.professional_centers(id,professional_id,center_id) values($1,$2,$3)",
    [ids.professionalCenter, ids.professional, ids.centerA],
  );
  for (const [center, actor, role, professionalCenter, active] of [
    [ids.centerA, ids.adminA, "ADMIN", null, true],
    [ids.centerA, ids.receptionA, "RECEPTION", null, true],
    [ids.centerB, ids.adminB, "ADMIN", null, true],
    [ids.centerA, ids.professionalA, "PROFESSIONAL", ids.professionalCenter, true],
    [ids.centerA, ids.inactiveA, "RECEPTION", null, false],
  ]) {
    await client.query(
      "insert into public.center_memberships(center_id,user_id,role,professional_center_id,is_active) values($1,$2,$3,$4,$5)",
      [center, actor, role, professionalCenter, active],
    );
  }
  await client.query("insert into public.platform_admins(user_id) values($1)", [ids.platform]);
  for (const [kind, id] of [
    ["unlinked", ids.unlinked],
    ["otherCenter", ids.otherCenter],
    ["active", ids.active],
    ["inactive", ids.inactive],
  ]) {
    await client.query(
      "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,$2,'Private','1990-01-01','AR',$3)",
      [id, kind, `${document}-${kind}`],
    );
  }
  await client.query(
    "insert into public.patient_centers(person_id,center_id,phone) values($1,$2,'555')",
    [ids.otherCenter, ids.centerB],
  );
  await client.query(
    "insert into public.patient_centers(person_id,center_id,phone) values($1,$2,'555')",
    [ids.active, ids.centerA],
  );
  await client.query(
    "insert into public.patient_centers(person_id,center_id,phone,is_active) values($1,$2,'555',false)",
    [ids.inactive, ids.centerA],
  );

  for (const kind of ["unlinked", "otherCenter", "active", "inactive"]) {
    const row = (
      await asRole(client, "authenticated", ids.adminA, resolveSql, [
        ids.centerA,
        "AR",
        `${document}-${kind}`,
        "1991-01-01",
      ])
    ).rows[0];
    assert.equal(row.identity_status, "UNVERIFIED", `${kind}: identity status`);
    assert.equal(row.birth_date_matches, false, `${kind}: birth match`);
    assert.deepEqual(
      Object.keys(row).sort(),
      ["identity_status", "birth_date_matches", ...protectedFields].sort(),
      `${kind}: return columns`,
    );
    for (const key of protectedFields) assert.equal(row[key], null, `${kind}: ${key} leaked`);
  }
  const receptionMismatch = (
    await asRole(client, "authenticated", ids.receptionA, resolveSql, [
      ids.centerA,
      "AR",
      `${document}-active`,
      "1991-01-01",
    ])
  ).rows[0];
  assert.equal(receptionMismatch.identity_status, "UNVERIFIED");

  for (const [kind, state] of [
    ["unlinked", "NOT_LINKED"],
    ["otherCenter", "NOT_LINKED"],
    ["active", "ACTIVE"],
    ["inactive", "INACTIVE"],
  ]) {
    const row = (
      await asRole(client, "authenticated", ids.adminA, resolveSql, [
        ids.centerA,
        "AR",
        `${document}-${kind}`,
        "1990-01-01",
      ])
    ).rows[0];
    assert.equal(row.identity_status, "FOUND", `${kind}: verified status`);
    assert.equal(row.birth_date_matches, true, `${kind}: verified DOB`);
    assert.equal(row.relationship_state, state, `${kind}: tenant state`);
    assert.equal(row.person_id, ids[kind], `${kind}: reused Person`);
    assert.equal(row.patient_center_id === null, state === "NOT_LINKED", `${kind}: local link ID`);
  }
  const absent = (
    await asRole(client, "authenticated", ids.adminA, resolveSql, [
      ids.centerA,
      "AR",
      `${document}-missing`,
      "1990-01-01",
    ])
  ).rows[0];
  assert.equal(absent.identity_status, "NOT_FOUND");
  assert.equal(absent.birth_date_matches, null);
  for (const key of protectedFields) assert.equal(absent[key], null);

  await denied(client, "anon", null, ids.centerA);
  for (const actor of ["adminB", "professionalA", "inactiveA", "platform"]) {
    await denied(client, "authenticated", ids[actor], ids.centerA, "PATIENT_ACCESS_DENIED");
  }
  await assert.rejects(
    asRole(
      client,
      "authenticated",
      ids.adminA,
      "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        ids.centerA,
        "Wrong",
        "DOB",
        "1991-01-01",
        "AR",
        `${document}-unlinked`,
        "555",
        null,
        null,
        null,
      ],
    ),
    (error) => error.code === "P0001" && error.message === "PATIENT_IDENTITY_ALREADY_EXISTS",
  );
  assert.equal(
    (
      await client.query(
        "select count(*)::integer as n from public.persons where nationality_code='AR' and normalized_document=private.normalize_document($1)",
        [`${document}-unlinked`],
      )
    ).rows[0].n,
    1,
  );
  const created = (
    await asRole(
      client,
      "authenticated",
      ids.adminA,
      "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        ids.centerA,
        "New",
        "Patient",
        "1990-01-01",
        "AR",
        `${document}-new`,
        "555",
        null,
        null,
        null,
      ],
    )
  ).rows[0];
  assert.equal(created.outcome, "CREATED");
  const linked = (
    await asRole(
      client,
      "authenticated",
      ids.adminA,
      "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        ids.centerA,
        ids.unlinked,
        "AR",
        `${document}-unlinked`,
        "1990-01-01",
        "555",
        null,
        null,
        null,
        true,
      ],
    )
  ).rows[0];
  assert.equal(linked.outcome, "LINKED");
  assert.equal(linked.person_id, ids.unlinked);
  const inactiveRelation = (
    await client.query(
      "select id,updated_at from public.patient_centers where center_id=$1 and person_id=$2",
      [ids.centerA, ids.inactive],
    )
  ).rows[0];
  const reactivated = (
    await asRole(
      client,
      "authenticated",
      ids.adminA,
      "select * from public.staff_reactivate_patient_center($1,$2,$3,$4,$5,$6,$7)",
      [
        ids.centerA,
        inactiveRelation.id,
        "AR",
        `${document}-inactive`,
        "1990-01-01",
        inactiveRelation.updated_at,
        true,
      ],
    )
  ).rows[0];
  assert.equal(reactivated.outcome, "REACTIVATED");

  console.log(
    JSON.stringify({
      result: "TASK039_LOCAL_RPC_PASS",
      migrations: migrations.length,
      unverifiedCases: 4,
      authorizedRoles: 2,
      deniedRoles: 5,
      flows: ["create", "link", "reactivate"],
    }),
  );
} finally {
  await client?.end().catch(() => undefined);
  if (started) await runDocker(["rm", "--force", container]).catch(() => undefined);
}
