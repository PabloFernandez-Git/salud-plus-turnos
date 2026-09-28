import { expect, test } from "@playwright/test";
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
} from "../../scripts/lib/supabase-dev-env.mjs";

loadLocalEnv();
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY es requerida para fixtures E2E temporales.");

const authAdmin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { Client } = pg;
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");
const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const prefix = `task005b3c-${runId}`;
const fixturePassword = `B3c-${randomBytes(18).toString("base64url")}`;
const newAdminPassword = `Admin-${randomBytes(18).toString("base64url")}`;
const newReceptionPassword = `Reception-${randomBytes(18).toString("base64url")}`;
const newProfessionalPassword = `Professional-${randomBytes(18).toString("base64url")}`;
const responseLossPassword = `Response-loss-${randomBytes(18).toString("base64url")}`;
const expectedCenterId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const expectedOperationIds = [
  "352a309e-f137-488e-b6e7-4b53e2cdb7b2",
  "964ec4bf-eeba-4f4f-914a-d2a8ca101934",
];

const centerIds = [randomUUID(), randomUUID()];
const fixtureMembershipIds = new Set(Array.from({ length: 8 }, () => randomUUID()));
const fixtureUserIds = new Set();
const fixtureOperationIds = new Set();
const resultMembershipIds = new Set();
const professionalIds = new Set(Array.from({ length: 3 }, () => randomUUID()));
const professionalCenterIds = new Set(Array.from({ length: 3 }, () => randomUUID()));
const users = new Map();
const trackedProvisioningActions = new Set();
let database;
let baselineBefore;

function temporaryDatabaseConfig() {
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
  if (!approvedHost) throw new Error("La conexión E2E no apunta al proyecto DEV aprobado.");

  return {
    host: variables.PGHOST,
    port: Number(variables.PGPORT),
    database: variables.PGDATABASE,
    user: variables.PGUSER,
    password: variables.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  };
}

function assertEqual(actual, expected, description) {
  if (actual !== expected) {
    throw new Error(`${description}: expected ${expected}, received ${actual}.`);
  }
}

function assertNoError(error, context) {
  if (error) throw new Error(context, { cause: error });
}

function createDeferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolvePromise = resolveValue;
    rejectPromise = rejectValue;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function usersRoutePattern(centerId) {
  return `**/centers/${centerId}/users`;
}

async function dispatchTrackedProvisioningAction(
  page,
  centerId,
  operationId,
  trigger,
  { responseLossBody } = {},
) {
  const started = createDeferred();
  const finished = createDeferred();
  void finished.promise.catch(() => {});
  const action = {
    centerId,
    operationId,
    page,
    handler: null,
    started: started.promise,
    finished: finished.promise,
    requestStarted: false,
    settled: false,
  };

  const handler = async (route) => {
    if (action.requestStarted || route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    action.requestStarted = true;
    started.resolve();
    try {
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(200);
      if (responseLossBody) {
        await route.fulfill({ status: 503, contentType: "text/plain", body: responseLossBody });
      } else {
        await route.fulfill({ response: upstream });
      }
      finished.resolve();
    } catch (error) {
      finished.reject(error);
      throw error;
    } finally {
      action.settled = true;
    }
  };

  action.handler = handler;
  fixtureOperationIds.add(operationId);
  trackedProvisioningActions.add(action);
  await page.route(usersRoutePattern(centerId), handler);
  try {
    await trigger();
    await action.started;
  } catch (error) {
    if (!action.requestStarted) {
      action.settled = true;
      finished.resolve();
    }
    throw error;
  }
  return action;
}

async function removeSettledProvisioningRoutes() {
  const settled = [...trackedProvisioningActions].filter((action) => action.settled);
  for (const action of settled) {
    if (!action.page.isClosed()) {
      await action.page
        .unroute(usersRoutePattern(action.centerId), action.handler)
        .catch(() => undefined);
    }
    trackedProvisioningActions.delete(action);
  }
}

async function reconcileOwnedProvisioningOperations() {
  const operationIds = [...fixtureOperationIds];
  if (operationIds.length === 0) return;
  const operations = await database.query(
    `select id,status,payload_hash
       from private.provisioning_operations
      where id=any($1::uuid[])`,
    [operationIds],
  );
  for (const operation of operations.rows) {
    if (["PENDING", "AUTH_READY", "COMPENSATION_REQUIRED"].includes(operation.status)) {
      await database.query("select * from public.reconcile_auth_provisioning_operation($1,$2)", [
        operation.id,
        operation.payload_hash,
      ]);
    }
  }
}

async function awaitProvisioningQuiescence(reason) {
  console.log(`TASK-005B3C cleanup_requested: ${reason}`);
  const inFlight = [...trackedProvisioningActions].filter(
    (action) => action.requestStarted && !action.settled,
  );
  if (inFlight.length > 0) {
    console.log(
      `TASK-005B3C cleanup WAITING: ${inFlight.map(({ operationId }) => operationId).join(",")}`,
    );
    await Promise.allSettled(inFlight.map(({ finished }) => finished));
  }
  await reconcileOwnedProvisioningOperations();
  console.log("TASK-005B3C server_action finished / provisioning state reconciled.");
}

async function persistentSnapshot() {
  const result = await database.query(
    `select pg_catalog.jsonb_build_object(
       'counts', pg_catalog.jsonb_build_object(
         'auth_users', (select count(*)::int from auth.users),
         'public_users', (select count(*)::int from public.users),
         'platform_admins', (select count(*)::int from public.platform_admins),
         'centers', (select count(*)::int from public.centers),
         'active_centers', (select count(*)::int from public.centers where is_active),
         'memberships', (select count(*)::int from public.center_memberships),
         'active_admin_memberships', (
           select count(*)::int from public.center_memberships where role='ADMIN' and is_active
         ),
         'operations', (select count(*)::int from private.provisioning_operations),
         'succeeded_operations', (
           select count(*)::int from private.provisioning_operations where status='SUCCEEDED'
         ),
         'professionals', (select count(*)::int from public.professionals),
         'professional_centers', (select count(*)::int from public.professional_centers),
         'specialties', (select count(*)::int from public.specialties)
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
  };
  for (const [kind, expected] of Object.entries(expectedCounts)) {
    assertEqual(snapshot.counts[kind], expected, `${description} ${kind}`);
  }
  assertEqual(snapshot.centers[0]?.id, expectedCenterId, `${description} Center id`);
  assertEqual(snapshot.centers[0]?.name, "Centro Médico Salud Plus", `${description} Center name`);
  assertEqual(snapshot.centers[0]?.is_active, true, `${description} Center status`);
  assertEqual(snapshot.memberships[0]?.role, "ADMIN", `${description} membership role`);
  assertEqual(snapshot.memberships[0]?.is_active, true, `${description} membership status`);
  assertEqual(
    JSON.stringify(
      snapshot.operations
        .map(({ id, status }) => ({ id, status }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ),
    JSON.stringify(
      expectedOperationIds
        .map((id) => ({ id, status: "SUCCEEDED" }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ),
    `${description} provisioning operations`,
  );
}

async function createAuthUser(name, firstName, lastName, password = fixturePassword) {
  const email = `${prefix}-${name}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(`No se pudo crear el Auth user ${name}.`, { cause: error });
  const user = { id: data.user.id, email, firstName, lastName, password };
  users.set(name, user);
  fixtureUserIds.add(user.id);
  return user;
}

async function createFixtures() {
  const definitions = [
    ["admin-a", "Ana", "Administradora"],
    ["admin-b", "Bruno", "Administrador"],
    ["reception", "Rita", "Recepción"],
    ["professional", "Pablo", "Profesional"],
    ["inactive-admin", "Inés", "Inactiva"],
    ["platform-only", "Patricia", "Plataforma"],
    ["reused", "Nombre", "Conservado"],
    ["same-active", "Samuel", "Miembro"],
    ["same-inactive", "Irene", "Inactiva"],
  ];
  for (const definition of definitions) await createAuthUser(...definition);

  for (const user of users.values()) {
    await database.query(
      "insert into public.users (id,email,first_name,last_name) values ($1,$2,$3,$4)",
      [user.id, user.email, user.firstName, user.lastName],
    );
  }

  await database.query(
    `insert into public.centers (id,name,is_active)
     values ($1,$2,true),($3,$4,true)`,
    [centerIds[0], `TASK-005B3C ${runId} Centro A`, centerIds[1], `TASK-005B3C ${runId} Centro B`],
  );

  const [occupiedProfessionalId, inactiveProfessionalId, crossProfessionalId] = [
    ...professionalIds,
  ];
  const [occupiedPcId, inactivePcId, crossPcId] = [...professionalCenterIds];
  await database.query(
    `insert into public.professionals
       (id,first_name,last_name,nationality_code,document_number,email)
     values
       ($1,'Olivia','Ocupada','AR',$4,$7),
       ($2,'Ignacio','Inactivo','AR',$5,$8),
       ($3,'Celia','Cruzada','AR',$6,$9)`,
    [
      occupiedProfessionalId,
      inactiveProfessionalId,
      crossProfessionalId,
      `DOC-O-${runId}`,
      `DOC-I-${runId}`,
      `DOC-C-${runId}`,
      `${prefix}-professional-occupied@example.test`,
      `${prefix}-professional-inactive@example.test`,
      `${prefix}-professional-cross@example.test`,
    ],
  );
  await database.query(
    `insert into public.professional_centers
       (id,professional_id,center_id,license_number,is_active)
     values
       ($1,$4,$7,'MP-O',true),
       ($2,$5,$7,'MP-I',false),
       ($3,$6,$8,'MP-C',true)`,
    [
      occupiedPcId,
      inactivePcId,
      crossPcId,
      occupiedProfessionalId,
      inactiveProfessionalId,
      crossProfessionalId,
      centerIds[0],
      centerIds[1],
    ],
  );

  const memberships = [...fixtureMembershipIds];
  await database.query(
    `insert into public.center_memberships
       (id,center_id,user_id,role,professional_center_id,is_active)
     values
       ($1,$9,$11,'ADMIN',null,true),
       ($2,$9,$12,'RECEPTION',null,true),
       ($3,$9,$13,'PROFESSIONAL',$19,true),
       ($4,$9,$14,'ADMIN',null,false),
       ($5,$10,$15,'ADMIN',null,true),
       ($6,$10,$16,'RECEPTION',null,true),
       ($7,$9,$17,'RECEPTION',null,true),
       ($8,$9,$18,'RECEPTION',null,false)`,
    [
      ...memberships,
      centerIds[0],
      centerIds[1],
      users.get("admin-a").id,
      users.get("reception").id,
      users.get("professional").id,
      users.get("inactive-admin").id,
      users.get("admin-b").id,
      users.get("reused").id,
      users.get("same-active").id,
      users.get("same-inactive").id,
      occupiedPcId,
    ],
  );
  await database.query("insert into public.platform_admins (user_id) values ($1)", [
    users.get("platform-only").id,
  ]);
}

async function collectOwnedFixtureIds() {
  const operationIds = [...fixtureOperationIds];
  if (operationIds.length === 0) return;

  const operations = await database.query(
    `select auth_user_id,result_user_id,result_membership_id
       from private.provisioning_operations
      where id=any($1::uuid[])`,
    [operationIds],
  );
  for (const operation of operations.rows) {
    if (operation.auth_user_id) fixtureUserIds.add(operation.auth_user_id);
    if (operation.result_user_id) fixtureUserIds.add(operation.result_user_id);
    if (operation.result_membership_id) resultMembershipIds.add(operation.result_membership_id);
  }

  const operationAuthUsers = await database.query(
    `select id
       from auth.users
      where raw_app_meta_data->>'provisioning_operation_id'=any($1::text[])`,
    [operationIds],
  );
  for (const { id } of operationAuthUsers.rows) fixtureUserIds.add(id);
}

async function cleanupDatabase() {
  const userIds = [...fixtureUserIds];
  const ownedMembershipIds = [...fixtureMembershipIds, ...resultMembershipIds];
  await database.query("begin");
  try {
    await database.query("delete from private.provisioning_operations where id=any($1::uuid[])", [
      [...fixtureOperationIds],
    ]);
    await database.query(
      `delete from public.center_memberships
        where id=any($1::uuid[])
           or (center_id=any($2::uuid[]) and user_id=any($3::uuid[]))`,
      [ownedMembershipIds, centerIds, userIds],
    );
    await database.query("delete from public.platform_admins where user_id=any($1::uuid[])", [
      userIds,
    ]);
    await database.query("delete from public.professional_centers where id=any($1::uuid[])", [
      [...professionalCenterIds],
    ]);
    await database.query("delete from public.professionals where id=any($1::uuid[])", [
      [...professionalIds],
    ]);
    await database.query("delete from public.centers where id=any($1::uuid[])", [centerIds]);
    await database.query("delete from public.users where id=any($1::uuid[])", [userIds]);
    await database.query("commit");
  } catch (error) {
    await database.query("rollback").catch(() => undefined);
    throw error;
  }
}

async function cleanupAuth() {
  const errors = [];
  for (const userId of [...fixtureUserIds].reverse()) {
    const { error } = await authAdmin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "Falló el cleanup Auth E2E B3C.");
}

async function assertNoResidueAndBaseline() {
  const userIds = [...fixtureUserIds];
  const residue = await database.query(
    `select
       (select count(*)::int from auth.users where id=any($1::uuid[])) as auth_users,
       (select count(*)::int from public.users where id=any($1::uuid[])) as profiles,
       (select count(*)::int from public.centers where id=any($2::uuid[])) as centers,
       (select count(*)::int from public.center_memberships
          where center_id=any($2::uuid[]) or user_id=any($1::uuid[])) as memberships,
       (select count(*)::int from public.platform_admins where user_id=any($1::uuid[])) as platform_admins,
       (select count(*)::int from public.professionals where id=any($3::uuid[])) as professionals,
       (select count(*)::int from public.professional_centers where id=any($4::uuid[])) as professional_centers,
       (select count(*)::int from private.provisioning_operations where id=any($5::uuid[])) as operations`,
    [
      userIds,
      centerIds,
      [...professionalIds],
      [...professionalCenterIds],
      [...fixtureOperationIds],
    ],
  );
  for (const [kind, count] of Object.entries(residue.rows[0])) {
    assertEqual(count, 0, `B3C E2E residue ${kind}`);
  }

  const baselineAfter = await persistentSnapshot();
  assertApprovedBaseline(baselineAfter, "DEV baseline after B3C E2E");
  assertEqual(
    JSON.stringify(baselineAfter),
    JSON.stringify(baselineBefore),
    "persistent DEV data preservation",
  );
  console.log("TASK-005B3C E2E cleanup exacto y baseline persistente verificados.");
}

async function cleanupFixtures() {
  const errors = [];
  try {
    await awaitProvisioningQuiescence("cleanupFixtures");
    await collectOwnedFixtureIds();
  } catch (error) {
    errors.push(error);
  }
  try {
    await cleanupDatabase();
  } catch (error) {
    errors.push(error);
  }
  try {
    await cleanupAuth();
  } catch (error) {
    errors.push(error);
  }
  try {
    await assertNoResidueAndBaseline();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "Falló el cleanup E2E TASK-005B3C.");
}

async function login(page, name) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(users.get(name).email);
  await page.getByLabel("Contraseña", { exact: true }).fill(users.get(name).password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

async function openAddUser(page, centerId = centerIds[0]) {
  await page.goto(`/centers/${centerId}/users`);
  await page.getByRole("button", { name: "Agregar usuario", exact: true }).click();
}

async function currentOperationId(page) {
  const operationId = await page.locator('input[name="operationId"]').inputValue();
  expect(operationId).toMatch(/^[0-9a-f-]{36}$/i);
  return operationId;
}

async function resolveEmail(page, email) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

async function fillNewIdentity(page, { firstName, lastName, password, role }) {
  await page.getByLabel("Nombre", { exact: true }).fill(firstName);
  await page.getByLabel("Apellido", { exact: true }).fill(lastName);
  await page.getByLabel("Contraseña inicial", { exact: true }).fill(password);
  await page.getByLabel("Rol", { exact: true }).selectOption(role);
}

async function expectSingleProvisioningEffect(operationId, expected) {
  await expect
    .poll(async () => {
      const result = await database.query(
        `select operation.status,operation.result_user_id,operation.result_membership_id,
                membership.role,membership.professional_center_id,membership.is_active
           from private.provisioning_operations operation
           join public.center_memberships membership
             on membership.id=operation.result_membership_id
          where operation.id=$1`,
        [operationId],
      );
      return result.rows;
    })
    .toEqual([
      expect.objectContaining({
        status: "SUCCEEDED",
        role: expected.role,
        professional_center_id: expected.professionalCenterId ?? null,
        is_active: true,
      }),
    ]);

  const effect = await database.query(
    `select
       (select count(*)::int from private.provisioning_operations where id=$1) as operations,
       (select count(*)::int from public.center_memberships membership
         join private.provisioning_operations operation
           on operation.result_membership_id=membership.id
        where operation.id=$1) as memberships`,
    [operationId],
  );
  expect(effect.rows[0]).toEqual({ operations: 1, memberships: 1 });
}

async function browserPersistenceSnapshot(page) {
  return page.evaluate(() => ({
    cookies: document.cookie,
    localStorage: Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]),
    sessionStorage: Object.keys(sessionStorage).map((key) => [key, sessionStorage.getItem(key)]),
    url: window.location.href,
  }));
}

async function expectUsersRouteDenied(page, centerId) {
  await page.goto(`/centers/${centerId}/users`);
  await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar usuario", exact: true })).toHaveCount(0);
  await expect(page.locator('input[name="operationId"]')).toHaveCount(0);
}

test.describe.serial("TASK-005B3C Center user provisioning", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    database = new Client({
      ...temporaryDatabaseConfig(),
      application_name: "task005b3c-e2e",
    });
    await database.connect();
    await database.query("set role postgres");
    baselineBefore = await persistentSnapshot();
    assertApprovedBaseline(baselineBefore, "DEV baseline before B3C E2E");
    await createFixtures();
  });

  test.afterEach(async () => {
    await removeSettledProvisioningRoutes();
  });

  test.afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      await database?.end();
    }
  });

  test("sólo ADMIN activo del Center abre el alta; los demás actores quedan denegados", async ({
    page,
  }) => {
    await login(page, "admin-a");
    await page.goto(`/centers/${centerIds[0]}/users`);
    await expect(page.getByRole("button", { name: "Agregar usuario", exact: true })).toBeVisible();

    for (const name of ["reception", "professional", "inactive-admin", "platform-only"]) {
      await login(page, name);
      await expectUsersRouteDenied(page, centerIds[0]);
    }

    await login(page, "admin-b");
    await expectUsersRouteDenied(page, centerIds[0]);
  });

  test("crea una identidad nueva ADMIN, rechaza password corto y no persiste el password", async ({
    page,
  }) => {
    await login(page, "admin-a");
    await openAddUser(page);
    const email = `${prefix}-new-admin@example.test`;
    await resolveEmail(page, email);
    const operationId = await currentOperationId(page);
    fixtureOperationIds.add(operationId);
    await expect(page.getByText(/identidad nueva/i).first()).toBeVisible();
    await fillNewIdentity(page, {
      firstName: "Adriana",
      lastName: "Nueva",
      password: "123456789",
      role: "ADMIN",
    });
    await page.getByRole("button", { name: "Agregar al centro", exact: true }).click();
    await expect(page.getByText(/al menos 10 caracteres/i)).toBeVisible();

    expect(await page.locator('input[name="operationId"]').inputValue()).toBe(operationId);
    await page.getByLabel("Contraseña inicial", { exact: true }).fill(newAdminPassword);
    await page.getByRole("button", { name: "Agregar al centro", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Usuario agregado al centro.");
    await expect(page.getByRole("row", { name: /Adriana Nueva/ })).toBeVisible();
    await expectSingleProvisioningEffect(operationId, { role: "ADMIN" });

    const serializedBrowserState = JSON.stringify(await browserPersistenceSnapshot(page));
    expect(serializedBrowserState).not.toContain(newAdminPassword);
    expect(serializedBrowserState).not.toContain("123456789");
  });

  test("crea RECEPTION con doble submit sin duplicar operación ni membership", async ({ page }) => {
    await login(page, "admin-a");
    await openAddUser(page);
    await resolveEmail(page, `${prefix}-new-reception@example.test`);
    const operationId = await currentOperationId(page);
    fixtureOperationIds.add(operationId);
    await fillNewIdentity(page, {
      firstName: "Renata",
      lastName: "Recepción",
      password: newReceptionPassword,
      role: "RECEPTION",
    });

    let postCount = 0;
    const routePattern = usersRoutePattern(centerIds[0]);
    const countPosts = async (route) => {
      if (route.request().method() === "POST") postCount += 1;
      await route.continue();
    };
    await page.route(routePattern, countPosts);
    await page.evaluate(() => {
      const operationInput = document.querySelector('input[name="operationId"]');
      const form = operationInput?.closest("form");
      if (!(form instanceof HTMLFormElement)) throw new Error("No se encontró el form de alta.");
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page.getByRole("status")).toContainText("Usuario agregado al centro.");
    await page.unroute(routePattern, countPosts);

    expect(postCount).toBe(1);
    await expectSingleProvisioningEffect(operationId, { role: "RECEPTION" });
    const membershipCount = await database.query(
      `select count(*)::int as count
         from public.center_memberships membership
         join public.users app_user on app_user.id=membership.user_id
        where membership.center_id=$1 and app_user.email=$2`,
      [centerIds[0], `${prefix}-new-reception@example.test`],
    );
    expect(membershipCount.rows[0].count).toBe(1);
  });

  test("reutiliza identidad sin mutar perfil, password ni membership de otro Center", async ({
    page,
  }) => {
    const target = users.get("reused");
    const otherMembershipBefore = await database.query(
      `select id,center_id,user_id,role,professional_center_id,is_active
         from public.center_memberships where center_id=$1 and user_id=$2`,
      [centerIds[1], target.id],
    );

    await login(page, "admin-a");
    await openAddUser(page);
    await resolveEmail(page, target.email);
    const operationId = await currentOperationId(page);
    fixtureOperationIds.add(operationId);
    await expect(page.getByText(/identidad ya existe|reutilizaremos/i).first()).toBeVisible();
    await expect(page.getByText(/^Nombre Conservado\./)).toBeVisible();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Apellido", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Contraseña inicial", { exact: true })).toHaveCount(0);
    await page.getByLabel("Rol", { exact: true }).selectOption("RECEPTION");
    await page.getByRole("button", { name: "Agregar al centro", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Usuario agregado al centro.");
    await expectSingleProvisioningEffect(operationId, { role: "RECEPTION" });

    const preserved = await database.query(
      "select email,first_name,last_name from public.users where id=$1",
      [target.id],
    );
    expect(preserved.rows[0]).toEqual({
      email: target.email,
      first_name: "Nombre",
      last_name: "Conservado",
    });
    const otherMembershipAfter = await database.query(
      `select id,center_id,user_id,role,professional_center_id,is_active
         from public.center_memberships where center_id=$1 and user_id=$2`,
      [centerIds[1], target.id],
    );
    expect(otherMembershipAfter.rows).toEqual(otherMembershipBefore.rows);

    const passwordProbe = createClient(dev.url, dev.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await passwordProbe.auth.signInWithPassword({
      email: target.email,
      password: target.password,
    });
    assertNoError(error, "La contraseña de la identidad reutilizada fue modificada.");
    expect(data.user?.id).toBe(target.id);
    await passwordProbe.auth.signOut({ scope: "local" });
  });

  test("informa memberships existentes activas e inactivas sin duplicar ni reactivar", async ({
    page,
  }) => {
    await login(page, "admin-a");
    const operationsBefore = await database.query(
      "select count(*)::int as count from private.provisioning_operations where scope_center_id=$1",
      [centerIds[0]],
    );

    for (const [name, expectedState] of [
      ["same-active", /ya pertenece|acceso activo/i],
      ["same-inactive", /ya pertenece|inactiv/i],
    ]) {
      await openAddUser(page);
      await resolveEmail(page, users.get(name).email);
      await expect(page.getByText(expectedState).first()).toBeVisible();
      await expect(page.getByLabel("Rol", { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Agregar al centro", exact: true }),
      ).toHaveCount(0);
    }

    const states = await database.query(
      `select user_id,is_active from public.center_memberships
        where center_id=$1 and user_id=any($2::uuid[]) order by user_id`,
      [centerIds[0], [users.get("same-active").id, users.get("same-inactive").id]],
    );
    expect(states.rows).toEqual(
      [
        { user_id: users.get("same-active").id, is_active: true },
        { user_id: users.get("same-inactive").id, is_active: false },
      ].sort((left, right) => left.user_id.localeCompare(right.user_id)),
    );
    const operationsAfter = await database.query(
      "select count(*)::int as count from private.provisioning_operations where scope_center_id=$1",
      [centerIds[0]],
    );
    expect(operationsAfter.rows[0].count).toBe(operationsBefore.rows[0].count);
  });

  test("bloquea PROFESSIONAL sin PC elegible y nunca expone PC ocupado, inactivo o cross-Center", async ({
    page,
  }) => {
    await login(page, "admin-a");
    await openAddUser(page);
    await resolveEmail(page, `${prefix}-blocked-professional@example.test`);

    const role = page.getByLabel("Rol", { exact: true });
    await expect(role.locator('option[value="PROFESSIONAL"]')).toHaveAttribute("disabled", "");
    await expect(
      page.getByText(/Profesional no está disponible/i).first(),
    ).toBeVisible();
    await expect(page.getByLabel("Profesional asociado", { exact: true })).toHaveCount(0);
    const addUserPanel = page.locator("#agregar-usuario");
    await expect(addUserPanel.getByText("Olivia Ocupada", { exact: true })).toHaveCount(0);
    await expect(addUserPanel.getByText("Ignacio Inactivo", { exact: true })).toHaveCount(0);
    await expect(addUserPanel.getByText("Celia Cruzada", { exact: true })).toHaveCount(0);
  });

  test("crea PROFESSIONAL únicamente con un ProfessionalCenter activo, libre y del Center", async ({
    page,
  }) => {
    const validProfessionalId = randomUUID();
    const validProfessionalCenterId = randomUUID();
    professionalIds.add(validProfessionalId);
    professionalCenterIds.add(validProfessionalCenterId);
    await database.query(
      `insert into public.professionals
         (id,first_name,last_name,nationality_code,document_number,email)
       values ($1,'Valeria','Válida','AR',$2,$3)`,
      [validProfessionalId, `DOC-V-${runId}`, `${prefix}-professional-valid@example.test`],
    );
    await database.query(
      `insert into public.professional_centers
         (id,professional_id,center_id,license_number,is_active)
       values ($1,$2,$3,'MP-V',true)`,
      [validProfessionalCenterId, validProfessionalId, centerIds[0]],
    );

    await login(page, "admin-a");
    await openAddUser(page);
    await resolveEmail(page, `${prefix}-new-professional@example.test`);
    const operationId = await currentOperationId(page);
    fixtureOperationIds.add(operationId);
    await fillNewIdentity(page, {
      firstName: "Pedro",
      lastName: "Profesional",
      password: newProfessionalPassword,
      role: "PROFESSIONAL",
    });
    const professional = page.getByLabel("Profesional asociado", { exact: true });
    await expect(professional).toBeVisible();
    await expect(professional.locator("option")).toHaveCount(2);
    await expect(professional).not.toContainText("Olivia Ocupada");
    await expect(professional).not.toContainText("Ignacio Inactivo");
    await expect(professional).not.toContainText("Celia Cruzada");
    await professional.selectOption(validProfessionalCenterId);
    await page.getByRole("button", { name: "Agregar al centro", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Usuario agregado al centro.");
    await expectSingleProvisioningEffect(operationId, {
      role: "PROFESSIONAL",
      professionalCenterId: validProfessionalCenterId,
    });
  });

  test("recupera el mismo operation_id tras commit, response-loss y refresh sin persistir password", async ({
    page,
  }) => {
    await login(page, "admin-a");
    await openAddUser(page);
    await resolveEmail(page, `${prefix}-response-loss@example.test`);
    const operationId = await currentOperationId(page);
    fixtureOperationIds.add(operationId);
    await fillNewIdentity(page, {
      firstName: "Respuesta",
      lastName: "Perdida",
      password: responseLossPassword,
      role: "RECEPTION",
    });

    const responseLoss = await dispatchTrackedProvisioningAction(
      page,
      centerIds[0],
      operationId,
      () => page.getByRole("button", { name: "Agregar al centro", exact: true }).click(),
      { responseLossBody: "Simulated B3C response loss after upstream commit." },
    );
    await responseLoss.finished;
    await expectSingleProvisioningEffect(operationId, { role: "RECEPTION" });

    const pendingBrowserState = JSON.stringify(await browserPersistenceSnapshot(page));
    expect(pendingBrowserState).toContain(operationId);
    expect(pendingBrowserState).not.toContain(responseLossPassword);
    await removeSettledProvisioningRoutes();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('input[name="operationId"]')).toHaveValue(operationId);
    await expect(page.locator('input[name="isRetryingOperation"]')).toHaveValue("true");
    await expect(page.getByLabel("Contraseña inicial", { exact: true })).toHaveValue("");
    await page.getByRole("button", { name: /Reintentar|verificar/i }).click();
    await expect(page.getByRole("status")).toContainText(/sin duplicar/i);
    await expectSingleProvisioningEffect(operationId, { role: "RECEPTION" });

    await expect
      .poll(async () => (await browserPersistenceSnapshot(page)).sessionStorage.length)
      .toBe(0);
  });

  test("un snapshot ambiguo tras response-loss bloquea otra operación hasta abandono explícito", async ({
    page,
  }) => {
    await login(page, "admin-a");
    await openAddUser(page);
    const ambiguousPassword = `Ambiguous-${randomBytes(18).toString("base64url")}`;
    await resolveEmail(page, `${prefix}-ambiguous@example.test`);
    const operationId = await currentOperationId(page);
    fixtureOperationIds.add(operationId);
    await fillNewIdentity(page, {
      firstName: "Estado",
      lastName: "Ambiguo",
      password: ambiguousPassword,
      role: "RECEPTION",
    });

    const responseLoss = await dispatchTrackedProvisioningAction(
      page,
      centerIds[0],
      operationId,
      () => page.getByRole("button", { name: "Agregar al centro", exact: true }).click(),
      { responseLossBody: "Simulated B3C ambiguous response after upstream commit." },
    );
    await responseLoss.finished;
    await expectSingleProvisioningEffect(operationId, { role: "RECEPTION" });
    await removeSettledProvisioningRoutes();

    const storageKey = await page.evaluate(() =>
      Object.keys(sessionStorage).find((key) =>
        key.startsWith("salud-plus:center:provision-user-intent:v1:"),
      ),
    );
    expect(storageKey).toBeTruthy();
    const invalidSnapshot = await page.evaluate((key) => {
      const serialized = sessionStorage.getItem(key);
      if (!serialized) throw new Error("No se encontró el snapshot B3C pendiente.");
      const parsed = JSON.parse(serialized);
      const invalidSerialized = JSON.stringify({ ...parsed, extraField: "unexpected" });
      sessionStorage.setItem(key, invalidSerialized);
      return invalidSerialized;
    }, storageKey);
    expect(invalidSnapshot).not.toContain(ambiguousPassword);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText("Hay un alta pendiente que no puede recuperarse de forma segura."),
      ).toBeVisible();
      await expect(page.locator('input[name="operationId"]')).toHaveCount(0);
      expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe(
        invalidSnapshot,
      );
    }

    await expectSingleProvisioningEffect(operationId, { role: "RECEPTION" });
    await page
      .getByRole("button", { name: "Abandonar intención pendiente e iniciar otra alta" })
      .click();
    const replacementOperationId = await page.locator('input[name="operationId"]').inputValue();
    expect(replacementOperationId).not.toBe(operationId);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
    await expectSingleProvisioningEffect(operationId, { role: "RECEPTION" });
  });
});
