// Render the real Turnos components with synthetic, local data only.
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
const cache = resolve("node_modules/.cache/task030-visual");
const output = resolve(".harness/tasks/active/TASK-030/evidence");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(resolve(cache, "index.html"), '<div id="root"></div><script type="module" src="/entry.tsx"></script>');
writeFileSync(resolve(cache, "link.tsx"), "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}");
writeFileSync(resolve(cache, "navigation.ts"), "export function useRouter(){return {refresh(){}}}");
writeFileSync(resolve(cache, "appointment-actions.ts"), `
const centerId = '11111111-1111-4111-8111-111111111111';
const specialtyId = '33333333-3333-4333-8333-333333333333';
const professionalCenterId = '44444444-4444-4444-8444-444444444444';
export async function listBookableSpecialtiesAction(){return {status:'SUCCESS',data:[{specialty_id:specialtyId,specialty_name:'Clínica médica'}]}}
export async function listBookableProfessionalsAction(){return {status:'SUCCESS',data:[{professional_center_id:professionalCenterId,professional_first_name:'Luisa',professional_last_name:'Vega',usual_appointment_duration_minutes:30}]}}
export async function searchAppointmentSlotsAction(){return {status:'SUCCESS',data:[{starts_at:'2026-11-03T13:00:00+00:00',ends_at:'2026-11-03T13:30:00+00:00',local_date:'2026-11-03',local_start_time:'10:00',local_end_date:'2026-11-03',local_end_time:'10:30'}]}}
export async function getAppointmentAvailabilityAction(){return {status:'SUCCESS',data:{intervals:[]}}}
export async function rescheduleAppointmentAction(){return {status:'BUSINESS_ERROR',code:'SLOT_ALREADY_TAKEN'}}
export async function transitionAppointmentStatusAction(){return {status:'BUSINESS_ERROR',code:'INVALID_STATUS_TRANSITION'}}
export async function updateAppointmentNoteAction(){return {status:'SUCCESS',data:{appointment_id:'22222222-2222-4222-8222-222222222222',updated_at:'2026-10-27T12:00:00+00:00'}}}
`);
writeFileSync(resolve(cache, "entry.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppointmentsList} from '@/modules/appointments/components/appointments-list';
import {AppointmentDetailScreen} from '@/modules/appointments/components/appointment-detail-screen';
import '@/app/globals.css';
const centerId='11111111-1111-4111-8111-111111111111';
const base={appointment_id:'22222222-2222-4222-8222-222222222222',starts_at:'2026-11-02T12:00:00+00:00',ends_at:'2026-11-02T12:30:00+00:00',updated_at:'2026-10-27T11:00:00+00:00',patient_first_name:'Ana',patient_last_name:'Paz',specialty_name:'Clínica médica',professional_center_id:'44444444-4444-4444-8444-444444444444',professional_first_name:'Luisa',professional_last_name:'Vega'};
const rows=['PENDING','CONFIRMED','ATTENDED','NO_SHOW','CANCELLED'].map((status,i)=>({...base,appointment_id:String(i+2).padStart(8,'0')+'-2222-4222-8222-222222222222',patient_first_name:['Ana','Bruno','Carla','Diego','Elena'][i],status,has_more:false}));
const detail={...base,status:'PENDING',patient_center_id:'55555555-5555-4555-8555-555555555555',specialty_id:'33333333-3333-4333-8333-333333333333',administrative_note:'Confirmar cobertura al llegar.'};
createRoot(document.getElementById('root')!).render(location.search.includes('detail') ?
 <AppointmentDetailScreen centerId={centerId} centerName="Centro sintético" timezone="America/Argentina/Buenos_Aires" detail={{kind:'STAFF',appointment:detail}} outsideAvailability={false}/> :
 <AppointmentsList centerId={centerId} centerName="Centro sintético" timezone="America/Argentina/Buenos_Aires" today="2026-10-27" role="ADMIN" filters={{fromDate:'2026-10-27',toDate:'2026-11-26'}} result={{kind:'STAFF',rows,hasMore:false,nextCursor:null}} loadFailed={false} professionals={[{id:base.professional_center_id,firstName:'Luisa',lastName:'Vega',usualAppointmentDurationMinutes:30,updatedAt:'u'}]}/>
);
`);
const server = await createServer({
  configFile: false, root: cache, envDir: cache, css: { postcss: root },
  resolve: { dedupe: ["react", "react-dom"], alias: [
    { find: "next/link", replacement: resolve(cache, "link.tsx") },
    { find: "next/navigation", replacement: resolve(cache, "navigation.ts") },
    { find: "../actions/appointment-actions", replacement: resolve(cache, "appointment-actions.ts") },
    { find: "@", replacement: resolve("src") },
  ] },
  server: { host: "127.0.0.1", port: 31030, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [name, width, height] of [["desktop-1440",1440,900],["mobile-390",390,844]]) {
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: "America/Argentina/Buenos_Aires" });
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:31030/");
    await expect(page.getByRole("heading", { name: "Turnos", exact: true })).toBeVisible();
    await expect(page.getByText("02/11/2026 · 09:00–09:30").first()).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} list overflow`);
    await page.screenshot({ path: resolve(output, `${name}-list.png`), fullPage: true, animations: "disabled" });
    await page.goto("http://127.0.0.1:31030/?detail");
    await expect(page.getByRole("heading", { name: "Detalle del turno" })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} detail overflow`);
    await page.screenshot({ path: resolve(output, `${name}-detail.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Editar nota" }).click();
    await page.getByRole("textbox", { name: "Editar nota" }).fill("Texto sin guardar");
    await page.screenshot({ path: resolve(output, `${name}-note-edit.png`), fullPage: true, animations: "disabled" });
    let discardPrompts = 0;
    page.on("dialog", dialog => discardPrompts++ === 0 ? dialog.dismiss() : dialog.accept());
    await page.getByRole("button", { name: "Cancelar edición" }).click();
    await expect(page.getByRole("textbox", { name: "Editar nota" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar edición" }).click();
    await expect(page.getByRole("textbox", { name: "Editar nota" })).toHaveCount(0);
    await page.getByRole("button", { name: "Elegir nuevo horario" }).click();
    const modal = page.getByRole("dialog", { name: "Reprogramar turno" });
    await expect(modal).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-reschedule.png`), animations: "disabled" });
    await modal.getByLabel("Fecha local del centro").fill("2026-11-03");
    await modal.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("dialog", { name: "¿Descartar cambios?" }).getByRole("heading", { name: "¿Descartar cambios?" })).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-discard.png`), animations: "disabled" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} modal overflow`);
    assert.deepEqual(errors, []);
    results.push({ name, list: true, detail: true, noteEdit: true, modal: true, discard: true, overflow: false, pageErrors: 0 });
    await context.close();
  }
  writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log("TASK-030 visual PASS", JSON.stringify(results));
} finally {
  await browser?.close();
  await server.close();
}
