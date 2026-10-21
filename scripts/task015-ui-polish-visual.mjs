// Local visual verification with synthetic props. No Supabase or application server requests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const root = resolve(".");
const cache = resolve("node_modules/.cache/task015-ui-polish-visual");
const output = resolve("artifacts/task015-ui-polish");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
mkdirSync(resolve(cache, "public"), { recursive: true });
copyFileSync(resolve("src/app/icon.svg"), resolve(cache, "public/icon.svg"));

writeFileSync(
  resolve(cache, "index.html"),
  '<link rel="icon" type="image/svg+xml" href="/icon.svg"><div id="root"></div><script type="module" src="/entry.tsx"></script>',
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
  server: { host: "127.0.0.1", port: 31015, strictPort: true, fs: { allow: [root] } },
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
    await page.goto("http://127.0.0.1:31015/centers/11111111-1111-4111-8111-111111111111/patients");
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/icon.svg");
    const faviconResponse = await page.request.get("http://127.0.0.1:31015/icon.svg");
    assert.equal(faviconResponse.status(), 200);
    assert.match(faviconResponse.headers()["content-type"], /image\/svg\+xml/);
    assert.match(await faviconResponse.text(), /#0369a1/);
    const iconSize = await page.evaluate(async () => {
      const icon = document.querySelector('link[rel="icon"]');
      const image = new Image();
      image.src = icon.href;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    });
    assert.deepEqual(iconSize, [64, 64]);
    const description = page.getByText(
      "Consultá y administrá los pacientes de este centro, registrá nuevos pacientes y mantené actualizados sus datos administrativos.",
    );
    const trigger = page.getByRole("button", { name: "Registrar paciente" });
    await expect(description).toBeVisible();
    await expect(trigger).toBeVisible();
    const descriptionBox = await description.boundingBox();
    const triggerBox = await trigger.boundingBox();
    assert.ok(descriptionBox && triggerBox);
    if (width === 1440) assert.ok(descriptionBox.height <= 24, "description should fit one line");
    assert.ok(triggerBox.x >= 0 && triggerBox.x + triggerBox.width <= width);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: resolve(output, `${name}-pacientes.png`), fullPage: true });

    await trigger.click();
    const registration = page.getByRole("dialog", { name: "Registrar paciente" });
    await expect(registration.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await registration.getByLabel("Documento").fill("123");
    await registration.getByLabel("Fecha de nacimiento").fill("2000-01-02");
    await registration.getByRole("button", { name: "Cerrar" }).click();
    const discard = page.getByRole("dialog", { name: "Descartar cambios" });
    await expect(discard).toBeVisible();
    await expect(discard.getByRole("heading", { name: "¿Descartar cambios?" })).toBeVisible();
    await expect(discard).toHaveAttribute("aria-describedby", "patient-discard-description");
    await expect(
      discard.getByText("Hay datos sin guardar. Si salís ahora, perderás los cambios realizados."),
    ).toBeVisible();
    const follow = discard.getByRole("button", { name: "Seguir editando" });
    const confirm = discard.getByRole("button", { name: "Descartar cambios" });
    await expect(follow).toBeFocused();
    const modalBox = await discard.boundingBox();
    const followBox = await follow.boundingBox();
    const confirmBox = await confirm.boundingBox();
    assert.ok(modalBox && followBox && confirmBox);
    assert.ok(Math.abs(modalBox.y + modalBox.height / 2 - height / 2) < 2);
    assert.ok(modalBox.x >= 0 && modalBox.x + modalBox.width <= width);
    if (width === 1440) assert.ok(modalBox.width >= 420 && modalBox.width <= 480);
    assert.ok(Math.abs(followBox.y - confirmBox.y) < 1);
    assert.ok(Math.abs(followBox.height - confirmBox.height) < 1);
    assert.ok(followBox.x + followBox.width < confirmBox.x);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: resolve(output, `${name}-descartar-cambios.png`) });
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(follow).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirm).toBeFocused();
    await page.mouse.click(5, height / 2);
    await expect(discard).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(registration).toBeVisible();
    await expect(registration.getByLabel("Documento")).toHaveValue("123");
    await registration.getByRole("button", { name: "Cerrar" }).click();
    await follow.click();
    await expect(registration.getByLabel("Fecha de nacimiento")).toHaveValue("2000-01-02");
    await registration.getByRole("button", { name: "Cerrar" }).click();
    await confirm.click();
    await expect(registration).not.toBeVisible();
    await expect(trigger).toBeFocused();
    assert.equal(await page.evaluate(() => (window.__patientCreates || []).length), 0);
    results.push({
      name,
      descriptionHeight: descriptionBox.height,
      dialogWidth: modalBox.width,
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
