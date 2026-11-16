// Isolated localhost preview of the real TASK-038 components with synthetic props.
// No Next server, Supabase credentials, or database requests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const root = resolve(".");
const cache = resolve("node_modules/.cache/task038-visual");
const output = resolve("artifacts/task038-visual");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });

writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  `export function useRouter() { return { refresh() {}, push(path) { location.href = path; } }; }`,
);
writeFileSync(
  resolve(cache, "link.tsx"),
  `import React from 'react'; export default function Link({href, children, ...props}) { return <a href={href} {...props}>{children}</a>; }`,
);
writeFileSync(
  resolve(cache, "actions.ts"),
  `const unavailable = { status: 'error', message: 'Vista sintética: no se guardan cambios.' };
export async function createAvailabilityAction() { return unavailable; }
export async function updateAvailabilityAction() { return unavailable; }
export async function deactivateAvailabilityAction() { return unavailable; }
export async function updateAppointmentDurationAction() { return unavailable; }
export async function previewAvailabilityBlockAction() {
  return { status: 'success', affectedCount: 1, message: 'Un turno afectado.' };
}
export async function createAvailabilityBlockAction() { return unavailable; }
export async function deactivateAvailabilityBlockAction() { return unavailable; }`,
);
writeFileSync(resolve(cache, "booking.tsx"), `export function BookingSelector() { return null; }`);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `import React from 'react';
import {createRoot} from 'react-dom/client';
import {AvailabilityScreen} from '@/modules/availability/components/availability-screen';
import {AgendaCalendar} from '@/modules/agenda/components/agenda-calendar';
import '@/app/globals.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/modules/agenda/components/agenda-calendar.css';
window.React = React;
const centerId = '11111111-1111-4111-8111-111111111111';
const professional = {id:'22222222-2222-4222-8222-222222222222', firstName:'Ana',
  lastName:'Pérez', usualAppointmentDurationMinutes:30, updatedAt:'2026-11-01T12:00:00Z'};
const intervals = [1,2,3,4,5].map((weekday) => ({id:'33333333-3333-4333-8333-33333333333'+weekday,
  weekday, startTime:'09:00', endTime:'17:00', updatedAt:'2026-11-01T12:00:00Z'}));
const blocks = [
  {id:'44444444-4444-4444-8444-444444444444', professionalCenterId:professional.id,
    startDate:'2026-11-18', endDate:'2026-11-19', reason:'VACATION', updatedAt:'2026-11-01T12:00:00Z'},
  {id:'55555555-5555-4555-8555-555555555555', professionalCenterId:professional.id,
    startDate:'2026-11-21', endDate:'2026-11-21', reason:'OTHER', updatedAt:'2026-11-01T12:00:00Z'},
  {id:'88888888-8888-4888-8888-888888888888', professionalCenterId:professional.id,
    startDate:'2026-11-24', endDate:'2026-11-26', reason:'ABSENCE', updatedAt:'2026-11-01T12:00:00Z'},
  {id:'99999999-9999-4999-8999-999999999999', professionalCenterId:professional.id,
    startDate:'2026-11-30', endDate:'2026-11-30', reason:'HOLIDAY', updatedAt:'2026-11-01T12:00:00Z'},
];
const day = '2026-11-18';
const view = new URLSearchParams(location.search).get('view') || 'day';
const agenda = location.pathname === '/agenda';
createRoot(document.getElementById('root')).render(<div className="min-h-screen bg-slate-100">
  <div className="mx-auto max-w-[1400px] px-5 pt-5 text-sm text-slate-700 sm:px-8">
    Vista sintética local · <a className="font-semibold text-sky-800 underline" href="/">Disponibilidad</a>
    {' · '}<a className="font-semibold text-sky-800 underline" href="/agenda?view=day">Agenda</a>
  </div>
  {agenda ? <AgendaCalendar centerId={centerId} centerName="Centro de prueba local"
    timezone="UTC" today={day} role="ADMIN" filters={{date:day,view}}
    appointments={[{id:'66666666-6666-4666-8666-666666666666', startsAt:'2026-11-18T09:00:00Z',
      endsAt:'2026-11-18T09:30:00Z', status:'PENDING', patientName:'Paciente de prueba',
      specialtyName:'Clínica médica', professionalCenterId:professional.id,
      professionalName:'Ana Pérez'}]}
    blocks={blocks} professionals={[professional]}
    specialties={[{specialty_id:'77777777-7777-4777-8777-777777777777', specialty_name:'Clínica médica'}]}
    loadFailed={false} />
  : <AvailabilityScreen centerId={centerId} centerName="Centro de prueba local" timezone="UTC"
    today="2026-11-16" professional={professional} intervals={intervals} blocks={blocks}
    canEdit={true} canViewProfessionals={true} />}
</div>);`,
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
      { find: "../actions/availability-actions", replacement: resolve(cache, "actions.ts") },
      { find: "../actions/availability-block-actions", replacement: resolve(cache, "actions.ts") },
      {
        find: "@/modules/appointments/components/booking-selector",
        replacement: resolve(cache, "booking.tsx"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31038, strictPort: true, fs: { allow: [root] } },
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [label, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: "UTC" });
    const blocked = [];
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
      blocked.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:31038/");
    await page.getByRole("heading", { name: "Bloqueos excepcionales" }).waitFor();
    await page.screenshot({ path: resolve(output, `${label}-availability.png`), fullPage: true });
    await page.getByRole("button", { name: "Agregar bloqueo" }).click();
    const addDialog = page.getByRole("dialog", { name: "Agregar bloqueo" });
    await addDialog.waitFor();
    await page.getByRole("button", { name: "Revisar turnos afectados" }).click();
    await page.getByText("1 turno reservado afectado.").waitFor();
    const addBounds = await addDialog.boundingBox();
    assert(addBounds && addBounds.x >= 0 && addBounds.x + addBounds.width <= width);
    assert(addBounds.y >= 0 && addBounds.y + addBounds.height <= height);
    await page.screenshot({ path: resolve(output, `${label}-block-dialog.png`), fullPage: true });
    await page.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Quitar" }).first().click();
    const removeDialog = page.getByRole("dialog", { name: "Quitar bloqueo" });
    await removeDialog.waitFor();
    const removeBounds = await removeDialog.boundingBox();
    assert(removeBounds && removeBounds.x >= 0 && removeBounds.x + removeBounds.width <= width);
    assert(removeBounds.y >= 0 && removeBounds.y + removeBounds.height <= height);
    await page.screenshot({ path: resolve(output, `${label}-remove-dialog.png`), fullPage: true });
    for (const view of ["day", "week", "month"]) {
      await page.goto(`http://127.0.0.1:31038/agenda?view=${view}`);
      const period = {
        day: "miércoles, 18 de noviembre de 2026",
        week: "Semana del 16 al 22 de noviembre de 2026",
        month: "Noviembre de 2026",
      }[view];
      await page.getByText(period, { exact: true }).waitFor();
      const notice = page.getByLabel("Bloqueos excepcionales");
      await notice.waitFor();
      assert.equal(await notice.locator("li").count(), { day: 1, week: 2, month: 4 }[view]);
      const noticeBounds = await notice.boundingBox();
      assert(noticeBounds && noticeBounds.x >= 0 && noticeBounds.x + noticeBounds.width <= width);
      await notice.screenshot({ path: resolve(output, `${label}-agenda-notice-${view}.png`) });
      await page.screenshot({
        path: resolve(output, `${label}-agenda-${view}.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("TASK-038 synthetic visual preview: PASS; localhost:31038; screenshots:", output);
  if (process.argv.includes("--serve")) {
    await browser.close();
    browser = null;
    console.log("Serving synthetic preview at http://127.0.0.1:31038 (Ctrl+C to stop)");
    await new Promise(() => {});
  }
} finally {
  await browser?.close();
  await server.close();
}
