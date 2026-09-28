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
const password = `B3d-${randomBytes(18).toString("base64url")}`;
const expectedCenterId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const expectedOperationIds = [
  "352a309e-f137-488e-b6e7-4b53e2cdb7b2",
  "964ec4bf-eeba-4f4f-914a-d2a8ca101934",
];
const centerIds = [randomUUID(), randomUUID(), randomUUID()];
const professionalIds = Array.from({ length: 5 }, () => randomUUID());
const professionalCenterIds = Array.from({ length: 5 }, () => randomUUID());
const membershipIds = Object.fromEntries(
  [
    "admin-a",
    "admin-b",
    "reception-target",
    "inactive-target",
    "professional-target",
    "reception-actor",
    "professional-actor",
    "other-admin",
    "cross-target",
    "last-admin",
    "inactive-admin",
  ].map((name) => [name, randomUUID()]),
);
const users = new Map();
const createdAuthUserIds = [];
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
             'id', id, 'email', email, 'encrypted_password', encrypted_password,
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
  const email = `task005b3d-${runId}-${name}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(`No se pudo crear el Auth user ${name}.`, { cause: error });
  const user = { id: data.user.id, email, firstName, lastName };
  users.set(name, user);
  createdAuthUserIds.push(user.id);
}

async function createFixtures() {
  const definitions = [
    ["admin-a", "Ana", "Administradora"],
    ["admin-b", "Bruno", "Administrador"],
    ["reception-target", "Rita", "Objetivo"],
    ["inactive-target", "Inés", "Inactiva"],
    ["professional-target", "Pablo", "Profesional"],
    ["reception-actor", "Raúl", "Recepción"],
    ["professional-actor", "Priscila", "Profesional"],
    ["other-admin", "Oscar", "Otro Centro"],
    ["last-admin", "Úrsula", "Última Admin"],
    ["inactive-admin", "Iván", "Admin Inactivo"],
    ["platform", "Patricia", "Plataforma"],
  ];
  for (const definition of definitions) await createAuthUser(...definition);
  for (const user of users.values()) {
    await database.query(
      "insert into public.users (id,email,first_name,last_name) values ($1,$2,$3,$4)",
      [user.id, user.email, user.firstName, user.lastName],
    );
  }

  await database.query(
    `insert into public.centers (id,name,is_active) values
       ($1,$2,true),($3,$4,true),($5,$6,true)`,
    [
      centerIds[0],
      `TASK-005B3D ${runId} Centro A`,
      centerIds[1],
      `TASK-005B3D ${runId} Centro B`,
      centerIds[2],
      `TASK-005B3D ${runId} Último Admin`,
    ],
  );

  for (let index = 0; index < professionalIds.length; index += 1) {
    await database.query(
      `insert into public.professionals
         (id,first_name,last_name,nationality_code,document_number,email)
       values ($1,$2,$3,'AR',$4,$5)`,
      [
        professionalIds[index],
        `Profesional ${index + 1}`,
        "Fixture",
        `DOC-${runId}-${index + 1}`,
        `professional-${runId}-${index + 1}@example.test`,
      ],
    );
  }
  await database.query(
    `insert into public.professional_centers
       (id,professional_id,center_id,license_number,is_active) values
       ($1,$6,$11,'PC ACTUAL',true),
       ($2,$7,$11,'PC LIBRE',true),
       ($3,$8,$11,'PC OCUPADO',true),
       ($4,$9,$11,'PC INACTIVO',false),
       ($5,$10,$12,'PC CROSS',true)`,
    [...professionalCenterIds, ...professionalIds, centerIds[0], centerIds[1]],
  );

  const values = [
    [membershipIds["admin-a"], centerIds[0], users.get("admin-a").id, "ADMIN", null, true],
    [membershipIds["admin-b"], centerIds[0], users.get("admin-b").id, "ADMIN", null, true],
    [
      membershipIds["reception-target"],
      centerIds[0],
      users.get("reception-target").id,
      "RECEPTION",
      null,
      true,
    ],
    [
      membershipIds["inactive-target"],
      centerIds[0],
      users.get("inactive-target").id,
      "RECEPTION",
      null,
      false,
    ],
    [
      membershipIds["professional-target"],
      centerIds[0],
      users.get("professional-target").id,
      "PROFESSIONAL",
      professionalCenterIds[0],
      true,
    ],
    [
      membershipIds["reception-actor"],
      centerIds[0],
      users.get("reception-actor").id,
      "RECEPTION",
      null,
      true,
    ],
    [
      membershipIds["professional-actor"],
      centerIds[0],
      users.get("professional-actor").id,
      "PROFESSIONAL",
      professionalCenterIds[2],
      true,
    ],
    [membershipIds["other-admin"], centerIds[1], users.get("other-admin").id, "ADMIN", null, true],
    [
      membershipIds["cross-target"],
      centerIds[1],
      users.get("reception-target").id,
      "RECEPTION",
      null,
      true,
    ],
    [membershipIds["last-admin"], centerIds[2], users.get("last-admin").id, "ADMIN", null, true],
    [
      membershipIds["inactive-admin"],
      centerIds[0],
      users.get("inactive-admin").id,
      "ADMIN",
      null,
      false,
    ],
  ];
  for (const value of values) {
    await database.query(
      `insert into public.center_memberships
         (id,center_id,user_id,role,professional_center_id,is_active)
       values ($1,$2,$3,$4,$5,$6)`,
      value,
    );
  }
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
        Object.values(membershipIds),
      ]);
      await database.query("delete from public.platform_admins where user_id=any($1::uuid[])", [
        createdAuthUserIds,
      ]);
      await database.query("delete from public.professional_centers where id=any($1::uuid[])", [
        professionalCenterIds,
      ]);
      await database.query("delete from public.professionals where id=any($1::uuid[])", [
        professionalIds,
      ]);
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
      assertApprovedBaseline(baselineAfter, "DEV baseline after B3D E2E");
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
           (select count(*)::int from public.professionals where id=any($4::uuid[])) as professionals,
           (select count(*)::int from public.professional_centers where id=any($5::uuid[])) as professional_centers`,
        [
          createdAuthUserIds,
          centerIds,
          Object.values(membershipIds),
          professionalIds,
          professionalCenterIds,
        ],
      );
      for (const [kind, count] of Object.entries(residue.rows[0])) {
        assertEqual(count, 0, `B3D E2E residue ${kind}`);
      }
      console.log("TASK-005B3D E2E cleanup exacto y baseline persistente verificados.");
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, "Falló el cleanup E2E de TASK-005B3D.");
}

async function login(page, name) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(users.get(name).email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function openUsers(page, actor, centerId = centerIds[0]) {
  await login(page, actor);
  await page.goto(`/centers/${centerId}/users`);
  await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();
}

async function openManager(page, rowName) {
  const row = page.getByRole("row", { name: rowName });
  await row.getByRole("button", { name: "Administrar" }).click();
  return row;
}

async function confirmChange(page, row) {
  await row.getByRole("button", { name: "Revisar cambios" }).click();
  const dialog = row.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar cambios" }).click();
}

function professionalSelect(row) {
  return row
    .locator("label")
    .filter({ hasText: /^Profesional asociado/ })
    .locator("select");
}

async function membership(name) {
  const result = await database.query(
    `select role, professional_center_id, is_active
     from public.center_memberships where id=$1`,
    [membershipIds[name]],
  );
  return result.rows[0];
}

test.describe.serial("TASK-005B3D membership management", () => {
  test.beforeEach(() => {
    test.setTimeout(120_000);
  });

  test.beforeAll(async () => {
    database = new Client({
      ...temporaryDatabaseConfig(),
      application_name: "task005b3d-e2e",
    });
    await database.connect();
    await database.query("set role postgres");
    baselineBefore = await persistentSnapshot();
    assertApprovedBaseline(baselineBefore, "DEV baseline before B3D E2E");
    await createFixtures();
  });

  test.afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      await database?.end();
    }
  });

  test("ADMIN cambia roles y activa/desactiva reutilizando la misma identidad", async ({
    page,
  }) => {
    await openUsers(page, "admin-a");
    let row = await openManager(page, /Rita Objetivo/);
    await row.getByLabel("Rol en este centro").selectOption("ADMIN");
    await confirmChange(page, row);
    await expect.poll(async () => (await membership("reception-target")).role).toBe("ADMIN");
    await page.reload();

    row = await openManager(page, /Rita Objetivo/);
    await row.getByLabel("Rol en este centro").selectOption("RECEPTION");
    await confirmChange(page, row);
    await expect.poll(async () => (await membership("reception-target")).role).toBe("RECEPTION");

    row = await openManager(page, /Inés Inactiva/);
    await row.getByLabel("Estado del acceso").selectOption("active");
    await confirmChange(page, row);
    await expect.poll(async () => (await membership("inactive-target")).is_active).toBe(true);
    await page.reload();

    row = await openManager(page, /Inés Inactiva/);
    await row.getByLabel("Estado del acceso").selectOption("inactive");
    await confirmChange(page, row);
    await expect.poll(async () => (await membership("inactive-target")).is_active).toBe(false);

    const identity = await database.query(
      `select app_user.email, app_user.first_name, app_user.last_name,
         (select role from public.center_memberships where id=$2) as other_center_role
       from public.users app_user where app_user.id=$1`,
      [users.get("reception-target").id, membershipIds["cross-target"]],
    );
    expect(identity.rows[0]).toEqual({
      email: users.get("reception-target").email,
      first_name: "Rita",
      last_name: "Objetivo",
      other_center_role: "RECEPTION",
    });
  });

  test("último ADMIN queda protegido en UI y en la RPC", async ({ page }) => {
    await openUsers(page, "last-admin", centerIds[2]);
    const row = await openManager(page, /Úrsula Última Admin/);
    await row.getByLabel("Rol en este centro").selectOption("RECEPTION");
    await row.getByRole("button", { name: "Revisar cambios" }).click();
    await expect(row.getByRole("alert")).toContainText("único Administrador activo");

    const directClient = createClient(dev.url, dev.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginError } = await directClient.auth.signInWithPassword({
      email: users.get("last-admin").email,
      password,
    });
    expect(loginError).toBeNull();
    const { error } = await directClient.rpc("admin_set_center_membership", {
      p_center_id: centerIds[2],
      p_expected_role: "ADMIN",
      p_expected_professional_center_id: null,
      p_expected_is_active: true,
      p_membership_id: membershipIds["last-admin"],
      p_role: "RECEPTION",
      p_professional_center_id: null,
      p_is_active: true,
    });
    expect(error?.message).toContain("retain an active ADMIN");
    expect(await membership("last-admin")).toMatchObject({ role: "ADMIN", is_active: true });
    await directClient.auth.signOut();
  });

  test("autorización tenant rechaza roles y Centers ajenos", async ({ page }) => {
    for (const actor of ["reception-actor", "professional-actor", "inactive-admin"]) {
      await login(page, actor);
      await page.goto(`/centers/${centerIds[0]}/users`);
      await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toHaveCount(0);
    }
    await login(page, "other-admin");
    await page.goto(`/centers/${centerIds[0]}/users`);
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toHaveCount(0);
    await login(page, "platform");
    await page.goto(`/centers/${centerIds[0]}/users`);
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toHaveCount(0);
  });

  test("PROFESSIONAL sólo ofrece PC válido, permite el PC propio y rechaza opciones inválidas", async ({
    page,
  }) => {
    await openUsers(page, "admin-a");
    let row = await openManager(page, /Pablo Profesional/);
    let professionalCenterSelect = professionalSelect(row);
    await expect(professionalCenterSelect.getByRole("option", { name: /PC ACTUAL/ })).toHaveCount(
      1,
    );
    await expect(professionalCenterSelect.getByRole("option", { name: /PC LIBRE/ })).toHaveCount(1);
    await expect(professionalCenterSelect.getByRole("option", { name: /PC OCUPADO/ })).toHaveCount(
      0,
    );
    await professionalCenterSelect.selectOption(professionalCenterIds[1]);
    await confirmChange(page, row);
    await expect
      .poll(async () => (await membership("professional-target")).professional_center_id)
      .toBe(professionalCenterIds[1]);
    await page.reload();

    row = await openManager(page, /Rita Objetivo/);
    await row.getByLabel("Rol en este centro").selectOption("PROFESSIONAL");
    professionalCenterSelect = professionalSelect(row);
    await expect(professionalCenterSelect.getByRole("option", { name: /PC ACTUAL/ })).toHaveCount(
      1,
    );
    await expect(professionalCenterSelect.getByRole("option", { name: /PC LIBRE/ })).toHaveCount(0);
    await expect(professionalCenterSelect.getByRole("option", { name: /PC OCUPADO/ })).toHaveCount(
      0,
    );
    await expect(professionalCenterSelect.getByRole("option", { name: /PC INACTIVO/ })).toHaveCount(
      0,
    );
    await expect(professionalCenterSelect.getByRole("option", { name: /PC CROSS/ })).toHaveCount(0);
    await professionalCenterSelect.selectOption(professionalCenterIds[0]);
    await confirmChange(page, row);
    await expect.poll(async () => (await membership("reception-target")).role).toBe("PROFESSIONAL");
    await expect
      .poll(async () => (await membership("reception-target")).professional_center_id)
      .toBe(professionalCenterIds[0]);
    await page.reload();

    row = await openManager(page, /Rita Objetivo/);
    const ownProfessionalSelect = professionalSelect(row);
    await expect(ownProfessionalSelect).toHaveValue(professionalCenterIds[0]);
    await expect(ownProfessionalSelect.getByRole("option", { name: /PC ACTUAL/ })).toHaveCount(1);

    await openUsers(page, "last-admin", centerIds[2]);
    row = await openManager(page, /Úrsula Última Admin/);
    await expect(
      row.getByLabel("Rol en este centro").getByRole("option", { name: /Profesional/ }),
    ).toHaveAttribute("disabled", "");
  });

  test("desactiva PROFESSIONAL con PC luego inactivo y bloquea su reactivación", async ({
    page,
  }) => {
    await database.query("update public.professional_centers set is_active=false where id=$1", [
      professionalCenterIds[0],
    ]);
    await openUsers(page, "admin-a");
    let row = await openManager(page, /Rita Objetivo/);
    await row.getByLabel("Estado del acceso").selectOption("inactive");
    await confirmChange(page, row);
    await expect.poll(async () => (await membership("reception-target")).is_active).toBe(false);
    await page.reload();

    row = await openManager(page, /Rita Objetivo/);
    await row.getByLabel("Estado del acceso").selectOption("active");
    await row.getByRole("button", { name: "Revisar cambios" }).click();
    await expect(row.getByRole("alert")).toContainText("vínculo profesional actual está inactivo");
    expect(await membership("reception-target")).toMatchObject({
      role: "PROFESSIONAL",
      professional_center_id: professionalCenterIds[0],
      is_active: false,
    });
  });

  test("self-admin se degrada cuando sobrevive otro ADMIN y navega de forma segura", async ({
    page,
  }) => {
    await openUsers(page, "admin-a");
    const row = await openManager(page, /Ana Administradora/);
    await row.getByLabel("Rol en este centro").selectOption("RECEPTION");
    await confirmChange(page, row);
    await expect(page).toHaveURL(new RegExp(`/centers/${centerIds[0]}$`));
    expect(await membership("admin-a")).toMatchObject({ role: "RECEPTION", is_active: true });
    expect(await membership("admin-b")).toMatchObject({ role: "ADMIN", is_active: true });
    await page.goto(`/centers/${centerIds[0]}/users`);
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toHaveCount(0);
  });
});
