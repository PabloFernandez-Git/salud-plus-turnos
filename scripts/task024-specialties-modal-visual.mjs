// Local Chromium check with synthetic props. No Supabase or Next server requests.
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
const cache = resolve("node_modules/.cache/task024-specialties-modal-visual");
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
export async function createSpecialtyAction(formData) {
  window.__createCalls = (window.__createCalls || 0) + 1;
  if (formData.get('description') === 'invalid') {
    return { status: 'error', message: 'Revisá los datos ingresados.',
      fieldErrors: { description: ['Descripción inválida.'] } };
  }
  if (window.__pending) return new Promise(resolve => { window.__resolveAction = resolve; });
  return { status: 'success', message: 'Especialidad creada.' };
}
export async function updateSpecialtyAction() { return { status: 'success', message: 'Especialidad actualizada.' }; }
export async function setSpecialtyActiveAction() { return { status: 'success', message: 'Estado actualizado.' }; }
`,
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SpecialtiesScreen } from '@/modules/specialties/components/specialties-screen';
import '@/app/globals.css';
createRoot(document.getElementById('root')).render(<div className="min-h-screen bg-slate-100/80">
  <SpecialtiesScreen centerId="11111111-1111-4111-8111-111111111111" centerName="Centro Salud"
    loadFailed={false} specialties={[{id:'22222222-2222-4222-8222-222222222222', name:'Cardiología', description:'Atención de adultos', is_active:true, updated_at:'2026-10-09T12:00:00Z'}]} />
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
      { find: "../actions/specialty-actions", replacement: resolve(cache, "actions.ts") },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31024, strictPort: true, fs: { allow: [root] } },
});

async function assertFieldStyle(input, tone) {
  const colors = await input.evaluate((element, colorTone) => {
    const sample = document.createElement("span");
    sample.className =
      colorTone === "red"
        ? "text-red-700"
        : colorTone === "sky"
          ? "text-sky-700"
          : "text-slate-300";
    document.body.append(sample);
    const expected = getComputedStyle(sample).color;
    const style = getComputedStyle(element);
    const result = {
      expected,
      border: style.borderTopColor,
      borderWidth: Number.parseFloat(style.borderTopWidth),
      outlineStyle: style.outlineStyle,
      shadow: style.boxShadow,
    };
    sample.remove();
    return result;
  }, tone);
  assert.equal(colors.border, colors.expected);
  assert.equal(colors.borderWidth, 2);
  assert.equal(colors.outlineStyle, "none");
  assert.equal(colors.shadow, "none");
}

let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto("http://127.0.0.1:31024/");
    await page.getByRole("button", { name: "Nueva especialidad" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva especialidad" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    assert.ok(box && Math.abs(box.x + box.width / 2 - width / 2) < 2);
    assert.ok(box.x >= 0 && box.x + box.width <= width);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const createName = dialog.getByRole("textbox", { name: "Nombre" });
    const createDescription = dialog.getByRole("textbox", { name: "Descripción (opcional)" });
    const nameBox = await createName.boundingBox();
    const descriptionBox = await createDescription.boundingBox();
    await assertFieldStyle(createName, "slate");
    await assertFieldStyle(createDescription, "slate");
    await createName.evaluate((element) =>
      element.addEventListener(
        "invalid",
        (event) => setTimeout(() => (window.__invalidPrevented = event.defaultPrevented), 0),
        { once: true },
      ),
    );
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Ingresá el nombre de la especialidad.")).toBeVisible();
    await expect(createName).toBeFocused();
    await assertFieldStyle(createName, "red");
    const invalidNameBox = await createName.boundingBox();
    assert.ok(
      nameBox &&
        invalidNameBox &&
        Math.abs(nameBox.height - invalidNameBox.height) < 1 &&
        Math.abs(nameBox.width - invalidNameBox.width) < 1,
    );
    await expect(createName).toHaveAttribute("aria-invalid", "true");
    await expect.poll(() => page.evaluate(() => window.__invalidPrevented)).toBe(true);
    assert.equal(await page.evaluate(() => window.__createCalls || 0), 0);
    await createName.fill("Neurología");
    await expect(dialog.getByText("Ingresá el nombre de la especialidad.")).not.toBeVisible();
    await assertFieldStyle(createName, "sky");
    await createDescription.focus();
    await assertFieldStyle(createDescription, "sky");
    const focusedDescriptionBox = await createDescription.boundingBox();
    assert.ok(
      descriptionBox &&
        focusedDescriptionBox &&
        Math.abs(descriptionBox.height - focusedDescriptionBox.height) < 1 &&
        Math.abs(descriptionBox.width - focusedDescriptionBox.width) < 1,
    );
    await createDescription.fill("invalid");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Descripción inválida.")).toBeVisible();
    await createDescription.focus();
    await assertFieldStyle(createDescription, "red");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveValue("Neurología");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Editar" }).click();
    const edit = page.getByRole("dialog", { name: "Editar Cardiología" });
    await expect(edit.getByRole("textbox", { name: "Nombre" })).toHaveValue("Cardiología");
    await expect(edit.getByRole("textbox", { name: "Descripción (opcional)" })).toHaveValue(
      "Atención de adultos",
    );
    const editBox = await edit.boundingBox();
    assert.ok(editBox && Math.abs(editBox.x + editBox.width / 2 - width / 2) < 2);
    assert.ok(editBox.x >= 0 && editBox.x + editBox.width <= width);
    const editName = edit.getByRole("textbox", { name: "Nombre" });
    await editName.fill("");
    await edit.getByRole("button", { name: "Guardar" }).click();
    await expect(edit.getByText("Ingresá el nombre de la especialidad.")).toBeVisible();
    await expect(editName).toBeFocused();
    await editName.fill("Dermatología");
    await expect(edit.getByText("Ingresá el nombre de la especialidad.")).not.toBeVisible();
    await edit.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await page.getByRole("button", { name: "Desactivar" }).click();
    const deactivate = page.getByRole("dialog", { name: "Desactivar Cardiología" });
    await expect(deactivate.getByText(/Las asociaciones existentes se conservan/)).toBeVisible();
    await expect(deactivate.getByRole("button", { name: "Confirmar desactivación" })).toHaveClass(
      /bg-red-700/,
    );
    const deactivateBox = await deactivate.boundingBox();
    assert.ok(deactivateBox && Math.abs(deactivateBox.x + deactivateBox.width / 2 - width / 2) < 2);
    assert.ok(deactivateBox.x >= 0 && deactivateBox.x + deactivateBox.width <= width);
    await page.close();
  }
  console.log("TASK-024 Chromium synthetic 1440/390 PASS");
} finally {
  await browser?.close();
  await server.close();
}
