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
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required for temporary DEV E2E users.");

const authAdmin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { Client } = pg;
const supabaseCli = resolve("node_modules/supabase/dist/supabase.js");
const baselineRunner = resolve("scripts/verify-task006b-db-foundation.mjs");
const poolerUrlFile = resolve("supabase/.temp/pooler-url");
const runId = randomUUID().replaceAll("-", "").slice(0, 14);
const password = `Task006f-${randomBytes(18).toString("base64url")}`;
const centerA = randomUUID();
const centerB = randomUUID();
const membershipIds = {
  adminA: randomUUID(),
  adminB: randomUUID(),
  reception: randomUUID(),
  professional: randomUUID(),
  inactive: randomUUID(),
};
const users = new Map();
const ownedAuthIds = new Set();
const ownedProfessionalIds = new Set();
const ownedProfessionalCenterIds = new Set();
const ownedSpecialtyIds = new Set();
const ownedAssociationIds = new Set();
let specialtyName = `Cardiología ${runId}`;
const secondSpecialtyName = `Clínica ${runId}`;
const documentNumber = `F${runId}`;
const professionalEmail = `professional-${runId}@example.test`;
let database;

function baselineOnly() {
  execFileSync(process.execPath, [baselineRunner, "--baseline-only"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

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
  if (!approvedHost) throw new Error("The E2E database connection is not approved DEV.");
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

async function createAuthUser(name, firstName, lastName) {
  const email = `task006f-${runId}-${name}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(`Could not create ${name} E2E Auth user.`, { cause: error });
  const user = { id: data.user.id, email, firstName, lastName };
  users.set(name, user);
  ownedAuthIds.add(user.id);
  await database.query(
    "insert into public.users (id,email,first_name,last_name) values ($1,$2,$3,$4)",
    [user.id, user.email, firstName, lastName],
  );
}

async function createFixtures() {
  await createAuthUser("admin-a", "Ana", "Integración");
  await createAuthUser("admin-b", "Bruno", "Integración");
  await createAuthUser("reception", "Rita", "Integración");
  await createAuthUser("professional", "Pablo", "Integración");
  await createAuthUser("inactive", "Inés", "Inactiva");
  await createAuthUser("platform", "Patricia", "Integración");
  await database.query(
    "insert into public.centers (id,name,is_active) values ($1,$2,true),($3,$4,true)",
    [centerA, `Centro 006F A ${runId}`, centerB, `Centro 006F B ${runId}`],
  );
  for (const [id, centerId, userId, role] of [
    [membershipIds.adminA, centerA, users.get("admin-a").id, "ADMIN"],
    [membershipIds.adminB, centerB, users.get("admin-b").id, "ADMIN"],
    [membershipIds.reception, centerA, users.get("reception").id, "RECEPTION"],
    [membershipIds.inactive, centerA, users.get("inactive").id, "ADMIN"],
  ]) {
    await database.query(
      "insert into public.center_memberships (id,center_id,user_id,role,is_active) values ($1,$2,$3,$4,$5)",
      [id, centerId, userId, role, id !== membershipIds.inactive],
    );
  }
  await database.query("insert into public.platform_admins (user_id) values ($1)", [
    users.get("platform").id,
  ]);
}

async function captureOwnedRows() {
  if (!database) return;
  const specialtyRows = await database.query(
    "select id from public.specialties where center_id=any($1::uuid[])",
    [[centerA, centerB]],
  );
  for (const row of specialtyRows.rows) ownedSpecialtyIds.add(row.id);
  const pcRows = await database.query(
    "select id,professional_id from public.professional_centers where center_id=any($1::uuid[])",
    [[centerA, centerB]],
  );
  for (const row of pcRows.rows) {
    ownedProfessionalCenterIds.add(row.id);
    ownedProfessionalIds.add(row.professional_id);
  }
  const associationRows = await database.query(
    `select professional_center_id,specialty_id from public.professional_center_specialties
     where center_id=any($1::uuid[])`,
    [[centerA, centerB]],
  );
  for (const row of associationRows.rows) {
    ownedAssociationIds.add(`${row.professional_center_id}:${row.specialty_id}`);
  }
}

async function cleanupFixtures() {
  const errors = [];
  if (database) {
    try {
      // Both Centers were created by this run and were empty at setup. Discover their
      // generated row UUIDs, then delete only those exact owned IDs.
      await captureOwnedRows();
      await database.query("begin");
      for (const key of ownedAssociationIds) {
        const [pcId, specialtyId] = key.split(":");
        await database.query(
          `delete from public.professional_center_specialties
           where professional_center_id=$1 and specialty_id=$2`,
          [pcId, specialtyId],
        );
      }
      await database.query("delete from public.center_memberships where id=any($1::uuid[])", [
        Object.values(membershipIds),
      ]);
      await database.query("delete from public.professional_centers where id=any($1::uuid[])", [
        [...ownedProfessionalCenterIds],
      ]);
      await database.query("delete from public.specialties where id=any($1::uuid[])", [
        [...ownedSpecialtyIds],
      ]);
      await database.query("delete from public.professionals where id=any($1::uuid[])", [
        [...ownedProfessionalIds],
      ]);
      await database.query("delete from public.platform_admins where user_id=any($1::uuid[])", [
        [...ownedAuthIds],
      ]);
      await database.query("delete from public.centers where id=any($1::uuid[])", [
        [centerA, centerB],
      ]);
      await database.query("delete from public.users where id=any($1::uuid[])", [
        [...ownedAuthIds],
      ]);
      await database.query("commit");
    } catch (error) {
      await database.query("rollback").catch(() => undefined);
      errors.push(error);
    }
  }
  for (const userId of [...ownedAuthIds].reverse()) {
    const { error } = await authAdmin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) errors.push(error);
  }
  if (database) await database.end().catch((error) => errors.push(error));
  try {
    baselineOnly();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "TASK-006F E2E cleanup/baseline failed.");
}

async function login(page, name) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(users.get(name).email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function specialtyRow(databaseName) {
  const result = await database.query(
    "select id,is_active from public.specialties where center_id=$1 and name=$2",
    [centerA, databaseName],
  );
  expect(result.rows).toHaveLength(1);
  ownedSpecialtyIds.add(result.rows[0].id);
  return result.rows[0];
}

async function professionalCenterRow(centerId) {
  const result = await database.query(
    "select id,professional_id,is_active,license_number,usual_appointment_duration_minutes from public.professional_centers where center_id=$1",
    [centerId],
  );
  expect(result.rows).toHaveLength(1);
  ownedProfessionalCenterIds.add(result.rows[0].id);
  ownedProfessionalIds.add(result.rows[0].professional_id);
  return result.rows[0];
}

test("TASK-006F ADMIN integra Specialty, ProfessionalCenter y asociaciones en DEV", async ({
  page,
}) => {
  test.setTimeout(420_000);
  baselineOnly();
  database = new Client({ ...temporaryDatabaseConfig(), application_name: "task006f-e2e" });
  await database.connect();
  await database.query("set role postgres");
  try {
    await createFixtures();
    await login(page, "admin-a");
    await page.goto(`/centers/${centerA}`);
    const nav = page.getByRole("navigation", { name: "Administración del centro" });
    await expect(nav.getByRole("link", { name: "Gestión de usuarios" })).toHaveAttribute(
      "href",
      `/centers/${centerA}/users`,
    );
    await expect(nav.getByRole("link", { name: "Especialidades" })).toHaveAttribute(
      "href",
      `/centers/${centerA}/specialties`,
    );
    await expect(nav.getByRole("link", { name: "Profesionales" })).toHaveAttribute(
      "href",
      `/centers/${centerA}/professionals`,
    );

    await page.goto(`/centers/${centerA}/specialties`);
    for (const name of [specialtyName, secondSpecialtyName]) {
      await page.getByRole("button", { name: "Nueva especialidad" }).click();
      const editor = page.getByRole("region", { name: "Nueva especialidad" });
      await editor.getByLabel("Nombre").fill(name);
      if (name === specialtyName)
        await editor.getByLabel("Descripción (opcional)").fill(" Atención inicial ");
      await editor.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
      await specialtyRow(name);
    }
    let specialty = await specialtyRow(specialtyName);
    expect(
      (
        await database.query("select description from public.specialties where id=$1", [
          specialty.id,
        ])
      ).rows,
    ).toEqual([{ description: "Atención inicial" }]);
    let row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await expect(row).toContainText("Atención inicial");
    await row.getByRole("button", { name: "Editar" }).click();
    specialtyName = `Cardiología editada ${runId}`;
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByLabel("Nombre")
      .fill(specialtyName);
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByLabel("Descripción (opcional)")
      .fill("Atención avanzada");
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByRole("button", { name: "Guardar" })
      .click();
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await expect(row).toContainText("Atención avanzada");
    await row.getByRole("button", { name: "Desactivar" }).click();
    await page.getByRole("button", { name: "Confirmar desactivación" }).click();
    await expect.poll(async () => (await specialtyRow(specialtyName)).is_active).toBe(false);
    await page.getByRole("button", { name: "Nueva especialidad" }).click();
    const duplicate = page.getByRole("region", { name: "Nueva especialidad" });
    await duplicate.getByLabel("Nombre").fill(`  ${specialtyName.toUpperCase()}  `);
    await duplicate.getByRole("button", { name: "Guardar" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Ya existe una especialidad" }),
    ).toBeVisible();
    expect(
      (
        await database.query(
          "select count(*)::int as count from public.specialties where center_id=$1",
          [centerA],
        )
      ).rows,
    ).toEqual([{ count: 2 }]);
    await duplicate.getByRole("button", { name: "Cancelar" }).click();
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Activar" }).click();
    await page.getByRole("button", { name: "Confirmar activación" }).click();
    await expect.poll(async () => (await specialtyRow(specialtyName)).is_active).toBe(true);
    // Two rendered snapshots exercise stale feedback and the authoritative UI refresh.
    const oldToken = (
      await database.query("select updated_at::text as token from public.specialties where id=$1", [
        specialty.id,
      ])
    ).rows[0].token;
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Editar" }).click();
    const concurrentPage = await page.context().newPage();
    await concurrentPage.goto(`/centers/${centerA}/specialties`);
    await concurrentPage
      .getByRole("row", { name: new RegExp(specialtyName) })
      .getByRole("button", { name: "Editar" })
      .click();
    const concurrentEditor = concurrentPage.getByRole("region", { name: "Editar especialidad" });
    await concurrentEditor.getByLabel("Descripción (opcional)").fill("Cambio concurrente");
    await concurrentEditor.getByRole("button", { name: "Guardar" }).click();
    await expect(
      concurrentPage.getByRole("row", { name: new RegExp(specialtyName) }),
    ).toContainText("Cambio concurrente");
    const changedToken = (
      await database.query("select updated_at::text as token from public.specialties where id=$1", [
        specialty.id,
      ])
    ).rows[0].token;
    expect(
      (
        await database.query("select $1::timestamptz > $2::timestamptz as advanced", [
          changedToken,
          oldToken,
        ])
      ).rows[0].advanced,
    ).toBe(true);
    const staleEditor = page.getByRole("region", { name: "Editar especialidad" });
    await staleEditor.getByLabel("Descripción (opcional)").fill("No debe sobrescribir");
    await staleEditor.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "otra sesión" })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(specialtyName) })).toContainText(
      "Cambio concurrente",
    );
    await expect(page.getByRole("region", { name: "Editar especialidad" })).toHaveCount(0);
    expect(
      (
        await database.query(
          "select description,updated_at::text as token from public.specialties where id=$1",
          [specialty.id],
        )
      ).rows,
    ).toEqual([{ description: "Cambio concurrente", token: changedToken }]);
    await concurrentPage.close();
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Editar" }).click();
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByLabel("Descripción (opcional)")
      .fill("");
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByRole("button", { name: "Guardar" })
      .click();
    await expect(page.getByRole("row", { name: new RegExp(specialtyName) })).toContainText(
      "Sin descripción",
    );
    expect(
      (
        await database.query("select description from public.specialties where id=$1", [
          specialty.id,
        ])
      ).rows,
    ).toEqual([{ description: null }]);
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Editar" }).click();
    const noOpToken = (
      await database.query("select updated_at::text as token from public.specialties where id=$1", [
        specialty.id,
      ])
    ).rows[0].token;
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByRole("button", { name: "Guardar" })
      .click();
    await expect(page.getByRole("alert").filter({ hasText: "actualizada" })).toBeVisible();
    expect(
      (
        await database.query(
          "select updated_at::text as token from public.specialties where id=$1",
          [specialty.id],
        )
      ).rows[0].token,
    ).toEqual(noOpToken);
    const firstSpecialty = await specialtyRow(specialtyName);
    const secondSpecialty = await specialtyRow(secondSpecialtyName);

    await page.goto(`/centers/${centerA}/professionals`);
    await page.getByRole("button", { name: "Nuevo profesional" }).click();
    await page.getByLabel("Nacionalidad (ISO alpha-2)").fill("AR");
    await page.getByLabel("Documento", { exact: true }).fill("---");
    await page.getByRole("button", { name: "Resolver identidad" }).click();
    await expect(page.getByText("Ingresá un documento válido.")).toBeVisible();
    await page.getByLabel("Documento", { exact: true }).fill(documentNumber);
    await page.getByRole("button", { name: "Resolver identidad" }).click();
    await expect(
      page.getByText("No existe un profesional con ese documento.", { exact: false }),
    ).toBeVisible();
    const identityCountsBefore = await database.query(
      `select (select count(*)::int from auth.users) as auth_count,
              (select count(*)::int from public.users) as user_count,
              (select count(*)::int from public.center_memberships) as membership_count`,
    );
    await page.getByLabel("Nombre", { exact: true }).fill("Elena");
    await page.getByLabel("Apellido", { exact: true }).fill("Integración");
    await page.getByLabel("Email", { exact: true }).fill(professionalEmail);
    await page.getByLabel("Matrícula (opcional)").fill("MAT-006F");
    await page.getByLabel("Duración habitual (minutos)").fill("45");
    await page.getByRole("button", { name: "Crear y vincular al centro" }).click();
    await expect(page.getByRole("row", { name: /Elena Integración/ })).toBeVisible();
    const pcA = await professionalCenterRow(centerA);
    const identityCountsAfter = await database.query(
      `select (select count(*)::int from auth.users) as auth_count,
              (select count(*)::int from public.users) as user_count,
              (select count(*)::int from public.center_memberships) as membership_count`,
    );
    expect(identityCountsAfter.rows[0]).toEqual(identityCountsBefore.rows[0]);
    expect(pcA.license_number).toBe("MAT-006F");
    expect(pcA.usual_appointment_duration_minutes).toBe(45);

    let professionalRow = page.getByRole("row", { name: /Elena Integración/ });
    await professionalRow.getByRole("button", { name: "Configurar" }).click();
    await page.getByLabel(specialtyName, { exact: true }).check();
    await page.getByLabel(secondSpecialtyName, { exact: true }).check();
    await page.getByRole("button", { name: "Guardar especialidades" }).click();
    await expect
      .poll(async () => {
        const result = await database.query(
          "select count(*)::int as count from public.professional_center_specialties where professional_center_id=$1 and is_active",
          [pcA.id],
        );
        return result.rows[0].count;
      })
      .toBe(2);

    await page.goto(`/centers/${centerA}/specialties`);
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Desactivar" }).click();
    await page.getByRole("button", { name: "Confirmar desactivación" }).click();
    await expect.poll(async () => (await specialtyRow(specialtyName)).is_active).toBe(false);
    const retained = await database.query(
      `select is_active from public.professional_center_specialties
       where professional_center_id=$1 and specialty_id=$2`,
      [pcA.id, firstSpecialty.id],
    );
    expect(retained.rows).toEqual([{ is_active: true }]);
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Activar" }).click();
    await page.getByRole("button", { name: "Confirmar activación" }).click();
    await expect.poll(async () => (await specialtyRow(specialtyName)).is_active).toBe(true);
    await page.goto(`/centers/${centerA}/professionals`);
    professionalRow = page.getByRole("row", { name: /Elena Integración/ });
    await professionalRow.getByRole("button", { name: "Configurar" }).click();
    await expect(page.getByLabel(specialtyName, { exact: true })).toBeChecked();
    await page.goto(`/centers/${centerA}/specialties`);
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Desactivar" }).click();
    await page.getByRole("button", { name: "Confirmar desactivación" }).click();
    await expect.poll(async () => (await specialtyRow(specialtyName)).is_active).toBe(false);
    await page.goto(`/centers/${centerA}/professionals`);
    professionalRow = page.getByRole("row", { name: /Elena Integración/ });
    await professionalRow.getByRole("button", { name: "Configurar" }).click();
    await expect(page.getByText(`${specialtyName} — Inactiva`)).toBeVisible();
    await page.getByRole("button", { name: "Desasociar" }).click();
    await page.getByRole("button", { name: "Guardar especialidades" }).click();
    await expect
      .poll(async () => {
        const result = await database.query(
          `select is_active from public.professional_center_specialties
         where professional_center_id=$1 and specialty_id=$2`,
          [pcA.id, firstSpecialty.id],
        );
        return result.rows[0]?.is_active;
      })
      .toBe(false);

    await page.goto(`/centers/${centerA}/specialties`);
    row = page.getByRole("row", { name: new RegExp(specialtyName) });
    await row.getByRole("button", { name: "Activar" }).click();
    await page.getByRole("button", { name: "Confirmar activación" }).click();
    await expect.poll(async () => (await specialtyRow(specialtyName)).is_active).toBe(true);
    await page.goto(`/centers/${centerA}/professionals`);
    professionalRow = page.getByRole("row", { name: /Elena Integración/ });
    await professionalRow.getByRole("button", { name: "Configurar" }).click();
    await page.getByLabel(specialtyName, { exact: true }).check();
    await page.getByRole("button", { name: "Guardar especialidades" }).click();
    await expect
      .poll(async () => {
        const result = await database.query(
          `select is_active from public.professional_center_specialties
         where professional_center_id=$1 and specialty_id=$2`,
          [pcA.id, firstSpecialty.id],
        );
        return result.rows[0]?.is_active;
      })
      .toBe(true);

    await login(page, "admin-b");
    await page.goto(`/centers/${centerB}/professionals`);
    await page.getByRole("button", { name: "Nuevo profesional" }).click();
    await page.getByLabel("Nacionalidad (ISO alpha-2)").fill("AR");
    await page.getByLabel("Documento", { exact: true }).fill(documentNumber);
    await page.getByRole("button", { name: "Resolver identidad" }).click();
    await expect(page.getByText("Elena Integración")).toBeVisible();
    await expect(page.getByText("Este profesional aún no está vinculado al centro.")).toBeVisible();
    await expect(page.getByText(professionalEmail)).toHaveCount(0);
    await expect(page.getByText("MAT-006F")).toHaveCount(0);
    await page.getByRole("button", { name: "Vincular profesional al centro" }).click();
    await expect(page.getByRole("row", { name: /Elena Integración/ })).toBeVisible();
    const pcB = await professionalCenterRow(centerB);
    expect(pcB.professional_id).toBe(pcA.professional_id);
    expect(pcB.id).not.toBe(pcA.id);

    await page.getByRole("button", { name: "Nuevo profesional" }).click();
    await page.getByLabel("Nacionalidad (ISO alpha-2)").fill("AR");
    await page.getByLabel("Documento", { exact: true }).fill(documentNumber);
    await page.getByRole("button", { name: "Resolver identidad" }).click();
    await expect(
      page.getByText("Este profesional ya pertenece al centro y está activo."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    let rowB = page.getByRole("row", { name: /Elena Integración/ });
    await rowB.getByRole("button", { name: "Desactivar" }).click();
    await page.getByRole("button", { name: "Confirmar desactivación" }).click();
    await expect.poll(async () => (await professionalCenterRow(centerB)).is_active).toBe(false);
    await page.goto(`/centers/${centerB}/professionals`);
    await page.getByRole("button", { name: "Nuevo profesional" }).click();
    await page.getByLabel("Nacionalidad (ISO alpha-2)").fill("AR");
    await page.getByLabel("Documento", { exact: true }).fill(documentNumber);
    await page.getByRole("button", { name: "Resolver identidad" }).click();
    await expect(
      page.getByText("Su vínculo con este centro está inactivo.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmar reactivación" }).click();
    await expect.poll(async () => (await professionalCenterRow(centerB)).is_active).toBe(true);
    expect((await professionalCenterRow(centerB)).id).toBe(pcB.id);

    await database.query(
      `insert into public.center_memberships
         (id,center_id,user_id,role,professional_center_id,is_active)
       values ($1,$2,$3,'PROFESSIONAL',$4,true)`,
      [membershipIds.professional, centerA, users.get("professional").id, pcA.id],
    );
    await login(page, "admin-a");
    await page.goto(`/centers/${centerA}/professionals`);
    let rowA = page.getByRole("row", { name: /Elena Integración/ });
    await rowA.getByRole("button", { name: "Desactivar" }).click();
    await page.getByRole("button", { name: "Confirmar desactivación" }).click();
    await expect(page.getByRole("link", { name: "Ir a Usuarios" })).toBeVisible();
    expect((await professionalCenterRow(centerA)).is_active).toBe(true);
    const activeMembership = await database.query(
      "select is_active from public.center_memberships where id=$1",
      [membershipIds.professional],
    );
    expect(activeMembership.rows).toEqual([{ is_active: true }]);
    await page.getByRole("link", { name: "Ir a Usuarios" }).click();
    await expect(page).toHaveURL(new RegExp(`/centers/${centerA}/users`));
    const membershipRow = page.getByRole("row", { name: /Pablo Integración/ });
    await membershipRow.getByRole("button", { name: "Administrar acceso" }).click();
    const accessDialog = page.getByRole("dialog", { name: "Administrar acceso" });
    await accessDialog.getByLabel("Estado del acceso").selectOption("inactive");
    await accessDialog.getByRole("button", { name: "Revisar cambios" }).click();
    await accessDialog.getByRole("button", { name: "Confirmar cambios" }).click();
    await expect
      .poll(
        async () =>
          (
            await database.query("select is_active from public.center_memberships where id=$1", [
              membershipIds.professional,
            ])
          ).rows[0].is_active,
      )
      .toBe(false);
    await page.goto(`/centers/${centerA}/professionals`);
    rowA = page.getByRole("row", { name: /Elena Integración/ });
    await rowA.getByRole("button", { name: "Desactivar" }).click();
    await page.getByRole("button", { name: "Confirmar desactivación" }).click();
    await expect.poll(async () => (await professionalCenterRow(centerA)).is_active).toBe(false);
    await page.goto(`/centers/${centerA}/professionals`);
    rowA = page.getByRole("row", { name: /Elena Integración/ });
    await rowA.getByRole("button", { name: "Activar" }).click();
    await page.getByRole("button", { name: "Confirmar activación" }).click();
    await expect.poll(async () => (await professionalCenterRow(centerA)).is_active).toBe(true);
    expect((await professionalCenterRow(centerA)).id).toBe(pcA.id);
    expect((await professionalCenterRow(centerA)).license_number).toBe("MAT-006F");
    await database.query("update public.center_memberships set is_active=true where id=$1", [
      membershipIds.professional,
    ]);

    await login(page, "reception");
    await page.goto(`/centers/${centerA}`);
    await expect(page.getByRole("navigation", { name: "Administración del centro" })).toHaveCount(
      0,
    );
    for (const path of ["specialties", "professionals"]) {
      await page.goto(`/centers/${centerA}/${path}`);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    }
    await login(page, "professional");
    await page.goto(`/centers/${centerA}`);
    await expect(page.getByRole("navigation", { name: "Administración del centro" })).toHaveCount(
      0,
    );
    for (const path of ["specialties", "professionals"]) {
      await page.goto(`/centers/${centerA}/${path}`);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    }
    await login(page, "inactive");
    for (const path of ["specialties", "professionals"]) {
      await page.goto(`/centers/${centerA}/${path}`);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    }
    // The same owned user loads each form while active, then loses membership before submit.
    await database.query("update public.center_memberships set is_active=true where id=$1", [
      membershipIds.inactive,
    ]);
    await page.goto(`/centers/${centerA}/specialties`);
    await page
      .getByRole("row", { name: new RegExp(specialtyName) })
      .getByRole("button", { name: "Editar" })
      .click();
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByLabel("Descripción (opcional)")
      .fill("Denegada");
    await database.query("update public.center_memberships set is_active=false where id=$1", [
      membershipIds.inactive,
    ]);
    await page
      .getByRole("region", { name: "Editar especialidad" })
      .getByRole("button", { name: "Guardar" })
      .click();
    await expect(page.getByRole("alert").filter({ hasText: "permiso" })).toBeVisible();
    expect(
      (
        await database.query("select description from public.specialties where id=$1", [
          firstSpecialty.id,
        ])
      ).rows,
    ).toEqual([{ description: null }]);
    await database.query("update public.center_memberships set is_active=true where id=$1", [
      membershipIds.inactive,
    ]);
    await page.goto(`/centers/${centerA}/professionals`);
    await page
      .getByRole("row", { name: /Elena Integración/ })
      .getByRole("button", { name: "Configurar" })
      .click();
    await page.getByLabel("Matrícula (opcional)").fill("DENIED");
    await database.query("update public.center_memberships set is_active=false where id=$1", [
      membershipIds.inactive,
    ]);
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "permiso" })).toBeVisible();
    expect((await professionalCenterRow(centerA)).license_number).toBe("MAT-006F");
    await login(page, "platform");
    for (const path of ["specialties", "professionals"]) {
      await page.goto(`/centers/${centerA}/${path}`);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    }
    await login(page, "admin-a");
    for (const path of ["specialties", "professionals"]) {
      await page.goto(`/centers/${centerB}/${path}`);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    }
    await page.context().clearCookies();
    for (const path of ["specialties", "professionals"]) {
      await page.goto(`/centers/${centerA}/${path}`);
      await expect(page).toHaveURL(/\/login$/);
    }

    expect(secondSpecialty.id).not.toBe(firstSpecialty.id);
    console.log("TASK-006F E2E integration flow passed with owned DEV fixtures.");
  } finally {
    await cleanupFixtures();
  }
});
