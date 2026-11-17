import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const manifestPath = resolve(".task039-dev/manifest.json");
const m = JSON.parse(readFileSync(manifestPath, "utf8"));
if (m.projectRef !== "ehllxymqyzrofydrvtzo" || m.stage !== "functional_pass")
  throw new Error("TASK-039 DEV fixtures not ready");
const uiDocument = m.uiDocument ?? `ui-${m.runId}`;
const path = `/centers/${m.ids.centerA}/patients`;

test("DEV: Registro protege UNVERIFIED y Administración opera con identidad verificada", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(m.users.receptionA.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(m.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 60_000 });
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  let dialog = page.getByRole("dialog", { name: "Registrar paciente" });
  await dialog.getByLabel("Documento", { exact: true }).fill(`active-${m.runId}`);
  await dialog.getByLabel("Fecha de nacimiento", { exact: true }).fill("01/01/1991");
  await dialog.getByRole("button", { name: "Comprobar identidad" }).click();
  await expect(dialog.getByRole("alert")).toContainText("No pudimos comprobar la identidad");
  await expect(dialog).not.toContainText("Task039 Synthetic");
  await expect(dialog.getByText("Datos del nuevo paciente")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Vincular|Reactivar|Revisar alta/ })).toHaveCount(
    0,
  );
  await dialog.getByLabel("Fecha de nacimiento", { exact: true }).fill("01/01/1990");
  await dialog.getByRole("button", { name: "Comprobar identidad" }).click();
  await expect(dialog.getByText("Identidad encontrada:")).toBeVisible();
  await expect(dialog.getByText(/Este paciente ya pertenece al centro/)).toBeVisible();
  await dialog.getByRole("button", { name: "Abrir panel" }).click();
  let admin = page.getByRole("dialog", { name: "Administrar paciente" });
  await expect(admin).toBeVisible();
  await expect(admin).toContainText(`active-${m.runId}`);
  await admin.getByRole("button", { name: "Cerrar" }).click();
  await page.goto(path);
  if (!m.uiDocument) {
    await page.getByRole("button", { name: "Registrar paciente" }).click();
    dialog = page.getByRole("dialog", { name: "Registrar paciente" });
    await dialog.getByLabel("Documento", { exact: true }).fill(uiDocument);
    await dialog.getByLabel("Fecha de nacimiento", { exact: true }).fill("01/01/1990");
    await dialog.getByRole("button", { name: "Comprobar identidad" }).click();
    await expect(dialog.getByText("Datos del nuevo paciente")).toBeVisible();
    await dialog.getByLabel("Nombre", { exact: true }).fill("Task039");
    await dialog.getByLabel("Apellido", { exact: true }).fill("Browser");
    await dialog.getByLabel("Teléfono", { exact: true }).fill("1004");
    await dialog.getByRole("button", { name: "Revisar alta" }).click();
    await expect(dialog.getByText("Revisá los datos antes de crear el paciente.")).toBeVisible();
    m.uiDocument = uiDocument;
    writeFileSync(manifestPath, `${JSON.stringify(m, null, 2)}\n`);
    await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Paciente registrado correctamente");
  }
  await page
    .getByRole("row", { name: new RegExp(uiDocument) })
    .getByRole("link", { name: "Administrar paciente" })
    .click();
  await expect(page).toHaveURL(/patient=[0-9a-f-]{36}/);
  admin = page.getByRole("dialog", { name: "Administrar paciente" });
  await expect(admin).toBeVisible();
  await expect(admin).toContainText(uiDocument);
  await admin.getByLabel("Teléfono", { exact: true }).fill("2004");
  await admin.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("Datos administrativos guardados");
});
