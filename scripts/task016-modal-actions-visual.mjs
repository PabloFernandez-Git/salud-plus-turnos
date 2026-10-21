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
const cache = resolve("node_modules/.cache/task016-modal-actions-visual");
const output = resolve("artifacts/task016-modal-actions");
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
  server: { host: "127.0.0.1", port: 31016, strictPort: true, fs: { allow: [root] } },
});

async function assertCenteredGroup(dialog, buttons, label) {
  const dialogBox = await dialog.boundingBox();
  const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
  assert.ok(dialogBox && boxes.every(Boolean), `${label}: missing bounds`);
  const first = boxes[0];
  const last = boxes.at(-1);
  const groupCenter = (first.x + last.x + last.width) / 2;
  const dialogCenter = dialogBox.x + dialogBox.width / 2;
  assert.ok(Math.abs(groupCenter - dialogCenter) < 12, `${label}: group not centered`);
  assert.ok(first.x >= 0 && last.x + last.width <= dialogBox.x + dialogBox.width);
  if (boxes.length === 2) {
    assert.ok(first.x + first.width < last.x, `${label}: order or gap`);
    assert.ok(Math.abs(first.y - last.y) < 1, `${label}: buttons on separate rows`);
    assert.ok(Math.abs(first.height - last.height) < 1, `${label}: unequal heights`);
  }
  return { groupCenter, dialogCenter, heights: boxes.map((box) => box.height) };
}

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
    await page.goto("http://127.0.0.1:31016/centers/11111111-1111-4111-8111-111111111111/users");
    const row = page.getByRole("row", { name: /Ana Admin/ });
    const trigger = row.getByRole("button", { name: "Administrar acceso" });
    await trigger.click();
    const access = page.getByRole("dialog", { name: "Administrar acceso" });
    const cancel = access.getByRole("button", { name: "Cancelar" });
    const review = access.getByRole("button", { name: "Revisar cambios" });
    const accessLayout = await assertCenteredGroup(access, [cancel, review], `${name} access`);
    await page.screenshot({ path: resolve(output, `${name}-administrar-acceso.png`) });
    await expect(access.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(review).toBeFocused();
    assert.ok(
      Number.parseFloat(await review.evaluate((button) => getComputedStyle(button).outlineWidth)) >=
        2,
    );
    await page.keyboard.press("Tab");
    await expect(access.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await access.getByLabel("Rol en este centro").selectOption("RECEPTION");
    await review.click();
    const confirmation = access.getByRole("group", { name: "Confirmar cambio de acceso" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Volver a editar" }).click();
    await expect(access.getByLabel("Rol en este centro")).toHaveValue("RECEPTION");
    await cancel.click();
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(access.getByLabel("Rol en este centro")).toHaveValue("RECEPTION");
    await review.click();
    await confirmation.getByRole("button", { name: "Confirmar cambios" }).click();
    await expect(access).not.toBeVisible();
    await expect(trigger).toBeFocused();
    assert.equal(await page.evaluate(() => (window.__membershipUpdates || []).length), 1);

    await page.goto("http://127.0.0.1:31016/centers/11111111-1111-4111-8111-111111111111/patients");
    const registerTrigger = page.getByRole("button", { name: "Registrar paciente" });
    await registerTrigger.click();
    const registration = page.getByRole("dialog", { name: "Registrar paciente" });
    const resolveButton = registration.getByRole("button", { name: "Comprobar identidad" });
    const initialLayout = await assertCenteredGroup(
      registration,
      [resolveButton],
      `${name} identity`,
    );
    await page.screenshot({ path: resolve(output, `${name}-registrar-identidad.png`) });
    await expect(registration.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(resolveButton).toBeFocused();
    assert.ok(
      Number.parseFloat(
        await resolveButton.evaluate((button) => getComputedStyle(button).outlineWidth),
      ) >= 2,
    );
    await page.keyboard.press("Tab");
    await expect(registration.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await registration.getByLabel("Documento").fill("123");
    await registration.getByLabel("Fecha de nacimiento").fill("2000-01-02");
    await resolveButton.click();
    await expect(registration.getByText("2. Datos del nuevo paciente")).toBeVisible();
    await registration.getByLabel("Nombre", { exact: true }).fill("Ana");
    await registration.getByLabel("Apellido").fill("Paciente");
    await registration.getByLabel("Teléfono").fill("555");
    const reviewRegistration = registration.getByRole("button", { name: "Revisar alta" });
    await reviewRegistration.scrollIntoViewIfNeeded();
    const altaLayout = await assertCenteredGroup(
      registration,
      [reviewRegistration],
      `${name} alta`,
    );
    await page.screenshot({ path: resolve(output, `${name}-registrar-alta.png`) });
    await reviewRegistration.click();
    const confirmRegistration = registration.getByRole("button", { name: "Confirmar" });
    await expect(confirmRegistration).toBeVisible();
    const confirmLayout = await assertCenteredGroup(
      registration,
      [confirmRegistration],
      `${name} confirm`,
    );
    await confirmRegistration.click();
    await expect(registration).not.toBeVisible();
    assert.equal(await page.evaluate(() => (window.__patientCreates || []).length), 1);

    await registerTrigger.click();
    await registration.getByLabel("Documento").fill("999");
    await registration.getByRole("button", { name: "Cerrar" }).click();
    const discard = page.getByRole("dialog", { name: "Descartar cambios" });
    const continueEditing = discard.getByRole("button", { name: "Seguir editando" });
    const discardChanges = discard.getByRole("button", { name: "Descartar cambios" });
    const discardLayout = await assertCenteredGroup(
      discard,
      [continueEditing, discardChanges],
      `${name} discard`,
    );
    await page.screenshot({ path: resolve(output, `${name}-descartar-cambios.png`) });
    await expect(continueEditing).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(discardChanges).toBeFocused();
    assert.ok(
      Number.parseFloat(
        await discardChanges.evaluate((button) => getComputedStyle(button).outlineWidth),
      ) >= 2,
    );
    await page.keyboard.press("Tab");
    await expect(continueEditing).toBeFocused();
    await page.mouse.click(5, height / 2);
    await expect(discard).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(registration.getByLabel("Documento")).toHaveValue("999");
    await registration.getByRole("button", { name: "Cerrar" }).click();
    await continueEditing.click();
    await expect(registration.getByLabel("Documento")).toHaveValue("999");
    await registration.getByRole("button", { name: "Cerrar" }).click();
    await discardChanges.click();
    await expect(registration).not.toBeVisible();
    await expect(registerTrigger).toBeFocused();
    assert.equal(await page.evaluate(() => (window.__patientCreates || []).length), 1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    results.push({ name, accessLayout, initialLayout, altaLayout, confirmLayout, discardLayout });
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
