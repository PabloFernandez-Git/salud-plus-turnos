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
const expectedCenterId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const expectedOperationIds = [
  "352a309e-f137-488e-b6e7-4b53e2cdb7b2",
  "964ec4bf-eeba-4f4f-914a-d2a8ca101934",
];
const users = new Map();
const fixtureAuthUserIds = new Set();
const fixturePublicUserIds = new Set();
const fixtureCenterIds = new Set();
const fixtureMembershipIds = new Set();
const fixturePlatformAdminUserIds = new Set();
const centerIds = [randomUUID(), randomUUID(), randomUUID()];
const membershipIds = Array.from({ length: 5 }, () => randomUUID());
let database;
let databaseConnected = false;
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

function assertNoError(error, context) {
  if (error) throw new Error(context, { cause: error });
}

function assertEqual(actual, expected, description) {
  if (actual !== expected) {
    throw new Error(`${description}: expected ${expected}, received ${actual}.`);
  }
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

async function createUser(name) {
  const email = `task005b1-${runId}-${name}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: originalPassword,
    email_confirm: true,
  });
  assertNoError(error, "No se pudo crear un Auth user E2E temporal.");
  if (!data.user) throw new Error("Auth no devolvió el usuario E2E creado.");
  fixtureAuthUserIds.add(data.user.id);
  users.set(name, { email, id: data.user.id });
}

async function cleanupDatabase() {
  await database.query("begin");
  try {
    if (fixtureMembershipIds.size > 0) {
      await database.query("delete from public.center_memberships where id = any($1::uuid[])", [
        [...fixtureMembershipIds],
      ]);
    }
    if (fixturePlatformAdminUserIds.size > 0) {
      await database.query("delete from public.platform_admins where user_id = any($1::uuid[])", [
        [...fixturePlatformAdminUserIds],
      ]);
    }
    if (fixtureCenterIds.size > 0) {
      await database.query("delete from public.centers where id = any($1::uuid[])", [
        [...fixtureCenterIds],
      ]);
    }
    if (fixturePublicUserIds.size > 0) {
      await database.query("delete from public.users where id = any($1::uuid[])", [
        [...fixturePublicUserIds],
      ]);
    }
    await database.query("commit");
  } catch (error) {
    await database.query("rollback");
    throw error;
  }
}

async function cleanupAuth() {
  const errors = [];
  for (const userId of [...fixtureAuthUserIds].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "Falló el cleanup Auth E2E.");
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
    fixturePublicUserIds.add(user.id);
  }

  const createdCenters = await database.query(
    `insert into public.centers (id,name,is_active)
     values ($1,$2,true),($3,$4,true),($5,$6,false)
     returning id,name,is_active`,
    [
      centerIds[0],
      `TASK-005B1 ${runId} Centro A`,
      centerIds[1],
      `TASK-005B1 ${runId} Centro B`,
      centerIds[2],
      `TASK-005B1 ${runId} Centro inactivo`,
    ],
  );
  const [centerA, centerB, inactiveCenter] = createdCenters.rows;
  for (const { id } of createdCenters.rows) fixtureCenterIds.add(id);

  await database.query(
    `insert into public.center_memberships (id,center_id,user_id,role,is_active)
     values
       ($1,$6,$9,'RECEPTION',true),
       ($2,$6,$10,'ADMIN',true),
       ($3,$7,$10,'RECEPTION',true),
       ($4,$6,$11,'RECEPTION',false),
       ($5,$8,$11,'RECEPTION',true)`,
    [
      ...membershipIds,
      centerA.id,
      centerB.id,
      inactiveCenter.id,
      users.get("one").id,
      users.get("two").id,
      users.get("inactive").id,
    ],
  );
  for (const id of membershipIds) fixtureMembershipIds.add(id);
  await database.query("insert into public.platform_admins (user_id) values ($1)", [
    users.get("platform").id,
  ]);
  fixturePlatformAdminUserIds.add(users.get("platform").id);

  return { centerA, centerB };
}

async function cleanupFixtures() {
  if (!databaseConnected) return;
  const cleanupErrors = [];

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
  try {
    const residue = await database.query(
      `select
         (select count(*)::integer from auth.users where id=any($1::uuid[])) as auth_users,
         (select count(*)::integer from public.users where id=any($2::uuid[])) as profiles,
         (select count(*)::integer from public.centers where id=any($3::uuid[])) as centers,
         (select count(*)::integer from public.center_memberships where id=any($4::uuid[])) as memberships,
         (select count(*)::integer from public.platform_admins where user_id=any($5::uuid[])) as platform_admins`,
      [
        [...fixtureAuthUserIds],
        [...fixturePublicUserIds],
        [...fixtureCenterIds],
        [...fixtureMembershipIds],
        [...fixturePlatformAdminUserIds],
      ],
    );
    for (const [kind, count] of Object.entries(residue.rows[0])) {
      if (count !== 0) cleanupErrors.push(new Error(`Quedaron residuos E2E: ${kind}.`));
    }
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    const baselineAfter = await persistentSnapshot();
    assertApprovedBaseline(baselineAfter, "TASK-005B1 baseline after cleanup");
    if (JSON.stringify(baselineAfter) !== JSON.stringify(baselineBefore)) {
      cleanupErrors.push(new Error("El baseline DEV no fue restaurado byte-for-byte por B1."));
    }
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Falló el cleanup de fixtures E2E TASK-005B1.");
  }

  console.log(
    "TASK-005B1 exact-ID cleanup verified: zero owned residues and baseline DEV restored.",
  );
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
    databaseConnected = true;
    await database.query("set role postgres");
    baselineBefore = await persistentSnapshot();
    assertApprovedBaseline(baselineBefore, "TASK-005B1 baseline before fixtures");
    ({ centerA, centerB } = await createFixtures());
  });

  test.afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      if (databaseConnected) {
        await database.end();
        databaseConnected = false;
      }
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

  test("PLATFORM_ADMIN sin membership recibe panel protegido, no acceso tenant", async ({
    page,
  }) => {
    await login(page, "platform");
    await expect(page).toHaveURL(/\/platform$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Centros", exact: true }),
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
