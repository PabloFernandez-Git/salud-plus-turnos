import { expect, test } from "@playwright/test";
import { openDevDatabase } from "../../scripts/task009-gate-d/dev-connection.mjs";
import {
  markAppointmentOwned,
  planAppointmentIntent,
  readLedger,
  saveLedger,
} from "../../scripts/task009-gate-d/ledger.mjs";

const ledger = readLedger();
if (
  ledger.stage !== "integrated" &&
  !(process.env.TASK009_BROWSER_ONLY === "1" && ledger.stage === "fixtures_ready")
) {
  throw new Error("TASK-009 browser tests require prepared fixtures");
}
const password = process.env.TASK009_TEST_PASSWORD;
const date = process.env.TASK009_DATE;
if (!password || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  throw new Error("TASK-009 browser test environment is incomplete");
}
const id = ledger.ids;
// Distinct slots and browser contexts; one worker preserves exclusive ledger ownership.
// Default mode continues the remaining scenarios after a failure (without retries).
test.describe.configure({ mode: "default" });

async function login(page, name) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(ledger.actors[name].email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/centers/${id.centerA}$`), { timeout: 60_000 });
}

function detailValue(page, label) {
  return page
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .locator("dd");
}

async function waitForAppointmentAction(page, click) {
  const [result] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        Boolean(candidate.request().headers()["next-action"]) &&
        new URL(candidate.url()).pathname.includes(`/centers/${id.centerA}/appointments/`),
      { timeout: 30_000 },
    ),
    click(),
  ]);
  expect(result.ok(), `Appointment Server Action returned HTTP ${result.status()}`).toBe(true);
}

async function selectCivilSlot(page, time, context) {
  const slot = page
    .getByRole("main")
    .getByRole("combobox", { name: "Horario disponible", exact: true });
  const option = slot.getByRole("option", { name: new RegExp(`^${time}–`) });
  try {
    await expect(slot).toBeEnabled({ timeout: 25_000 });
    await expect(option).toHaveCount(1, { timeout: 5_000 });
    await expect(option).toBeEnabled({ timeout: 5_000 });
  } catch {
    throw new Error(
      `${context}: horario ${time} no está listo: ${JSON.stringify({
        disabled: await slot.isDisabled(),
        options: await slot.locator("option").allTextContents(),
        alerts: await page.getByRole("main").getByRole("alert").allTextContents(),
      })}`,
    );
  }
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`${context}: horario ${time} no tiene valor`);
  await slot.selectOption(value, { timeout: 5_000 });
  await expect(slot).toHaveValue(value);
}

async function chooseA(page, time) {
  const actionRequests = [];
  const failedRequests = [];
  const pageErrors = [];
  const onRequest = (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      actionRequests.push({ path: new URL(request.url()).pathname, status: "pending" });
    }
  };
  const onResponse = (response) => {
    const request = response.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      const pending = actionRequests.find(
        (entry) => entry.path === new URL(request.url()).pathname && entry.status === "pending",
      );
      if (pending) pending.status = response.status();
    }
  };
  const onRequestFailed = (request) => {
    failedRequests.push({
      path: new URL(request.url()).pathname,
      reason: request.failure()?.errorText ?? "unknown",
    });
  };
  const onPageError = (error) => pageErrors.push(error.name);
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  page.on("pageerror", onPageError);
  try {
    await page.goto(`/centers/${id.centerA}/appointments/new?patientCenterId=${id.patientA}`);
    await expect(page.getByRole("heading", { name: "Crear turno", exact: true })).toBeVisible();
    await expect(page.getByText("Synthetic A Fixture")).toBeVisible();
    const specialty = page
      .getByRole("main")
      .getByRole("combobox", { name: "Especialidad", exact: true });
    try {
      await expect(specialty).toBeEnabled({ timeout: 25_000 });
      await expect(specialty.locator(`option[value="${id.specialtyA}"]`)).toHaveCount(1, {
        timeout: 5_000,
      });
    } catch {
      const diagnostic = {
        disabled: await specialty.isDisabled(),
        options: await specialty
          .locator("option")
          .evaluateAll((options) => options.map((option) => option.value)),
        alerts: await page.getByRole("main").getByRole("alert").allTextContents(),
        actionRequests,
        failedRequests,
        pageErrors,
      };
      throw new Error(`Crear turno: Especialidad no está lista: ${JSON.stringify(diagnostic)}`);
    }
    await specialty.selectOption(id.specialtyA, { timeout: 5_000 });
  } finally {
    page.off("request", onRequest);
    page.off("response", onResponse);
    page.off("requestfailed", onRequestFailed);
    page.off("pageerror", onPageError);
  }
  const professional = page
    .getByRole("main")
    .getByRole("combobox", { name: "Profesional", exact: true });
  await expect(professional, "El catálogo de profesionales debe estar listo").toBeEnabled({
    timeout: 25_000,
  });
  await expect(professional.locator(`option[value="${id.pcA}"]`)).toHaveCount(1, {
    timeout: 5_000,
  });
  await professional.selectOption(id.pcA, { timeout: 5_000 });
  const localDate = page.getByRole("main").getByLabel("Fecha local del centro", { exact: true });
  await expect(localDate).toBeEnabled({ timeout: 10_000 });
  await localDate.fill(date, { timeout: 5_000 });
  await selectCivilSlot(page, time, "Crear turno");
  await expect(
    page.getByRole("button", { name: "Confirmar y crear turno", exact: true }),
  ).toBeEnabled();
}

function reserveBrowserAppointment(time) {
  return planAppointmentIntent(ledger, {
    centerId: id.centerA,
    patientCenterId: id.patientA,
    professionalCenterId: id.pcA,
    specialtyId: id.specialtyA,
    localDate: date,
    localTime: time,
  });
}

async function countOwnedSlotAppointments(time) {
  const database = await openDevDatabase("browser-slot-count-audit");
  try {
    await database.query("BEGIN TRANSACTION READ ONLY");
    await database.query("SET LOCAL statement_timeout = '5s'");
    const result = await database.query(
      "select count(*)::int as count from public.appointments a join public.centers c on c.id=a.center_id where a.center_id=$1 and a.patient_center_id=$2 and (a.starts_at at time zone c.timezone)::date=$3::date and to_char(a.starts_at at time zone c.timezone,'HH24:MI')=$4",
      [id.centerA, id.patientA, date, time],
    );
    return result.rows[0].count;
  } finally {
    await database.query("ROLLBACK").catch(() => undefined);
    await database.end();
  }
}

test("desktop staff booking, detail, list, cross-center denial and Professional privacy", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await login(page, "admina");
  await page.goto(`/centers/${id.centerA}/patients`);
  await expect(page.getByRole("heading", { name: /Pacientes/ })).toBeVisible();
  await chooseA(page, "17:00");
  const note = page.getByRole("textbox", { name: "Nota", exact: true });
  await note.fill("Synthetic browser note");
  await expect(note).toHaveValue("Synthetic browser note");
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "4. Resumen", exact: true }) })
      .getByText("Synthetic browser note", { exact: true }),
  ).toBeVisible();
  const intentId = reserveBrowserAppointment("17:00");
  await page
    .getByRole("button", { name: "Confirmar y crear turno", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(page).toHaveURL(new RegExp(`/centers/${id.centerA}/appointments/[0-9a-f-]{36}$`));
  const appointmentId = page.url().match(/\/appointments\/([0-9a-f-]{36})$/)?.[1];
  if (!appointmentId) throw new Error("Browser CREATE result lacked UUID; preserve ledger");
  markAppointmentOwned(ledger, intentId, appointmentId);
  expect(await countOwnedSlotAppointments("17:00")).toBe(1);
  await expect(page.getByRole("heading", { name: "Detalle del turno", exact: true })).toBeVisible();
  await expect(page.getByText("Nota actual guardada.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Editar nota", exact: true })).toHaveValue(
    "Synthetic browser note",
  );
  const staleContext = await browser.newContext();
  const stalePage = await staleContext.newPage();
  try {
    await login(stalePage, "admina");
    await stalePage.goto(`/centers/${id.centerA}/appointments/${appointmentId}`);
    await expect(
      stalePage.getByRole("heading", { name: "Detalle del turno", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Editar nota", exact: true })
      .fill("Updated synthetic browser note");
    await waitForAppointmentAction(page, () =>
      page.getByRole("button", { name: "Guardar nota", exact: true }).click(),
    );
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Editar nota", exact: true })).toHaveValue(
      "Updated synthetic browser note",
    );
    await stalePage
      .getByRole("textbox", { name: "Editar nota", exact: true })
      .fill("Stale synthetic note");
    await stalePage.getByRole("button", { name: "Guardar nota", exact: true }).click();
    await expect(stalePage.getByRole("main").getByRole("alert")).toHaveText(
      "El turno cambió. Recargá el detalle antes de continuar.",
    );
  } finally {
    await staleContext.close();
  }
  await page.getByRole("button", { name: "Elegir nuevo horario", exact: true }).click();
  await expect(
    page.getByRole("main").getByLabel("Fecha local del centro", { exact: true }),
  ).toHaveValue(date);
  await selectCivilSlot(page, "17:30", "Reprogramar turno");
  await expect(
    page.getByRole("button", { name: "Guardar reprogramación", exact: true }),
  ).toBeEnabled();
  await waitForAppointmentAction(page, () =>
    page.getByRole("button", { name: "Guardar reprogramación", exact: true }).click(),
  );
  await page.reload();
  await expect(detailValue(page, "Horario")).toHaveText("17:30–18:00");
  await expect(page).toHaveURL(new RegExp(`/appointments/${appointmentId}$`));
  await waitForAppointmentAction(page, () =>
    page.getByRole("button", { name: "Confirmar", exact: true }).click(),
  );
  await page.reload();
  await expect(detailValue(page, "Estado")).toHaveText("Confirmado");
  page.once("dialog", (dialog) => dialog.accept());
  await waitForAppointmentAction(page, () =>
    page.getByRole("button", { name: "Cancelar turno", exact: true }).click(),
  );
  await page.reload();
  await expect(detailValue(page, "Estado")).toHaveText("Cancelado");
  await expect(
    page.getByText("El estado es terminal; no permite nuevas transiciones."),
  ).toBeVisible();
  await page.goto(`/centers/${id.centerA}/appointments?from=${date}&to=${date}`);
  await expect(page.getByRole("heading", { name: "Turnos", exact: true })).toBeVisible();
  const appointmentRow = page
    .getByRole("region", { name: "Resultados de turnos", exact: true })
    .getByRole("listitem")
    .filter({
      has: page.locator(`a[href="/centers/${id.centerA}/appointments/${appointmentId}"]`),
    });
  await expect(appointmentRow).toHaveCount(1);
  await expect(appointmentRow.getByText("Synthetic A Fixture", { exact: true })).toBeVisible();
  await expect(appointmentRow.getByText("Cancelado", { exact: true })).toBeVisible();

  await page.goto(`/centers/${id.centerB}/appointments/${appointmentId}`);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  const professional = await browser.newContext();
  const professionalPage = await professional.newPage();
  try {
    await login(professionalPage, "professionala");
    await professionalPage.goto(`/centers/${id.centerA}/appointments/${appointmentId}`);
    await expect(
      professionalPage.getByRole("heading", { name: "Detalle del turno", exact: true }),
    ).toBeVisible();
    const html = await professionalPage.content();
    expect(html).not.toContain("Updated synthetic browser note");
    expect(html).not.toContain("Synthetic browser note");
    expect(html).not.toContain(`T009-PAT-A-${ledger.runId}`);
    expect(html).not.toContain(id.patientA);
    await expect(
      professionalPage.getByRole("heading", { name: "Nota administrativa", exact: true }),
    ).toHaveCount(0);
  } finally {
    await professional.close();
  }
  ledger.browserAppointmentId = appointmentId;
  ledger.evidence.push({
    at: new Date().toISOString(),
    label:
      "browser desktop double-submit booking/list/detail, cross-center denial, Professional privacy",
    outcome: "PASS",
  });
  saveLedger(ledger);
});

test("mobile 390px and browser timezone do not alter Center civil time", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Pacific/Honolulu",
  });
  const page = await context.newPage();
  try {
    await login(page, "admina");
    await chooseA(page, "18:30");
    await expect(page.getByText("America/Argentina/Buenos_Aires")).toBeVisible();
    await expect(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "4. Resumen", exact: true }) })
        .getByText("18:30–19:00", { exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await page.keyboard.press("Tab");
    const focusVisible = await page.evaluate(() => document.activeElement !== document.body);
    expect(focusVisible).toBe(true);
  } finally {
    await context.close();
  }
  ledger.evidence.push({
    at: new Date().toISOString(),
    label: "browser 390px, keyboard focus, Center civil time with different browser timezone",
    outcome: "PASS",
  });
  saveLedger(ledger);
});

test("lost CREATE response is reconciled without a second CREATE", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page, "receptiona");
  await chooseA(page, "18:00");
  const intentId = reserveBrowserAppointment("18:00");
  let intercepted = false;
  let createPosts = 0;
  let createActionId;
  await page.route(`**/centers/${id.centerA}/appointments/new*`, async (route) => {
    const actionId = route.request().headers()["next-action"];
    if (route.request().method() === "POST" && actionId) {
      // Installed after catalog loading; the first action is the explicit CREATE.
      // Reconciliation uses its own Server Action and must not count as CREATE.
      createActionId ??= actionId;
      if (actionId === createActionId) createPosts++;
    }
    if (!intercepted && createPosts === 1) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  await page.getByRole("button", { name: "Confirmar y crear turno", exact: true }).click();
  await expect.poll(() => intercepted, { timeout: 10_000 }).toBe(true);
  await expect(
    page
      .getByRole("main")
      .getByRole("status")
      .getByText(/resultado de esta reserva sigue sin confirmarse/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar y crear turno", exact: true }),
  ).toBeDisabled();
  expect(createPosts).toBe(1);
  await page.getByRole("button", { name: "Verificar turno propuesto", exact: true }).click();
  const link = page
    .getByRole("main")
    .getByRole("status")
    .getByRole("link", { name: "Ver detalle", exact: true });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const appointmentId = href?.match(/\/appointments\/([0-9a-f-]{36})$/)?.[1];
  if (!appointmentId) throw new Error("Browser reconciliation UUID is uncertain; preserve ledger");
  markAppointmentOwned(ledger, intentId, appointmentId);
  expect(await countOwnedSlotAppointments("18:00")).toBe(1);
  expect(createPosts, "Reconciliation must not issue a second CREATE").toBe(1);
  ledger.evidence.push({
    at: new Date().toISOString(),
    label: "browser lost-response reconciliation without automatic second CREATE",
    outcome: "PASS",
  });
  saveLedger(ledger);
});
