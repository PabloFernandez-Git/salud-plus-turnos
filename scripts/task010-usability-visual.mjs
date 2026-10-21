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
const cache = resolve("node_modules/.cache/task010-usability-visual");
const output = resolve("artifacts/task010-usability");
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
  resolve(cache, "entry.tsx"),
  `
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CenterHeader } from '@/modules/access/components/center-header';
import { CenterDashboard } from '@/modules/access/components/center-dashboard';
import { CenterUsersScreen } from '@/modules/access/components/center-users-screen';
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
  return <div className="min-h-screen bg-slate-100/80">
    <CenterHeader centerId={centerId} centerName="Centro Médico Salud Plus" user={user} role="ADMIN" />
    {onUsers
      ? <CenterUsersScreen actorUserId={user.id} centerId={centerId}
          centerName="Centro Médico Salud Plus" loadFailed={false}
          manageableProfessionalCenters={professionals} professionalCenters={professionals} users={users} />
      : <CenterDashboard centerId={centerId} role="ADMIN" />}
  </div>;
}
history.replaceState({}, '', base);
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
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31011, strictPort: true, fs: { allow: [root] } },
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
    await page.goto("http://127.0.0.1:31011");
    await expect(page.getByRole("link", { name: "Gestión de usuarios" })).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-dashboard.png`), fullPage: true });
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
    const rowBefore = await row.boundingBox();
    assert.ok(rowBefore);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${name} users screen has horizontal overflow`,
    );
    await page.screenshot({ path: resolve(output, `${name}-listado.png`), fullPage: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Administrar acceso" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await expect(dialog.getByText("Ana Admin")).toBeVisible();
    await expect(
      dialog.getByText("ana.administracion.de.consultorio.con.direccion.extensa@example.test"),
    ).toBeVisible();
    await expect(dialog.getByLabel("Rol en este centro")).toHaveValue("ADMIN");
    await expect(dialog.getByLabel("Estado del acceso")).toHaveValue("active");
    const rowOpen = await row.boundingBox();
    assert.ok(rowOpen);
    assert.ok(Math.abs(rowOpen.height - rowBefore.height) < 2, `${name} table row expanded`);
    const modalBox = await dialog.boundingBox();
    assert.ok(modalBox);
    assert.ok(modalBox.x >= 0 && modalBox.x + modalBox.width <= width, `${name} modal overflows`);
    assert.equal(
      await dialog.evaluate((element) => element.scrollWidth > element.clientWidth),
      false,
      `${name} long identity overflows the modal`,
    );
    assert.ok(
      Math.abs(modalBox.y + modalBox.height / 2 - height / 2) < 2,
      `${name} modal is not centered`,
    );
    await page.screenshot({ path: resolve(output, `${name}-modal.png`) });
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Rol en este centro")).toBeFocused();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByLabel("Rol en este centro").selectOption("PROFESSIONAL");
    await expect(dialog.getByLabel("Profesional asociado")).toBeVisible();
    await dialog.getByLabel("Rol en este centro").selectOption("RECEPTION");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(dialog.getByLabel("Rol en este centro")).toHaveValue("RECEPTION");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(dialog).not.toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.__membershipUpdates || []), []);
    await trigger.click();
    await dialog.getByLabel("Rol en este centro").selectOption("RECEPTION");
    await dialog.getByLabel("Estado del acceso").selectOption("inactive");
    await dialog.getByRole("button", { name: "Revisar cambios" }).click();
    const confirmation = dialog.getByRole("group", { name: "Confirmar cambio de acceso" });
    await expect(confirmation).toContainText("Ana Admin");
    await expect(confirmation).toContainText("Nuevo rol: Recepción");
    await confirmation.getByRole("button", { name: "Volver a editar" }).click();
    await expect(confirmation).not.toBeVisible();
    await dialog.getByRole("button", { name: "Revisar cambios" }).click();
    await confirmation.getByRole("button", { name: "Confirmar cambios" }).click();
    await expect(dialog).not.toBeVisible();
    const update = await page.evaluate(() => ({
      updates: window.__membershipUpdates || [],
      refreshCount: window.__refreshCount || 0,
    }));
    assert.equal(update.updates.length, 1);
    assert.equal(update.updates[0].role, "RECEPTION");
    assert.equal(update.updates[0].isActive, "false");
    assert.equal(update.refreshCount, 1);
    await page.getByRole("button", { name: "Agregar usuario" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
    const emailBox = await page.getByLabel("Email").boundingBox();
    const continueBox = await page.getByRole("button", { name: "Continuar" }).boundingBox();
    assert.ok(emailBox && continueBox);
    assert.ok(Math.abs(emailBox.height - continueBox.height) < 1, `${name} control heights differ`);
    if (width === 1440) {
      assert.ok(emailBox.x + emailBox.width < continueBox.x, "desktop controls are not inline");
      assert.ok(Math.abs(emailBox.y - continueBox.y) < 1, "desktop controls are not aligned");
    } else {
      assert.ok(emailBox.y + emailBox.height < continueBox.y, "mobile controls are not stacked");
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${name} add-user form has horizontal overflow`,
    );
    await page.screenshot({ path: resolve(output, `${name}-agregar-usuario.png`), fullPage: true });
    await page.getByLabel("Email").fill("nuevo@example.test");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel("Rol")).toBeVisible();
    await expect(page.getByLabel("Contraseña inicial")).toBeVisible();
    await page.getByRole("link", { name: "Inicio", exact: true }).click();
    await expect(page.getByRole("link", { name: "Gestión de usuarios" })).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(hasOverflow, false, `${name} has horizontal overflow`);
    results.push({
      name,
      width,
      hasOverflow,
      rowHeight: rowBefore.height,
      modal: "ok",
      addUser: "ok",
    });
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
