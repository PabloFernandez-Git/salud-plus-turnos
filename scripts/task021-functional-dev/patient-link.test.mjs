import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { patientLink } from "../../tests/e2e/task-021-patient-link.mjs";

const row = (time, name, hiddenName = name) =>
  `
  <li><a href="#">
    <span><span>${time} UTC-3 · ${name}</span><span>Especialidad · Pendiente</span></span>
    <span>Ver detalle<span class="sr-only"> de ${hiddenName}</span></span>
  </a></li>`
    .replace(/>\s+</g, "><")
    .trim();

test("patient isolation uses individual links, not concatenated section text", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const section = page.locator('section[aria-labelledby="upcoming-heading"]');
    const setRows = async (rows) =>
      page.setContent(`
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading">Mis próximos turnos de hoy</h2>
          <ol>${rows}</ol>
        </section>`);

    await setRows(row("20:55", "Task021 Patient A") + row("21:15", "Task021 Patient A"));
    assert.match(await section.textContent(), /Task021 Patient A21:15/);
    await expect(patientLink(section, "Task021 Patient A2")).toHaveCount(0);
    await expect(patientLink(section, "Task021 Patient A")).toHaveCount(2);
    await expect(
      section.locator("li").nth(1).locator("a > span:first-child > span:first-child"),
    ).toHaveText("21:15 UTC-3 · Task021 Patient A");

    await setRows(row("20:55", "Task021 Patient A") + row("21:15", "Task021 Patient A2"));
    await expect(patientLink(section, "Task021 Patient A2")).toHaveCount(1);
    await assert.rejects(
      () => expect(patientLink(section, "Task021 Patient A2")).toHaveCount(0, { timeout: 100 }),
      /toHaveCount/,
    );

    await setRows(row("21:15", "Task021 Patient A2"));
    await expect(patientLink(section, "Task021 Patient A")).toHaveCount(0);
    await expect(patientLink(section, "Task021 Patient A2")).toHaveCount(1);

    await setRows(row("21:15", "Task021 Patient A2", "Task021 Patient A"));
    await assert.rejects(
      () =>
        expect(section.locator("li a > span:first-child > span:first-child")).toHaveText(
          "21:15 UTC-3 · Task021 Patient A",
          { timeout: 100 },
        ),
      /toHaveText/,
    );
  } finally {
    await browser.close();
  }
});
