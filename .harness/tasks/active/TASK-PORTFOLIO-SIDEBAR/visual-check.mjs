// Requires preview.mjs running on 127.0.0.1:3017. Uses synthetic data only.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = "http://127.0.0.1:3017/centers/11111111-1111-4111-8111-111111111111";
const output = resolve("artifacts/portfolio-sidebar-visual");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [
    [1366, 608],
    [1366, 768],
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await expect(page.getByText(/versión de demostración con datos ficticios/)).toBeVisible();
    await expect(page.getByText("Visitante Demo · Invitado · Demo de lectura")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Salud Plus" })).toHaveAttribute(
      "href",
      new URL(base).pathname,
    );
    await expect(page.getByRole("link", { name: "Turnos" })).toHaveCount(width < 768 ? 0 : 1);
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${width} has horizontal overflow`);
    await page.screenshot({ path: `${output}/${width}x${height}-dashboard.png`, fullPage: true });
    const refresh = page.getByRole("button", { name: "Actualizar" });
    await refresh.click();
    await expect(refresh).toHaveAttribute("aria-busy", "true");
    await expect(refresh).toBeDisabled();
    await expect(refresh.locator("svg")).toHaveClass(/animate-spin/);
    await expect(refresh).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    const logoutDialog = page.getByRole("dialog", { name: "¿Querés cerrar sesión?" });
    await expect(logoutDialog).toBeVisible();
    await logoutDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(logoutDialog).not.toBeVisible();

    if (width >= 768) {
      const sidebar = page.getByRole("complementary", { name: "Barra lateral del centro" });
      await expect(sidebar).toHaveAttribute("data-expanded", "false");
      assert.equal(Math.round((await sidebar.boundingBox()).width), 64);
      const mainX = (await page.locator("main").boundingBox()).x;
      await sidebar.hover();
      await expect(sidebar).toHaveAttribute("data-expanded", "true");
      await page.waitForTimeout(240);
      assert.equal(Math.round((await sidebar.boundingBox()).width), 240);
      assert.equal((await page.locator("main").boundingBox()).x, mainX);
      await page.screenshot({ path: `${output}/${width}x${height}-expanded.png`, fullPage: true });
      await sidebar.getByRole("link", { name: "Pacientes" }).focus();
      await expect(sidebar).toHaveAttribute("data-expanded", "true");
      await sidebar.getByRole("link", { name: "Pacientes" }).click();
      await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    } else {
      const trigger = page.getByRole("button", { name: "Abrir menú de navegación" });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Menú de navegación" });
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: `${output}/${width}x${height}-menu.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await dialog.getByRole("link", { name: "Pacientes" }).click();
      await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
    }

    for (const destination of [
      "agenda",
      "appointments",
      "patients",
      "professionals",
      "availability",
      "specialties",
      "users",
      "settings",
    ]) {
      await page.goto(`${base}/${destination}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      assert.ok(
        (await page.evaluate(() => document.documentElement.scrollWidth)) <= width,
        `${destination} overflows at ${width}`,
      );
    }
    assert.deepEqual(errors, [], `${width} page errors`);
    await page.close();
    console.log(`${width}x${height}: PASS`);
  }
} finally {
  await browser.close();
}
