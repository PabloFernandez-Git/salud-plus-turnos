import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { connect } from "../../scripts/task021-dev/gate.mjs";
import { expectedRows } from "../../scripts/task021-functional-dev/plan.mjs";
import { patientLink } from "./task-021-patient-link.mjs";
import { dashboardReady } from "./task-021-dashboard-ready.mjs";

const ledgerPath = process.env.TASK021_LEDGER_PATH;
const password = process.env.TASK021_FIXTURE_PASSWORD;
if (!ledgerPath || !password) throw new Error("TASK-021 browser fixture context unavailable");
const ledger = JSON.parse(readFileSync(resolve(ledgerPath), "utf8"));
if (ledger.stage !== "fixtures_ready" || ledger.plan.projectRef !== "ehllxymqyzrofydrvtzo")
  throw new Error("TASK-021 browser fixtures are not ready");
const p = ledger.plan,
  i = p.ids;
const base = `/centers/${i.centerA}`;
const activity = (page) => page.locator('section[aria-labelledby="activity-heading"]');
const upcoming = (page) => page.locator('section[aria-labelledby="upcoming-heading"]');
const cards = (page) =>
  page.getByRole("navigation", { name: "Navegación del centro" }).getByRole("link");
async function login(browser, name, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(p.actors[name].email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(name === "unlinked" ? /\/no-access$/ : /\/centers\/[0-9a-f-]+$/, {
    timeout: 60000,
  });
  return { context, page };
}
async function metric(page, label, value) {
  const dd = activity(page)
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::dd");
  await expect(dd).toBeVisible();
  await expect
    .poll(() => dd.evaluate((element) => element.firstChild?.textContent?.trim()))
    .toBe(String(value));
}
function localTime(instant) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(instant));
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")} ${part("timeZoneName").replace("GMT", "UTC")}`;
}
function friendlyDate(instant) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date(instant));
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday");
  return `${weekday.charAt(0).toLocaleUpperCase("es-AR")}${weekday.slice(1)} ${part("day")} de ${part("month")}`;
}
async function assertDashboard(page, scope, viewport) {
  await page.goto(base);
  await dashboardReady(page);
  const expected = expectedRows(p, scope);
  const professional = scope !== "staff";
  await expect(
    activity(page).getByRole("heading", {
      name: professional ? "Mi actividad de hoy" : "Actividad de hoy",
    }),
  ).toBeVisible();
  const centerDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(p.createdAt));
  const datePart = (type) => centerDate.find((item) => item.type === type)?.value ?? "";
  expect(`${datePart("year")}-${datePart("month")}-${datePart("day")}`).toBe(p.localDate);
  await expect(activity(page)).toContainText(friendlyDate(p.createdAt));
  await expect(activity(page)).toContainText(/Actualizado a las \d{2}:\d{2} \(hora del centro\)/);
  await metric(
    page,
    professional ? "Mis turnos del día" : "Turnos del día",
    expected.pending_count +
      expected.confirmed_count +
      expected.attended_count +
      expected.no_show_count,
  );
  await metric(page, "Por atender", expected.pending_count + expected.confirmed_count);
  await metric(page, "Atendidos", expected.attended_count);
  await metric(page, "Ausentes", expected.no_show_count);
  await expect(activity(page)).toContainText(
    `${expected.pending_count} pendientes · ${expected.confirmed_count} confirmados`,
  );
  await expect(activity(page)).toContainText(
    `Cancelados con fecha de hoy: ${expected.cancelled_count}`,
  );
  if (professional) {
    await expect(
      activity(page).getByText("Profesionales con turnos hoy", { includeHidden: true }),
    ).toHaveCount(0);
    const otherIds = p.appointments
      .filter((item) => item.professionalCenter !== (scope === i.pcA ? "pcA" : "pcA2"))
      .map((item) => item.id);
    const html = await page.content();
    for (const id of otherIds) expect(html).not.toContain(id);
    for (const marker of [
      `T021-PAT-A-${p.runId}`,
      `T021-PAT-A2-${p.runId}`,
      `task021-patient-a-${p.runId}@example.test`,
      `task021-patient-a2-${p.runId}@example.test`,
    ])
      expect(html).not.toContain(marker);
    await expect(
      patientLink(upcoming(page), scope === i.pcA ? "Task021 Patient A2" : "Task021 Patient A"),
    ).toHaveCount(0);
    for (const name of ["Pacientes", "Profesionales", "Especialidades", "Gestión de usuarios"])
      await expect(cards(page).filter({ hasText: name })).toHaveCount(0);
    await expect(cards(page)).toHaveCount(3);
  } else {
    await expect(activity(page)).toContainText("Profesionales con turnos hoy: 2");
    await expect(cards(page)).toHaveCount(viewport === "admin" ? 7 : 4);
  }
  const list = upcoming(page).locator("ol > li");
  await expect(list).toHaveCount(expected.upcoming.length);
  for (let n = 0; n < expected.upcoming.length; n++) {
    const item = p.appointments.find((row) => row.id === expected.upcoming[n]);
    expect(item).toBeDefined();
    const line = list.nth(n);
    await expect(line.getByRole("link")).toHaveAttribute(
      "href",
      `/centers/${i.centerA}/appointments/${item.id}`,
    );
    const patientName = `Task021 Patient ${item.patient === "patientA" ? "A" : "A2"}`;
    await expect(line.locator("a > span:first-child > span:first-child")).toHaveText(
      `${localTime(item.startsAt)} · ${patientName}`,
    );
    await expect(patientLink(line, patientName)).toHaveCount(1);
    await expect(line).toContainText(`TASK-021 Specialty ${p.runId}`);
    if (professional) await expect(line).not.toContainText("Task021 Professional");
    else
      await expect(line.locator("a > span:first-child > span:nth-child(2)")).toContainText(
        new RegExp(`^Task021 Professional ${item.professionalCenter === "pcA" ? "A" : "A2"} · `),
      );
  }
  await expect(page.getByRole("heading", { name: "¿Qué querés hacer hoy?" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Dashboard must not overflow the viewport horizontally",
  ).toBe(true);
}
async function mutate(db, sql, values, expectedCount) {
  const result = await db.query(sql, values);
  expect(result.rowCount).toBe(expectedCount);
}
test("Dashboard DEV: alcance, estados, actualización y navegación", async ({ browser }) => {
  test.setTimeout(300000);
  for (const [name, scope, cardRole] of [
    ["adminA", "staff", "admin"],
    ["receptionA", "staff", "reception"],
    ["professionalA", i.pcA, "professional"],
    ["professionalA2", i.pcA2, "professional"],
  ]) {
    const { context, page } = await login(browser, name);
    try {
      await assertDashboard(page, scope, cardRole);
    } finally {
      await context.close();
    }
  }
  const mobile = await login(browser, "professionalA", { width: 390, height: 844 });
  try {
    await assertDashboard(mobile.page, i.pcA, "professional");
  } finally {
    await mobile.context.close();
  }
  const other = await login(browser, "adminB");
  try {
    await other.page.goto(`/centers/${i.centerB}`);
    await dashboardReady(other.page);
    await metric(other.page, "Turnos del día", 0);
    await expect(other.page.locator("body")).toContainText("No hay turnos vigentes para hoy.");
    await expect(upcoming(other.page)).toContainText("No hay próximos turnos de hoy.");
    const response = await other.page.goto(base);
    expect(response).not.toBeNull();
    await expect(
      other.page.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeVisible();
    const html = await response.text();
    for (const marker of [p.actors.adminA.email, p.appointments[0].id, "Task021 Patient A"])
      expect(html).not.toContain(marker);
  } finally {
    await other.context.close();
  }
  const unlinked = await login(browser, "unlinked");
  try {
    const response = await unlinked.page.goto(base);
    expect(response).not.toBeNull();
    await expect(
      unlinked.page.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeVisible();
    const html = await response.text();
    for (const marker of [p.appointments[0].id, "Task021 Patient A"])
      expect(html).not.toContain(marker);
  } finally {
    await unlinked.context.close();
  }
  const admin = await login(browser, "adminA");
  const db = await connect();
  try {
    await admin.page.goto(base);
    await dashboardReady(admin.page);
    let aborted = false;
    await admin.page.route(`**/centers/${i.centerA}*`, async (route) => {
      const request = route.request();
      if (!aborted && request.method() === "POST" && request.headers()["next-action"]) {
        aborted = true;
        await route.abort("failed");
      } else await route.continue();
    });
    await activity(admin.page).getByRole("button", { name: "Actualizar" }).click();
    await expect.poll(() => aborted).toBe(true);
    await expect(activity(admin.page).getByRole("alert")).toContainText(
      "No pudimos cargar la actividad.",
    );
    await expect(activity(admin.page).locator("dl")).toHaveCount(0);
    await expect(cards(admin.page)).toHaveCount(7);
    await admin.page.unrouteAll();
    await activity(admin.page).getByRole("button", { name: "Reintentar" }).click();
    await dashboardReady(admin.page);
    await metric(admin.page, "Turnos del día", 9);
    const chosen = p.appointments.find((x) => x.label === "a1-pending-1");
    await mutate(
      db,
      "update public.appointments set status='CONFIRMED' where id=$1 and center_id=$2",
      [chosen.id, i.centerA],
      1,
    );
    await activity(admin.page).getByRole("button", { name: "Actualizar" }).click();
    await dashboardReady(admin.page);
    await expect(activity(admin.page)).toContainText("3 pendientes · 4 confirmados");
    await mutate(
      db,
      "update public.appointments set status='ATTENDED' where id=any($1::uuid[]) and center_id=$2 and status in ('PENDING','CONFIRMED')",
      [p.appointments.map((x) => x.id), i.centerA],
      7,
    );
    await activity(admin.page).getByRole("button", { name: "Actualizar" }).click();
    await dashboardReady(admin.page);
    await expect(upcoming(admin.page)).toContainText("No quedan próximos turnos de hoy.");
    await expect(upcoming(admin.page).locator("ol > li")).toHaveCount(0);
    await mutate(
      db,
      "update public.appointments set status='CANCELLED' where id=any($1::uuid[]) and center_id=$2",
      [p.appointments.map((x) => x.id), i.centerA],
      10,
    );
    await activity(admin.page).getByRole("button", { name: "Actualizar" }).click();
    await dashboardReady(admin.page);
    await expect(activity(admin.page)).toContainText("No hay turnos vigentes para hoy.");
    await metric(admin.page, "Turnos del día", 0);
    await expect(upcoming(admin.page)).toContainText("No hay próximos turnos de hoy.");
  } finally {
    await db.end();
    await admin.context.close();
  }
});
