import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { analyzeRobotsMetaContents } from "../../scripts/task022-functional-dev/robots.mjs";

const final = process.env.TASK022_FUNCTIONAL_SCOPE === "denial-final";
const closure = process.env.TASK022_FUNCTIONAL_SCOPE === "denial-closure";
const focused = closure || final || process.env.TASK022_FUNCTIONAL_SCOPE === "denial";
const ledger = JSON.parse(
  readFileSync(
    resolve(
      focused
        ? closure
          ? ".task022-functional-dev/closure-ledger.json"
          : final
            ? ".task022-functional-dev/final-ledger.json"
            : ".task022-functional-dev/focused-ledger.json"
        : ".task022-functional-dev/ledger.json",
    ),
    "utf8",
  ),
);
if (
  ledger.stage !== "fixtures_ready" ||
  ledger.plan.projectRef !== "ehllxymqyzrofydrvtzo" ||
  (ledger.plan.scope === "denial") !== focused
)
  throw new Error("TASK-022 browser fixtures are not ready");
const password = process.env.TASK022_FIXTURE_PASSWORD;
if (!password) throw new Error("TASK-022 synthetic Auth password is unavailable");
const i = ledger.plan.ids;
const base = `/centers/${i.centerA}/patients`;

async function login(page, name) {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(ledger.plan.actors[name].email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(name === "unlinked" ? /\/no-access$/ : /\/centers\/[0-9a-f-]+$/, {
    timeout: 60_000,
  });
}

async function openPatient(page, patientId, tab = "Turnos", onResponse = () => undefined) {
  const response = await page.goto(`${base}?patient=${patientId}`);
  onResponse(response);
  const dialog = page.getByRole("dialog", { name: "Administrar paciente" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Datos del paciente" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  if (tab === "Turnos") {
    await dialog.getByRole("tab", { name: "Turnos" }).click();
    await expect(dialog.getByRole("tabpanel", { name: "Turnos" })).toBeVisible();
  }
  return { dialog, response };
}

async function closureScenario(browser) {
  const observations = [];
  const evidencePath = resolve(".task022-functional-dev/closure-browser-evidence.json");
  const saveEvidence = () => {
    const temporary = `${evidencePath}.${randomUUID()}.tmp`;
    writeFileSync(
      temporary,
      `${JSON.stringify({ runId: ledger.plan.runId, observations }, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    renameSync(temporary, evidencePath);
  };
  async function recordActor(actor, inspect) {
    const row = { actor, outcome: "FAIL", httpStatus: null, renderedPage: null, failures: [] };
    let page;
    const check = async (label, assertion) => {
      try {
        await assertion();
        return true;
      } catch {
        row.failures.push(label);
        return false;
      }
    };
    try {
      page = await browser.newPage();
      await login(page, actor);
      await inspect(page, row, check);
    } catch {
      row.failures.push("actor_setup_or_navigation");
    } finally {
      if (page) await page.close().catch(() => row.failures.push("page_close"));
      row.outcome = row.failures.length === 0 ? "PASS" : "FAIL";
      observations.push(row);
      saveEvidence();
    }
  }

  await recordActor("receptionA", async (page, row, check) => {
    const { dialog } = await openPatient(page, i.patientA, "Datos del paciente", (response) => {
      row.httpStatus = response?.status() ?? null;
    });
    await check("reception_http", async () => expect(row.httpStatus).toBe(200));
    row.renderedPage = "patient_dialog";
    const dataTab = dialog.getByRole("tab", { name: "Datos del paciente" });
    await dataTab.click();
    await expect(dataTab).toHaveAttribute("aria-selected", "true");
    const dataPanel = dialog.getByRole("tabpanel", { name: "Datos del paciente" });
    await expect(dataPanel).toBeVisible();
    row.patientVisible = await check("reception_patient_visible", async () =>
      expect(dataPanel.getByText("Task022 Patient A", { exact: true })).toBeVisible(),
    );
    const turnsTab = dialog.getByRole("tab", { name: "Turnos" });
    await turnsTab.click();
    await expect(turnsTab).toHaveAttribute("aria-selected", "true");
    const turnsPanel = dialog.getByRole("tabpanel", { name: "Turnos" });
    await expect(turnsPanel).toBeVisible();
    const upcoming = turnsPanel.getByRole("region", { name: "Próximos turnos" });
    const turnVisible = await check("reception_turn_visible", async () => {
      await expect(upcoming.getByRole("listitem")).toHaveCount(1);
      await expect(upcoming.getByRole("listitem")).toContainText(
        `Task022 Professional A · TASK-022 Specialty A ${ledger.plan.runId}`,
      );
      await expect(upcoming.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
        "href",
        `/centers/${i.centerA}/appointments/${ledger.plan.appointments[0].id}`,
      );
    });
    row.upcomingAppointmentId = turnVisible ? ledger.plan.appointments[0].id : null;
  });

  for (const actor of ["professionalA", "adminB", "unlinked"]) {
    await recordActor(actor, async (page, row, check) => {
      const response = await page.goto(`${base}?patient=${i.patientA}`);
      row.httpStatus = response?.status() ?? null;
      await check("denied_http", async () => expect([200, 404]).toContain(row.httpStatus));
      row.notFoundVisible = await check("denied_page", async () =>
        expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible(),
      );
      if (row.notFoundVisible) row.renderedPage = "not_found";
      row.noindex = "not_required";
      if (row.httpStatus === 200) {
        row.noindex = await check("denied_noindex", async () => {
          const robotsMeta = page.locator('meta[name="robots" i]');
          await expect
            .poll(async () => {
              const contents = await robotsMeta.evaluateAll((elements) =>
                elements.map((element) => element.getAttribute("content")),
              );
              const { hasNoindex, hasIndexConflict } = analyzeRobotsMetaContents(contents);
              return hasNoindex && !hasIndexConflict;
            })
            .toBe(true);
        });
      }
      row.protectedDataAbsent = await check("denied_protected_data", async () => {
        const html = response ? await response.text() : "";
        const rendered = await page.content();
        for (const marker of [
          "Task022 Patient A",
          `T022-PAT-A-${ledger.plan.runId}`,
          `task022-patient-a-${ledger.plan.runId}@example.test`,
          ledger.plan.appointments[0].id,
        ]) {
          expect(html).not.toContain(marker);
          expect(rendered).not.toContain(marker);
        }
        await expect(page.getByText("Task022 Patient A", { exact: true })).toHaveCount(0);
      });
      row.administrativeControlsAbsent = await check("denied_admin_controls", async () => {
        for (const [role, name] of [
          ["heading", "Pacientes"],
          ["form", "Búsqueda de pacientes"],
          ["dialog", "Administrar paciente"],
          ["region", "Próximos turnos"],
          ["region", "Historial"],
          ["button", "Guardar cambios"],
          ["button", "Desactivar paciente"],
          ["link", "Administrar paciente"],
        ]) {
          await expect(
            page.getByRole(role, { name, exact: true, includeHidden: true }),
          ).toHaveCount(0);
        }
      });
    });
  }
  if (observations.some((row) => row.outcome !== "PASS"))
    throw new Error("TASK-022 closure Chromium actor checks failed; inspect sanitized evidence");
}

test("ADMIN: historia paginada, nombres, horario, detalle y paciente vacío", async ({ page }) => {
  await login(page, "adminA");
  await openPatient(page, i.patientA);
  const upcoming = page.getByRole("region", { name: "Próximos turnos" });
  const history = page.getByRole("region", { name: "Historial" });
  await expect(upcoming.getByRole("listitem")).toHaveCount(2);
  await expect(history.getByRole("listitem")).toHaveCount(20);
  await expect(
    history.getByText(`Task022 Professional A · TASK-022 Specialty A ${ledger.plan.runId}`).first(),
  ).toBeVisible();
  await history.getByRole("button", { name: "Cargar más" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(27);
  for (const label of ["Atendido", "Ausente", "Cancelado", "Pendiente"]) {
    await expect(history.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(history).toContainText("GMT-4");
  await expect(history).toContainText("GMT-5");
  await expect(history.getByRole("button", { name: "Cargar más" })).toHaveCount(0);
  await upcoming.getByRole("link", { name: "Ver detalle" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/centers/${i.centerA}/appointments/[0-9a-f-]+$`));
  await expect(page.getByText("Task022 Patient A").first()).toBeVisible();
  await openPatient(page, i.patientEmpty);
  await expect(page.getByText("No hay próximos turnos para este paciente.")).toBeVisible();
  await expect(
    page.getByText("Este paciente todavía no tiene turnos en el historial."),
  ).toBeVisible();
});

test("RECEPTION puede leer; PROFESSIONAL y otro centro no acceden", async ({ browser }) => {
  if (closure) {
    // Four independent sessions must all run even when one actor reaches its assertion timeout.
    test.setTimeout(300_000);
    return closureScenario(browser);
  }
  const observations = [];
  const reception = await browser.newPage();
  try {
    await login(reception, "receptionA");
    const { dialog } = await openPatient(reception, i.patientA, "Datos del paciente");
    const dataTab = dialog.getByRole("tab", { name: "Datos del paciente" });
    await dataTab.click();
    await expect(dataTab).toHaveAttribute("aria-selected", "true");
    const dataPanel = dialog.getByRole("tabpanel", { name: "Datos del paciente" });
    await expect(dataPanel).toBeVisible();
    await expect(dataPanel.getByText("Task022 Patient A", { exact: true })).toBeVisible();
    const turnsTab = dialog.getByRole("tab", { name: "Turnos" });
    await turnsTab.click();
    await expect(turnsTab).toHaveAttribute("aria-selected", "true");
    const turnsPanel = dialog.getByRole("tabpanel", { name: "Turnos" });
    await expect(turnsPanel).toBeVisible();
    const upcoming = turnsPanel.getByRole("region", { name: "Próximos turnos" });
    await expect(upcoming.getByRole("listitem")).toHaveCount(focused ? 1 : 2);
    if (focused) {
      await expect(upcoming.getByRole("listitem")).toContainText(
        `Task022 Professional A · TASK-022 Specialty A ${ledger.plan.runId}`,
      );
      await expect(upcoming.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
        "href",
        `/centers/${i.centerA}/appointments/${ledger.plan.appointments[0].id}`,
      );
    }
    if (focused) observations.push({ actor: "receptionA", patientVisible: true, upcoming: 1 });
  } finally {
    await reception.close();
  }
  for (const name of ["professionalA", "adminB", "unlinked"]) {
    const page = await browser.newPage();
    try {
      await login(page, name);
      const response = await page.goto(`${base}?patient=${i.patientA}`);
      expect(response, `${name} patient page response`).not.toBeNull();
      expect([200, 404], `${name} patient page response`).toContain(response.status());
      await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
      if (response.status() === 200) {
        const robotsMeta = page.locator('meta[name="robots" i]');
        await expect
          .poll(async () => {
            const contents = await robotsMeta.evaluateAll((elements) =>
              elements.map((element) => element.getAttribute("content")),
            );
            const { hasNoindex, hasIndexConflict } = analyzeRobotsMetaContents(contents);
            return hasNoindex && !hasIndexConflict;
          })
          .toBe(true);
      }
      const html = await response.text();
      for (const marker of [
        "Task022 Patient A",
        `T022-PAT-A-${ledger.plan.runId}`,
        `task022-patient-a-${ledger.plan.runId}@example.test`,
        ledger.plan.appointments[0].id,
      ]) {
        expect(html, `${name} response must not contain patient data`).not.toContain(marker);
      }
      await expect(page.getByText("Task022 Patient A")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Pacientes", exact: true, includeHidden: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("form", { name: "Búsqueda de pacientes", includeHidden: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("dialog", { name: "Administrar paciente", includeHidden: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("region", { name: "Próximos turnos", includeHidden: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("region", { name: "Historial", includeHidden: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Guardar cambios", includeHidden: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Desactivar paciente", includeHidden: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Administrar paciente", includeHidden: true }),
      ).toHaveCount(0);
      if (focused)
        observations.push({
          actor: name,
          httpStatus: response.status(),
          notFoundVisible: true,
          noindex: response.status() === 200,
          protectedDataInResponse: false,
          administrativeActionsVisible: false,
        });
    } finally {
      await page.close();
    }
  }
  if (focused)
    writeFileSync(
      resolve(
        final
          ? ".task022-functional-dev/final-browser-evidence.json"
          : ".task022-functional-dev/focused-browser-evidence.json",
      ),
      `${JSON.stringify({ runId: ledger.plan.runId, observations }, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
});

test("navegación a otro paciente descarta turnos previos", async ({ page }) => {
  await login(page, "adminA");
  let held = false;
  await page.route(`**/centers/${i.centerA}/patients*`, async (route) => {
    const request = route.request();
    if (!held && request.method() === "POST" && request.headers()["next-action"]) {
      held = true;
      await new Promise((done) => setTimeout(done, 1200));
    }
    await route.continue();
  });
  await openPatient(page, i.patientA);
  await expect.poll(() => held).toBeTruthy();
  await page.goto(`${base}?patient=${i.patientEmpty}`);
  await page.getByRole("tab", { name: "Turnos" }).click();
  await expect(page.getByText("No hay próximos turnos para este paciente.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Historial" }).getByRole("listitem")).toHaveCount(
    0,
  );
});

test("error de lectura muestra reintento y se recupera", async ({ page }) => {
  await login(page, "adminA");
  let aborted = 0;
  await page.route(`**/centers/${i.centerA}/patients*`, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"] && aborted < 2) {
      aborted += 1;
      await route.abort("failed");
    } else await route.continue();
  });
  await openPatient(page, i.patientA);
  await expect.poll(() => aborted).toBeGreaterThan(0);
  await expect(
    page.getByRole("alert").getByText("No pudimos cargar los turnos de este paciente."),
  ).toBeVisible();
  await page.unrouteAll();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByRole("region", { name: "Próximos turnos" }).getByRole("listitem"),
  ).toHaveCount(2);
});
