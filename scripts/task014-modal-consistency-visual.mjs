// Local visual verification with synthetic props. No Supabase or application server requests.
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
const cache = resolve("node_modules/.cache/task014-modal-consistency-visual");
const output = resolve("artifacts/task014-modal-consistency");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });

writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  `
export function navigate(path) {
  history.pushState({}, '', path);
  window.dispatchEvent(new Event('popstate'));
}
export function usePathname() { return location.pathname; }
export function useRouter() { return { refresh() { window.__refreshCount = (window.__refreshCount || 0) + 1; }, replace: navigate, push: navigate }; }
`,
);
writeFileSync(
  resolve(cache, "link.tsx"),
  `
import React from 'react';
import { navigate } from './navigation';
export default function Link({href, children, ...props}) {
  return <a {...props} href={href} onClick={event => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
      event.preventDefault(); navigate(href);
    }
  }}>{children}</a>;
}
`,
);
writeFileSync(
  resolve(cache, "actions.ts"),
  `
export async function resolveCenterIdentityAction(_centerId, email) {
  return { status: 'success', email: email.trim().toLowerCase(), identityExists: false,
    membershipExists: false, message: 'La identidad es nueva.' };
}
export async function provisionCenterUserAction() {
  return { status: 'error', message: 'La vista local no realiza altas.' };
}
export async function updateCenterMembershipAction(formData) {
  window.__membershipUpdates = [...(window.__membershipUpdates || []), Object.fromEntries(formData)];
  return { status: 'success', message: 'Acceso actualizado con el estado confirmado por el servidor.',
    membership: { id: formData.get('membershipId'), role: formData.get('role'),
      isActive: formData.get('isActive') === 'true', professionalCenterId: formData.get('professionalCenterId') || null } };
}
export async function logoutAction() { return { status: 'idle' }; }
`,
);
writeFileSync(
  resolve(cache, "patient-actions.ts"),
  `
const id = '77777777-7777-4777-8777-777777777777';
export async function resolvePatientAction({ documentNumber }) {
  window.__patientResolves = [...(window.__patientResolves || []), documentNumber];
  if (documentNumber === '123') return { status: 'success', data: {
    identity_status: 'NOT_FOUND', first_name: null, last_name: null, birth_date_matches: null,
    relationship_state: null, person_id: null, patient_center_id: null, patient_center_updated_at: null } };
  const relationship_state = documentNumber === '789' ? 'INACTIVE' : 'NOT_LINKED';
  return { status: 'success', data: { identity_status: 'FOUND', first_name: 'Ana', last_name: 'Paciente',
    birth_date_matches: true, relationship_state, person_id: id,
    patient_center_id: relationship_state === 'INACTIVE' ? id : null,
    patient_center_updated_at: relationship_state === 'INACTIVE' ? '2026-10-21T12:00:00Z' : null } };
}
export async function createPatientAction(payload) {
  window.__patientCreates = [...(window.__patientCreates || []), payload];
  return { status: 'success', data: { outcome: 'CREATED', patient_center_id: id } };
}
export async function linkPatientAction(payload) {
  window.__patientLinks = [...(window.__patientLinks || []), payload];
  return { status: 'success', data: { outcome: 'LINKED', patient_center_id: id } };
}
export async function reactivatePatientAction(payload) {
  window.__patientReactivations = [...(window.__patientReactivations || []), payload];
  return { status: 'success', data: { outcome: 'REACTIVATED', patient_center_id: id } };
}
export async function updatePatientAction() { throw new Error('not used in visual check'); }
export async function deactivatePatientAction() { throw new Error('not used in visual check'); }
`,
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CenterHeader } from '@/modules/access/components/center-header';
import { CenterDashboard } from '@/modules/access/components/center-dashboard';
import { CenterUsersScreen } from '@/modules/access/components/center-users-screen';
import { PatientsScreen } from '@/modules/patients/components/patients-screen';
import '@/app/globals.css';

const centerId = '11111111-1111-4111-8111-111111111111';
const base = '/centers/' + centerId;
const user = { id: '22222222-2222-4222-8222-222222222222',
  firstName: 'Pablo', lastName: 'Fernandez', email: 'pablo@example.test' };
const users = [{ id: '33333333-3333-4333-8333-333333333333', userId: user.id,
  firstName: user.firstName, lastName: user.lastName, email: user.email,
  role: 'ADMIN', isActive: true, professional: null },
  { id: '44444444-4444-4444-8444-444444444444', userId: '55555555-5555-4555-8555-555555555555',
    firstName: 'Ana', lastName: 'Admin', email: 'ana.administracion.de.consultorio.con.direccion.extensa@example.test',
    role: 'ADMIN', isActive: true, professional: null }];
const professionals = [{ id: '66666666-6666-4666-8666-666666666666',
  firstName: 'Paula', lastName: 'Libre', licenseNumber: 'MP 1', occupiedMembershipId: null }];

function App() {
  const [, refresh] = useState(0);
  useEffect(() => { const update = () => refresh(value => value + 1);
    addEventListener('popstate', update); return () => removeEventListener('popstate', update); }, []);
  const onUsers = location.pathname.endsWith('/users');
  const onPatients = location.pathname.endsWith('/patients');
  return <div className="min-h-screen bg-slate-100/80">
    <CenterHeader centerId={centerId} centerName="Centro Médico Salud Plus" user={user} role="ADMIN" />
    {onUsers
      ? <CenterUsersScreen actorUserId={user.id} centerId={centerId}
          centerName="Centro Médico Salud Plus" loadFailed={false}
          manageableProfessionalCenters={professionals} professionalCenters={professionals} users={users} />
      : onPatients
        ? <PatientsScreen centerId={centerId} centerName="Centro Médico Salud Plus"
            filters={{ query: '', state: 'ACTIVE', page: 1 }} result={null} />
      : <CenterDashboard centerId={centerId} role="ADMIN" />}
  </div>;
}
if (location.pathname === '/') history.replaceState({}, '', base);
createRoot(document.getElementById('root')).render(<App />);
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
      { find: "../actions/center-user-actions", replacement: resolve(cache, "actions.ts") },
      { find: "../actions/auth-actions", replacement: resolve(cache, "actions.ts") },
      { find: "../actions/patient-actions", replacement: resolve(cache, "patient-actions.ts") },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31014, strictPort: true, fs: { allow: [root] } },
});

const results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [name, width, height] of [
    ["desktop-1440", 1440, 900],
    ["mobile-390", 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:31014");
    await expect(page.getByRole("link", { name: "Gestión de usuarios" })).toBeVisible();
    await page.getByRole("link", { name: "Gestión de usuarios" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Gestión de usuarios" }),
    ).toBeVisible();
    await expect(page.locator('[aria-current="page"]')).toHaveText("Gestión de usuarios");
    await expect(
      page.getByText("Administrá los usuarios, roles y accesos del centro."),
    ).toBeVisible();
    await expect(
      page.getByText("Ingresá un email para agregar un usuario a este centro."),
    ).toBeVisible();
    const row = page.getByRole("row", { name: /Ana Admin/ });
    const trigger = row.getByRole("button", { name: "Administrar acceso" });
    await expect(trigger).toBeVisible();
    await trigger.scrollIntoViewIfNeeded();
    const triggerBox = await trigger.boundingBox();
    assert.ok(triggerBox && triggerBox.x >= 0 && triggerBox.x + triggerBox.width <= width);
    const rowBefore = await row.boundingBox();
    assert.ok(rowBefore);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${name} users screen has horizontal overflow`,
    );
    await page.screenshot({ path: resolve(output, `${name}-listado.png`), fullPage: true });
    await page.goto("http://127.0.0.1:31014/centers/11111111-1111-4111-8111-111111111111/patients");
    const registerTrigger = page.getByRole("button", { name: "Registrar paciente" });
    await expect(registerTrigger).toBeVisible();
    await registerTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Registrar paciente" });
    const closeButton = dialog.getByRole("button", { name: "Cerrar" });
    await expect(dialog).toBeVisible();
    await expect(closeButton).toBeFocused();
    await expect(
      dialog.getByText(
        "Comprobá la identidad antes de crear o vincular un registro en este centro.",
      ),
    ).toBeVisible();
    await expect(dialog.getByLabel("Nacionalidad (código ISO de dos letras)")).toBeVisible();
    await expect(dialog.getByLabel("Documento")).toBeVisible();
    await expect(dialog.getByLabel("Fecha de nacimiento")).toBeVisible();
    const modalBox = await dialog.boundingBox();
    assert.ok(modalBox);
    assert.ok(modalBox.x >= 0 && modalBox.x + modalBox.width <= width, name + " modal overflows");
    assert.ok(
      Math.abs(modalBox.y + modalBox.height / 2 - height / 2) < 2,
      name + " modal is not centered",
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: resolve(output, name + "-registrar-inicial.png") });
    await closeButton.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Comprobar identidad" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Nacionalidad (código ISO de dos letras)")).toBeFocused();
    await closeButton.click();
    await expect(dialog).not.toBeVisible();
    await expect(registerTrigger).toBeFocused();
    await registerTrigger.click();
    await page.mouse.click(5, height / 2);
    await expect(dialog).not.toBeVisible();
    await expect(registerTrigger).toBeFocused();
    await registerTrigger.click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(registerTrigger).toBeFocused();
    await registerTrigger.click();
    await dialog.getByLabel("Documento").fill("123");
    await dialog.getByLabel("Fecha de nacimiento").fill("2000-01-02");
    for (const method of ["x", "backdrop", "escape"]) {
      if (method === "x") await closeButton.click();
      else if (method === "backdrop") await page.mouse.click(5, height / 2);
      else await page.keyboard.press("Escape");
      const discard = page.getByRole("dialog", { name: "Descartar cambios" });
      await expect(discard).toBeVisible();
      await discard.getByRole("button", { name: "Seguir editando" }).click();
      await expect(dialog.getByLabel("Documento")).toHaveValue("123");
      await expect(dialog.getByLabel("Fecha de nacimiento")).toHaveValue("2000-01-02");
    }
    await closeButton.click();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(registerTrigger).toBeFocused();
    assert.equal(await page.evaluate(() => (window.__patientCreates || []).length), 0);
    await registerTrigger.click();
    await dialog.getByLabel("Documento").fill("123");
    await dialog.getByLabel("Fecha de nacimiento").fill("2000-01-02");
    await dialog.getByRole("button", { name: "Comprobar identidad" }).click();
    await expect(dialog.getByText("2. Datos del nuevo paciente")).toBeVisible();
    await dialog.getByLabel("Nombre", { exact: true }).fill("Ana");
    await dialog.getByLabel("Apellido").fill("Paciente");
    await dialog.getByLabel("Teléfono").fill("555");
    await dialog.getByLabel("Email (opcional)").fill("ana@example.test");
    await dialog.getByLabel("Obra social / prepaga (opcional)").fill("Plan Uno");
    await dialog
      .getByLabel("Notas administrativas (opcional)")
      .fill("Nota administrativa de prueba");
    const internalScroll = await dialog.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    );
    assert.equal(internalScroll, true, name + " long form does not scroll inside modal");
    await page.screenshot({ path: resolve(output, name + "-registrar-etapa2.png") });
    await dialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.screenshot({ path: resolve(output, name + "-registrar-etapa2-inferior.png") });
    await dialog.getByRole("button", { name: "Revisar alta" }).click();
    await expect(dialog.getByText("Confirmá la creación del paciente.")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).not.toBeVisible();
    assert.equal(await page.evaluate(() => (window.__patientCreates || []).length), 1);
    await registerTrigger.click();
    await dialog.getByLabel("Documento").fill("456");
    await dialog.getByLabel("Fecha de nacimiento").fill("2000-01-02");
    await dialog.getByRole("button", { name: "Comprobar identidad" }).click();
    await expect(dialog.getByText(/Identidad encontrada:/)).toBeVisible();
    await dialog.getByLabel("Teléfono").fill("555");
    await dialog.getByRole("button", { name: "Vincular a este centro" }).click();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).not.toBeVisible();
    assert.equal(await page.evaluate(() => (window.__patientLinks || []).length), 1);
    await registerTrigger.click();
    await dialog.getByLabel("Documento").fill("789");
    await dialog.getByLabel("Fecha de nacimiento").fill("2000-01-02");
    await dialog.getByRole("button", { name: "Comprobar identidad" }).click();
    await expect(dialog.getByText(/El registro está inactivo/)).toBeVisible();
    await dialog.getByRole("button", { name: "Reactivar en este centro" }).click();
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).not.toBeVisible();
    assert.equal(await page.evaluate(() => (window.__patientReactivations || []).length), 1);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(hasOverflow, false, name + " has horizontal overflow");
    results.push({
      name,
      width,
      hasOverflow,
      rowHeight: rowBefore.height,
      internalScroll,
      patientFlows: "ok",
    });
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
