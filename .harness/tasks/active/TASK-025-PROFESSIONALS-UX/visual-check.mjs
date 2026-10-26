// Synthetic local Chromium check: no Next server or Supabase requests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const root = resolve(".");
const cache = resolve("node_modules/.cache/task025-professionals-modal-visual");
mkdirSync(cache, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "link.tsx"),
  "import React from 'react'; export default function Link({href, children, ...props}) { return <a href={href} {...props}>{children}</a>; }",
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  "export function useRouter() { return { refresh() {} }; }",
);
writeFileSync(
  resolve(cache, "actions.ts"),
  `
export async function resolveProfessionalAction() {
  return { status: 'resolved', message: 'ok', resolution: { resolution_status: 'NOT_FOUND' } };
}
export async function createProfessionalAction() { return { status: 'success', message: 'Creado' }; }
export async function linkProfessionalAction() { return { status: 'success', message: 'Vinculado' }; }
export async function updateProfessionalCenterAction() {
  return { status: 'success', message: 'Configuración actualizada', updatedAt: '2026-10-09T12:01:00+00:00' };
}
export async function setProfessionalCenterActiveAction() { return { status: 'success', message: 'Actualizado' }; }
`,
);
writeFileSync(
  resolve(cache, "specialty-action.ts"),
  "export async function updateProfessionalSpecialtiesAction() { return { status: 'success', message: 'Especialidades actualizadas', updatedAt: '2026-10-09T12:02:00+00:00' }; }",
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProfessionalsScreen } from '@/modules/professionals/components/professionals-screen';
import '@/app/globals.css';
createRoot(document.getElementById('root')).render(<div className="min-h-screen bg-slate-100/80">
  <ProfessionalsScreen centerId="11111111-1111-4111-8111-111111111111" centerName="Centro Salud"
    loadFailed={false} professionals={[{
      id:'33333333-3333-4333-8333-333333333333', firstName:'Ana', lastName:'Pérez',
      licenseNumber:'M-1', usualAppointmentDurationMinutes:30, isActive:true,
      updatedAt:'2026-10-09T12:00:00+00:00'
    }, {
      id:'55555555-5555-4555-8555-555555555555', firstName:'Lucía', lastName:'Gómez',
      licenseNumber:'M-2', usualAppointmentDurationMinutes:45, isActive:true,
      updatedAt:'2026-10-09T12:00:00+00:00'
    }]} specialties={[
      {id:'44444444-4444-4444-8444-444444444444', name:'Cardiología', isActive:true},
      {id:'66666666-6666-4666-8666-666666666666', name:'Pediatría y adolescencia', isActive:true}
    ]}
    associations={[
      {professionalCenterId:'55555555-5555-4555-8555-555555555555', specialtyId:'44444444-4444-4444-8444-444444444444', isActive:true},
      {professionalCenterId:'55555555-5555-4555-8555-555555555555', specialtyId:'66666666-6666-4666-8666-666666666666', isActive:true}
    ]} />
</div>);
`,
);

const server = await createServer({
  configFile: false,
  root: cache,
  envDir: cache,
  css: { postcss: root },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "next/link", replacement: resolve(cache, "link.tsx") },
      { find: "next/navigation", replacement: resolve(cache, "navigation.ts") },
      { find: "../actions/professional-actions", replacement: resolve(cache, "actions.ts") },
      {
        find: "../actions/professional-specialty-action",
        replacement: resolve(cache, "specialty-action.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31025, strictPort: true, fs: { allow: [root] } },
});

async function checkDialog(page, dialog, width) {
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  assert.ok(box && Math.abs(box.x + box.width / 2 - width / 2) < 2);
  assert.ok(box.x >= 0 && box.x + box.width <= width);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(
    await dialog.evaluate((element) => element.scrollWidth > element.clientWidth),
    false,
  );
}

async function checkBorder(field, tone) {
  const { border, expected, width } = await field.evaluate((element, tone) => {
    const sample = document.createElement("span");
    sample.className =
      tone === "red-700" ? "text-red-700" : tone === "sky-700" ? "text-sky-700" : "text-slate-300";
    document.body.append(sample);
    const expected = getComputedStyle(sample).color;
    sample.remove();
    const style = getComputedStyle(element);
    return { border: style.borderTopColor, expected, width: style.borderTopWidth };
  }, tone);
  assert.equal(border, expected);
  assert.equal(width, "2px");
}

async function checkCursor(locator, expected) {
  assert.equal(
    await locator.evaluate((element) => getComputedStyle(element).cursor),
    expected,
  );
}

let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [390, 556, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto("http://127.0.0.1:31025/");
    await checkCursor(page.getByRole("button", { name: "Nuevo profesional" }), "pointer");
    await checkCursor(page.getByRole("link", { name: "Inicio" }), "pointer");
    await checkCursor(page.getByRole("link", { name: "Disponibilidad" }).first(), "pointer");
    const table = page.getByRole("table");
    const anaRow = table.getByRole("row", { name: /Ana Pérez/ });
    const luciaRow = table.getByRole("row", { name: /Lucía Gómez/ });
    await expect(anaRow.getByText("Sin especialidades")).toBeVisible();
    await expect(luciaRow.getByText("Cardiología")).toBeVisible();
    await expect(luciaRow.getByText("Pediatría y adolescencia")).toBeVisible();
    const tableGeometry = await table.evaluate((element) => ({
      tableWidth: element.getBoundingClientRect().width,
      scrollerWidth: element.parentElement.clientWidth,
      scrollerScrollWidth: element.parentElement.scrollWidth,
      specialtyWidth: element.querySelectorAll("tbody tr")[1].cells[1].getBoundingClientRect()
        .width,
      actionWidth: element.querySelectorAll("tbody tr")[1].cells[5].getBoundingClientRect().width,
    }));
    assert.ok(tableGeometry.specialtyWidth >= 224);
    assert.ok(tableGeometry.actionWidth >= 300);
    assert.equal(tableGeometry.scrollerScrollWidth > tableGeometry.scrollerWidth, width !== 1440);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const scrollHint = page.getByText("Deslizá horizontalmente para ver todas las columnas");
    if (width !== 1440) await expect(scrollHint).toBeVisible();
    else await expect(scrollHint).toHaveCount(0);
    const actionGeometry = await anaRow.evaluate((row) => {
      const controls = Array.from(row.cells[5].querySelectorAll("a, button"));
      return controls.map((control) => {
        const rect = control.getBoundingClientRect();
        const textRange = document.createRange();
        textRange.selectNodeContents(control);
        const textRect = textRange.getBoundingClientRect();
        const style = getComputedStyle(control);
        return {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          height: rect.height,
          computedHeight: style.height,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          textCenter: textRect.top + textRect.height / 2,
        };
      });
    });
    assert.equal(actionGeometry.length, 3);
    assert.deepEqual(
      actionGeometry.map(({ computedHeight }) => computedHeight),
      ["44px", "44px", "44px"],
    );
    for (const property of [
      "height",
      "paddingTop",
      "paddingBottom",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "lineHeight",
    ]) {
      assert.ok(actionGeometry.every((control) => control[property] === actionGeometry[0][property]));
    }
    const actionCenter = actionGeometry[0].top + actionGeometry[0].height / 2;
    assert.ok(
      actionGeometry.every(({ top, height }) => Math.abs(top + height / 2 - actionCenter) < 1),
    );
    assert.ok(actionGeometry.every(({ textCenter }) => Math.abs(textCenter - actionCenter) < 2));
    assert.ok(actionGeometry[0].right < actionGeometry[1].left);
    assert.ok(actionGeometry[1].right < actionGeometry[2].left);
    if (width !== 1440) {
      await table.evaluate((element) => {
        element.parentElement.scrollLeft = element.parentElement.scrollWidth;
      });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.setViewportSize({ width: 1440, height: 844 });
      await expect(scrollHint).toHaveCount(0);
      await page.setViewportSize({ width, height: 844 });
      await expect(scrollHint).toBeVisible();
    }
    await page.getByRole("button", { name: "Nuevo profesional" }).click();
    const create = page.getByRole("dialog", { name: "Nuevo profesional" });
    await checkDialog(page, create, width);
    const country = create.getByRole("combobox", { name: "Nacionalidad" });
    await checkBorder(country, "slate-300");
    await country.focus();
    await checkBorder(country, "sky-700");
    await create.getByRole("button", { name: "Verificar documento" }).click();
    await expect(create.getByText("Seleccioná un país.")).toBeVisible();
    await checkBorder(country, "red-700");
    await country.selectOption("AR");
    await create.getByRole("textbox", { name: "Documento" }).fill("123");
    await create.getByRole("button", { name: "Verificar documento" }).click();
    await expect(create.getByRole("textbox", { name: "Nombre" })).toBeVisible();
    await checkDialog(page, create, width);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(create.getByRole("textbox", { name: "Documento" })).toHaveValue("123");
    await create.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(page.getByRole("button", { name: "Nuevo profesional" })).toBeFocused();
    await anaRow.getByRole("button", { name: "Configurar" }).click();
    const edit = page.getByRole("dialog", { name: "Configurar Ana Pérez" });
    await checkDialog(page, edit, width);
    const saveConfiguration = edit.getByRole("button", { name: "Guardar configuración" });
    await expect(saveConfiguration).toBeDisabled();
    await checkCursor(saveConfiguration, "not-allowed");
    await checkCursor(edit.getByRole("button", { name: "Guardar especialidades" }), "not-allowed");
    const license = edit.getByRole("textbox", { name: "Matrícula (opcional)" });
    await license.fill("M-3");
    await expect(saveConfiguration).toBeEnabled();
    await checkCursor(saveConfiguration, "pointer");
    await license.fill("M-1");
    await expect(saveConfiguration).toBeDisabled();
    await license.fill("M-3");
    await saveConfiguration.click();
    await expect(saveConfiguration).toBeDisabled();
    await expect(edit.getByRole("status")).toBeVisible();
    await checkCursor(saveConfiguration, "not-allowed");
    await edit.getByRole("checkbox", { name: "Cardiología" }).check();
    await expect(edit.getByRole("button", { name: "Guardar especialidades" })).toBeEnabled();
    await checkCursor(edit.getByRole("button", { name: "Guardar especialidades" }), "pointer");
    await expect(saveConfiguration).toBeDisabled();
    await edit.getByText("Cerrar", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(edit.getByRole("checkbox", { name: "Cardiología" })).toBeChecked();
    await edit.getByText("Cerrar", { exact: true }).click();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await anaRow.getByRole("button", { name: "Desactivar" }).click();
    const deactivate = page.getByRole("dialog", { name: "Desactivar Ana Pérez" });
    await checkDialog(page, deactivate, width);
    await expect(deactivate.getByRole("button", { name: "Confirmar desactivación" })).toHaveClass(
      /bg-red-700/,
    );
    await page.close();
  }
  console.log("TASK-025 Chromium synthetic 390/556/1440 PASS");
} finally {
  await browser?.close();
  await server.close();
}
