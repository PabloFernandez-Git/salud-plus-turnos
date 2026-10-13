import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import {
  assertLinkedSupabaseProject,
  loadLocalEnv,
  loadSupabaseDevConfig,
} from "./lib/supabase-dev-env.mjs";

const { Client } = pg;
pg.types.setTypeParser(1184, (value) => value);
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");
const emailContractCases = JSON.parse(
  readFileSync(
    resolve("src/modules/professionals/schemas/professional-email-contract-cases.json"),
    "utf8",
  ),
);
const expectedCenterId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const expectedBaselineDigest = "e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a";
const expectedOperationIds = [
  "352a309e-f137-488e-b6e7-4b53e2cdb7b2",
  "964ec4bf-eeba-4f4f-914a-d2a8ca101934",
];
const applicationPrefix = "task006b-";
const waitTimeoutMilliseconds = 20_000;

loadLocalEnv();
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!secretKey) {
  throw new Error("SUPABASE_SECRET_KEY is required for temporary DEV Auth fixtures.");
}

const authAdmin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let cachedDatabaseConfig;
function temporaryDatabaseConfig() {
  if (cachedDatabaseConfig) return cachedDatabaseConfig;
  const stdout = execFileSync(
    process.execPath,
    [supabaseCli, "db", "dump", "--linked", "--dry-run", "--schema", "public"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "true",
        DO_NOT_TRACK: "1",
        SUPABASE_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const variables = Object.fromEntries(
    [...stdout.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
  );
  const poolerUrl = new URL(readFileSync(poolerUrlFile, "utf8").trim());
  const approvedHost =
    variables.PGHOST === `db.${dev.projectRef}.supabase.co` ||
    (variables.PGHOST === poolerUrl.hostname && variables.PGUSER?.endsWith(`.${dev.projectRef}`));
  if (!approvedHost) throw new Error("The temporary connection does not target approved DEV.");

  cachedDatabaseConfig = {
    host: variables.PGHOST,
    port: Number(variables.PGPORT),
    database: variables.PGDATABASE,
    user: variables.PGUSER,
    password: variables.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: waitTimeoutMilliseconds,
  };
  return cachedDatabaseConfig;
}

async function connect(label) {
  const client = new Client({
    ...temporaryDatabaseConfig(),
    application_name: `${applicationPrefix}${label}`,
  });
  await client.connect();
  await client.query("set role postgres");
  return client;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, description) {
  if (actual !== expected) {
    throw new Error(`${description}: expected ${expected}, received ${actual}.`);
  }
}

async function expectSqlState(action, code, token, description) {
  try {
    await action();
  } catch (error) {
    if (error?.code !== code || (token && error?.message !== token)) {
      throw new Error(
        `${description}: expected ${code}/${token}, received ${error?.code}/${error?.message}.`,
        { cause: error },
      );
    }
    return error;
  }
  throw new Error(`${description}: operation unexpectedly succeeded.`);
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

async function beginAsUser(client, userId) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
}

async function assertTokenGreater(client, newerToken, olderToken, description) {
  const result = await client.query(
    "select $1::timestamptz > $2::timestamptz as is_strictly_greater",
    [newerToken, olderToken],
  );
  assertEqual(result.rows[0].is_strictly_greater, true, description);
}

async function expectStaleWithinTransaction(client, savepoint, action, token, description) {
  await client.query(`savepoint ${savepoint}`);
  try {
    await action();
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query(`release savepoint ${savepoint}`);
    if (error?.code !== "P0001" || error?.message !== token) {
      throw new Error(
        `${description}: expected P0001/${token}, received ${error?.code}/${error?.message}.`,
        { cause: error },
      );
    }
    return;
  }
  await client.query(`rollback to savepoint ${savepoint}`);
  await client.query(`release savepoint ${savepoint}`);
  throw new Error(`${description}: operation unexpectedly succeeded.`);
}

function tagged(label, promise) {
  return promise.then(
    (value) => ({ label, status: "fulfilled", value }),
    (error) => ({ label, status: "rejected", error }),
  );
}

async function withTimeout(promise, description) {
  let watchdog;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        watchdog = setTimeout(
          () => reject(new Error(`Timed out waiting for ${description}.`)),
          waitTimeoutMilliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(watchdog);
  }
}

async function observeAdvisoryWaits(control, pids, description) {
  const deadline = Date.now() + waitTimeoutMilliseconds;
  while (Date.now() < deadline) {
    const result = await control.query(
      `select pg_catalog.count(distinct lock_record.pid)::integer as waiting_count
       from pg_catalog.pg_locks as lock_record
       where lock_record.pid = any($1::integer[])
         and lock_record.locktype = 'advisory'
         and not lock_record.granted`,
      [pids],
    );
    if (result.rows[0].waiting_count === pids.length) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  throw new Error(`${description}: pending advisory locks were not observed.`);
}

async function sessionLock(client, lockText) {
  await client.query("select pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended($1,0))", [
    lockText,
  ]);
}

async function sessionUnlock(client, lockText) {
  const result = await client.query(
    "select pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended($1,0)) as unlocked",
    [lockText],
  );
  assertEqual(result.rows[0].unlocked, true, `release ${lockText}`);
}

async function persistentSnapshot(client) {
  const result = await client.query(
    `select pg_catalog.jsonb_build_object(
       'auth_users', coalesce((
         select pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'id', auth_user.id,
             'email', auth_user.email,
             'encrypted_password', auth_user.encrypted_password,
             'raw_user_meta_data', auth_user.raw_user_meta_data
           ) order by auth_user.id
         ) from auth.users as auth_user
       ), '[]'::jsonb),
       'users', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(app_user) order by app_user.id)
         from public.users as app_user
       ), '[]'::jsonb),
       'platform_admins', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(platform_admin) order by platform_admin.user_id)
         from public.platform_admins as platform_admin
       ), '[]'::jsonb),
       'centers', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(center_record) order by center_record.id)
         from public.centers as center_record
       ), '[]'::jsonb),
       'memberships', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(membership) order by membership.id)
         from public.center_memberships as membership
       ), '[]'::jsonb),
       'operations', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(operation) order by operation.id)
         from private.provisioning_operations as operation
       ), '[]'::jsonb),
       'professionals', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(professional) order by professional.id)
         from public.professionals as professional
       ), '[]'::jsonb),
       'professional_centers', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(professional_center) order by professional_center.id)
         from public.professional_centers as professional_center
       ), '[]'::jsonb),
       'specialties', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(specialty) order by specialty.id)
         from public.specialties as specialty
       ), '[]'::jsonb),
       'professional_center_specialties', coalesce((
         select pg_catalog.jsonb_agg(
           pg_catalog.to_jsonb(association)
           order by association.professional_center_id, association.specialty_id
         ) from public.professional_center_specialties as association
       ), '[]'::jsonb)
     ) as snapshot`,
  );
  return result.rows[0].snapshot;
}

function snapshotDigest(snapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function assertApprovedBaseline(snapshot, description) {
  assertEqual(snapshot.auth_users.length, 1, `${description} auth users`);
  assertEqual(snapshot.users.length, 1, `${description} public users`);
  assertEqual(snapshot.platform_admins.length, 1, `${description} platform admins`);
  assertEqual(snapshot.centers.length, 1, `${description} centers`);
  assertEqual(snapshot.memberships.length, 1, `${description} memberships`);
  assertEqual(snapshot.operations.length, 2, `${description} operations`);
  assertEqual(snapshot.professionals.length, 0, `${description} professionals`);
  assertEqual(snapshot.professional_centers.length, 0, `${description} professional centers`);
  assertEqual(snapshot.specialties.length, 0, `${description} specialties`);
  assertEqual(
    snapshot.professional_center_specialties.length,
    0,
    `${description} professional center specialties`,
  );
  assertEqual(snapshot.centers[0]?.id, expectedCenterId, `${description} Center id`);
  assertEqual(snapshot.centers[0]?.is_active, true, `${description} Center active`);
  assertEqual(snapshot.memberships[0]?.role, "ADMIN", `${description} membership role`);
  assertEqual(snapshot.memberships[0]?.is_active, true, `${description} membership active`);
  assertEqual(
    JSON.stringify(
      snapshot.operations
        .map(({ id, status }) => ({ id, status }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ),
    JSON.stringify(
      expectedOperationIds
        .map((id) => ({ id, status: "SUCCEEDED" }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ),
    `${description} operation identities`,
  );
}

const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const password = randomBytes(24).toString("base64url");
const authFixtureNames = [
  "adminA",
  "adminB",
  "reception",
  "professional",
  "inactiveAdmin",
  "platformOnly",
  "membershipTarget",
];
const actors = new Map();
const owned = {
  authUsers: [],
  users: [],
  platformAdmins: [],
  centers: [],
  memberships: [],
  professionals: [],
  professionalCenters: [],
  specialties: [],
};

function own(kind, id) {
  if (id && !owned[kind].includes(id)) owned[kind].push(id);
  return id;
}

async function createAuthFixtures() {
  for (const name of authFixtureNames) {
    const email = `task006b-${runId}-${name.toLowerCase()}@example.test`;
    const { data, error } = await authAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Could not create Auth fixture ${name}.`);
    actors.set(name, { id: data.user.id, email });
    own("authUsers", data.user.id);
  }
}

async function cleanup(control) {
  const errors = [];
  const attempt = async (description, action) => {
    try {
      await action();
    } catch (error) {
      errors.push(new Error(`Failed to ${description}.`, { cause: error }));
    }
  };

  await attempt("remove owned memberships", () =>
    control.query("delete from public.center_memberships where id = any($1::uuid[])", [
      owned.memberships,
    ]),
  );
  await attempt("remove owned ProfessionalCenterSpecialties", () =>
    control.query(
      `delete from public.professional_center_specialties
       where professional_center_id = any($1::uuid[])
          or specialty_id = any($2::uuid[])`,
      [owned.professionalCenters, owned.specialties],
    ),
  );
  await attempt("remove owned ProfessionalCenters", () =>
    control.query("delete from public.professional_centers where id = any($1::uuid[])", [
      owned.professionalCenters,
    ]),
  );
  await attempt("remove owned Specialties", () =>
    control.query("delete from public.specialties where id = any($1::uuid[])", [owned.specialties]),
  );
  await attempt("remove owned Professionals", () =>
    control.query("delete from public.professionals where id = any($1::uuid[])", [
      owned.professionals,
    ]),
  );
  await attempt("remove owned PlatformAdmins", () =>
    control.query("delete from public.platform_admins where user_id = any($1::uuid[])", [
      owned.platformAdmins,
    ]),
  );
  await attempt("remove owned Centers", () =>
    control.query("delete from public.centers where id = any($1::uuid[])", [owned.centers]),
  );
  await attempt("remove owned application Users", () =>
    control.query("delete from public.users where id = any($1::uuid[])", [owned.users]),
  );

  for (const authUserId of owned.authUsers) {
    await attempt(`remove Auth user ${authUserId}`, async () => {
      const { error } = await authAdmin.auth.admin.deleteUser(authUserId);
      if (error) throw error;
    });
  }

  if (errors.length > 0) throw new AggregateError(errors, "TASK-006B cleanup failed.");
}

const ids = {
  centerA: randomUUID(),
  centerB: randomUUID(),
  membershipAdminA: randomUUID(),
  membershipAdminB: randomUUID(),
  membershipReception: randomUUID(),
  membershipProfessional: randomUUID(),
  membershipInactiveAdmin: randomUUID(),
  membershipTarget: randomUUID(),
  professionalActor: randomUUID(),
  professionalCenterActor: randomUUID(),
};

async function setupFixtures(control) {
  await createAuthFixtures();
  for (const actor of actors.values()) {
    own("users", actor.id);
    await control.query(
      `insert into public.users (id, email, first_name, last_name)
       values ($1,$2,$3,$4)`,
      [actor.id, actor.email, "TASK006B", "Fixture"],
    );
  }

  own("centers", ids.centerA);
  own("centers", ids.centerB);
  await control.query(
    `insert into public.centers (id, name)
     values ($1,$2),($3,$4)`,
    [ids.centerA, `TASK-006B A ${runId}`, ids.centerB, `TASK-006B B ${runId}`],
  );

  own("professionals", ids.professionalActor);
  own("professionalCenters", ids.professionalCenterActor);
  await control.query(
    `insert into public.professionals (
       id, first_name, last_name, nationality_code, document_number, email
     ) values ($1,'Professional','Actor','AR',$2,$3)
     returning id`,
    [ids.professionalActor, `ACTOR-${runId}`, `actor-${runId}@example.test`],
  );
  await control.query(
    `insert into public.professional_centers (id, professional_id, center_id)
     values ($1,$2,$3)`,
    [ids.professionalCenterActor, ids.professionalActor, ids.centerA],
  );

  const membershipRows = [
    [ids.membershipAdminA, ids.centerA, actors.get("adminA").id, "ADMIN", null, true],
    [ids.membershipAdminB, ids.centerB, actors.get("adminB").id, "ADMIN", null, true],
    [ids.membershipReception, ids.centerA, actors.get("reception").id, "RECEPTION", null, true],
    [
      ids.membershipProfessional,
      ids.centerA,
      actors.get("professional").id,
      "PROFESSIONAL",
      ids.professionalCenterActor,
      true,
    ],
    [
      ids.membershipInactiveAdmin,
      ids.centerA,
      actors.get("inactiveAdmin").id,
      "ADMIN",
      null,
      false,
    ],
    [ids.membershipTarget, ids.centerA, actors.get("membershipTarget").id, "RECEPTION", null, true],
  ];
  for (const row of membershipRows) {
    own("memberships", row[0]);
    await control.query(
      `insert into public.center_memberships (
         id, center_id, user_id, role, professional_center_id, is_active
       ) values ($1,$2,$3,$4,$5,$6)`,
      row,
    );
  }

  own("platformAdmins", actors.get("platformOnly").id);
  await control.query("insert into public.platform_admins (user_id) values ($1)", [
    actors.get("platformOnly").id,
  ]);
}

function resolveProfessional(client, centerId, nationalityCode, documentNumber) {
  return client.query("select * from public.admin_resolve_professional_by_document($1,$2,$3)", [
    centerId,
    nationalityCode,
    documentNumber,
  ]);
}

function createProfessional(client, centerId, overrides = {}) {
  const input = {
    firstName: "Ada",
    lastName: "Lovelace",
    nationalityCode: "AR",
    documentNumber: `CREATE-${runId}`,
    email: `ada-${runId}@example.test`,
    phone: " 12345 ",
    licenseNumber: " MN 123 ",
    duration: 30,
    ...overrides,
  };
  return client.query(
    `select * from public.admin_create_professional_with_center(
       $1,$2,$3,$4,$5,$6,$7,$8,$9
     )`,
    [
      centerId,
      input.firstName,
      input.lastName,
      input.nationalityCode,
      input.documentNumber,
      input.email,
      input.phone,
      input.licenseNumber,
      input.duration,
    ],
  );
}

function linkProfessional(
  client,
  centerId,
  professionalId,
  nationalityCode,
  documentNumber,
  expectedUpdatedAt,
) {
  return client.query("select * from public.admin_link_professional_to_center($1,$2,$3,$4,$5)", [
    centerId,
    professionalId,
    nationalityCode,
    documentNumber,
    expectedUpdatedAt,
  ]);
}

function updateProfessionalCenter(client, centerId, pcId, token, licenseNumber, duration) {
  return client.query("select * from public.admin_update_professional_center($1,$2,$3,$4,$5)", [
    centerId,
    pcId,
    token,
    licenseNumber,
    duration,
  ]);
}

function setProfessionalCenterActive(client, centerId, pcId, token, isActive) {
  return client.query("select * from public.admin_set_professional_center_active($1,$2,$3,$4)", [
    centerId,
    pcId,
    token,
    isActive,
  ]);
}

function createSpecialty(client, centerId, name, description = null) {
  return client.query("select * from public.admin_create_specialty($1,$2,$3)", [
    centerId,
    name,
    description,
  ]);
}

function updateSpecialty(client, centerId, specialtyId, token, name, description = null) {
  return client.query("select * from public.admin_update_specialty($1,$2,$3,$4,$5)", [
    centerId,
    specialtyId,
    token,
    name,
    description,
  ]);
}

function setSpecialtyActive(client, centerId, specialtyId, token, isActive) {
  return client.query("select * from public.admin_set_specialty_active($1,$2,$3,$4)", [
    centerId,
    specialtyId,
    token,
    isActive,
  ]);
}

function updateSpecialties(client, centerId, pcId, token, activate, deactivate) {
  return client.query(
    `select * from public.admin_update_professional_center_specialties(
       $1,$2,$3,$4::uuid[],$5::uuid[]
     )`,
    [centerId, pcId, token, activate, deactivate],
  );
}

async function verifySameTransactionCas(
  client,
  actorId,
  professionalCenterId,
  professionalCenterToken,
  specialtyId,
  specialtyToken,
) {
  await beginAsUser(client, actorId);
  try {
    const pcFirst = await updateProfessionalCenter(
      client,
      ids.centerA,
      professionalCenterId,
      professionalCenterToken,
      "MN 1000",
      50,
    );
    const pcToken1 = pcFirst.rows[0].updated_at;
    await assertTokenGreater(
      client,
      pcToken1,
      professionalCenterToken,
      "PC first same-transaction token is monotonic",
    );
    await expectStaleWithinTransaction(
      client,
      "pc_stale_after_first",
      () =>
        updateProfessionalCenter(
          client,
          ids.centerA,
          professionalCenterId,
          professionalCenterToken,
          "MN stale 0",
          55,
        ),
      "STALE_PROFESSIONAL_CENTER_STATE",
      "PC token0 is stale after first same-transaction change",
    );

    const pcSecond = await updateProfessionalCenter(
      client,
      ids.centerA,
      professionalCenterId,
      pcToken1,
      "MN 1001",
      55,
    );
    const pcToken2 = pcSecond.rows[0].updated_at;
    await assertTokenGreater(
      client,
      pcToken2,
      pcToken1,
      "PC second same-transaction token is monotonic",
    );
    await expectStaleWithinTransaction(
      client,
      "pc_stale_after_second",
      () =>
        updateProfessionalCenter(
          client,
          ids.centerA,
          professionalCenterId,
          pcToken1,
          "MN stale 1",
          60,
        ),
      "STALE_PROFESSIONAL_CENTER_STATE",
      "PC token1 is stale after second same-transaction change",
    );
    const pcNoop = await updateProfessionalCenter(
      client,
      ids.centerA,
      professionalCenterId,
      pcToken2,
      " MN 1001 ",
      55,
    );
    assertEqual(pcNoop.rows[0].updated_at, pcToken2, "PC same-transaction no-op token");

    const specialtyFirst = await updateSpecialty(
      client,
      ids.centerA,
      specialtyId,
      specialtyToken,
      "Cardiology",
      "Same transaction one",
    );
    const specialtyToken1 = specialtyFirst.rows[0].updated_at;
    await assertTokenGreater(
      client,
      specialtyToken1,
      specialtyToken,
      "Specialty first same-transaction token is monotonic",
    );
    await expectStaleWithinTransaction(
      client,
      "specialty_stale_after_first",
      () =>
        updateSpecialty(
          client,
          ids.centerA,
          specialtyId,
          specialtyToken,
          "Cardiology",
          "Stale zero",
        ),
      "STALE_SPECIALTY_STATE",
      "Specialty token0 is stale after first same-transaction change",
    );

    const specialtySecond = await updateSpecialty(
      client,
      ids.centerA,
      specialtyId,
      specialtyToken1,
      "Cardiology",
      "Same transaction two",
    );
    const specialtyToken2 = specialtySecond.rows[0].updated_at;
    await assertTokenGreater(
      client,
      specialtyToken2,
      specialtyToken1,
      "Specialty second same-transaction token is monotonic",
    );
    await expectStaleWithinTransaction(
      client,
      "specialty_stale_after_second",
      () =>
        updateSpecialty(
          client,
          ids.centerA,
          specialtyId,
          specialtyToken1,
          "Cardiology",
          "Stale one",
        ),
      "STALE_SPECIALTY_STATE",
      "Specialty token1 is stale after second same-transaction change",
    );
    const specialtyNoop = await updateSpecialty(
      client,
      ids.centerA,
      specialtyId,
      specialtyToken2,
      " Cardiology ",
      " Same transaction two ",
    );
    assertEqual(
      specialtyNoop.rows[0].updated_at,
      specialtyToken2,
      "Specialty same-transaction no-op token",
    );

    await client.query("commit");
    return { professionalCenterToken: pcToken2, specialtyToken: specialtyToken2 };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyOlderTransactionCannotRegressCas(control, olderClient, newerClient) {
  const specialtyId = own("specialties", randomUUID());
  const inserted = await control.query(
    `insert into public.specialties (id, center_id, name, description)
     values ($1,$2,$3,'initial') returning updated_at`,
    [specialtyId, ids.centerA, `Transaction age ${runId}`],
  );

  await olderClient.query("begin");
  try {
    const olderStartedAt = (
      await olderClient.query("select pg_catalog.transaction_timestamp() as started_at")
    ).rows[0].started_at;
    const newerChange = await newerClient.query(
      `update public.specialties
       set description='newer transaction'
       where id=$1
       returning updated_at`,
      [specialtyId],
    );
    await assertTokenGreater(
      newerClient,
      newerChange.rows[0].updated_at,
      inserted.rows[0].updated_at,
      "newer transaction Specialty token",
    );
    await assertTokenGreater(
      newerClient,
      newerChange.rows[0].updated_at,
      olderStartedAt,
      "newer token follows older transaction start",
    );

    const olderChange = await olderClient.query(
      `update public.specialties
       set description='older transaction applied later'
       where id=$1
       returning updated_at`,
      [specialtyId],
    );
    await assertTokenGreater(
      olderClient,
      olderChange.rows[0].updated_at,
      newerChange.rows[0].updated_at,
      "older transaction applied later cannot regress Specialty token",
    );
    await olderClient.query("commit");
  } catch (error) {
    await olderClient.query("rollback");
    throw error;
  }
}

async function verifyAuthorizationAndRls(control, testClient) {
  const specialtyA = own("specialties", randomUUID());
  const specialtyB = own("specialties", randomUUID());
  await control.query(
    `insert into public.specialties (id, center_id, name)
     values ($1,$2,$3),($4,$5,$6)`,
    [specialtyA, ids.centerA, `Visible A ${runId}`, specialtyB, ids.centerB, `Visible B ${runId}`],
  );

  const adminARead = await asUser(testClient, actors.get("adminA").id, (database) =>
    database.query("select id from public.specialties order by id"),
  );
  assertEqual(adminARead.rows.length, 1, "ADMIN A Specialty visibility");
  assertEqual(adminARead.rows[0].id, specialtyA, "ADMIN A visible Specialty");

  const adminBRead = await asUser(testClient, actors.get("adminB").id, (database) =>
    database.query("select id from public.specialties order by id"),
  );
  assertEqual(adminBRead.rows.length, 1, "ADMIN B Specialty visibility");
  assertEqual(adminBRead.rows[0].id, specialtyB, "ADMIN B visible Specialty");

  for (const actorName of ["reception", "professional", "inactiveAdmin", "platformOnly"]) {
    const result = await asUser(testClient, actors.get(actorName).id, (database) =>
      database.query("select id from public.specialties"),
    );
    assertEqual(result.rows.length, 0, `${actorName} Specialty visibility`);
    await expectSqlState(
      () =>
        asUser(testClient, actors.get(actorName).id, (database) =>
          createSpecialty(database, ids.centerA, `Denied ${actorName} ${runId}`),
        ),
      "42501",
      "CENTER_ADMINISTRATION_DENIED",
      `${actorName} Specialty RPC`,
    );
  }

  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminB").id, (database) =>
        createSpecialty(database, ids.centerA, `Cross center ${runId}`),
      ),
    "42501",
    "CENTER_ADMINISTRATION_DENIED",
    "cross-center Specialty RPC",
  );

  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        database.query("insert into public.specialties (center_id,name) values ($1,$2)", [
          ids.centerA,
          `Direct DML ${runId}`,
        ]),
      ),
    "42501",
    "permission denied for table specialties",
    "authenticated direct Specialty INSERT",
  );

  await testClient.query("begin");
  await testClient.query("set local role anon");
  await expectSqlState(
    () => testClient.query("select id from public.specialties"),
    "42501",
    "permission denied for table specialties",
    "anon Specialty SELECT",
  );
  await testClient.query("rollback");
}

async function verifyProfessionalAndSpecialtyContracts(control, testClient) {
  const notFound = await asUser(testClient, actors.get("adminA").id, (database) =>
    resolveProfessional(database, ids.centerA, "AR", `MISSING-${runId}`),
  );
  assertEqual(notFound.rows[0].resolution_status, "NOT_FOUND", "missing exact resolution status");
  for (const field of [
    "professional_id",
    "first_name",
    "last_name",
    "professional_center_id",
    "professional_center_updated_at",
  ]) {
    assertEqual(notFound.rows[0][field], null, `missing exact resolution ${field}`);
  }

  const externalProfessionalId = own("professionals", randomUUID());
  const externalProfessionalCenterId = own("professionalCenters", randomUUID());
  const externalDocument = `EXTERNAL-${runId}`;
  await control.query(
    `insert into public.professionals (
       id, first_name, last_name, nationality_code, document_number, email, phone
     ) values ($1,'Grace','Hopper','AR',$2,$3,'private-phone')`,
    [externalProfessionalId, externalDocument, `private-${runId}@example.test`],
  );
  await control.query(
    `insert into public.professional_centers (
       id, professional_id, center_id, license_number,
       usual_appointment_duration_minutes
     ) values ($1,$2,$3,'PRIVATE-LICENSE',45)`,
    [externalProfessionalCenterId, externalProfessionalId, ids.centerB],
  );

  const unresolved = await asUser(testClient, actors.get("adminA").id, (database) =>
    resolveProfessional(database, ids.centerA, " ar ", ` ${externalDocument.toLowerCase()} `),
  );
  assertEqual(unresolved.rows[0].resolution_status, "NOT_LINKED", "exact resolution status");
  assertEqual(unresolved.rows[0].first_name, "Grace", "exact resolution first name");
  assertEqual(unresolved.rows[0].last_name, "Hopper", "exact resolution last name");
  assertEqual(
    JSON.stringify(Object.keys(unresolved.rows[0]).sort()),
    JSON.stringify(
      [
        "first_name",
        "last_name",
        "professional_center_id",
        "professional_center_updated_at",
        "professional_id",
        "resolution_status",
      ].sort(),
    ),
    "exact resolution output columns",
  );

  const globalReadBeforeLink = await asUser(testClient, actors.get("adminA").id, (database) =>
    database.query("select id from public.professionals where id=$1", [externalProfessionalId]),
  );
  assertEqual(globalReadBeforeLink.rows.length, 0, "cross-center direct Professional visibility");

  const linked = await asUser(testClient, actors.get("adminA").id, (database) =>
    linkProfessional(database, ids.centerA, externalProfessionalId, "AR", externalDocument, null),
  );
  const linkedPcId = own("professionalCenters", linked.rows[0].professional_center_id);
  assertEqual(linked.rows[0].outcome, "CREATED_LINK", "existing Professional link outcome");
  const linkedResolution = await asUser(testClient, actors.get("adminA").id, (database) =>
    resolveProfessional(database, ids.centerA, "AR", externalDocument),
  );
  assertEqual(
    linkedResolution.rows[0].resolution_status,
    "LINKED_ACTIVE",
    "linked exact resolution status",
  );

  const linkedAgain = await asUser(testClient, actors.get("adminA").id, (database) =>
    linkProfessional(database, ids.centerA, externalProfessionalId, "AR", externalDocument, null),
  );
  assertEqual(linkedAgain.rows[0].outcome, "REUSED_ACTIVE", "active link reuse outcome");
  assertEqual(linkedAgain.rows[0].professional_center_id, linkedPcId, "active link reused row");

  const countsBeforeCreate = await control.query(
    `select
       (select count(*)::integer from auth.users) as auth_users,
       (select count(*)::integer from public.users) as users,
       (select count(*)::integer from public.center_memberships) as memberships`,
  );
  const created = await asUser(testClient, actors.get("adminA").id, (database) =>
    createProfessional(database, ids.centerA, {
      firstName: "  Ada ",
      lastName: " Lovelace  ",
      nationalityCode: " ar ",
      documentNumber: ` 12.34-${runId} `,
      email: ` ADA-${runId}@EXAMPLE.TEST `,
      phone: " 12345 ",
      licenseNumber: " MN 123 ",
    }),
  );
  const createdProfessionalId = own("professionals", created.rows[0].professional_id);
  const createdPcId = own("professionalCenters", created.rows[0].professional_center_id);
  assertEqual(created.rows[0].outcome, "CREATED", "Professional create outcome");

  const persistedProfessional = await control.query(
    `select first_name, last_name, nationality_code, document_number,
            normalized_document, email, phone
     from public.professionals where id=$1`,
    [createdProfessionalId],
  );
  assertEqual(persistedProfessional.rows[0].first_name, "Ada", "Professional first name trim");
  assertEqual(persistedProfessional.rows[0].last_name, "Lovelace", "Professional last name trim");
  assertEqual(persistedProfessional.rows[0].nationality_code, "AR", "nationality canonicalization");
  assertEqual(
    persistedProfessional.rows[0].email,
    `ada-${runId}@example.test`,
    "PostgreSQL email normalization",
  );
  assertEqual(persistedProfessional.rows[0].phone, "12345", "Professional phone trim");
  const countsAfterCreate = await control.query(
    `select
       (select count(*)::integer from auth.users) as auth_users,
       (select count(*)::integer from public.users) as users,
       (select count(*)::integer from public.center_memberships) as memberships`,
  );
  assertEqual(
    JSON.stringify(countsAfterCreate.rows[0]),
    JSON.stringify(countsBeforeCreate.rows[0]),
    "Professional create did not create Auth/User/membership",
  );

  for (const [index, emailCase] of emailContractCases.valid.entries()) {
    const emailCreated = await asUser(testClient, actors.get("adminA").id, (database) =>
      createProfessional(database, ids.centerA, {
        documentNumber: `EMAIL-VALID-${index}-${runId}`,
        email: emailCase.input,
      }),
    );
    own("professionals", emailCreated.rows[0].professional_id);
    own("professionalCenters", emailCreated.rows[0].professional_center_id);
    const storedEmail = await control.query("select email from public.professionals where id=$1", [
      emailCreated.rows[0].professional_id,
    ]);
    assertEqual(
      storedEmail.rows[0].email,
      emailCase.normalized,
      `PostgreSQL shared valid email case ${emailCase.input}`,
    );
  }

  const professionalCountBeforeInvalidEmail = Number(
    (await control.query("select count(*) from public.professionals")).rows[0].count,
  );
  for (const [index, email] of emailContractCases.invalid.entries()) {
    await expectSqlState(
      () =>
        asUser(testClient, actors.get("adminA").id, (database) =>
          createProfessional(database, ids.centerA, {
            documentNumber: `EMAIL-INVALID-${index}-${runId}`,
            email,
          }),
        ),
      "22023",
      "INVALID_PROFESSIONAL_INPUT",
      `PostgreSQL shared invalid email case ${email}`,
    );
  }
  assertEqual(
    Number((await control.query("select count(*) from public.professionals")).rows[0].count),
    professionalCountBeforeInvalidEmail,
    "invalid email did not insert Professional",
  );

  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        createProfessional(database, ids.centerA, {
          documentNumber: `12 34–${runId.toLowerCase()}`,
          email: `other-${runId}@example.test`,
        }),
      ),
    "P0001",
    "PROFESSIONAL_IDENTITY_ALREADY_EXISTS",
    "canonical Professional deduplication",
  );
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        createProfessional(database, ids.centerA, {
          documentNumber: `INVALID-DURATION-${runId}`,
          email: `duration-${runId}@example.test`,
          duration: 31,
        }),
      ),
    "22023",
    "INVALID_PROFESSIONAL_INPUT",
    "PostgreSQL Professional duration validation",
  );

  let pcToken = created.rows[0].professional_center_updated_at;
  const pcNoop = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateProfessionalCenter(database, ids.centerA, createdPcId, pcToken, " MN 123 ", 30),
  );
  assertEqual(pcNoop.rows[0].updated_at, pcToken, "PC no-op CAS");
  const pcUpdated = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateProfessionalCenter(database, ids.centerA, createdPcId, pcToken, "MN 999", 45),
  );
  const stalePcToken = pcToken;
  pcToken = pcUpdated.rows[0].updated_at;
  assert(pcToken !== stalePcToken, "PC token did not advance.");
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        updateProfessionalCenter(database, ids.centerA, createdPcId, stalePcToken, "MN 888", 50),
      ),
    "P0001",
    "STALE_PROFESSIONAL_CENTER_STATE",
    "stale ProfessionalCenter update",
  );

  const specialty = await asUser(testClient, actors.get("adminA").id, (database) =>
    createSpecialty(database, ids.centerA, " Cardiology ", " Main specialty "),
  );
  const specialtyId = own("specialties", specialty.rows[0].specialty_id);
  let specialtyToken = specialty.rows[0].updated_at;
  assertEqual(specialty.rows[0].name, "Cardiology", "Specialty name trim");
  assertEqual(specialty.rows[0].description, "Main specialty", "Specialty description trim");

  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        createSpecialty(database, ids.centerA, " cardiology ", null),
      ),
    "P0001",
    "SPECIALTY_NAME_ALREADY_EXISTS",
    "case-insensitive trimmed Specialty deduplication",
  );

  const specialtyNoop = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateSpecialty(
      database,
      ids.centerA,
      specialtyId,
      specialtyToken,
      " Cardiology ",
      " Main specialty ",
    ),
  );
  assertEqual(specialtyNoop.rows[0].updated_at, specialtyToken, "Specialty edit no-op CAS");
  const specialtyUpdated = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateSpecialty(database, ids.centerA, specialtyId, specialtyToken, "Cardiology", "Updated"),
  );
  const staleSpecialtyToken = specialtyToken;
  specialtyToken = specialtyUpdated.rows[0].updated_at;
  const reservedSpecialty = await asUser(testClient, actors.get("adminA").id, (database) =>
    createSpecialty(database, ids.centerA, `Reserved ${runId}`),
  );
  own("specialties", reservedSpecialty.rows[0].specialty_id);
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        updateSpecialty(
          database,
          ids.centerA,
          specialtyId,
          specialtyToken,
          ` reserved ${runId} `,
          "Updated",
        ),
      ),
    "P0001",
    "SPECIALTY_NAME_ALREADY_EXISTS",
    "Specialty rename collision",
  );
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        setSpecialtyActive(database, ids.centerA, specialtyId, staleSpecialtyToken, false),
      ),
    "P0001",
    "STALE_SPECIALTY_STATE",
    "stale Specialty state",
  );

  const sameTransactionCas = await verifySameTransactionCas(
    testClient,
    actors.get("adminA").id,
    createdPcId,
    pcToken,
    specialtyId,
    specialtyToken,
  );
  pcToken = sameTransactionCas.professionalCenterToken;
  specialtyToken = sameTransactionCas.specialtyToken;

  const batchActivated = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateSpecialties(database, ids.centerA, createdPcId, pcToken, [specialtyId], []),
  );
  assertEqual(batchActivated.rows[0].activated_count, 1, "batch activation count");
  assertEqual(batchActivated.rows[0].deactivated_count, 0, "batch deactivation count");
  const batchStaleToken = pcToken;
  pcToken = batchActivated.rows[0].professional_center_updated_at;
  assert(pcToken !== batchStaleToken, "batch token did not advance.");

  const batchNoop = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateSpecialties(database, ids.centerA, createdPcId, pcToken, [specialtyId], []),
  );
  assertEqual(batchNoop.rows[0].activated_count, 0, "batch activation no-op count");
  assertEqual(batchNoop.rows[0].professional_center_updated_at, pcToken, "batch no-op token");
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        updateSpecialties(database, ids.centerA, createdPcId, pcToken, [], []),
      ),
    "22023",
    "NO_SPECIALTY_CHANGES",
    "empty Specialty batch",
  );

  const crossCenterSpecialtyId = own("specialties", randomUUID());
  await control.query("insert into public.specialties (id,center_id,name) values ($1,$2,$3)", [
    crossCenterSpecialtyId,
    ids.centerB,
    `Cross batch ${runId}`,
  ]);
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        updateSpecialties(
          database,
          ids.centerA,
          createdPcId,
          pcToken,
          [specialtyId, crossCenterSpecialtyId],
          [],
        ),
      ),
    "22023",
    "INVALID_SPECIALTY_BATCH",
    "cross-center Specialty batch",
  );
  assertEqual(
    Number(
      (
        await control.query(
          `select count(*) from public.professional_center_specialties
           where professional_center_id=$1`,
          [createdPcId],
        )
      ).rows[0].count,
    ),
    1,
    "cross-center batch atomicity",
  );

  const specialtyInactive = await asUser(testClient, actors.get("adminA").id, (database) =>
    setSpecialtyActive(database, ids.centerA, specialtyId, specialtyToken, false),
  );
  specialtyToken = specialtyInactive.rows[0].updated_at;
  const associationPreserved = await control.query(
    `select is_active from public.professional_center_specialties
     where professional_center_id=$1 and specialty_id=$2`,
    [createdPcId, specialtyId],
  );
  assertEqual(associationPreserved.rows[0].is_active, true, "Specialty deactivation preservation");
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        updateSpecialties(database, ids.centerA, createdPcId, pcToken, [specialtyId], []),
      ),
    "P0001",
    "SPECIALTY_NOT_ACTIVE",
    "inactive Specialty activation",
  );
  const specialtyReactivated = await asUser(testClient, actors.get("adminA").id, (database) =>
    setSpecialtyActive(database, ids.centerA, specialtyId, specialtyToken, true),
  );
  specialtyToken = specialtyReactivated.rows[0].updated_at;
  const specialtyStateNoop = await asUser(testClient, actors.get("adminA").id, (database) =>
    setSpecialtyActive(database, ids.centerA, specialtyId, specialtyToken, true),
  );
  assertEqual(specialtyStateNoop.rows[0].updated_at, specialtyToken, "Specialty state no-op token");

  const batchDeactivated = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateSpecialties(database, ids.centerA, createdPcId, pcToken, [], [specialtyId]),
  );
  assertEqual(batchDeactivated.rows[0].deactivated_count, 1, "batch deactivation count");
  pcToken = batchDeactivated.rows[0].professional_center_updated_at;
  const batchDeactivateNoop = await asUser(testClient, actors.get("adminA").id, (database) =>
    updateSpecialties(database, ids.centerA, createdPcId, pcToken, [], [specialtyId]),
  );
  assertEqual(batchDeactivateNoop.rows[0].deactivated_count, 0, "batch deactivation no-op");
  assertEqual(
    batchDeactivateNoop.rows[0].professional_center_updated_at,
    pcToken,
    "batch deactivation no-op token",
  );

  const pcActiveNoop = await asUser(testClient, actors.get("adminA").id, (database) =>
    setProfessionalCenterActive(database, ids.centerA, createdPcId, pcToken, true),
  );
  assertEqual(pcActiveNoop.rows[0].updated_at, pcToken, "PC state no-op token");
  const pcInactive = await asUser(testClient, actors.get("adminA").id, (database) =>
    setProfessionalCenterActive(database, ids.centerA, createdPcId, pcToken, false),
  );
  pcToken = pcInactive.rows[0].updated_at;
  const inactiveResolution = await asUser(testClient, actors.get("adminA").id, (database) =>
    resolveProfessional(database, ids.centerA, "AR", `12.34-${runId}`),
  );
  assertEqual(
    inactiveResolution.rows[0].resolution_status,
    "LINKED_INACTIVE",
    "inactive exact resolution status",
  );
  assertEqual(
    inactiveResolution.rows[0].professional_center_updated_at,
    pcToken,
    "inactive exact resolution CAS token",
  );
  const reactivated = await asUser(testClient, actors.get("adminA").id, (database) =>
    linkProfessional(database, ids.centerA, createdProfessionalId, "AR", `12.34-${runId}`, pcToken),
  );
  assertEqual(reactivated.rows[0].outcome, "REACTIVATED", "PC reactivation outcome");
  assertEqual(reactivated.rows[0].professional_center_id, createdPcId, "PC reactivation row reuse");
  pcToken = reactivated.rows[0].professional_center_updated_at;
  const preservedPc = await control.query(
    `select license_number, usual_appointment_duration_minutes
     from public.professional_centers where id=$1`,
    [createdPcId],
  );
  assertEqual(preservedPc.rows[0].license_number, "MN 1001", "reactivation license preservation");
  assertEqual(
    preservedPc.rows[0].usual_appointment_duration_minutes,
    55,
    "reactivation duration preservation",
  );
  const preservedAssociation = await control.query(
    `select is_active from public.professional_center_specialties
     where professional_center_id=$1 and specialty_id=$2`,
    [createdPcId, specialtyId],
  );
  assertEqual(
    preservedAssociation.rows[0].is_active,
    false,
    "reactivation association preservation",
  );

  await control.query(
    `update public.center_memberships
     set role='PROFESSIONAL', professional_center_id=$2, is_active=true
     where id=$1`,
    [ids.membershipTarget, createdPcId],
  );
  await expectSqlState(
    () =>
      asUser(testClient, actors.get("adminA").id, (database) =>
        setProfessionalCenterActive(database, ids.centerA, createdPcId, pcToken, false),
      ),
    "P0001",
    "PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP",
    "ProfessionalCenter active membership blocker",
  );

  return { createdPcId, createdProfessionalId, pcToken, specialtyId };
}

async function runQueuedPair({
  control,
  clientA,
  clientB,
  actorA,
  actorB = actorA,
  lockText,
  actionA,
  actionB,
  description,
}) {
  let controllerHasLock = false;
  let transactionA = false;
  let transactionB = false;
  try {
    await sessionLock(control, lockText);
    controllerHasLock = true;
    await beginAsUser(clientA, actorA);
    transactionA = true;
    await beginAsUser(clientB, actorB);
    transactionB = true;
    const pidA = Number((await clientA.query("select pg_backend_pid() as pid")).rows[0].pid);
    const pidB = Number((await clientB.query("select pg_backend_pid() as pid")).rows[0].pid);

    const pendingA = tagged("A", actionA(clientA));
    await observeAdvisoryWaits(control, [pidA], `${description} A barrier`);
    const pendingB = tagged("B", actionB(clientB));
    await observeAdvisoryWaits(control, [pidA, pidB], `${description} A/B barrier`);

    await sessionUnlock(control, lockText);
    controllerHasLock = false;

    const resultA = await withTimeout(pendingA, `${description} transaction A`);
    if (resultA.status === "fulfilled") {
      await clientA.query("commit");
    } else {
      await clientA.query("rollback");
    }
    transactionA = false;

    const resultB = await withTimeout(pendingB, `${description} transaction B`);
    if (resultB.status === "fulfilled") {
      await clientB.query("commit");
    } else {
      await clientB.query("rollback");
    }
    transactionB = false;
    return { resultA, resultB };
  } finally {
    if (controllerHasLock) await sessionUnlock(control, lockText).catch(() => {});
    if (transactionA) await clientA.query("rollback").catch(() => {});
    if (transactionB) await clientB.query("rollback").catch(() => {});
  }
}

function assertRejected(result, code, token, description) {
  assertEqual(result.status, "rejected", `${description} status`);
  assertEqual(result.error?.code, code, `${description} SQLSTATE`);
  assertEqual(result.error?.message, token, `${description} token`);
}

async function verifyConcurrency(control, clientA, clientB) {
  const createDocument = `CONCURRENT-CREATE-${runId}`;
  const normalizedCreateDocument = createDocument.replaceAll("-", "").toUpperCase();
  const identityLock = `salud-plus:professional-identity:AR:${normalizedCreateDocument}`;
  const createRace = await runQueuedPair({
    control,
    clientA,
    clientB,
    actorA: actors.get("adminA").id,
    actorB: actors.get("adminB").id,
    lockText: identityLock,
    actionA: (database) =>
      createProfessional(database, ids.centerA, {
        documentNumber: createDocument,
        email: `concurrent-a-${runId}@example.test`,
      }),
    actionB: (database) =>
      createProfessional(database, ids.centerB, {
        documentNumber: createDocument,
        email: `concurrent-b-${runId}@example.test`,
      }),
    description: "Professional create/create",
  });
  assertEqual(createRace.resultA.status, "fulfilled", "Professional create/create winner");
  assertRejected(
    createRace.resultB,
    "P0001",
    "PROFESSIONAL_IDENTITY_ALREADY_EXISTS",
    "Professional create/create loser",
  );
  own("professionals", createRace.resultA.value.rows[0].professional_id);
  own("professionalCenters", createRace.resultA.value.rows[0].professional_center_id);
  const duplicateCount = await control.query(
    `select count(*)::integer as count
     from public.professionals
     where nationality_code='AR' and normalized_document=private.normalize_document($1)`,
    [createDocument],
  );
  assertEqual(duplicateCount.rows[0].count, 1, "concurrent Professional identity count");

  const linkProfessionalId = own("professionals", randomUUID());
  const linkDocument = `CONCURRENT-LINK-${runId}`;
  await control.query(
    `insert into public.professionals (
       id, first_name, last_name, nationality_code, document_number, email
     ) values ($1,'Link','Race','AR',$2,$3)`,
    [linkProfessionalId, linkDocument, `link-${runId}@example.test`],
  );
  const linkRace = await runQueuedPair({
    control,
    clientA,
    clientB,
    actorA: actors.get("adminA").id,
    lockText: `salud-plus:center:${ids.centerA}`,
    actionA: (database) =>
      linkProfessional(database, ids.centerA, linkProfessionalId, "AR", linkDocument, null),
    actionB: (database) =>
      linkProfessional(database, ids.centerA, linkProfessionalId, "AR", linkDocument, null),
    description: "ProfessionalCenter link/link",
  });
  assertEqual(linkRace.resultA.status, "fulfilled", "link/link transaction A");
  assertEqual(linkRace.resultB.status, "fulfilled", "link/link transaction B");
  assertEqual(linkRace.resultA.value.rows[0].outcome, "CREATED_LINK", "link/link create outcome");
  assertEqual(linkRace.resultB.value.rows[0].outcome, "REUSED_ACTIVE", "link/link reuse outcome");
  const linkPcId = own(
    "professionalCenters",
    linkRace.resultA.value.rows[0].professional_center_id,
  );
  assertEqual(
    linkRace.resultB.value.rows[0].professional_center_id,
    linkPcId,
    "link/link row identity",
  );

  const deactivatedForRace = await asUser(clientA, actors.get("adminA").id, (database) =>
    setProfessionalCenterActive(
      database,
      ids.centerA,
      linkPcId,
      linkRace.resultA.value.rows[0].professional_center_updated_at,
      false,
    ),
  );
  const inactiveToken = deactivatedForRace.rows[0].updated_at;
  const reactivationRace = await runQueuedPair({
    control,
    clientA,
    clientB,
    actorA: actors.get("adminA").id,
    lockText: `salud-plus:center:${ids.centerA}`,
    actionA: (database) =>
      linkProfessional(
        database,
        ids.centerA,
        linkProfessionalId,
        "AR",
        linkDocument,
        inactiveToken,
      ),
    actionB: (database) =>
      linkProfessional(
        database,
        ids.centerA,
        linkProfessionalId,
        "AR",
        linkDocument,
        inactiveToken,
      ),
    description: "ProfessionalCenter reactivation/reactivation",
  });
  assertEqual(reactivationRace.resultA.status, "fulfilled", "reactivation winner");
  assertEqual(
    reactivationRace.resultA.value.rows[0].outcome,
    "REACTIVATED",
    "reactivation outcome",
  );
  assertRejected(
    reactivationRace.resultB,
    "P0001",
    "STALE_PROFESSIONAL_CENTER_STATE",
    "reactivation stale loser",
  );

  const specialtyRace = await runQueuedPair({
    control,
    clientA,
    clientB,
    actorA: actors.get("adminA").id,
    lockText: `salud-plus:center:${ids.centerA}`,
    actionA: (database) => createSpecialty(database, ids.centerA, `Concurrent Specialty ${runId}`),
    actionB: (database) =>
      createSpecialty(database, ids.centerA, ` concurrent specialty ${runId} `),
    description: "Specialty create/create",
  });
  assertEqual(specialtyRace.resultA.status, "fulfilled", "Specialty create/create winner");
  assertRejected(
    specialtyRace.resultB,
    "P0001",
    "SPECIALTY_NAME_ALREADY_EXISTS",
    "Specialty create/create loser",
  );
  own("specialties", specialtyRace.resultA.value.rows[0].specialty_id);

  const batchProfessionalId = own("professionals", randomUUID());
  const batchPcId = own("professionalCenters", randomUUID());
  const batchSpecialtyA = own("specialties", randomUUID());
  const batchSpecialtyB = own("specialties", randomUUID());
  await control.query(
    `insert into public.professionals (
       id, first_name, last_name, nationality_code, document_number, email
     ) values ($1,'Batch','Race','AR',$2,$3)`,
    [batchProfessionalId, `BATCH-${runId}`, `batch-${runId}@example.test`],
  );
  const batchPc = await control.query(
    `insert into public.professional_centers (id, professional_id, center_id)
     values ($1,$2,$3) returning updated_at`,
    [batchPcId, batchProfessionalId, ids.centerA],
  );
  await control.query(
    `insert into public.specialties (id, center_id, name)
     values ($1,$2,$3),($4,$2,$5)`,
    [batchSpecialtyA, ids.centerA, `Batch A ${runId}`, batchSpecialtyB, `Batch B ${runId}`],
  );
  const batchToken = batchPc.rows[0].updated_at;
  const batchRace = await runQueuedPair({
    control,
    clientA,
    clientB,
    actorA: actors.get("adminA").id,
    lockText: `salud-plus:center:${ids.centerA}`,
    actionA: (database) =>
      updateSpecialties(database, ids.centerA, batchPcId, batchToken, [batchSpecialtyA], []),
    actionB: (database) =>
      updateSpecialties(database, ids.centerA, batchPcId, batchToken, [batchSpecialtyB], []),
    description: "ProfessionalCenter Specialty batch/batch",
  });
  assertEqual(batchRace.resultA.status, "fulfilled", "batch/batch winner");
  assertRejected(
    batchRace.resultB,
    "P0001",
    "STALE_PROFESSIONAL_CENTER_STATE",
    "batch/batch stale loser",
  );
  const batchAssociations = await control.query(
    `select specialty_id from public.professional_center_specialties
     where professional_center_id=$1 order by specialty_id`,
    [batchPcId],
  );
  assertEqual(batchAssociations.rows.length, 1, "batch/batch atomic association count");
  assertEqual(batchAssociations.rows[0].specialty_id, batchSpecialtyA, "batch/batch winning delta");

  const invariantProfessionalId = own("professionals", randomUUID());
  const invariantPcId = own("professionalCenters", randomUUID());
  await control.query(
    `insert into public.professionals (
       id, first_name, last_name, nationality_code, document_number, email
     ) values ($1,'Invariant','Race','AR',$2,$3)`,
    [invariantProfessionalId, `INVARIANT-${runId}`, `invariant-${runId}@example.test`],
  );
  const invariantPc = await control.query(
    `insert into public.professional_centers (id, professional_id, center_id)
     values ($1,$2,$3) returning updated_at`,
    [invariantPcId, invariantProfessionalId, ids.centerA],
  );
  const invariantRace = await runQueuedPair({
    control,
    clientA,
    clientB,
    actorA: actors.get("adminA").id,
    lockText: `salud-plus:center:${ids.centerA}`,
    actionA: (database) =>
      database.query(
        `select * from public.admin_set_center_membership(
           $1,$2,'PROFESSIONAL',$3,true,'RECEPTION',null,true
         )`,
        [ids.centerA, ids.membershipReception, invariantPcId],
      ),
    actionB: (database) =>
      setProfessionalCenterActive(
        database,
        ids.centerA,
        invariantPcId,
        invariantPc.rows[0].updated_at,
        false,
      ),
    description: "membership assignment/ProfessionalCenter deactivation",
  });
  assertEqual(invariantRace.resultA.status, "fulfilled", "membership assignment winner");
  assertRejected(
    invariantRace.resultB,
    "P0001",
    "PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP",
    "ProfessionalCenter deactivation loser",
  );
  const invariantState = await control.query(
    `select professional_center.is_active as pc_active,
            membership.is_active as membership_active,
            membership.role,
            membership.professional_center_id
     from public.professional_centers as professional_center
     join public.center_memberships as membership on membership.id=$2
     where professional_center.id=$1`,
    [invariantPcId, ids.membershipReception],
  );
  assertEqual(invariantState.rows[0].pc_active, true, "D4 final PC state");
  assertEqual(invariantState.rows[0].membership_active, true, "D4 final membership state");
  assertEqual(invariantState.rows[0].role, "PROFESSIONAL", "D4 final membership role");
  assertEqual(
    invariantState.rows[0].professional_center_id,
    invariantPcId,
    "D4 final membership link",
  );
}

if (process.argv.includes("--baseline-only")) {
  const baselineControl = await connect("baseline-only");
  try {
    const snapshot = await persistentSnapshot(baselineControl);
    assertApprovedBaseline(snapshot, "DEV baseline before TASK-006F tests");
    assertEqual(
      snapshotDigest(snapshot),
      expectedBaselineDigest,
      "exact approved DEV baseline digest",
    );
    console.log(`DEV baseline before TASK-006F: sha256=${snapshotDigest(snapshot)}.`);
  } finally {
    await baselineControl.end();
  }
  process.exit(0);
}

let control;
let testClient;
let concurrencyA;
let concurrencyB;
let baselineBefore;
let scenarioError;
const cleanupErrors = [];

try {
  control = await connect("control");
  testClient = await connect("functional");
  concurrencyA = await connect("concurrency-a");
  concurrencyB = await connect("concurrency-b");

  baselineBefore = await persistentSnapshot(control);
  assertApprovedBaseline(baselineBefore, "DEV baseline before TASK-006B tests");
  console.log(`DEV baseline before TASK-006B: sha256=${snapshotDigest(baselineBefore)}.`);

  await control.query(readFileSync(resolve("supabase/tests/task-006b-foundation.sql"), "utf8"));
  await setupFixtures(control);
  await verifyAuthorizationAndRls(control, testClient);
  await verifyOlderTransactionCannotRegressCas(control, concurrencyA, concurrencyB);
  await verifyProfessionalAndSpecialtyContracts(control, testClient);
  await verifyConcurrency(control, concurrencyA, concurrencyB);

  console.log(
    "TASK-006B DB/RLS/RPC verification passed, including deterministic lock-observed concurrency.",
  );
} catch (error) {
  scenarioError = error;
} finally {
  for (const client of [testClient, concurrencyA, concurrencyB]) {
    if (!client) continue;
    try {
      await client.query("rollback").catch(() => {});
      await client.end();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (control) {
    try {
      await cleanup(control);
    } catch (error) {
      cleanupErrors.push(error);
    }

    try {
      const baselineAfter = await persistentSnapshot(control);
      assertApprovedBaseline(baselineAfter, "DEV baseline after TASK-006B tests");
      assertEqual(
        JSON.stringify(baselineAfter),
        JSON.stringify(baselineBefore),
        "exact persistent DEV baseline preservation",
      );
      console.log(`DEV baseline after TASK-006B: sha256=${snapshotDigest(baselineAfter)}.`);
    } catch (error) {
      cleanupErrors.push(error);
    }

    await control.end().catch((error) => cleanupErrors.push(error));
  }
}

if (scenarioError) {
  if (cleanupErrors.length > 0) {
    scenarioError.cleanupErrors = cleanupErrors;
    console.error("TASK-006B cleanup also encountered errors:", ...cleanupErrors);
  }
  throw scenarioError;
}

if (cleanupErrors.length > 0) {
  throw new AggregateError(cleanupErrors, "TASK-006B verification passed but cleanup failed.");
}
