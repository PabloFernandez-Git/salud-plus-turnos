import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const evidenceDirectory = path.resolve(".harness/tasks/archive/TASK-002/evidence");

async function eventBox(locator: Locator) {
  const event = locator.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' rbc-event ')][1]",
  );
  const box = await event.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function openSpike(page: Page) {
  await page.goto("/spikes/react-big-calendar");
  await expect(
    page.getByRole("heading", { name: "React Big Calendar — evaluación técnica" }),
  ).toBeVisible();
}

test.describe("React Big Calendar spike", () => {
  test("day uses professional resources and positions all required durations", async ({ page }) => {
    await openSpike(page);

    await expect(page.locator('[data-current-view="day"]')).toBeVisible();
    await expect(page.locator("[data-resource-id]")).toHaveCount(3);
    await expect(page.getByText("Dra. Ana Torres", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dr. Bruno Silva", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dra. Clara Méndez", { exact: true }).first()).toBeVisible();

    const twentyMinute = await eventBox(page.locator('[data-event-id="wed-ana-20"]'));
    const thirtyMinute = await eventBox(page.locator('[data-event-id="wed-bruno-30"]'));
    const fortyFiveMinute = await eventBox(page.locator('[data-event-id="wed-clara-45"]'));

    expect(twentyMinute.y).toBeLessThan(thirtyMinute.y);
    expect(thirtyMinute.y).toBeLessThan(fortyFiveMinute.y);
    expect(twentyMinute.height).toBeLessThan(thirtyMinute.height);
    expect(thirtyMinute.height).toBeLessThan(fortyFiveMinute.height);
  });

  test("a free day slot produces a visible, non-persistent selection", async ({ page }) => {
    await openSpike(page);

    const anaColumn = page.locator(".rbc-day-slot").first();
    const box = await anaColumn.boundingBox();
    expect(box).not.toBeNull();

    await anaColumn.click({ position: { x: box!.width / 2, y: box!.height * 0.55 } });

    await expect(page.getByTestId("selection-result")).toContainText("Dra. Ana Torres");
    await expect(page.getByTestId("selection-result")).toContainText("No se guardó ningún turno");
  });

  test("week keeps days as columns, filters professionals and displays simultaneous events", async ({
    page,
  }) => {
    await openSpike(page);
    await page.getByRole("button", { name: "Semana" }).click();

    await expect(page.locator('[data-current-view="week"]')).toBeVisible();
    await expect(page.locator(".rbc-time-header-content .rbc-header")).toHaveCount(7);

    const anaOverlap = await eventBox(page.locator('[data-event-id="tue-ana-overlap"]'));
    const brunoOverlap = await eventBox(page.locator('[data-event-id="tue-bruno-overlap"]'));
    expect(Math.abs(anaOverlap.y - brunoOverlap.y)).toBeLessThan(2);
    expect(anaOverlap.x).not.toBe(brunoOverlap.x);

    const professionalFilters = page.getByRole("group", { name: "Profesionales visibles" });
    await professionalFilters.getByText("Clara Méndez", { exact: true }).click();
    await professionalFilters.getByText("Bruno Silva", { exact: true }).click();
    await expect(page.locator('[data-event-id="tue-bruno-overlap"]')).toHaveCount(0);
    await expect(page.locator('[data-event-id="tue-ana-overlap"]')).toBeVisible();

    const referenceLabel = await page.getByTestId("period-label").textContent();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("period-label")).not.toHaveText(referenceLabel ?? "");
    await page.getByRole("button", { name: "Fecha de referencia" }).click();
    await expect(page.getByTestId("period-label")).toHaveText(referenceLabel ?? "");
  });

  test("month renders custom summaries and drills down to day", async ({ page }) => {
    await openSpike(page);
    await page.getByRole("button", { name: "Mes" }).click();

    const referenceDay = page.locator('[data-date="2026-04-15"]');
    await expect(referenceDay).toContainText("3 turnos");
    await expect(referenceDay).toContainText("Ana Torres");
    await expect(page.locator(".rbc-month-view .rbc-event")).toHaveCount(0);

    const referenceLabel = await page.getByTestId("period-label").textContent();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByTestId("period-label")).not.toHaveText(referenceLabel ?? "");
    await page.getByRole("button", { name: "Fecha de referencia" }).click();
    await referenceDay.click();
    await expect(page.locator('[data-current-view="day"]')).toBeVisible();
  });

  for (const viewport of [
    { name: "mobile-375", width: 375, height: 812 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1280", width: 1280, height: 900 },
  ]) {
    test(`captures deterministic responsive evidence at ${viewport.width}px`, async ({ page }) => {
      mkdirSync(evidenceDirectory, { recursive: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openSpike(page);

      for (const view of ["Día", "Semana", "Mes"] as const) {
        await page.getByRole("button", { name: view }).click();
        await page.screenshot({
          fullPage: true,
          path: path.join(evidenceDirectory, `${viewport.name}-${view.toLowerCase()}.png`),
        });
      }

      const overflow = await page.locator(".rbc-spike").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));

      if (viewport.width < 1280) {
        expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
      } else {
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      }
    });
  }
});
