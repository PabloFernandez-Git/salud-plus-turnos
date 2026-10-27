// Chromium check of the real patient modal with synthetic actions. No database access.
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
const cache = resolve("node_modules/.cache/task028-patients-visual");
const output = resolve("artifacts/task028-patients-visual");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  "export function useRouter() { return { push() {}, refresh() {} }; }",
);
writeFileSync(
  resolve(cache, "link.tsx"),
  "import React from 'react'; export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a>; }",
);
writeFileSync(
  resolve(cache, "actions.ts"),
  `
const patientCenterId = '22222222-2222-4222-8222-222222222222';
export async function resolvePatientAction() {
  const mode = new URLSearchParams(location.search);
  if (mode.has('mismatch')) return { status: 'success', data: { identity_status: 'FOUND', first_name: 'Identidad', last_name: 'Reservada', birth_date_matches: false, relationship_state: 'NOT_LINKED', person_id: null, patient_center_id: null, patient_center_updated_at: null } };
  if (mode.has('link')) return { status: 'success', data: { identity_status: 'FOUND', first_name: 'Paciente', last_name: 'Sintético', birth_date_matches: true, relationship_state: 'NOT_LINKED', person_id: '33333333-3333-4333-8333-333333333333', patient_center_id: null, patient_center_updated_at: null } };
  return { status: 'success', data: { identity_status: 'NOT_FOUND', first_name: null, last_name: null, birth_date_matches: null, relationship_state: null, person_id: null, patient_center_id: null, patient_center_updated_at: null } };
}
export async function createPatientAction() { return { status: 'success', data: { outcome: 'CREATED', patient_center_id: patientCenterId } }; }
export async function linkPatientAction() { return { status: 'success', data: { outcome: 'LINKED', patient_center_id: patientCenterId } }; }
export async function reactivatePatientAction() { throw new Error('fixture reactivate blocked'); }
export async function updatePatientAction() { return { status: 'success', data: { outcome: 'UPDATED', patient_center_id: patientCenterId } }; }
export async function deactivatePatientAction() { throw new Error('fixture deactivate blocked'); }
`,
);
writeFileSync(
  resolve(cache, "appointment-actions.ts"),
  `
export async function loadPatientAppointmentSectionsAction() { return { status: 'success', data: { asOf: '2026-10-26T12:00:00Z', upcoming: { rows: [], hasMore: false, nextCursor: null }, history: { rows: [], hasMore: false, nextCursor: null } } }; }
export async function loadPatientAppointmentPageAction() { throw new Error('fixture page blocked'); }
`,
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PatientWorkspace } from '@/modules/patients/components/patient-workspace';
import '@/app/globals.css';
const centerId='11111111-1111-4111-8111-111111111111';
const patientCenterId='22222222-2222-4222-8222-222222222222';
const detail={patientCenterId,phone:'011 5555-0101',email:'ana@example.test',insuranceName:'Plan Salud',administrativeNotes:'Nota administrativa de prueba',isActive:true,updatedAt:'2026-10-26T09:00:00Z',firstName:'Ana',lastName:'Pérez',birthDate:'1990-01-02',nationalityCode:'AR',documentNumber:'12345678'};
const admin=new URLSearchParams(location.search).has('admin');
createRoot(document.getElementById('root')).render(<main className="min-h-screen bg-slate-100 p-5"><PatientWorkspace centerId={centerId} filters={{query:'',state:'ACTIVE',page:1}} detail={admin?detail:null} detailFailed={false} /></main>);
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
      { find: "../actions/patient-actions", replacement: resolve(cache, "actions.ts") },
      {
        find: "../actions/patient-appointment-actions",
        replacement: resolve(cache, "appointment-actions.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31028, strictPort: true, fs: { allow: [root] } },
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [390, 556, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:31028/");
    await page.getByRole("button", { name: "Registrar paciente" }).click();
    const registration = page.getByRole("dialog", { name: "Registrar paciente" });
    await expect(registration).toBeVisible();
    await expect(registration.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await expect(registration.getByRole("combobox", { name: "Nacionalidad" })).toHaveValue("AR");
    await registration.getByRole("button", { name: "Comprobar identidad" }).click();
    await expect(registration.getByRole("textbox", { name: "Documento" })).toBeFocused();
    await expect(registration.getByText("Ingresá el documento.")).toBeVisible();
    await expect(
      registration.getByText("Ingresá una fecha válida en formato DD/MM/AAAA."),
    ).toBeVisible();
    await page.screenshot({ path: resolve(output, `registration-validation-${width}.png`) });
    await registration.getByRole("textbox", { name: "Documento" }).fill("12345678");
    const birthDate = registration.getByLabel("Fecha de nacimiento");
    await birthDate.fill("02011990");
    await expect(birthDate).toHaveValue("02/01/1990");
    await birthDate.evaluate((input) => {
      input.focus();
      input.setSelectionRange(3, 5);
    });
    await page.keyboard.press("Backspace");
    await expect(birthDate).toHaveValue("02//1990");
    await page.keyboard.press("Tab");
    await expect(birthDate).toHaveValue("02//1990");
    await expect(
      registration.getByText("Ingresá una fecha válida en formato DD/MM/AAAA."),
    ).toBeVisible();
    await birthDate.evaluate((input) => {
      input.focus();
      input.setSelectionRange(3, 3);
    });
    await page.keyboard.type("12");
    await expect(birthDate).toHaveValue("02/12/1990");
    await expect(
      registration.getByText("Ingresá una fecha válida en formato DD/MM/AAAA."),
    ).toHaveCount(0);
    await birthDate.evaluate((input) => {
      input.focus();
      input.setSelectionRange(3, 5);
    });
    await page.keyboard.type("01");
    await expect(birthDate).toHaveValue("02/01/1990");
    await expect(registration.getByText("Ingresá el documento.")).toHaveCount(0);
    await registration.getByRole("button", { name: "Comprobar identidad" }).click();
    await expect(registration.getByText("2. Datos del nuevo paciente")).toBeVisible();
    await registration.getByRole("textbox", { name: "Nombre", exact: true }).fill("Ana");
    await registration.getByRole("textbox", { name: "Apellido" }).fill("Pérez");
    await registration.getByRole("textbox", { name: "Teléfono" }).fill("011 5555-0101");
    await registration.getByRole("textbox", { name: "Email (opcional)" }).fill("ana@example.test");
    await registration
      .getByRole("textbox", { name: "Obra social / prepaga (opcional)" })
      .fill("Plan Salud");
    await registration
      .getByRole("textbox", { name: "Notas administrativas (opcional)" })
      .fill("Nota administrativa de prueba");
    await registration.getByRole("button", { name: "Revisar alta" }).click();
    await expect(registration.getByText("3. Revisión y confirmación")).toBeVisible();
    const review = registration.getByRole("region", { name: "Revisión y confirmación" });
    await expect(review.getByText("Ana Pérez")).toBeVisible();
    await expect(review.getByText("Argentina")).toBeVisible();
    await expect(review.getByText("02/01/1990")).toBeVisible();
    await expect(review.getByText("ana@example.test")).toBeVisible();
    await registration.getByRole("button", { name: "Confirmar" }).scrollIntoViewIfNeeded();
    const box = await registration.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width);
    if (width < 1440) {
      assert.equal(
        await registration.evaluate((dialog) => dialog.scrollHeight > dialog.clientHeight),
        true,
      );
    }
    assert.equal(
      await registration.evaluate((dialog) => getComputedStyle(dialog).overflowY),
      "auto",
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: resolve(output, `registration-${width}.png`) });
    await registration.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("status")).toHaveText("Paciente registrado correctamente");
    await expect(page.getByRole("dialog", { name: "Administrar paciente" })).toHaveCount(0);
    await page.goto("http://127.0.0.1:31028/?admin=1");
    const administration = page.getByRole("dialog", { name: "Administrar paciente" });
    await expect(administration).toBeVisible();
    await expect(administration.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    await administration.getByRole("textbox", { name: "Teléfono" }).fill("011 5555-9999");
    await expect(administration.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    await administration.getByRole("tab", { name: "Turnos" }).click();
    await expect(administration.getByRole("heading", { name: "Próximos turnos" })).toBeVisible();
    await administration.getByRole("tab", { name: "Datos del paciente" }).click();
    await page.screenshot({ path: resolve(output, `administration-${width}.png`) });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    if (width === 390) {
      await page.goto("http://127.0.0.1:31028/?mismatch=1");
      await page.getByRole("button", { name: "Registrar paciente" }).click();
      const mismatch = page.getByRole("dialog", { name: "Registrar paciente" });
      await mismatch.getByRole("textbox", { name: "Documento" }).fill("12345678");
      await mismatch.getByRole("textbox", { name: "Fecha de nacimiento" }).fill("02011990");
      await mismatch.getByRole("button", { name: "Comprobar identidad" }).click();
      await expect(mismatch.getByRole("alert")).toHaveText(
        "No pudimos comprobar la identidad con los datos ingresados. Revisá el documento y la fecha de nacimiento.",
      );
      await expect(mismatch.getByRole("textbox", { name: "Documento" })).toHaveValue("12345678");
      await expect(mismatch.getByRole("textbox", { name: "Fecha de nacimiento" })).toHaveValue(
        "02/01/1990",
      );
      await expect(mismatch.getByText("Identidad Reservada")).toHaveCount(0);
      await expect(
        mismatch.getByRole("button", { name: /Revisar alta|Vincular a este centro/ }),
      ).toHaveCount(0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({ path: resolve(output, "identity-mismatch-390.png") });

      await page.goto("http://127.0.0.1:31028/?link=1");
      await page.getByRole("button", { name: "Registrar paciente" }).click();
      const linking = page.getByRole("dialog", { name: "Registrar paciente" });
      await linking.getByRole("textbox", { name: "Documento" }).fill("12345678");
      await linking.getByRole("textbox", { name: "Fecha de nacimiento" }).fill("02011990");
      await linking.getByRole("button", { name: "Comprobar identidad" }).click();
      await expect(linking.getByText("Identidad encontrada:")).toBeVisible();
      await linking.getByRole("textbox", { name: "Teléfono" }).fill("000 0000-0000");
      await linking.getByRole("button", { name: "Vincular a este centro" }).click();
      const linkReview = linking.getByRole("region", { name: "Revisión y confirmación" });
      await expect(linkReview.getByText("Paciente Sintético")).toBeVisible();
      await expect(
        linkReview.getByText("Revisá los datos antes de vincular el paciente con este centro."),
      ).toBeVisible();
      await linking.getByRole("button", { name: "Confirmar" }).scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({ path: resolve(output, "identity-link-review-390.png") });
      await linking.getByRole("button", { name: "Confirmar" }).click();
      await expect(page.getByRole("status")).toHaveText("Paciente vinculado correctamente");
      await expect(page.getByRole("dialog", { name: "Administrar paciente" })).toHaveCount(0);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(`Chromium PASS: 390, 556, 1440 px; screenshots in ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
