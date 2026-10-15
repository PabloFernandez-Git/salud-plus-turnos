import { expect, test } from "@playwright/test";
import {
  addOwned,
  assert,
  devClients,
  openDatabase,
  readLedger,
  saveLedger,
} from "../../scripts/task007-gate-d/fixture-core.mjs";

const { dev } = devClients();
const ledger = readLedger();
assert(ledger.stage === "integrated", `Expected integrated fixtures, got ${ledger.stage}`);
assert(
  ledger.credentialsRecovered !== false &&
    typeof ledger.password === "string" &&
    ledger.password.length > 20,
  "Fixture credentials are not recovered; STOP before E2E",
);
const centerA = ledger.ids.centerA;
const uiDocument = `UI-${ledger.runId}`;
const unlinkedDocument = `UNLINK-${ledger.runId}`;
const patientPath = `/centers/${centerA}/patients`;
test.describe.configure({ mode: "serial" });

async function login(page, name) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(ledger.actors[name].email);
  await page.getByLabel("Contraseña", { exact: true }).fill(ledger.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 60_000 });
}

async function identity(dialog, document, birthDate = "1990-01-01") {
  await dialog.getByLabel("Documento", { exact: true }).fill(document);
  await dialog.getByLabel("Fecha de nacimiento", { exact: true }).fill(birthDate);
  await dialog.getByRole("button", { name: "Comprobar identidad" }).click();
}

async function search(page, query, state = "ACTIVE") {
  const form = page.getByRole("form", { name: "Búsqueda de pacientes" });
  await form.getByRole("searchbox", { name: "Buscar" }).fill(query);
  await form.getByRole("combobox", { name: "Estado" }).selectOption(state);
  await form.getByRole("button", { name: "Buscar" }).click();
}

async function capturePatientFromUrl(page, expectedDocument) {
  await expect(page).toHaveURL(/patient=[0-9a-f-]{36}/);
  const patientCenterId = new URL(page.url()).searchParams.get("patient");
  const database = await openDatabase(dev, "e2e-capture");
  try {
    const result = await database.query(
      "select pc.id,pc.person_id,pc.center_id,p.document_number from public.patient_centers pc join public.persons p on p.id=pc.person_id where pc.id=$1",
      [patientCenterId],
    );
    assert(
      result.rowCount === 1 &&
        result.rows[0].center_id === centerA &&
        result.rows[0].document_number === expectedDocument,
      "E2E generated row ownership cannot be proven",
    );
    addOwned(ledger, "persons", result.rows[0].person_id);
    addOwned(ledger, "patientCenters", result.rows[0].id);
    return result.rows[0].id;
  } finally {
    await database.end();
  }
}

test("RECEPTION desktop: login, NOT_FOUND, search, edit, deactivate, INACTIVE, reactivate, ACTIVE, stale", async ({
  page,
}) => {
  test.setTimeout(600_000);
  ledger.generated.uiDocument = uiDocument;
  saveLedger(ledger); // Exact document reservation precedes the UI create operation.
  await login(page, "receptionA");
  await page.goto(`/centers/${centerA}`);
  await page
    .getByRole("navigation", { name: "Navegación del centro" })
    .getByRole("link", { name: "Pacientes" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${patientPath}$`));
  await search(page, `MISS-${ledger.runId}`);
  await expect(page.getByText("No encontramos pacientes para esta búsqueda")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Registrar paciente" })).toHaveCount(0);
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  const registration = page.getByRole("dialog", { name: "Registrar paciente" });
  await identity(registration, uiDocument);
  await expect(registration.getByText("Datos del nuevo paciente")).toBeVisible();
  await registration.getByLabel("Nombre", { exact: true }).fill("Valeria");
  await registration.getByLabel("Apellido", { exact: true }).fill("Fixture");
  await registration.getByLabel("Teléfono", { exact: true }).fill("1001");
  await registration.getByLabel("Email (opcional)").fill("initial@example.test");
  await registration.getByLabel("Obra social / prepaga (opcional)").fill("Inicial");
  await registration.getByLabel("Notas administrativas (opcional)").fill("Nota inicial");
  await registration.getByRole("button", { name: "Revisar alta" }).click();
  await expect(registration.getByText("Confirmá la creación del paciente.")).toBeVisible();
  await registration.getByRole("button", { name: "Confirmar", exact: true }).click();
  const uiPatientCenterId = await capturePatientFromUrl(page, uiDocument);
  let administration = page.getByRole("dialog", { name: "Administrar paciente" });
  await expect(administration).toBeVisible();
  await administration.getByRole("button", { name: "Cerrar" }).click();
  await page.goto(patientPath);
  await search(page, uiDocument);
  const list = page.getByRole("region", { name: "Listado de pacientes" });
  await expect(list).toContainText("Valeria Fixture");
  await list.getByRole("link", { name: "Administrar" }).click();
  administration = page.getByRole("dialog", { name: "Administrar paciente" });
  await administration.getByLabel("Teléfono", { exact: true }).fill("2002");
  await administration.getByLabel("Email", { exact: true }).fill("edited@example.test");
  await administration.getByLabel("Obra social / prepaga", { exact: true }).fill("Editada");
  await administration.getByLabel("Notas administrativas", { exact: true }).fill("Nota editada");
  await administration.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("Datos administrativos guardados");
  await administration.getByRole("button", { name: "Cerrar" }).click();
  await page.goto(
    `${patientPath}?q=${encodeURIComponent(uiDocument)}&patient=${uiPatientCenterId}`,
  );
  administration = page.getByRole("dialog", { name: "Administrar paciente" });
  await expect(administration.getByLabel("Teléfono", { exact: true })).toHaveValue("2002");
  await expect(administration.getByLabel("Notas administrativas", { exact: true })).toHaveValue(
    "Nota editada",
  );
  await administration.getByRole("button", { name: "Desactivar", exact: true }).click();
  await administration
    .getByRole("group", { name: "Confirmar desactivación" })
    .getByRole("button", { name: "Confirmar desactivación" })
    .click();
  await expect(page.getByRole("status")).toContainText("Paciente desactivado");
  await page.goto(patientPath);
  await search(page, uiDocument, "INACTIVE");
  await expect(page.getByRole("region", { name: "Listado de pacientes" })).toContainText(
    "Valeria Fixture",
  );
  await page
    .getByRole("region", { name: "Listado de pacientes" })
    .getByRole("link", { name: "Administrar" })
    .click();
  administration = page.getByRole("dialog", { name: "Administrar paciente" });
  await administration.getByLabel("Confirmar fecha de nacimiento").fill("1990-01-01");
  await administration.getByRole("button", { name: "Comprobar para reactivar" }).click();
  await expect(administration.getByText(/Identidad comprobada/)).toBeVisible();
  await administration.getByRole("button", { name: "Confirmar reactivación" }).click();
  await expect(page.getByRole("status")).toContainText("Paciente reactivado");
  await page.goto(patientPath);
  await search(page, uiDocument);
  await expect(page.getByRole("region", { name: "Listado de pacientes" })).toContainText(
    "Valeria Fixture",
  );
  await page.goto(
    `${patientPath}?q=${encodeURIComponent(uiDocument)}&patient=${uiPatientCenterId}`,
  );
  administration = page.getByRole("dialog", { name: "Administrar paciente" });
  await expect(administration.getByLabel("Teléfono", { exact: true })).toHaveValue("2002");
  await expect(administration.getByLabel("Email", { exact: true })).toHaveValue(
    "edited@example.test",
  );
  await expect(administration.getByLabel("Obra social / prepaga", { exact: true })).toHaveValue(
    "Editada",
  );
  await expect(administration.getByLabel("Notas administrativas", { exact: true })).toHaveValue(
    "Nota editada",
  );
  const concurrentPage = await page.context().newPage();
  await concurrentPage.goto(
    `${patientPath}?q=${encodeURIComponent(uiDocument)}&patient=${uiPatientCenterId}`,
  );
  const concurrentDialog = concurrentPage.getByRole("dialog", { name: "Administrar paciente" });
  await concurrentDialog.getByLabel("Teléfono", { exact: true }).fill("3003");
  await concurrentDialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(concurrentPage.getByRole("status")).toContainText("Datos administrativos guardados");
  await administration.getByLabel("Teléfono", { exact: true }).fill("STALE");
  await administration.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(administration.getByRole("alert")).toContainText(/cambi|otra sesión/i);
  await expect(administration.getByRole("button", { name: "Recargar datos" })).toBeVisible();
  await concurrentPage.close();
});

test("NOT_LINKED confirmation, ACTIVE reuse, DOB mismatch, mobile, ADMIN and PROFESSIONAL", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "receptionA");
  await page.goto(patientPath);
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  let registration = page.getByRole("dialog", { name: "Registrar paciente" });
  await identity(registration, unlinkedDocument, "1991-01-01");
  await expect(registration.getByRole("alert")).toContainText("no coinciden");
  await registration.getByLabel("Fecha de nacimiento", { exact: true }).fill("1990-01-01");
  await registration.getByRole("button", { name: "Comprobar identidad" }).click();
  await expect(registration.getByText("Identidad encontrada:")).toBeVisible();
  await registration.getByLabel("Teléfono", { exact: true }).fill("M-100");
  await registration.getByRole("button", { name: "Vincular a este centro" }).click();
  await expect(registration.getByText("Confirmá el vínculo con este centro.")).toBeVisible();
  await registration.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page).toHaveURL(/patient=[0-9a-f-]{36}/);
  const linkedId = new URL(page.url()).searchParams.get("patient");
  const database = await openDatabase(dev, "e2e-link-capture");
  try {
    const row = await database.query(
      "select person_id,center_id from public.patient_centers where id=$1",
      [linkedId],
    );
    assert(
      row.rowCount === 1 &&
        row.rows[0].person_id === ledger.ids.unlinkedPerson &&
        row.rows[0].center_id === centerA,
      "NOT_LINKED generated row ownership ambiguous",
    );
    addOwned(ledger, "patientCenters", linkedId);
  } finally {
    await database.end();
  }
  await page.goto(patientPath);
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  registration = page.getByRole("dialog", { name: "Registrar paciente" });
  await identity(registration, unlinkedDocument);
  await expect(
    registration.getByText("Este paciente ya pertenece al centro.", { exact: false }),
  ).toBeVisible();
  await registration.getByRole("button", { name: "Abrir panel" }).click();
  await expect(page.getByRole("dialog", { name: "Administrar paciente" })).toBeVisible();
  await login(page, "adminA");
  await page.goto(patientPath);
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
  await login(page, "professionalA");
  await page.goto(patientPath);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Listado de pacientes" })).toHaveCount(0);
  ledger.stage = "e2e_pass";
  ledger.evidence.push({
    at: new Date().toISOString(),
    event: "e2e_pass",
    viewports: ["desktop", "390x844"],
  });
  saveLedger(ledger);
});
