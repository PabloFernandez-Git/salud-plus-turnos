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
const password = `B3b-${randomBytes(18).toString("base64url")}`;
const expectedCenterId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const expectedOperationIds = [
  "352a309e-f137-488e-b6e7-4b53e2cdb7b2",
  "964ec4bf-eeba-4f4f-914a-d2a8ca101934",
];
const users = new Map();
const createdAuthUserIds = [];
const centerIds = [randomUUID(), randomUUID()];
const membershipIds = Array.from({ length: 7 }, () => randomUUID());
const professionalId = randomUUID();
const professionalCenterId = randomUUID();
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

async function createAuthUser(name, firstName, lastName) {
  const email = `task005b3b-${runId}-${name}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear el Auth user ${name}.`, { cause: error });
  const user = { id: data.user.id, email, firstName, lastName };
  users.set(name, user);
  createdAuthUserIds.push(user.id);
}

async function createFixtures() {
  const definitions = [
    ["admin-a", "Ana", "Administradora"],
    ["admin-b", "Bruno", "Administrador"],
    ["reception", "Rita", "Recepción"],
    ["professional", "Pablo", "Profesional"],
    ["inactive-admin", "Inés", "Inactiva"],
    ["platform", "Patricia", "Plataforma"],
    ["cross-center", "Celia", "Otro Centro"],
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
    [
      centerIds[0],
      `TASK-005B3B ${runId} Centro A`,
      centerIds[1],
      `TASK-005B3B ${runId} Centro B`,
    ],
  );
  await database.query(
    `insert into public.professionals
       (id,first_name,last_name,nationality_code,document_number,email)
     values ($1,'Paula','Médica','AR',$2,$3)`,
    [professionalId, `DOC-${runId}`, `professional-record-${runId}@example.test`],
  );
  await database.query(
    `insert into public.professional_centers
       (id,professional_id,center_id,license_number,is_active)
     values ($1,$2,$3,'MP 1234',true)`,
    [professionalCenterId, professionalId, centerIds[0]],
  );
  await database.query(
    `insert into public.center_memberships
       (id,center_id,user_id,role,professional_center_id,is_active)
     values
       ($1,$8,$10,'ADMIN',null,true),
       ($2,$8,$11,'RECEPTION',null,true),
       ($3,$8,$12,'PROFESSIONAL',$15,true),
       ($4,$8,$13,'ADMIN',null,false),
       ($5,$9,$14,'ADMIN',null,true),
       ($6,$9,$16,'RECEPTION',null,true),
       ($7,$9,$17,'RECEPTION',null,false)`,
    [
      ...membershipIds,
      centerIds[0],
      centerIds[1],
      users.get("admin-a").id,
      users.get("reception").id,
      users.get("professional").id,
      users.get("inactive-admin").id,
      users.get("admin-b").id,
      professionalCenterId,
      users.get("cross-center").id,
      users.get("platform").id,
    ],
  );
  await database.query("insert into public.platform_admins (user_id) values ($1)", [
    users.get("platform").id,
  ]);
}

async function cleanupFixtures() {
  const errors = [];

  if (database) {
    try {
      await database.query("begin");
      await database.query("delete from public.center_memberships where id=any($1::uuid[])", [
        membershipIds,
      ]);
      await database.query("delete from public.platform_admins where user_id=any($1::uuid[])", [
        createdAuthUserIds,
      ]);
      await database.query("delete from public.professional_centers where id=$1", [
        professionalCenterId,
      ]);
      await database.query("delete from public.professionals where id=$1", [professionalId]);
      await database.query("delete from public.centers where id=any($1::uuid[])", [centerIds]);
      await database.query("delete from public.users where id=any($1::uuid[])", [
        createdAuthUserIds,
      ]);
      await database.query("commit");
    } catch (error) {
      await database.query("rollback").catch(() => undefined);
      errors.push(error);
    }
  }

  for (const userId of [...createdAuthUserIds].reverse()) {
    const { error } = await authAdmin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) errors.push(error);
  }

  if (database && baselineBefore) {
    try {
      const baselineAfter = await persistentSnapshot();
      assertApprovedBaseline(baselineAfter, "DEV baseline after B3B E2E");
      assertEqual(
        JSON.stringify(baselineAfter),
        JSON.stringify(baselineBefore),
        "persistent DEV data preservation",
      );
      const residue = await database.query(
        `select
           (select count(*)::int from auth.users where id=any($1::uuid[])) as auth_users,
           (select count(*)::int from public.users where id=any($1::uuid[])) as profiles,
           (select count(*)::int from public.centers where id=any($2::uuid[])) as centers,
           (select count(*)::int from public.center_memberships where id=any($3::uuid[])) as memberships,
           (select count(*)::int from public.professionals where id=$4) as professionals,
           (select count(*)::int from public.professional_centers where id=$5) as professional_centers`,
        [createdAuthUserIds, centerIds, membershipIds, professionalId, professionalCenterId],
      );
      for (const [kind, count] of Object.entries(residue.rows[0])) {
        assertEqual(count, 0, `B3B E2E residue ${kind}`);
      }
      console.log("TASK-005B3B E2E cleanup exacto y baseline persistente verificados.");
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) throw new AggregateError(errors, "Falló el cleanup E2E de TASK-005B3B.");
}

async function login(page, name) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(users.get(name).email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

async function expectUsersRouteDenied(page, centerId) {
  await page.goto(`/centers/${centerId}/users`);
  await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText(users.get("admin-a").email)).toHaveCount(0);
}

test.describe.serial("TASK-005B3B Center users read-only UI", () => {
  test.beforeAll(async () => {
    database = new Client({
      ...temporaryDatabaseConfig(),
      application_name: "task005b3b-e2e",
    });
    await database.connect();
    await database.query("set role postgres");
    baselineBefore = await persistentSnapshot();
    assertApprovedBaseline(baselineBefore, "DEV baseline before B3B E2E");
    await createFixtures();
  });

  test.afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      await database?.end();
    }
  });

  test("ADMIN navega al listado, ve sólo su Center y vuelve al Center", async ({ page }) => {
    await login(page, "admin-a");
    await expect(page).toHaveURL(new RegExp(`/centers/${centerIds[0]}$`));

    await page.getByRole("link", { name: "Usuarios" }).click();
    await expect(page).toHaveURL(new RegExp(`/centers/${centerIds[0]}/users$`));
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();
    await expect(page.getByText(`TASK-005B3B ${runId} Centro A`)).toBeVisible();

    const adminRow = page.getByRole("row", { name: /Ana Administradora/ });
    await expect(adminRow.getByText(users.get("admin-a").email)).toBeVisible();
    await expect(adminRow.getByRole("cell", { name: "Administrador", exact: true })).toBeVisible();
    await expect(adminRow.getByRole("cell", { name: "Activo", exact: true })).toBeVisible();
    await expect(adminRow.getByLabel("Sin profesional asociado")).toHaveText("—");

    const receptionRow = page.getByRole("row", { name: /Rita Recepción/ });
    await expect(receptionRow.getByRole("cell", { name: "Recepción", exact: true })).toBeVisible();
    await expect(receptionRow.getByRole("cell", { name: "Activo", exact: true })).toBeVisible();

    const inactiveRow = page.getByRole("row", { name: /Inés Inactiva/ });
    await expect(inactiveRow.getByRole("cell", { name: "Inactivo", exact: true })).toBeVisible();

    const professionalRow = page.getByRole("row", { name: /Pablo Profesional/ });
    await expect(
      professionalRow.getByRole("cell", { name: "Profesional", exact: true }),
    ).toBeVisible();
    await expect(professionalRow.getByText("Paula Médica")).toBeVisible();
    await expect(professionalRow.getByText("Matrícula: MP 1234")).toBeVisible();
    await expect(professionalRow.getByRole("button", { name: "Administrar" })).toBeVisible();

    await expect(page.getByText(users.get("cross-center").email)).toHaveCount(0);
    await expect(page.getByText(`TASK-005B3B ${runId} Centro B`)).toHaveCount(0);

    await page.getByRole("link", { name: "Volver al centro" }).click();
    await expect(page).toHaveURL(new RegExp(`/centers/${centerIds[0]}$`));
  });

  test("RECEPTION y PROFESSIONAL no ven navegación ni abren /users", async ({ page }) => {
    for (const name of ["reception", "professional"]) {
      await login(page, name);
      await expect(page).toHaveURL(new RegExp(`/centers/${centerIds[0]}$`));
      await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
      await expectUsersRouteDenied(page, centerIds[0]);
    }
  });

  test("membership inactiva y ADMIN de otro Center quedan denegados", async ({ page }) => {
    await login(page, "inactive-admin");
    await expect(page).toHaveURL(/\/no-access$/);
    await expectUsersRouteDenied(page, centerIds[0]);

    await login(page, "admin-b");
    await expect(page).toHaveURL(new RegExp(`/centers/${centerIds[1]}$`));
    await expectUsersRouteDenied(page, centerIds[0]);
  });

  test("PLATFORM_ADMIN sin ADMIN tenant no obtiene acceso", async ({ page }) => {
    await login(page, "platform");
    await expect(page).toHaveURL(/\/platform$/);
    await expectUsersRouteDenied(page, centerIds[0]);
  });
});
