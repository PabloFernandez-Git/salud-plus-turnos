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
const cache = resolve("node_modules/.cache/task010-visual");
const output = resolve("artifacts/task010-gestion-usuarios");
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
export function useRouter() { return { refresh() {}, replace: navigate, push: navigate }; }
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
export async function updateCenterMembershipAction() {
  return { status: 'error', message: 'La vista local no modifica accesos.' };
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
  role: 'ADMIN', isActive: true, professional: null }];

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
          manageableProfessionalCenters={[]} professionalCenters={[]} users={users} />
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
  server: { host: "127.0.0.1", port: 31010, strictPort: true, fs: { allow: [root] } },
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
    await page.goto("http://127.0.0.1:31010");
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
    await expect(page.getByRole("button", { name: "Administrar acceso" })).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${name} users screen has horizontal overflow`,
    );
    await page.screenshot({ path: resolve(output, `${name}-usuarios.png`), fullPage: true });
    await page.getByRole("button", { name: "Administrar acceso" }).click();
    await expect(page.getByRole("heading", { name: "Administrar acceso" })).toBeVisible();
    await expect(page.getByLabel("Rol en este centro")).toHaveValue("ADMIN");
    await expect(page.getByLabel("Estado del acceso")).toHaveValue("active");
    await page.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Agregar usuario" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
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
    results.push({ name, width, hasOverflow, navigation: "ok", addUser: "ok" });
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
