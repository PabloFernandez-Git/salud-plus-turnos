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
const originalPassword = `E2e-${runId}-password`;
const updatedPassword = `Nueva-${runId}-password`;
const users = new Map();
const centerIds = [];
let database;

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

async function createUser(name) {
  const email = `task005b1-${runId}-${name}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: originalPassword,
    email_confirm: true,
  });
  assertNoError(error, "No se pudo crear un Auth user E2E temporal.");
  if (!data.user) throw new Error("Auth no devolvió el usuario E2E creado.");
  users.set(name, { email, id: data.user.id });
}

async function cleanupDatabase(userIds = [], centers = []) {
  await database.query("begin");
  try {
    if (userIds.length > 0) {
      await database.query(
        "delete from public.center_memberships where user_id = any($1::uuid[])",
        [userIds],
      );
      await database.query("delete from public.platform_admins where user_id = any($1::uuid[])", [
        userIds,
      ]);
    }
    if (centers.length > 0) {
      await database.query(
        "delete from public.center_memberships where center_id = any($1::uuid[])",
        [centers],
      );
      await database.query("delete from public.centers where id = any($1::uuid[])", [centers]);
    }
    if (userIds.length > 0) {
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
  const staleUsers = await database.query(
    `select id from auth.users where email like 'task005b1-%@example.test'`,
  );
  const staleCenters = await database.query(
    `select id from public.centers where name like 'TASK-005B1 %'`,
  );
  const staleUserIds = staleUsers.rows.map((row) => row.id);
  const staleCenterIds = staleCenters.rows.map((row) => row.id);
  if (staleUserIds.length === 0 && staleCenterIds.length === 0) return;

  await cleanupDatabase(staleUserIds, staleCenterIds);
  await cleanupAuth(staleUserIds);
}

async function createFixtures() {
  for (const name of ["zero", "one", "two", "inactive", "platform"]) {
    await createUser(name);
  }

  for (const [name, user] of users) {
    await database.query(
      `insert into public.users (id,email,first_name,last_name) values ($1,$2,$3,$4)`,
      [user.id, user.email, name === "platform" ? "Plataforma" : "Persona", name],
    );
  }

  const createdCenters = await database.query(
    `insert into public.centers (name,is_active)
     values ($1,true),($2,true),($3,false)
     returning id,name,is_active`,
    [
      `TASK-005B1 ${runId} Centro A`,
      `TASK-005B1 ${runId} Centro B`,
      `TASK-005B1 ${runId} Centro inactivo`,
    ],
  );
  const [centerA, centerB, inactiveCenter] = createdCenters.rows;
  centerIds.push(centerA.id, centerB.id, inactiveCenter.id);

  await database.query(
    `insert into public.center_memberships (center_id,user_id,role,is_active)
     values
       ($1,$4,'RECEPTION',true),
       ($1,$5,'ADMIN',true),
       ($2,$5,'RECEPTION',true),
       ($1,$6,'RECEPTION',false),
       ($3,$6,'RECEPTION',true)`,
    [
      centerA.id,
      centerB.id,
      inactiveCenter.id,
      users.get("one").id,
      users.get("two").id,
      users.get("inactive").id,
    ],
  );
  await database.query("insert into public.platform_admins (user_id) values ($1)", [
    users.get("platform").id,
  ]);

  return { centerA, centerB };
}

async function cleanupFixtures() {
  const userIds = [...users.values()].map((user) => user.id);
  const cleanupErrors = [];

  try {
    await cleanupDatabase(userIds, centerIds);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await cleanupAuth(userIds);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    const residue = await database.query(
      `select
         (select count(*)::integer from auth.users where email like 'task005b1-%@example.test') as auth_users,
         (select count(*)::integer from public.users where email like 'task005b1-%@example.test') as profiles,
         (select count(*)::integer from public.centers where name like 'TASK-005B1 %') as centers`,
    );
    for (const [kind, count] of Object.entries(residue.rows[0])) {
      if (count !== 0) cleanupErrors.push(new Error(`Quedaron residuos E2E: ${kind}.`));
    }
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Falló el cleanup de fixtures E2E TASK-005B1.");
  }

  console.log("TASK-005B1 E2E fixture cleanup verified: zero Auth, profile and Center residues.");
}

async function login(page, name, password = originalPassword) {
  const user = users.get(name);
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test.describe.serial("TASK-005B1 Auth UI and Center access", () => {
  let centerA;
  let centerB;

  test.beforeAll(async () => {
    database = new Client({ ...temporaryDatabaseConfig(), application_name: "task005b1-e2e" });
    await database.connect();
    await database.query("set role postgres");
    await cleanupStaleFixtures();
    ({ centerA, centerB } = await createFixtures());
  });

  test.afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      await database?.end();
    }
  });

  test("login inválido usa un error genérico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(users.get("one").email);
    await page.getByLabel("Contraseña", { exact: true }).fill("password-incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText("No pudimos iniciar sesión con esos datos.", { exact: true }),
    ).toBeVisible();
  });

  test("login válido con cero memberships muestra no-access y logout limpia la sesión", async ({
    page,
  }) => {
    await login(page, "zero");
    await expect(page).toHaveURL(/\/no-access$/);
    await expect(page.getByRole("heading", { name: "Sin acceso activo" })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("una membership redirige directo y Center A no permite Center B", async ({ page }) => {
    await login(page, "one");
    await expect(page).toHaveURL(new RegExp(`/centers/${centerA.id}$`));
    await expect(page.getByRole("heading", { name: centerA.name })).toBeVisible();
    await expect(page.getByText("Rol: RECEPTION")).toBeVisible();

    await page.goto("/login");
    await expect(page).toHaveURL(new RegExp(`/centers/${centerA.id}$`));

    const response = await page.goto(`/centers/${centerB.id}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(centerB.name)).toHaveCount(0);
  });

  test("dos memberships activas muestran selector con nombre y rol", async ({ page }) => {
    await login(page, "two");
    await expect(page).toHaveURL(/\/select-center$/);
    await expect(page.getByRole("link", { name: new RegExp(centerA.name) })).toContainText(
      "Rol: ADMIN",
    );
    await expect(page.getByRole("link", { name: new RegExp(centerB.name) })).toContainText(
      "Rol: RECEPTION",
    );
    await page.getByRole("link", { name: new RegExp(centerB.name) }).click();
    await expect(page).toHaveURL(new RegExp(`/centers/${centerB.id}$`));
  });

  test("membership inactiva y Center inactivo se ignoran", async ({ page }) => {
    await login(page, "inactive");
    await expect(page).toHaveURL(/\/no-access$/);
  });

  test("PLATFORM_ADMIN sin membership recibe placeholder protegido, no acceso tenant", async ({
    page,
  }) => {
    await login(page, "platform");
    await expect(page).toHaveURL(/\/platform$/);
    await expect(
      page.getByRole("heading", { name: "Administración próximamente disponible" }),
    ).toBeVisible();

    const response = await page.goto(`/centers/${centerA.id}`);
    expect(response?.status()).toBe(404);
  });

  test("recovery mantiene respuesta anti-enumeración", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`missing-${runId}@example.test`);
    await page.getByRole("button", { name: "Enviar instrucciones" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Si existe una cuenta asociada, recibirás instrucciones",
    );
  });

  test("callback inválido no admite un redirect externo", async ({ page }) => {
    await page.goto("/auth/callback?next=https://evil.example.test");
    await expect(page).toHaveURL(/\/login\?error=invalid_callback$/);
    await expect(page).not.toHaveURL(/evil\.example\.test/);
  });

  test("update password rechaza menos de 10 y acepta una contraseña válida", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, "one");
    await expect(page).toHaveURL(new RegExp(`/centers/${centerA.id}$`));
    await page.goto("/update-password");
    await page.getByLabel("Nueva contraseña").fill("123456789");
    await page.getByLabel("Confirmar contraseña").fill("123456789");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(page).toHaveURL(/\/update-password$/);
    expect(
      await page.getByLabel("Nueva contraseña").evaluate((input) => input.validity.valid),
    ).toBe(false);

    await page.getByLabel("Nueva contraseña").fill(updatedPassword);
    await page.getByLabel("Confirmar contraseña").fill(updatedPassword);
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(page).toHaveURL(new RegExp(`/centers/${centerA.id}$`));

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await login(page, "one", updatedPassword);
    await expect(page).toHaveURL(new RegExp(`/centers/${centerA.id}$`));
  });
});
