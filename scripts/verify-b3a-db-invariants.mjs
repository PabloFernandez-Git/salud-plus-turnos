import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
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
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");
const baselineOnly = process.argv.includes("--baseline-only");
const expectedCenterId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const expectedOperationIds = [
  "352a309e-f137-488e-b6e7-4b53e2cdb7b2",
  "964ec4bf-eeba-4f4f-914a-d2a8ca101934",
];

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
    connectionTimeoutMillis: 20_000,
  };
  return cachedDatabaseConfig;
}

async function connect(label) {
  const client = new Client({
    ...temporaryDatabaseConfig(),
    application_name: `task005b3a-${label}`,
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

async function expectSqlState(action, code, description, messagePattern) {
  try {
    await action();
  } catch (error) {
    if (error?.code !== code) {
      throw new Error(`${description}: expected SQLSTATE ${code}, received ${error?.code}.`, {
        cause: error,
      });
    }
    if (messagePattern && !messagePattern.test(error.message)) {
      throw new Error(`${description}: unexpected error message.`, { cause: error });
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

async function observePendingCenterLock(control, pid, description) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = await control.query(
      `select exists (
         select 1 from pg_catalog.pg_locks
         where pid=$1 and locktype='advisory' and not granted
       ) as waiting`,
      [pid],
    );
    if (waiting.rows[0].waiting) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error(`${description}: no pending advisory lock was observed.`);
}

async function persistentSnapshot(client) {
  const result = await client.query(
    `select pg_catalog.jsonb_build_object(
       'counts', pg_catalog.jsonb_build_object(
         'auth_users', (select count(*)::int from auth.users),
         'public_users', (select count(*)::int from public.users),
         'platform_admins', (select count(*)::int from public.platform_admins),
         'centers', (select count(*)::int from public.centers),
         'active_centers', (select count(*)::int from public.centers where is_active),
         'memberships', (select count(*)::int from public.center_memberships),
         'active_admin_memberships', (
           select count(*)::int from public.center_memberships
           where role='ADMIN' and is_active
         ),
         'operations', (select count(*)::int from private.provisioning_operations),
         'succeeded_operations', (
           select count(*)::int from private.provisioning_operations where status='SUCCEEDED'
         ),
         'professionals', (select count(*)::int from public.professionals),
         'professional_centers', (select count(*)::int from public.professional_centers),
         'specialties', (select count(*)::int from public.specialties),
         'active_professional_duplicates', (
           select count(*)::int
           from (
             select professional_center_id
             from public.center_memberships
             where role='PROFESSIONAL' and is_active
             group by professional_center_id
             having count(*) > 1
           ) duplicates
         )
       ),
       'auth_users', coalesce((
         select pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'id', id,
             'email', email,
             'encrypted_password', encrypted_password,
             'raw_user_meta_data', raw_user_meta_data
           ) order by id
         ) from auth.users
       ), '[]'::jsonb),
       'public_users', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(app_user) order by app_user.id)
         from public.users app_user
       ), '[]'::jsonb),
       'platform_admins', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(platform_admin) order by platform_admin.user_id)
         from public.platform_admins platform_admin
       ), '[]'::jsonb),
       'centers', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(center_record) order by center_record.id)
         from public.centers center_record
       ), '[]'::jsonb),
       'memberships', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(membership) order by membership.id)
         from public.center_memberships membership
       ), '[]'::jsonb),
       'operations', coalesce((
         select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(operation) order by operation.id)
         from private.provisioning_operations operation
       ), '[]'::jsonb)
     ) as snapshot`,
  );
  return result.rows[0].snapshot;
}

function assertApprovedBaseline(snapshot, description) {
  const expectedCounts = {
    auth_users: 1,
    public_users: 1,
    platform_admins: 1,
    centers: 1,
    active_centers: 1,
    memberships: 1,
    active_admin_memberships: 1,
    operations: 2,
    succeeded_operations: 2,
    professionals: 0,
    professional_centers: 0,
    specialties: 0,
    active_professional_duplicates: 0,
  };
  for (const [kind, expected] of Object.entries(expectedCounts)) {
    assertEqual(snapshot.counts[kind], expected, `${description} ${kind}`);
  }
  assertEqual(snapshot.centers[0]?.id, expectedCenterId, `${description} Center id`);
  assertEqual(snapshot.centers[0]?.name, "Centro Médico Salud Plus", `${description} Center name`);
  assertEqual(snapshot.centers[0]?.is_active, true, `${description} Center status`);
  assertEqual(
    snapshot.memberships[0]?.center_id,
    expectedCenterId,
    `${description} membership Center`,
  );
  assertEqual(snapshot.memberships[0]?.role, "ADMIN", `${description} membership role`);
  assertEqual(snapshot.memberships[0]?.is_active, true, `${description} membership status`);
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
    `${description} provisioning operations`,
  );
}

const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const password = randomBytes(24).toString("base64url");
const fixtureNames = [
  "adminA1",
  "adminA2",
  "crossRole",
  "reception",
  "professional",
  "inactiveAdmin",
  "platformOnly",
  "bOnly",
  "existing",
  "provisionCandidate",
  "setCandidate",
  "historyA",
  "historyB",
];
const fixtures = new Map();
const createdAuthUserIds = [];
const centerIds = [];
const professionalIds = [];
const operationIds = [];
let control;
let transactionA;
let transactionB;
let baselineBefore;

async function createAuthFixtures() {
  for (const name of fixtureNames) {
    const email = `task005b3a-${runId}-${name.toLowerCase()}@example.test`;
    const { data, error } = await authAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Could not create Auth fixture ${name}.`);
    fixtures.set(name, { id: data.user.id, email });
    createdAuthUserIds.push(data.user.id);
  }
}

async function prepareAndBindTenantOperation({
  actor,
  centerId,
  target,
  firstName,
  lastName,
  role,
  professionalCenterId = null,
  authUserWasCreated = true,
}) {
  const operationId = randomUUID();
  operationIds.push(operationId);
  const prepared = await control.query(
    "select * from public.prepare_tenant_user_provisioning_operation($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      operationId,
      actor.id,
      centerId,
      target.email,
      firstName,
      lastName,
      role,
      professionalCenterId,
    ],
  );
  await control.query("select * from public.bind_auth_provisioning_operation($1,$2,$3,$4)", [
    operationId,
    prepared.rows[0].payload_hash,
    target.id,
    authUserWasCreated,
  ]);
  return operationId;
}

async function provision(
  client,
  actor,
  operationId,
  centerId,
  target,
  firstName,
  lastName,
  role,
  pcId,
) {
  return asUser(client, actor.id, (database) =>
    database.query("select * from public.admin_provision_center_user($1,$2,$3,$4,$5,$6,$7)", [
      operationId,
      centerId,
      target.id,
      firstName,
      lastName,
      role,
      pcId,
    ]),
  );
}

async function setMembership(client, actor, centerId, membershipId, role, pcId, isActive) {
  return asUser(client, actor.id, (database) =>
    database.query("select * from public.admin_set_center_membership($1,$2,$3,$4,$5)", [
      centerId,
      membershipId,
      role,
      pcId,
      isActive,
    ]),
  );
}

async function verifyCatalog() {
  await control.query(readFileSync(resolve("supabase/tests/auth-access-foundation.sql"), "utf8"));

  const index = await control.query(
    `select
       index_record.indisunique,
       pg_catalog.pg_get_indexdef(index_record.indexrelid) as definition,
       pg_catalog.pg_get_expr(index_record.indpred, index_record.indrelid) as predicate
     from pg_catalog.pg_index index_record
     where index_record.indexrelid =
       'public.center_memberships_active_professional_center_key'::regclass`,
  );
  assertEqual(index.rows.length, 1, "partial unique index presence");
  assertEqual(index.rows[0].indisunique, true, "partial index uniqueness");
  assert(/\(professional_center_id\)/.test(index.rows[0].definition), "Index column differs.");
  assert(
    /role = 'PROFESSIONAL'::(?:public\.)?membership_role/.test(index.rows[0].predicate),
    "Index role predicate differs.",
  );
  assert(/is_active/.test(index.rows[0].predicate), "Index active predicate differs.");

  const functions = [
    "public.admin_provision_center_user(uuid,uuid,uuid,text,text,public.membership_role,uuid)",
    "public.admin_set_center_membership(uuid,uuid,public.membership_role,uuid,boolean)",
  ];
  for (const signature of functions) {
    const security = await control.query(
      `select prosecdef, proconfig, pg_catalog.pg_get_functiondef(oid) as definition
       from pg_catalog.pg_proc where oid=$1::regprocedure`,
      [signature],
    );
    assert(security.rows[0].prosecdef, `${signature} is not SECURITY DEFINER.`);
    assert(
      security.rows[0].proconfig?.includes('search_path=""'),
      `${signature} search_path differs.`,
    );
    assert(
      security.rows[0].definition.includes("salud-plus:center:"),
      `${signature} does not use the common Center advisory lock.`,
    );
    for (const role of ["public", "anon"]) {
      const privilege = await control.query(
        "select pg_catalog.has_function_privilege($1,$2::regprocedure,'EXECUTE') as allowed",
        [role, signature],
      );
      assertEqual(privilege.rows[0].allowed, false, `${role} EXECUTE ${signature}`);
    }
    const authenticated = await control.query(
      "select pg_catalog.has_function_privilege('authenticated',$1::regprocedure,'EXECUTE') as allowed",
      [signature],
    );
    assertEqual(authenticated.rows[0].allowed, true, `authenticated EXECUTE ${signature}`);
  }

  const policies = await control.query(
    "select policyname from pg_catalog.pg_policies where schemaname='public' order by policyname",
  );
  assertEqual(policies.rows.length, 6, "public policy count");
  const badPrivileges = await control.query(
    `select exists (
       select 1
       from pg_catalog.pg_class table_record
       join pg_catalog.pg_namespace namespace_record on namespace_record.oid=table_record.relnamespace
       where namespace_record.nspname='public' and table_record.relkind='r'
         and (
           pg_catalog.has_table_privilege('anon',table_record.oid,'SELECT,INSERT,UPDATE,DELETE')
           or pg_catalog.has_table_privilege('authenticated',table_record.oid,'INSERT,UPDATE,DELETE')
         )
     ) as exists`,
  );
  assertEqual(badPrivileges.rows[0].exists, false, "generic domain DML grants");
}

async function cleanupDatabase() {
  if (!control || createdAuthUserIds.length === 0) return;
  await control.query("begin");
  try {
    if (centerIds.length > 0) {
      await control.query("delete from public.center_memberships where center_id=any($1::uuid[])", [
        centerIds,
      ]);
      await control.query(
        "delete from public.professional_centers where center_id=any($1::uuid[])",
        [centerIds],
      );
      await control.query("delete from public.centers where id=any($1::uuid[])", [centerIds]);
    }
    if (professionalIds.length > 0) {
      await control.query("delete from public.professionals where id=any($1::uuid[])", [
        professionalIds,
      ]);
    }
    if (operationIds.length > 0) {
      await control.query("delete from private.provisioning_operations where id=any($1::uuid[])", [
        operationIds,
      ]);
    }
    await control.query("delete from public.platform_admins where user_id=any($1::uuid[])", [
      createdAuthUserIds,
    ]);
    await control.query("delete from public.users where id=any($1::uuid[])", [createdAuthUserIds]);
    await control.query("commit");
  } catch (error) {
    await control.query("rollback");
    throw error;
  }
}

async function cleanupAuth() {
  const errors = [];
  for (const userId of [...createdAuthUserIds].reverse()) {
    const { error } = await authAdmin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "Auth fixture cleanup failed.");
}

try {
  control = await connect("control");
  baselineBefore = await persistentSnapshot(control);
  assertApprovedBaseline(baselineBefore, "DEV baseline before B3A tests");
  console.log(`DEV baseline verified before tests: ${JSON.stringify(baselineBefore.counts)}.`);

  if (!baselineOnly) {
    await verifyCatalog();
    await createAuthFixtures();

    const centerA = randomUUID();
    const centerB = randomUUID();
    centerIds.push(centerA, centerB);
    await control.query(
      `insert into public.centers (id,name,timezone,is_active)
       values ($1,$2,'America/Argentina/Buenos_Aires',true),
              ($3,$4,'America/Argentina/Buenos_Aires',true)`,
      [centerA, `TASK-005B3A A ${runId}`, centerB, `TASK-005B3A B ${runId}`],
    );

    const pcNames = ["occupied", "inactive", "other", "transition", "history", "race"];
    const pcIds = Object.fromEntries(pcNames.map((name) => [name, randomUUID()]));
    for (const name of pcNames) {
      const professionalId = randomUUID();
      professionalIds.push(professionalId);
      await control.query(
        `insert into public.professionals
          (id,first_name,last_name,nationality_code,document_number,email)
         values ($1,'B3A',$2,'AR',$3,$4)`,
        [
          professionalId,
          name,
          `TASK005B3A-${runId}-${name}`,
          `task005b3a-${runId}-${name}@example.test`,
        ],
      );
      await control.query(
        `insert into public.professional_centers
          (id,professional_id,center_id,is_active)
         values ($1,$2,$3,$4)`,
        [pcIds[name], professionalId, name === "other" ? centerB : centerA, name !== "inactive"],
      );
    }

    const profileNames = fixtureNames.filter((name) => name !== "provisionCandidate");
    for (const name of profileNames) {
      const fixture = fixtures.get(name);
      await control.query(
        "insert into public.users (id,first_name,last_name,email) values ($1,$2,$3,$4)",
        [
          fixture.id,
          name === "existing" ? "Preserved" : "B3A",
          name === "existing" ? "Identity" : name,
          fixture.email,
        ],
      );
    }

    const membershipIds = Object.fromEntries(
      [
        "adminA1",
        "adminA2",
        "crossRole",
        "reception",
        "professional",
        "inactiveAdmin",
        "bOnly",
        "setCandidate",
      ].map((name) => [name, randomUUID()]),
    );
    const membershipRows = [
      [membershipIds.adminA1, centerA, fixtures.get("adminA1").id, "ADMIN", null, true],
      [membershipIds.adminA2, centerA, fixtures.get("adminA2").id, "ADMIN", null, true],
      [membershipIds.crossRole, centerB, fixtures.get("crossRole").id, "ADMIN", null, true],
      [membershipIds.reception, centerA, fixtures.get("reception").id, "RECEPTION", null, true],
      [
        membershipIds.professional,
        centerA,
        fixtures.get("professional").id,
        "PROFESSIONAL",
        pcIds.occupied,
        true,
      ],
      [
        membershipIds.inactiveAdmin,
        centerA,
        fixtures.get("inactiveAdmin").id,
        "ADMIN",
        null,
        false,
      ],
      [membershipIds.bOnly, centerB, fixtures.get("bOnly").id, "RECEPTION", null, true],
      [
        membershipIds.setCandidate,
        centerA,
        fixtures.get("setCandidate").id,
        "RECEPTION",
        null,
        true,
      ],
    ];
    for (const row of membershipRows) {
      await control.query(
        `insert into public.center_memberships
          (id,center_id,user_id,role,professional_center_id,is_active)
         values ($1,$2,$3,$4,$5,$6)`,
        row,
      );
    }
    await control.query("insert into public.platform_admins (user_id) values ($1)", [
      fixtures.get("platformOnly").id,
    ]);

    await control.query("begin");
    try {
      await control.query("drop index public.center_memberships_active_professional_center_key");
      await control.query(
        `insert into public.center_memberships
          (id,center_id,user_id,role,professional_center_id,is_active)
         values ($1,$2,$3,'PROFESSIONAL',$4,true),($5,$2,$6,'PROFESSIONAL',$4,true)`,
        [
          randomUUID(),
          centerA,
          fixtures.get("historyA").id,
          pcIds.history,
          randomUUID(),
          fixtures.get("historyB").id,
        ],
      );
      await expectSqlState(
        () =>
          control.query(`do $migration$
          begin
            if exists (
              select 1 from public.center_memberships membership
              where membership.role='PROFESSIONAL'::public.membership_role and membership.is_active
              group by membership.professional_center_id having count(*) > 1
            ) then
              raise exception using errcode='23514',
                message='Cannot enforce active ProfessionalCenter membership uniqueness: duplicate active PROFESSIONAL memberships exist.';
            end if;
          end;
          $migration$;`),
        "23514",
        "migration duplicate preflight",
        /duplicate active PROFESSIONAL memberships/,
      );
    } finally {
      await control.query("rollback");
    }

    const historyMembershipA = randomUUID();
    const historyMembershipB = randomUUID();
    await control.query(
      `insert into public.center_memberships
        (id,center_id,user_id,role,professional_center_id,is_active)
       values ($1,$2,$3,'PROFESSIONAL',$4,true)`,
      [historyMembershipA, centerA, fixtures.get("historyA").id, pcIds.history],
    );
    await expectSqlState(
      () =>
        control.query(
          `insert into public.center_memberships
            (id,center_id,user_id,role,professional_center_id,is_active)
           values ($1,$2,$3,'PROFESSIONAL',$4,true)`,
          [historyMembershipB, centerA, fixtures.get("historyB").id, pcIds.history],
        ),
      "23505",
      "partial UNIQUE active authority",
    );
    await control.query("update public.center_memberships set is_active=false where id=$1", [
      historyMembershipA,
    ]);
    await control.query(
      `insert into public.center_memberships
        (id,center_id,user_id,role,professional_center_id,is_active)
       values ($1,$2,$3,'PROFESSIONAL',$4,false)`,
      [historyMembershipB, centerA, fixtures.get("historyB").id, pcIds.history],
    );
    const history = await control.query(
      `select count(*)::int as total,
              count(*) filter (where is_active)::int as active
       from public.center_memberships where professional_center_id=$1`,
      [pcIds.history],
    );
    assertEqual(history.rows[0].total, 2, "inactive ProfessionalCenter history count");
    assertEqual(history.rows[0].active, 0, "inactive ProfessionalCenter history active count");

    const adminA1 = fixtures.get("adminA1");
    const adminA2 = fixtures.get("adminA2");
    const existing = fixtures.get("existing");
    const provisionCandidate = fixtures.get("provisionCandidate");
    const existingOperation = await prepareAndBindTenantOperation({
      actor: adminA1,
      centerId: centerA,
      target: existing,
      firstName: "Changed",
      lastName: "Values",
      role: "RECEPTION",
      authUserWasCreated: false,
    });
    const firstProvision = await provision(
      control,
      adminA1,
      existingOperation,
      centerA,
      existing,
      "Changed",
      "Values",
      "RECEPTION",
      null,
    );
    const retriedProvision = await provision(
      control,
      adminA1,
      existingOperation,
      centerA,
      existing,
      "Changed",
      "Values",
      "RECEPTION",
      null,
    );
    assertEqual(
      retriedProvision.rows[0].membership_id,
      firstProvision.rows[0].membership_id,
      "idempotent tenant provisioning result",
    );
    await expectSqlState(
      () =>
        provision(
          control,
          adminA1,
          existingOperation,
          centerA,
          existing,
          "Changed",
          "Values",
          "ADMIN",
          null,
        ),
      "23514",
      "provisioning fingerprint mismatch",
    );
    const preserved = await control.query(
      "select first_name,last_name,email from public.users where id=$1",
      [existing.id],
    );
    assertEqual(preserved.rows[0].first_name, "Preserved", "existing first name preservation");
    assertEqual(preserved.rows[0].last_name, "Identity", "existing last name preservation");
    assertEqual(preserved.rows[0].email, existing.email, "existing email preservation");
    const passwordClient = createClient(dev.url, dev.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: passwordError } = await passwordClient.auth.signInWithPassword({
      email: existing.email,
      password,
    });
    if (passwordError)
      throw new Error("Existing Auth identity credentials changed during provisioning.");
    await passwordClient.auth.signOut({ scope: "local" });

    for (const [label, pcId, code] of [
      ["cross-center ProfessionalCenter provisioning", pcIds.other, "23514"],
      ["inactive ProfessionalCenter provisioning", pcIds.inactive, "23514"],
      ["occupied ProfessionalCenter provisioning", pcIds.occupied, "23505"],
    ]) {
      const operationId = await prepareAndBindTenantOperation({
        actor: adminA1,
        centerId: centerA,
        target: provisionCandidate,
        firstName: "Provision",
        lastName: "Candidate",
        role: "PROFESSIONAL",
        professionalCenterId: pcId,
      });
      await expectSqlState(
        () =>
          provision(
            control,
            adminA1,
            operationId,
            centerA,
            provisionCandidate,
            "Provision",
            "Candidate",
            "PROFESSIONAL",
            pcId,
          ),
        code,
        label,
      );
    }

    for (const [description, actor] of [
      ["RECEPTION tenant provisioning", fixtures.get("reception")],
      ["PROFESSIONAL tenant provisioning", fixtures.get("professional")],
      ["inactive ADMIN tenant provisioning", fixtures.get("inactiveAdmin")],
      ["PLATFORM_ADMIN-only tenant provisioning", fixtures.get("platformOnly")],
      ["other-Center ADMIN tenant provisioning", fixtures.get("crossRole")],
    ]) {
      const operationId = await prepareAndBindTenantOperation({
        actor,
        centerId: centerA,
        target: provisionCandidate,
        firstName: "Unauthorized",
        lastName: "Provision",
        role: "RECEPTION",
      });
      await expectSqlState(
        () =>
          provision(
            control,
            actor,
            operationId,
            centerA,
            provisionCandidate,
            "Unauthorized",
            "Provision",
            "RECEPTION",
            null,
          ),
        "42501",
        description,
      );
    }

    await expectSqlState(
      () =>
        setMembership(
          control,
          fixtures.get("reception"),
          centerA,
          membershipIds.setCandidate,
          "RECEPTION",
          null,
          false,
        ),
      "42501",
      "RECEPTION administration",
    );
    await expectSqlState(
      () =>
        setMembership(
          control,
          fixtures.get("professional"),
          centerA,
          membershipIds.setCandidate,
          "RECEPTION",
          null,
          false,
        ),
      "42501",
      "PROFESSIONAL administration",
    );
    await expectSqlState(
      () =>
        setMembership(
          control,
          fixtures.get("inactiveAdmin"),
          centerA,
          membershipIds.setCandidate,
          "RECEPTION",
          null,
          false,
        ),
      "42501",
      "inactive ADMIN administration",
    );
    await expectSqlState(
      () =>
        setMembership(
          control,
          fixtures.get("platformOnly"),
          centerA,
          membershipIds.setCandidate,
          "RECEPTION",
          null,
          false,
        ),
      "42501",
      "PLATFORM_ADMIN-only administration",
    );
    await expectSqlState(
      () =>
        setMembership(
          control,
          fixtures.get("crossRole"),
          centerA,
          membershipIds.setCandidate,
          "RECEPTION",
          null,
          false,
        ),
      "42501",
      "other-Center ADMIN with no Center A membership",
    );
    await expectSqlState(
      () => setMembership(control, adminA1, centerB, membershipIds.bOnly, "RECEPTION", null, false),
      "42501",
      "cross-center administration",
    );

    const exactCrossCenterIdentity = await asUser(control, adminA1.id, (database) =>
      database.query("select * from public.admin_resolve_user_by_email($1,$2)", [
        centerA,
        fixtures.get("bOnly").email,
      ]),
    );
    assertEqual(
      exactCrossCenterIdentity.rows[0].identity_exists,
      true,
      "exact known-email identity resolution",
    );
    assertEqual(
      exactCrossCenterIdentity.rows[0].center_membership_exists,
      false,
      "cross-center membership non-disclosure",
    );
    assertEqual(
      Object.hasOwn(exactCrossCenterIdentity.rows[0], "role"),
      false,
      "cross-center role non-disclosure",
    );
    const wildcardResolution = await asUser(control, adminA1.id, (database) =>
      database.query("select * from public.admin_resolve_user_by_email($1,$2)", [
        centerA,
        "%@example.test",
      ]),
    );
    assertEqual(
      wildcardResolution.rows[0].identity_exists,
      false,
      "identity wildcard enumeration denial",
    );

    for (const [description, pcId, code] of [
      ["set cross-center ProfessionalCenter", pcIds.other, "23514"],
      ["set inactive ProfessionalCenter", pcIds.inactive, "23514"],
      ["set occupied ProfessionalCenter", pcIds.occupied, "23505"],
    ]) {
      await expectSqlState(
        () =>
          setMembership(
            control,
            adminA1,
            centerA,
            membershipIds.setCandidate,
            "PROFESSIONAL",
            pcId,
            true,
          ),
        code,
        description,
      );
    }
    await setMembership(
      control,
      adminA1,
      centerA,
      membershipIds.setCandidate,
      "PROFESSIONAL",
      pcIds.transition,
      true,
    );
    await control.query("update public.professional_centers set is_active=false where id=$1", [
      pcIds.transition,
    ]);
    await setMembership(
      control,
      adminA1,
      centerA,
      membershipIds.setCandidate,
      "PROFESSIONAL",
      pcIds.transition,
      false,
    );
    await setMembership(
      control,
      adminA1,
      centerA,
      membershipIds.setCandidate,
      "PROFESSIONAL",
      pcIds.transition,
      false,
    );
    await expectSqlState(
      () =>
        setMembership(
          control,
          adminA1,
          centerA,
          membershipIds.setCandidate,
          "PROFESSIONAL",
          pcIds.transition,
          true,
        ),
      "23514",
      "reactivation with inactive ProfessionalCenter",
    );
    await expectSqlState(
      () =>
        setMembership(
          control,
          adminA1,
          centerA,
          membershipIds.setCandidate,
          "PROFESSIONAL",
          pcIds.inactive,
          false,
        ),
      "23514",
      "ProfessionalCenter change disguised as deactivation",
    );

    const raceOperation = await prepareAndBindTenantOperation({
      actor: adminA1,
      centerId: centerA,
      target: provisionCandidate,
      firstName: "Race",
      lastName: "Provision",
      role: "PROFESSIONAL",
      professionalCenterId: pcIds.race,
    });
    transactionA = await connect("professional-race-a");
    transactionB = await connect("professional-race-b");
    await beginAsUser(transactionA, adminA1.id);
    await transactionA.query(
      "select * from public.admin_provision_center_user($1,$2,$3,$4,$5,$6,$7)",
      [
        raceOperation,
        centerA,
        provisionCandidate.id,
        "Race",
        "Provision",
        "PROFESSIONAL",
        pcIds.race,
      ],
    );
    await beginAsUser(transactionB, adminA2.id);
    const professionalBlockedPid = Number(
      (await transactionB.query("select pg_catalog.pg_backend_pid() as pid")).rows[0].pid,
    );
    const losingProfessionalAssignment = transactionB.query(
      "select * from public.admin_set_center_membership($1,$2,$3,$4,$5)",
      [centerA, firstProvision.rows[0].membership_id, "PROFESSIONAL", pcIds.race, true],
    );
    void losingProfessionalAssignment.catch(() => {});
    await observePendingCenterLock(
      control,
      professionalBlockedPid,
      "ProfessionalCenter concurrency",
    );
    await transactionA.query("commit");
    const professionalRaceResult = await Promise.allSettled([losingProfessionalAssignment]);
    assert(
      professionalRaceResult[0].status === "rejected" &&
        professionalRaceResult[0].reason?.code === "23505",
      "Concurrent ProfessionalCenter assignment did not leave one accepted and one rejected operation.",
    );
    await transactionB.query("rollback");
    await transactionA.end();
    await transactionB.end();
    transactionA = undefined;
    transactionB = undefined;
    const raceWinners = await control.query(
      `select count(*)::int as count from public.center_memberships
       where professional_center_id=$1 and role='PROFESSIONAL' and is_active`,
      [pcIds.race],
    );
    assertEqual(raceWinners.rows[0].count, 1, "concurrent ProfessionalCenter winner count");

    await setMembership(control, adminA1, centerA, membershipIds.adminA2, "ADMIN", null, false);
    await expectSqlState(
      () => setMembership(control, adminA1, centerA, membershipIds.adminA1, "ADMIN", null, false),
      "23514",
      "last ADMIN self-deactivation",
    );
    await expectSqlState(
      () =>
        setMembership(control, adminA1, centerA, membershipIds.adminA1, "RECEPTION", null, true),
      "23514",
      "last ADMIN self-demotion",
    );
    await setMembership(control, adminA1, centerA, membershipIds.adminA2, "ADMIN", null, true);
    await setMembership(control, adminA2, centerA, membershipIds.adminA1, "ADMIN", null, false);
    await setMembership(control, adminA2, centerA, membershipIds.adminA1, "ADMIN", null, true);

    transactionA = await connect("admin-race-a");
    transactionB = await connect("admin-race-b");
    await beginAsUser(transactionA, adminA1.id);
    await transactionA.query("select * from public.admin_set_center_membership($1,$2,$3,$4,$5)", [
      centerA,
      membershipIds.adminA1,
      "RECEPTION",
      null,
      true,
    ]);
    await beginAsUser(transactionB, adminA2.id);
    const adminBlockedPid = Number(
      (await transactionB.query("select pg_catalog.pg_backend_pid() as pid")).rows[0].pid,
    );
    const losingAdminChange = transactionB.query(
      "select * from public.admin_set_center_membership($1,$2,$3,$4,$5)",
      [centerA, membershipIds.adminA2, "RECEPTION", null, true],
    );
    void losingAdminChange.catch(() => {});
    await observePendingCenterLock(control, adminBlockedPid, "last ADMIN concurrency");
    await transactionA.query("commit");
    const adminRaceResult = await Promise.allSettled([losingAdminChange]);
    assert(
      adminRaceResult[0].status === "rejected" && adminRaceResult[0].reason?.code === "23514",
      "Concurrent ADMIN changes did not leave one accepted and one rejected operation.",
    );
    await transactionB.query("rollback");
    const remainingAdmins = await control.query(
      `select count(*)::int as count from public.center_memberships
       where center_id=$1 and role='ADMIN' and is_active`,
      [centerA],
    );
    assertEqual(remainingAdmins.rows[0].count, 1, "active ADMIN postcondition after concurrency");

    await expectSqlState(
      () =>
        asUser(control, adminA2.id, (database) =>
          database.query("update public.center_memberships set is_active=false where id=$1", [
            membershipIds.setCandidate,
          ]),
        ),
      "42501",
      "authenticated direct membership UPDATE",
    );

    console.log(
      "TASK-005B3A DB/RPC/invariant verification passed, including deterministic concurrency.",
    );
  }
} finally {
  for (const client of [transactionA, transactionB]) {
    if (client) {
      try {
        await client.query("rollback");
      } catch {}
      await client.end().catch(() => {});
    }
  }

  const cleanupErrors = [];
  if (!baselineOnly) {
    try {
      await cleanupDatabase();
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await cleanupAuth();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (control && baselineBefore) {
    try {
      const baselineAfter = await persistentSnapshot(control);
      assertApprovedBaseline(baselineAfter, "DEV baseline after B3A tests");
      assertEqual(
        JSON.stringify(baselineAfter),
        JSON.stringify(baselineBefore),
        "persistent DEV data preservation",
      );
      console.log(`DEV baseline verified after tests: ${JSON.stringify(baselineAfter.counts)}.`);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (control) await control.end().catch((error) => cleanupErrors.push(error));
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "TASK-005B3A cleanup or baseline verification failed.");
  }
}
