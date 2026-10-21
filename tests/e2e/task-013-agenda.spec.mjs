import { expect, test } from "@playwright/test";
import { relative, resolve, sep } from "node:path";
import { readLedger } from "../../scripts/task013-agenda-visual/ledger.mjs";

function evidenceRoot() {
  const root = resolve(".harness/tasks/archive/TASK-013/evidence");
  const selected = resolve(process.env.TASK013_EVIDENCE_DIR ?? "");
  const within = relative(root, selected);
  if (!within || within.startsWith("..") || within.includes(`..${sep}`))
    throw new Error("TASK-013 evidence path escaped its task folder");
  return selected;
}

async function login(page, ledger, password) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(ledger.authEmail);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/centers/${ledger.ids.center}$`), { timeout: 60_000 });
}

async function agenda(page, ledger, view, date, filters = {}) {
  const query = new URLSearchParams({ view, date, ...filters });
  await page.goto(`/centers/${ledger.ids.center}/agenda?${query}`);
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Calendario de turnos" })).toBeVisible();
}

async function capture(page, folder, name) {
  await page.screenshot({ path: resolve(folder, name), fullPage: true, animations: "disabled" });
}

async function clickCivilSlot(page, time) {
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3));
  const group = page.locator(".rbc-time-content .rbc-time-gutter .rbc-timeslot-group").nth(hour);
  const day = page.locator(".rbc-time-content .rbc-day-slot").first();
  await group.scrollIntoViewIfNeeded();
  const timeBox = await group.boundingBox();
  const dayBox = await day.boundingBox();
  if (!timeBox || !dayBox) throw new Error("Agenda hourly grid did not expose a slot");
  const y = timeBox.y + (minute === 30 ? 0.75 : 0.25) * timeBox.height;
  await page.mouse.click(dayBox.x + Math.min(30, dayBox.width / 3), y);
  await expect(page.getByRole("region", { name: "Horarios disponibles" })).toBeVisible();
}

async function pickPostgresSlot(page, time) {
  const selector = page
    .getByRole("region", { name: "Horarios disponibles" })
    .getByRole("combobox", { name: "Horario disponible" });
  await expect(selector).toBeEnabled({ timeout: 30_000 });
  const option = selector.getByRole("option", { name: new RegExp(`^${time}–`) });
  await expect(option).toBeEnabled();
  const value = await option.getAttribute("value");
  if (!value) throw new Error("PostgreSQL slot lacks instant");
  await selector.selectOption(value);
  await expect(page.getByRole("link", { name: "Continuar para crear turno" })).toBeVisible();
  return value;
}

const contexts = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, timezoneId: "UTC" },
  { name: "mobile", viewport: { width: 390, height: 844 }, timezoneId: "Pacific/Honolulu" },
];

async function withSyntheticSession(browser, config, check) {
  test.setTimeout(180_000);
  const ledger = readLedger(process.env.TASK013_LEDGER_PATH);
  if (ledger.stage !== "browser_running" || !ledger.authUserId)
    throw new Error("TASK-013 browser requires owned fixtures");
  const password = process.env.TASK013_TEST_PASSWORD;
  if (!password) throw new Error("TASK-013 browser password is missing");
  const folder = evidenceRoot();
  const context = await browser.newContext({
    viewport: config.viewport,
    timezoneId: config.timezoneId,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.name));
  try {
    await login(page, ledger, password);
    await check({ page, ledger, folder });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
}

for (const config of contexts) {
  test(`TASK-013 ${config.name} Día con turnos`, async ({ browser }) => {
    await withSyntheticSession(browser, config, async ({ page, ledger, folder }) => {
      await agenda(page, ledger, "day", ledger.date);
      await expect(page.locator(".rbc-event")).toHaveCount(2);
      await page.locator(".rbc-event").first().scrollIntoViewIfNeeded();
      await capture(page, folder, `${config.name}-day.png`);
    });
  });

  test(`TASK-013 ${config.name} Semana con simultaneidad`, async ({ browser }) => {
    await withSyntheticSession(browser, config, async ({ page, ledger, folder }) => {
      await agenda(page, ledger, "week", ledger.date);
      await expect(page.locator(".rbc-event")).toHaveCount(3);
      await page.locator(".rbc-event").first().scrollIntoViewIfNeeded();
      await capture(page, folder, `${config.name}-week.png`);
    });
  });

  test(`TASK-013 ${config.name} Mes poblado`, async ({ browser }) => {
    await withSyntheticSession(browser, config, async ({ page, ledger, folder }) => {
      await agenda(page, ledger, "month", ledger.date);
      await expect(
        page.getByRole("button", {
          name: new RegExp(`${ledger.date.slice(-2)}: 2 turnos`),
        }),
      ).toBeVisible();
      await capture(page, folder, `${config.name}-month.png`);
    });
  });

  test(`TASK-013 ${config.name} DST ambiguo`, async ({ browser }) => {
    await withSyntheticSession(browser, config, async ({ page, ledger, folder }) => {
      await agenda(page, ledger, "day", ledger.dstDate);
      const special = page.getByRole("heading", { name: "Turnos con horario especial" });
      await expect(special).toBeVisible();
      await expect(page.getByRole("link", { name: /01:30 GMT-4/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /01:30 GMT-5/ })).toBeVisible();
      await capture(page, folder, `${config.name}-dst.png`);
    });
  });

  test(`TASK-013 ${config.name} filtros`, async ({ browser }) => {
    await withSyntheticSession(browser, config, async ({ page, ledger }) => {
      await agenda(page, ledger, "day", ledger.date, { specialty: ledger.ids.specialtyA });
      await expect(page.locator(".rbc-event")).toHaveCount(1);
      await expect(page.locator(".rbc-event")).toContainText("Task013 Profesional A");
      await agenda(page, ledger, "day", ledger.date, { professional: ledger.ids.pcB });
      await expect(page.locator(".rbc-event")).toHaveCount(1);
      await expect(page.locator(".rbc-event")).toContainText("Task013 Profesional B");
      await agenda(page, ledger, "day", ledger.date, { status: "CANCELLED" });
      await expect(page.locator(".rbc-event")).toHaveCount(1);
      await expect(page.locator(".rbc-event")).toContainText("Cancelado");
    });
  });

  test(`TASK-013 ${config.name} slot PostgreSQL y alta preseleccionada`, async ({ browser }) => {
    await withSyntheticSession(browser, config, async ({ page, ledger, folder }) => {
      await agenda(page, ledger, "day", ledger.date, {
        specialty: ledger.ids.specialtyA,
        professional: ledger.ids.pcA,
      });
      await clickCivilSlot(page, config.name === "desktop" ? "12:00" : "12:30");
      const instant = await pickPostgresSlot(page, config.name === "desktop" ? "12:00" : "12:30");
      await capture(page, folder, `${config.name}-slot.png`);
      await page.getByRole("link", { name: "Continuar para crear turno" }).click();
      await expect(page.getByRole("heading", { name: "Crear turno", exact: true })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Horario disponible" })).toHaveValue(instant);
      await capture(page, folder, `${config.name}-prefill.png`);
      if (config.name === "mobile") {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
      }
    });
  });
}

test("TASK-013 desktop CREATE con respuesta perdida y reconciliación", async ({ browser }) => {
  await withSyntheticSession(browser, contexts[0], async ({ page, ledger, folder }) => {
    await agenda(page, ledger, "day", ledger.date, {
      specialty: ledger.ids.specialtyA,
      professional: ledger.ids.pcA,
    });
    await clickCivilSlot(page, "12:00");
    const instant = await pickPostgresSlot(page, "12:00");
    await page.getByRole("link", { name: "Continuar para crear turno" }).click();
    await expect(page.getByRole("combobox", { name: "Horario disponible" })).toHaveValue(instant);
    await page.getByRole("searchbox", { name: "Buscar paciente activo" }).fill("Paciente");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByText("Paciente Sintético", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirmar y crear turno" })).toBeEnabled();
    let intercepted = false;
    let createPosts = 0;
    let createActionId;
    await page.route(`**/centers/${ledger.ids.center}/appointments/new*`, async (route) => {
      const actionId = route.request().headers()["next-action"];
      if (route.request().method() === "POST" && actionId) {
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
    await page.getByRole("button", { name: "Confirmar y crear turno" }).click();
    await expect.poll(() => intercepted, { timeout: 10_000 }).toBe(true);
    await expect(
      page
        .getByRole("main")
        .getByRole("status")
        .getByText(/resultado de esta reserva sigue sin confirmarse/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar y crear turno" })).toBeDisabled();
    await page.getByRole("button", { name: "Verificar turno propuesto" }).click();
    await expect(
      page.getByRole("main").getByRole("status").getByRole("link", { name: "Ver detalle" }),
    ).toBeVisible();
    expect(createPosts).toBe(1);
    await agenda(page, ledger, "day", ledger.date);
    await expect(page.locator(".rbc-event")).toHaveCount(3);
    await capture(page, folder, "desktop-after-create.png");
  });
});
