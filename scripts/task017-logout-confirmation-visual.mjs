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
const cache = resolve("node_modules/.cache/task017-logout-confirmation-visual");
const output = resolve("artifacts/task017-logout-confirmation");
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
export async function logoutAction() {
  window.__logoutCalls = (window.__logoutCalls || 0) + 1;
  if (window.__logoutMode === 'pending') {
    return await new Promise(resolve => { window.__finishLogout = resolve; });
  }
  if (window.__logoutMode === 'error') {
    return { status: 'error', message: 'No pudimos cerrar la sesión.' };
  }
  history.pushState({}, '', '/login');
  window.dispatchEvent(new Event('popstate'));
  return { status: 'success' };
}
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
  if (location.pathname === '/login') return <main><h1>Iniciar sesión</h1></main>;
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
  server: { host: "127.0.0.1", port: 31017, strictPort: true, fs: { allow: [root] } },
});

async function assertFocused(locator, label) {
  assert.equal(
    await locator.evaluate((element) => element === document.activeElement),
    true,
    label,
  );
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
    await page.goto("http://127.0.0.1:31017/centers/11111111-1111-4111-8111-111111111111");
    const trigger = page.getByRole("button", { name: "Cerrar sesión" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "¿Querés cerrar sesión?" });
    const cancel = dialog.getByRole("button", { name: "Cancelar" });
    const confirm = dialog.getByRole("button", { name: "Cerrar sesión" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Podés volver a ingresar a Salud Plus cuando quieras."),
    ).toBeVisible();
    await assertFocused(cancel, `${name} initial focus`);
    assert.equal(await page.evaluate(() => window.__logoutCalls || 0), 0);
    const dialogBox = await dialog.boundingBox();
    const cancelBox = await cancel.boundingBox();
    const confirmBox = await confirm.boundingBox();
    assert.ok(dialogBox && cancelBox && confirmBox);
    assert.ok(Math.abs(dialogBox.x + dialogBox.width / 2 - width / 2) < 2);
    assert.ok(Math.abs(dialogBox.y + dialogBox.height / 2 - height / 2) < 2);
    assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= width);
    assert.ok(Math.abs((cancelBox.x + confirmBox.x + confirmBox.width) / 2 - width / 2) < 2);
    assert.ok(cancelBox.x + cancelBox.width < confirmBox.x);
    assert.equal(cancelBox.height, confirmBox.height);
    assert.equal(cancelBox.height, 44);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: resolve(output, `${name}-confirmacion.png`) });
    await page.keyboard.press("Tab");
    await assertFocused(confirm, `${name} Tab to confirm`);
    assert.ok(
      Number.parseFloat(
        await confirm.evaluate((button) => getComputedStyle(button).outlineWidth),
      ) >= 2,
    );
    await page.keyboard.press("Tab");
    await assertFocused(cancel, `${name} Tab wrap to cancel`);
    await page.keyboard.press("Shift+Tab");
    await assertFocused(confirm, `${name} Shift+Tab wrap to confirm`);
    await cancel.click();
    await expect(dialog).not.toBeVisible();
    await assertFocused(trigger, `${name} Cancelar restores focus`);
    assert.equal(await page.evaluate(() => window.__logoutCalls || 0), 0);

    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await assertFocused(trigger, `${name} Escape restores focus`);
    await trigger.click();
    await page.mouse.click(5, height / 2);
    await expect(dialog).not.toBeVisible();
    await assertFocused(trigger, `${name} backdrop restores focus`);
    assert.equal(await page.evaluate(() => window.__logoutCalls || 0), 0);

    await page.evaluate(() => {
      window.__logoutMode = "pending";
    });
    await trigger.click();
    await confirm.click();
    await expect(dialog.getByRole("button", { name: "Cerrando sesión…" })).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await page.evaluate(() => document.querySelector("dialog form").requestSubmit());
    await page.keyboard.press("Escape");
    await page.mouse.click(5, height / 2);
    await expect(dialog).toBeVisible();
    assert.equal(await page.evaluate(() => window.__logoutCalls || 0), 1);
    await page.evaluate(() =>
      window.__finishLogout({ status: "error", message: "No pudimos cerrar la sesión." }),
    );
    await expect(dialog.getByRole("alert")).toHaveText("No pudimos cerrar la sesión.");
    await expect(dialog).toBeVisible();
    await expect(confirm).toBeEnabled();
    assert.ok(page.url().endsWith("/centers/11111111-1111-4111-8111-111111111111"));
    await page.screenshot({ path: resolve(output, `${name}-error.png`) });
    await cancel.click();
    await assertFocused(trigger, `${name} error Cancelar restores focus`);
    await trigger.click();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await page.evaluate(() => {
      window.__logoutMode = "success";
    });
    await confirm.click();
    await expect(page).toHaveURL("http://127.0.0.1:31017/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    assert.equal(await page.evaluate(() => window.__logoutCalls || 0), 2);
    results.push({
      name,
      dialogWidth: dialogBox.width,
      buttonsHeight: cancelBox.height,
      callsBeforeConfirm: 0,
      callsAfterConfirm: 2,
      overflow: false,
    });
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
