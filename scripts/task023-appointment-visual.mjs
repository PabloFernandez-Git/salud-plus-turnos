// Local Chromium fixture for the real Crear turno page. No Next or Supabase requests.
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
const cache = resolve("node_modules/.cache/task023-appointment-visual");
const output = resolve("artifacts/task023-ux/crear-turno");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { NewAppointmentScreen } from '@/modules/appointments/components/new-appointment-screen';\nimport '@/app/globals.css';\ncreateRoot(document.getElementById('root')).render(\n  <NewAppointmentScreen centerId=\"11111111-1111-4111-8111-111111111111\"\n    centerName=\"Centro Médico Salud Plus\" timezone=\"America/Argentina/Buenos_Aires\"\n    initialPatient={null} />\n);\n",
);
writeFileSync(
  resolve(cache, "appointment-actions.ts"),
  "const centerId = '11111111-1111-4111-8111-111111111111';\nconst specialtyId = '33333333-3333-4333-8333-333333333333';\nconst professionalCenterId = '22222222-2222-4222-8222-222222222222';\nconst sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));\nexport async function searchAppointmentPatientsAction(input) {\n  if (input.centerId !== centerId) throw Error('wrong center');\n  await sleep(150);\n  return { status: 'SUCCESS', data: { rows: [{patientCenterId:'44444444-4444-4444-8444-444444444444',firstName:'Ana',lastName:'Paz'}], hasNext:false } };\n}\nexport async function listBookableSpecialtiesAction(input) {\n  if (input.centerId !== centerId) throw Error('wrong center');\n  await sleep(150);\n  return { status:'SUCCESS', data:[{specialty_id:specialtyId,specialty_name:'Clínica médica'}] };\n}\nexport async function listBookableProfessionalsAction(input) {\n  if (input.centerId !== centerId) throw Error('wrong center');\n  return { status:'SUCCESS', data:[{professional_center_id:professionalCenterId,professional_first_name:'Luisa',professional_last_name:'Vega',usual_appointment_duration_minutes:30}] };\n}\nexport async function searchAppointmentSlotsAction(input) {\n  if (input.centerId !== centerId) throw Error('wrong center');\n  return {status:'SUCCESS', data:[{starts_at:'2026-12-20T12:00:00Z',ends_at:'2026-12-20T12:30:00Z',local_date:'2026-12-20',local_start_time:'09:00',local_end_date:'2026-12-20',local_end_time:'09:30'}]};\n}\nexport async function getAppointmentAvailabilityAction(input) {\n  if (input.centerId !== centerId) throw Error('wrong center');\n  return {status:'SUCCESS',data:{intervals:[]}};\n}\nexport async function createAppointmentAction(input) {\n  if (input.centerId !== centerId) throw Error('wrong center');\n  return {status:'BUSINESS_ERROR',code:'PATIENT_INACTIVE'};\n}\nexport async function reconcileAppointmentCreateAction() { throw Error('not used'); }\n",
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  "export function useRouter(){return {push(path){history.pushState({},'',path);window.dispatchEvent(new Event('popstate'));}}}",
);
writeFileSync(
  resolve(cache, "link.tsx"),
  "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}",
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
      {
        find: "../actions/appointment-actions",
        replacement: resolve(cache, "appointment-actions.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31025, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [name, width, height] of [
    ["desktop-1440", 1440, 900],
    ["mobile-390", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      timezoneId: "America/Argentina/Buenos_Aires",
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:31025/");
    await expect(page.getByRole("heading", { name: "Crear turno" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Paciente" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "2. Especialidad, profesional y horario" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "3. Nota administrativa opcional" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "4. Resumen" })).toBeVisible();
    await page.screenshot({
      path: resolve(output, name + "-initial.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("searchbox", { name: "Buscar paciente activo" }).fill("Ana");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByText("Ana Paz", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Seleccionar" }).click();
    await page
      .getByRole("combobox", { name: "Especialidad", exact: true })
      .selectOption("33333333-3333-4333-8333-333333333333");
    await page
      .getByRole("combobox", { name: "Profesional", exact: true })
      .selectOption("22222222-2222-4222-8222-222222222222");
    await page.getByLabel("Fecha local del centro").fill("2026-12-20");
    await page
      .getByRole("combobox", { name: "Horario disponible" })
      .selectOption("2026-12-20T12:00:00Z");
    await page.getByRole("textbox", { name: "Nota" }).fill("Control administrativo");
    await expect(page.getByText("09:00–09:30", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar y crear turno" })).toBeEnabled();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      name + " overflow",
    );
    await page.screenshot({
      path: resolve(output, name + "-ready.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Confirmar y crear turno" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.screenshot({
      path: resolve(output, name + "-business-error.png"),
      fullPage: true,
      animations: "disabled",
    });
    assert.deepEqual(errors, []);
    results.push({ name, initial: true, ready: true, businessError: true, overflow: false });
    await context.close();
  }
  writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log("TASK-023 Crear turno Chromium local PASS", JSON.stringify(results));
} finally {
  await browser?.close();
  await server.close();
}
