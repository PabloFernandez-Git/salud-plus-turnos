import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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

const admin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { Client } = pg;
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const prefix = `task005b2-${runId}`;
const platformPassword = `Platform-${runId}-password`;
const existingPassword = `Existing-${runId}-password`;
const newAdminPassword = `New-admin-${runId}-password`;
const responseLossAdminPassword = `Response-loss-${runId}-password`;
const invalidSnapshotAdminPassword = `Invalid-snapshot-${runId}-password`;
const platformEmail = `${prefix}-platform@example.test`;
const existingEmail = `${prefix}-existing@example.test`;
const newAdminEmail = `${prefix}-new-admin@example.test`;
const responseLossAdminEmail = `${prefix}-response-loss-admin@example.test`;
const invalidSnapshotAdminEmail = `${prefix}-invalid-snapshot-admin@example.test`;
const newCenterName = `TASK-005B2 ${runId} Centro nuevo`;
const responseLossCenterName = `TASK-005B2 ${runId} Centro response loss`;
const invalidSnapshotCenterName = `TASK-005B2 ${runId} Centro snapshot invalido`;
const previousCenterName = `TASK-005B2 ${runId} Centro previo`;
const reusedCenterName = `TASK-005B2 ${runId} Centro reutilizado`;
const fixtureUserIds = new Set();
const fixtureCenterIds = new Set();
const fixtureOperationIds = new Set();
const inFlightResponseLossRoutes = new Set();
let database;
let platformUser;
let existingUser;
let newAdminUserId;
let newCenterId;

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

function createResponseLossInterceptor(body) {
  let intercepted = false;
  const browserResponseDelivered = createDeferred();
  void browserResponseDelivered.promise.catch(() => {});

  const handler = async (route) => {
    if (intercepted || route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    intercepted = true;
    const routeWork = (async () => {
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(200);
      await route.fulfill({ status: 503, contentType: "text/plain", body });
    })();
    inFlightResponseLossRoutes.add(routeWork);

    try {
      await routeWork;
      browserResponseDelivered.resolve();
    } catch (error) {
      browserResponseDelivered.reject(error);
      throw error;
    } finally {
      inFlightResponseLossRoutes.delete(routeWork);
    }
  };

  return {
    browserResponseDelivered: browserResponseDelivered.promise,
    handler,
    wasIntercepted: () => intercepted,
  };
}

async function createAuthUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assertNoError(error, "No se pudo crear un Auth user E2E temporal.");
  if (!data.user) throw new Error("Auth no devolvió el usuario E2E creado.");
  fixtureUserIds.add(data.user.id);
  return data.user;
}

async function currentFixtureIds() {
  const users = await database.query(
    "select id from auth.users where email like 'task005b2-%@example.test'",
  );
  const centers = await database.query(
    "select id from public.centers where name like 'TASK-005B2 %'",
  );
  for (const { id } of users.rows) fixtureUserIds.add(id);
  for (const { id } of centers.rows) fixtureCenterIds.add(id);
  return { userIds: [...fixtureUserIds], centerIds: [...fixtureCenterIds] };
}

async function cleanupDatabase(userIds, centerIds) {
  await database.query("begin");
  try {
    if (userIds.length > 0 || centerIds.length > 0 || fixtureOperationIds.size > 0) {
      await database.query(
        `delete from private.provisioning_operations
         where id = any($1::uuid[])
            or actor_user_id = any($2::uuid[])
            or auth_user_id = any($2::uuid[])
            or result_center_id = any($3::uuid[])`,
        [[...fixtureOperationIds], userIds, centerIds],
      );
    }
    if (centerIds.length > 0) {
      await database.query(
        "delete from public.center_memberships where center_id = any($1::uuid[])",
        [centerIds],
      );
      await database.query("delete from public.specialties where center_id = any($1::uuid[])", [
        centerIds,
      ]);
      await database.query("delete from public.centers where id = any($1::uuid[])", [centerIds]);
    }
    if (userIds.length > 0) {
      await database.query(
        "delete from public.center_memberships where user_id = any($1::uuid[])",
        [userIds],
      );
      await database.query("delete from public.platform_admins where user_id = any($1::uuid[])", [
        userIds,
      ]);
      await database.query("delete from public.users where id = any($1::uuid[])", [userIds]);
    }
    await database.query("commit");
  } catch (error) {
    await database.query("rollback");
    throw error;
  }
}

async function cleanupAuth(userIds) {
  const errors = [];
  for (const userId of [...userIds].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "Falló el cleanup Auth E2E.");
}

async function cleanupStaleFixtures() {
  const { userIds, centerIds } = await currentFixtureIds();
  if (userIds.length === 0 && centerIds.length === 0) return;
  await cleanupDatabase(userIds, centerIds);
  await cleanupAuth(userIds);
  fixtureUserIds.clear();
  fixtureCenterIds.clear();
}

async function createFixtures() {
  platformUser = await createAuthUser(platformEmail, platformPassword);
  existingUser = await createAuthUser(existingEmail, existingPassword);
  await database.query(
    `insert into public.users (id,email,first_name,last_name)
     values ($1,$2,'Plataforma','Temporal'),($3,$4,'Nombre conservado','Apellido conservado')`,
    [platformUser.id, platformEmail, existingUser.id, existingEmail],
  );
  await database.query("insert into public.platform_admins (user_id) values ($1)", [
    platformUser.id,
  ]);
}

async function cleanupFixtures() {
  const cleanupErrors = [];
  let ids = { userIds: [...fixtureUserIds], centerIds: [...fixtureCenterIds] };
  try {
    ids = await currentFixtureIds();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await cleanupDatabase(ids.userIds, ids.centerIds);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await cleanupAuth(ids.userIds);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    const residue = await database.query(
      `select
         (select count(*)::integer from auth.users where email like 'task005b2-%@example.test') as auth_users,
         (select count(*)::integer from public.users where email like 'task005b2-%@example.test') as profiles,
         (select count(*)::integer from public.centers where name like 'TASK-005B2 %') as centers,
         (select count(*)::integer from public.center_memberships
            where user_id = any($1::uuid[]) or center_id = any($2::uuid[])) as memberships,
         (select count(*)::integer from public.platform_admins
            where user_id = any($1::uuid[])) as platform_admins,
         (select count(*)::integer from private.provisioning_operations
            where id = any($3::uuid[])
               or actor_user_id = any($1::uuid[])
               or auth_user_id = any($1::uuid[])
               or result_center_id = any($2::uuid[])) as provisioning_operations`,
      [ids.userIds, ids.centerIds, [...fixtureOperationIds]],
    );
    for (const [kind, count] of Object.entries(residue.rows[0])) {
      if (count !== 0) cleanupErrors.push(new Error(`Quedaron residuos E2E: ${kind}.`));
    }
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Falló el cleanup de fixtures E2E TASK-005B2.");
  }
  console.log(
    "TASK-005B2 E2E cleanup verified: zero Auth, profile, Center, membership, PLATFORM_ADMIN and provisioning-operation residues.",
  );
}

async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

async function resolveAdminEmail(page, email) {
  await page.getByLabel("Email del primer ADMIN").fill(email);
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function fillCenter(page, { name, address, phone, email }) {
  await page.locator('input[name="centerName"]').fill(name);
  await page.locator('input[name="centerAddress"]').fill(address);
  await page.locator('input[name="centerPhone"]').fill(phone);
  await page.locator('input[name="centerEmail"]').fill(email);
}

async function browserPersistenceSnapshot(page) {
  return page.evaluate(() => ({
    cookies: document.cookie,
    localStorage: Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]),
    sessionStorage: Object.keys(sessionStorage).map((key) => [key, sessionStorage.getItem(key)]),
    url: window.location.href,
  }));
}

test.describe.serial("TASK-005B2 Platform Admin", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    database = new Client({ ...temporaryDatabaseConfig(), application_name: "task005b2-e2e" });
    await database.connect();
    await database.query("set role postgres");
    await cleanupStaleFixtures();
    await createFixtures();
  });

  test.afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      await database?.end();
    }
  });

  test.afterEach(async () => {
    await Promise.allSettled([...inFlightResponseLossRoutes]);
  });

  test("PLATFORM_ADMIN accede al estado vacío protegido", async ({ page }) => {
    await login(page, platformEmail, platformPassword);
    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole("heading", { name: "Centros", exact: true })).toBeVisible();
    await expect(page.getByText("Todavía no hay centros creados.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear centro" }).last()).toBeVisible();
  });

  test("crea Center + ADMIN nuevo, conserva operation_id y muestra Usuarios = 1", async ({
    page,
  }) => {
    await login(page, platformEmail, platformPassword);
    const firstOperationId = await page.locator('input[name="operationId"]').inputValue();
    fixtureOperationIds.add(firstOperationId);

    await resolveAdminEmail(page, newAdminEmail);
    await expect(page.getByText("Identidad nueva:", { exact: false })).toBeVisible();
    await fillCenter(page, {
      name: newCenterName,
      address: "Calle Nueva 123",
      phone: "+54 11 4000 5000",
      email: `${prefix}-center@example.test`,
    });
    await page.locator('input[name="adminFirstName"]').fill("Admin");
    await page.locator('input[name="adminLastName"]').fill("Nuevo");
    await page.locator('input[name="adminInitialPassword"]').fill(newAdminPassword);
    expect(await page.locator('input[name="operationId"]').inputValue()).toBe(firstOperationId);
    await page.getByRole("button", { name: "Crear centro", exact: true }).last().click();

    await expect(page.getByRole("status")).toContainText(
      "Centro creado con su primer administrador.",
    );
    await expect
      .poll(async () => (await browserPersistenceSnapshot(page)).sessionStorage.length)
      .toBe(0);
    const row = page.getByRole("row", { name: new RegExp(newCenterName) });
    await expect(row).toBeVisible();
    await expect(row.locator("td").nth(1)).toHaveText("Activo");
    await expect(row.locator("td").nth(2)).toHaveText("Calle Nueva 123");
    await expect(row.locator("td").nth(3)).toHaveText("+54 11 4000 5000");
    await expect(row.locator("td").nth(6)).toHaveText("1");
    await expect(row.locator("td").nth(7)).toHaveText("0");
    await expect(row.locator("td").nth(8)).toHaveText("0");

    const created = await database.query(
      `select c.id,
              count(distinct cm.id)::integer as memberships,
              min(cm.user_id::text) as admin_user_id
       from public.centers c
       join public.center_memberships cm on cm.center_id=c.id
       where c.name=$1 and cm.role='ADMIN' and cm.is_active
       group by c.id`,
      [newCenterName],
    );
    expect(created.rowCount).toBe(1);
    expect(created.rows[0].memberships).toBe(1);
    newCenterId = created.rows[0].id;
    newAdminUserId = created.rows[0].admin_user_id;
    fixtureCenterIds.add(newCenterId);
    fixtureUserIds.add(newAdminUserId);

    const operation = await database.query(
      `select status,result_center_id from private.provisioning_operations where id=$1`,
      [firstOperationId],
    );
    expect(operation.rows).toEqual([{ status: "SUCCEEDED", result_center_id: newCenterId }]);

    await page.getByRole("button", { name: "Crear otro centro" }).click();
    const nextOperationId = await page.locator('input[name="operationId"]').inputValue();
    expect(nextOperationId).not.toBe(firstOperationId);
  });

  test("recupera el mismo operation_id tras commit + response-loss + refresh", async ({ page }) => {
    const browserConsole = [];
    page.on("console", (message) => browserConsole.push(message.text()));
    await login(page, platformEmail, platformPassword);
    const operationId = await page.locator('input[name="operationId"]').inputValue();
    fixtureOperationIds.add(operationId);

    await resolveAdminEmail(page, responseLossAdminEmail);
    await fillCenter(page, {
      name: responseLossCenterName,
      address: "Calle Commit 789",
      phone: "+54 11 8000 9000",
      email: `${prefix}-response-loss-center@example.test`,
    });
    await page.locator('input[name="adminFirstName"]').fill("Respuesta");
    await page.locator('input[name="adminLastName"]').fill("Perdida");
    await page.locator('input[name="adminInitialPassword"]').fill(responseLossAdminPassword);

    const responseLoss = createResponseLossInterceptor(
      "Simulated response loss after upstream commit.",
    );
    await page.route("**/platform", responseLoss.handler);
    await page.getByRole("button", { name: "Crear centro", exact: true }).last().click();

    await expect.poll(responseLoss.wasIntercepted).toBe(true);
    await responseLoss.browserResponseDelivered;

    await expect
      .poll(async () => {
        const result = await database.query(
          `select count(*)::integer as centers
           from public.centers
           where name=$1`,
          [responseLossCenterName],
        );
        return result.rows[0].centers;
      })
      .toBe(1);
    await page.unroute("**/platform", responseLoss.handler);

    const beforeRefresh = await browserPersistenceSnapshot(page);
    expect(JSON.stringify(beforeRefresh)).toContain(operationId);
    expect(JSON.stringify(beforeRefresh)).not.toContain(responseLossAdminPassword);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByText("Hay una creación de centro pendiente de confirmar.", { exact: false }),
    ).toBeVisible();
    await expect(page.locator('input[name="operationId"]')).toHaveValue(operationId);
    await expect(page.locator('input[name="centerName"]')).toHaveValue(responseLossCenterName);
    await expect(page.locator('input[name="centerName"]')).toHaveAttribute("readonly");
    await expect(page.locator('input[name="adminFirstName"]')).toHaveAttribute("readonly");
    await expect(page.locator('input[name="adminInitialPassword"]')).toHaveValue("");

    const afterRefresh = await browserPersistenceSnapshot(page);
    const durableState = JSON.stringify(afterRefresh);
    expect(durableState).toContain(operationId);
    expect(durableState).toContain(responseLossCenterName);
    expect(durableState).not.toContain(responseLossAdminPassword);
    expect(browserConsole.join("\n")).not.toContain(responseLossAdminPassword);

    await page.getByRole("button", { name: "Reintentar / verificar" }).click();
    await expect(page.getByRole("status")).toContainText(
      "La operación quedó confirmada al reintentar, sin duplicar el centro.",
    );
    await expect(page.getByRole("row", { name: new RegExp(responseLossCenterName) })).toBeVisible();

    const result = await database.query(
      `select c.id,
              count(distinct cm.id)::integer as memberships,
              count(distinct po.id)::integer as operations,
              min(cm.user_id::text) as admin_user_id
       from public.centers c
       join public.center_memberships cm
         on cm.center_id=c.id and cm.role='ADMIN' and cm.is_active
       join private.provisioning_operations po
         on po.result_center_id=c.id and po.status='SUCCEEDED'
       where c.name=$1
       group by c.id`,
      [responseLossCenterName],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ memberships: 1, operations: 1 });
    fixtureCenterIds.add(result.rows[0].id);
    fixtureUserIds.add(result.rows[0].admin_user_id);

    const operation = await database.query(
      `select id,status,result_center_id
       from private.provisioning_operations
       where id=$1`,
      [operationId],
    );
    expect(operation.rows).toEqual([
      { id: operationId, status: "SUCCEEDED", result_center_id: result.rows[0].id },
    ]);
    await expect
      .poll(async () => (await browserPersistenceSnapshot(page)).sessionStorage.length)
      .toBe(0);
  });

  test("bloquea snapshot inválido tras commit + response-loss hasta abandono explícito", async ({
    page,
  }) => {
    await login(page, platformEmail, platformPassword);
    const operationId = await page.locator('input[name="operationId"]').inputValue();
    fixtureOperationIds.add(operationId);

    await resolveAdminEmail(page, invalidSnapshotAdminEmail);
    await fillCenter(page, {
      name: invalidSnapshotCenterName,
      address: "Calle Snapshot 321",
      phone: "+54 11 8100 9100",
      email: `${prefix}-invalid-snapshot-center@example.test`,
    });
    await page.locator('input[name="adminFirstName"]').fill("Snapshot");
    await page.locator('input[name="adminLastName"]').fill("Invalido");
    await page.locator('input[name="adminInitialPassword"]').fill(invalidSnapshotAdminPassword);

    const responseLoss = createResponseLossInterceptor(
      "Simulated response loss before snapshot corruption.",
    );
    await page.route("**/platform", responseLoss.handler);
    await page.getByRole("button", { name: "Crear centro", exact: true }).last().click();

    await expect.poll(responseLoss.wasIntercepted).toBe(true);
    await responseLoss.browserResponseDelivered;

    await expect
      .poll(async () => {
        const committed = await database.query(
          `select count(*)::integer as centers
           from public.centers
           where name=$1`,
          [invalidSnapshotCenterName],
        );
        return committed.rows[0].centers;
      })
      .toBe(1);
    await page.unroute("**/platform", responseLoss.handler);

    const committed = await database.query(
      `select c.id,
              count(distinct cm.id)::integer as memberships,
              count(distinct po.id)::integer as operations,
              min(cm.user_id::text) as admin_user_id
       from public.centers c
       join public.center_memberships cm
         on cm.center_id=c.id and cm.role='ADMIN' and cm.is_active
       join private.provisioning_operations po
         on po.result_center_id=c.id and po.status='SUCCEEDED'
       where c.name=$1
       group by c.id`,
      [invalidSnapshotCenterName],
    );
    expect(committed.rows).toHaveLength(1);
    expect(committed.rows[0]).toMatchObject({ memberships: 1, operations: 1 });
    fixtureCenterIds.add(committed.rows[0].id);
    fixtureUserIds.add(committed.rows[0].admin_user_id);

    const storageKey = await page.evaluate(() =>
      Object.keys(sessionStorage).find((key) =>
        key.startsWith("salud-plus:platform:create-center-intent:v1:"),
      ),
    );
    expect(storageKey).toBeTruthy();
    const invalidSnapshot = await page.evaluate((key) => {
      const serialized = sessionStorage.getItem(key);
      if (!serialized) throw new Error("No se encontró el snapshot pendiente.");
      const parsed = JSON.parse(serialized);
      const withUnexpectedProperty = { ...parsed, extraField: "unexpected" };
      const invalidSerialized = JSON.stringify(withUnexpectedProperty);
      sessionStorage.setItem(key, invalidSerialized);
      return invalidSerialized;
    }, storageKey);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(
        "Hay una creación de centro pendiente que no puede recuperarse de forma segura.",
      ),
    ).toBeVisible();
    await expect(page.locator('input[name="operationId"]')).toHaveCount(0);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe(
      invalidSnapshot,
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(
        "Hay una creación de centro pendiente que no puede recuperarse de forma segura.",
      ),
    ).toBeVisible();
    await expect(page.locator('input[name="operationId"]')).toHaveCount(0);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe(
      invalidSnapshot,
    );

    const beforeAbandonment = await database.query(
      `select
         (select count(*)::integer from public.centers where name=$1) as centers,
         (select count(*)::integer
            from public.center_memberships where center_id=$2 and role='ADMIN' and is_active)
           as memberships,
         (select count(*)::integer
            from private.provisioning_operations where result_center_id=$2 and status='SUCCEEDED')
           as operations`,
      [invalidSnapshotCenterName, committed.rows[0].id],
    );
    expect(beforeAbandonment.rows[0]).toEqual({ centers: 1, memberships: 1, operations: 1 });

    await page
      .getByRole("button", { name: "Abandonar intención pendiente e iniciar una nueva alta" })
      .click();
    const newOperationId = await page.locator('input[name="operationId"]').inputValue();
    expect(newOperationId).not.toBe(operationId);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();

    const afterAbandonment = await database.query(
      `select
         (select count(*)::integer from public.centers where name=$1) as centers,
         (select count(*)::integer
            from public.center_memberships where center_id=$2 and role='ADMIN' and is_active)
           as memberships,
         (select count(*)::integer
            from private.provisioning_operations where result_center_id=$2 and status='SUCCEEDED')
           as operations`,
      [invalidSnapshotCenterName, committed.rows[0].id],
    );
    expect(afterAbandonment.rows[0]).toEqual({ centers: 1, memberships: 1, operations: 1 });
  });

  test("desactivar bloquea tenant, reactivar restaura acceso y conserva membership", async ({
    browser,
    page,
  }) => {
    await login(page, platformEmail, platformPassword);
    let row = page.getByRole("row", { name: new RegExp(newCenterName) });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Desactivar" }).click();
    await expect(row.getByText("Inactivo")).toBeVisible();

    const inactiveState = await database.query(
      `select c.is_active,cm.is_active as membership_active
       from public.centers c
       join public.center_memberships cm on cm.center_id=c.id
       where c.id=$1 and cm.user_id=$2`,
      [newCenterId, newAdminUserId],
    );
    expect(inactiveState.rows[0]).toEqual({ is_active: false, membership_active: true });

    const tenantContext = await browser.newContext();
    const tenantPage = await tenantContext.newPage();
    await login(tenantPage, newAdminEmail, newAdminPassword);
    await expect(tenantPage).toHaveURL(/\/no-access$/);

    row = page.getByRole("row", { name: new RegExp(newCenterName) });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Reactivar" }).click();
    await expect(row.getByText("Activo")).toBeVisible();

    await expect
      .poll(async () => {
        const activeCenter = await database.query(
          "select is_active from public.centers where id=$1",
          [newCenterId],
        );
        return activeCenter.rows[0]?.is_active;
      })
      .toBe(true);

    await tenantPage.goto(`/?after-reactivation=${randomUUID()}`);
    await expect(tenantPage).toHaveURL(new RegExp(`/centers/${newCenterId}$`));
    await tenantContext.close();
  });

  test("ADMIN tenant no accede a /platform", async ({ page }) => {
    await login(page, newAdminEmail, newAdminPassword);
    await expect(page).toHaveURL(new RegExp(`/centers/${newCenterId}$`));
    await page.goto("/platform");
    await expect(page).toHaveURL(new RegExp(`/centers/${newCenterId}$`));
    await expect(page.getByText("Administración de plataforma")).toHaveCount(0);
  });

  test("usuario autenticado común no accede a /platform", async ({ page }) => {
    await login(page, existingEmail, existingPassword);
    await expect(page).toHaveURL(/\/no-access$/);
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/no-access$/);
    await expect(page.getByText("Administración de plataforma")).toHaveCount(0);
  });

  test("reutiliza identidad existente sin cambiar credenciales, perfil ni memberships", async ({
    page,
  }) => {
    const previous = await database.query(
      `insert into public.centers (name,address,phone,email,is_active)
       values ($1,'Dirección previa','1111','previous@example.test',true)
       returning id`,
      [previousCenterName],
    );
    const previousCenterId = previous.rows[0].id;
    fixtureCenterIds.add(previousCenterId);
    await database.query(
      `insert into public.center_memberships (center_id,user_id,role,is_active)
       values ($1,$2,'ADMIN',true)`,
      [previousCenterId, existingUser.id],
    );

    await login(page, platformEmail, platformPassword);
    const operationId = await page.locator('input[name="operationId"]').inputValue();
    fixtureOperationIds.add(operationId);
    await resolveAdminEmail(page, existingEmail);
    await expect(page.getByText("Identidad existente:", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Contraseña inicial")).toHaveCount(0);
    await fillCenter(page, {
      name: reusedCenterName,
      address: "Calle Reutilizada 456",
      phone: "+54 11 6000 7000",
      email: `${prefix}-reused-center@example.test`,
    });
    await page.getByRole("button", { name: "Crear centro", exact: true }).last().click();

    const row = page.getByRole("row", { name: new RegExp(reusedCenterName) });
    await expect(row).toBeVisible();
    await expect(row.locator("td").nth(6)).toHaveText("1");

    const preserved = await database.query(
      `select u.email,u.first_name,u.last_name,
              count(cm.id)::integer as memberships,
              count(cm.id) filter (where cm.center_id=$2 and cm.role='ADMIN' and cm.is_active)::integer
                as previous_memberships
       from public.users u
       join public.center_memberships cm on cm.user_id=u.id
       where u.id=$1
       group by u.id`,
      [existingUser.id, previousCenterId],
    );
    expect(preserved.rows[0]).toEqual({
      email: existingEmail,
      first_name: "Nombre conservado",
      last_name: "Apellido conservado",
      memberships: 2,
      previous_memberships: 1,
    });

    const { data: authIdentity, error: authIdentityError } = await admin.auth.admin.getUserById(
      existingUser.id,
    );
    assertNoError(authIdentityError, "No se pudo releer la identidad existente.");
    expect(authIdentity.user.email).toBe(existingEmail);

    const passwordProbe = createClient(dev.url, dev.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: loginData, error: loginError } = await passwordProbe.auth.signInWithPassword({
      email: existingEmail,
      password: existingPassword,
    });
    assertNoError(loginError, "La contraseña existente fue modificada inesperadamente.");
    expect(loginData.user?.id).toBe(existingUser.id);
    await passwordProbe.auth.signOut();

    const reusedCenters = await database.query(`select id from public.centers where name=$1`, [
      reusedCenterName,
    ]);
    expect(reusedCenters.rowCount).toBe(1);
    fixtureCenterIds.add(reusedCenters.rows[0].id);
  });
});
