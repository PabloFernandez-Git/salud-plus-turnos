// Local Chromium check with synthetic RPC contract data. No Supabase or Next server requests.
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
const cache = resolve("node_modules/.cache/task023-dashboard-visual");
const output = resolve("artifacts/task023-ux/dashboard");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  `
const router = { refresh() { window.__routerRefresh = (window.__routerRefresh || 0) + 1; } };
export function useRouter() { return router; }
export function usePathname() { return location.pathname; }
`,
);
writeFileSync(
  resolve(cache, "link.tsx"),
  `
import React from 'react';
export default function Link({href, children, ...props}) { return <a {...props} href={href}>{children}</a>; }
`,
);
writeFileSync(
  resolve(cache, "dashboard-actions.ts"),
  `
const id = '33333333-3333-4333-8333-333333333333';
export async function refreshDailyDashboardAction() {
  window.__dashboardReads = (window.__dashboardReads || 0) + 1;
  if (window.__dashboardMode === 'error') return { status: 'error', message: 'fallo sintético' };
  const empty = window.__dashboardMode === 'empty';
  return { status: 'success', data: {
    scope: 'staff', role: 'ADMIN', membershipId: 'membership-a', activeTotal: empty ? 0 : 7,
    toAttend: empty ? 0 : 3,
    row: { as_of: '2026-11-01T05:20:00+00:00', local_date: '2026-11-01',
      timezone: 'America/New_York', pending_count: empty ? 0 : 2,
      confirmed_count: empty ? 0 : 1, attended_count: empty ? 0 : 3,
      no_show_count: empty ? 0 : 1, cancelled_count: 2,
      professional_centers_with_appointments_count: empty ? 0 : 2,
      upcoming: empty ? [] : [{ appointment_id: id, starts_at: '2026-11-01T06:30:00+00:00',
        ends_at: '2026-11-01T07:00:00+00:00', status: 'PENDING',
        patient_first_name: 'Eva', patient_last_name: 'López', specialty_name: 'Clínica médica',
        professional_center_id: '44444444-4444-4444-8444-444444444444',
        professional_first_name: 'Ana', professional_last_name: 'García' }] }
  } };
}
`,
);
writeFileSync(
  resolve(cache, "auth-actions.ts"),
  `export async function logoutAction() { return { status: 'error', message: 'Vista local' }; }`,
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CenterHeader } from '@/modules/access/components/center-header';
import { CenterDashboard } from '@/modules/access/components/center-dashboard';
import '@/app/globals.css';
const centerId = '11111111-1111-4111-8111-111111111111';
const user = { id: '22222222-2222-4222-8222-222222222222',
  firstName: 'Pablo', lastName: 'Fernández', email: 'pablo@example.test' };
createRoot(document.getElementById('root')).render(<div className="min-h-screen bg-slate-100/80">
  <CenterHeader centerId={centerId} centerName="Centro Médico Salud Plus" user={user} role="ADMIN" />
  <CenterDashboard centerId={centerId} membershipId="membership-a" role="ADMIN" />
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
      {
        find: "../actions/daily-dashboard-actions",
        replacement: resolve(cache, "dashboard-actions.ts"),
      },
      { find: "../actions/auth-actions", replacement: resolve(cache, "auth-actions.ts") },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31023, strictPort: true, fs: { allow: [root] } },
});
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
    await page.goto("http://127.0.0.1:31023/centers/11111111-1111-4111-8111-111111111111");
    await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
    assert.equal(await page.getByText("¿Qué querés hacer hoy?").count(), 0);
    assert.equal(await page.getByText("Elegí un módulo para empezar.").count(), 0);
    await expect(page.getByRole("heading", { name: "Operación diaria" })).toBeVisible();
    await expect(page.getByText(/Profesionales con turnos hoy/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Agenda" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Turnos" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Eva López/ })).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${name} overflow`,
    );
    await page.screenshot({
      path: resolve(output, `${name}-activity.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.evaluate(() => {
      window.__dashboardMode = "error";
    });
    await page.getByRole("button", { name: "Actualizar" }).click();
    await expect(page.getByRole("alert")).toContainText("No pudimos cargar la actividad");
    await expect(page.getByRole("link", { name: "Agenda" })).toBeVisible();
    await page.screenshot({
      path: resolve(output, `${name}-error.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.evaluate(() => {
      window.__dashboardMode = "empty";
    });
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("No hay turnos vigentes para hoy.")).toBeVisible();
    await page.screenshot({
      path: resolve(output, `${name}-empty.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() => document.activeElement?.matches(":focus-visible")),
      `${name} focus visible`,
    );
    await context.close();
  }
  console.log("TASK-023 Dashboard Chromium synthetic 1440/390 PASS; screenshots:", output);
} finally {
  await browser?.close();
  await server.close();
}
