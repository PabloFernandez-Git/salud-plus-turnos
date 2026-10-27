// Local Chromium fixture for the real Crear turno and Reprogramar components.
// All data are synthetic; no Next.js or Supabase request is made.
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
const cache = resolve("node_modules/.cache/task030-iteration-2-visual");
const output = resolve(".harness/tasks/active/TASK-030/evidence-iteration-2");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(resolve(cache, "index.html"), '<div id="root"></div><script type="module" src="/entry.tsx"></script>');
writeFileSync(resolve(cache, "link.tsx"), "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}");
writeFileSync(resolve(cache, "navigation.ts"), "export function useRouter(){return {refresh(){},push(){}}}");
writeFileSync(resolve(cache, "appointment-actions.ts"), `
const specialtyId='33333333-3333-4333-8333-333333333333';
const professionalCenterId='44444444-4444-4444-8444-444444444444';
export async function listBookableSpecialtiesAction(){return {status:'SUCCESS',data:[{specialty_id:specialtyId,specialty_name:'Clínica médica'}]}}
export async function listBookableProfessionalsAction(){return {status:'SUCCESS',data:[{professional_center_id:professionalCenterId,professional_first_name:'Luisa',professional_last_name:'Vega',usual_appointment_duration_minutes:30}]}}
export async function searchAppointmentSlotsAction({localDate}){
  const data=Array.from({length:12},(_,index)=>{
    const localHour=9+Math.floor(index/2),localMinute=index%2?30:0;
    const nextHour=localHour+(localMinute?1:0),nextMinute=localMinute?0:30;
    const start=new Date(Date.UTC(2026,10,Number(localDate.slice(-2)),localHour+3,localMinute)).toISOString();
    const end=new Date(Date.UTC(2026,10,Number(localDate.slice(-2)),nextHour+3,nextMinute)).toISOString();
    const time=(hour,minute)=>String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
    return {starts_at:start,ends_at:end,local_date:localDate,local_start_time:time(localHour,localMinute),local_end_date:localDate,local_end_time:time(nextHour,nextMinute)};
  });
  return {status:'SUCCESS',data};
}
export async function getAppointmentAvailabilityAction(){return {status:'SUCCESS',data:{intervals:[]}}}
export async function searchAppointmentPatientsAction(){return {status:'SUCCESS',data:{rows:[],hasNext:false}}}
export async function createAppointmentAction(){return {status:'BUSINESS_ERROR',code:'SLOT_ALREADY_TAKEN'}}
export async function reconcileAppointmentCreateAction(){return {status:'SUCCESS',data:{kind:'INCONCLUSIVE'}}}
export async function rescheduleAppointmentAction(){return {status:'BUSINESS_ERROR',code:'SLOT_ALREADY_TAKEN'}}
export async function transitionAppointmentStatusAction(){return {status:'BUSINESS_ERROR',code:'INVALID_STATUS_TRANSITION'}}
export async function updateAppointmentNoteAction(){return {status:'SUCCESS',data:{appointment_id:'22222222-2222-4222-8222-222222222222',updated_at:'2026-10-27T12:00:00+00:00'}}}
`);
writeFileSync(resolve(cache, "entry.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {NewAppointmentScreen} from '@/modules/appointments/components/new-appointment-screen';
import {AppointmentDetailScreen} from '@/modules/appointments/components/appointment-detail-screen';
import '@/app/globals.css';
const centerId='11111111-1111-4111-8111-111111111111';
const specialtyId='33333333-3333-4333-8333-333333333333';
const professionalCenterId='44444444-4444-4444-8444-444444444444';
const detail={appointment_id:'22222222-2222-4222-8222-222222222222',starts_at:'2026-11-02T12:00:00+00:00',ends_at:'2026-11-02T12:30:00+00:00',updated_at:'2026-10-27T11:00:00+00:00',status:'PENDING',patient_first_name:'Ana',patient_last_name:'Paz',specialty_name:'Clínica médica',professional_center_id:professionalCenterId,professional_first_name:'Luisa',professional_last_name:'Vega',patient_center_id:'55555555-5555-4555-8555-555555555555',specialty_id:specialtyId,administrative_note:''};
createRoot(document.getElementById('root')!).render(location.search.includes('detail') ?
 <AppointmentDetailScreen centerId={centerId} centerName="Centro sintético" timezone="America/Argentina/Buenos_Aires" detail={{kind:'STAFF',appointment:detail}} outsideAvailability={false}/> :
 <NewAppointmentScreen centerId={centerId} centerName="Centro sintético" timezone="America/Argentina/Buenos_Aires" initialPatient={{patientCenterId:detail.patient_center_id,firstName:'Ana',lastName:'Paz'}} initialBooking={{specialtyId,professionalCenterId,localDate:'2026-11-03'}}/>
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
  server: { host: "127.0.0.1", port: 31031, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [name, width, height] of [["desktop-1440",1440,900],["mobile-390",390,844]]) {
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: "Pacific/Auckland" });
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:31031/");
    await expect(page.getByRole("heading", { name: "Crear turno" })).toBeVisible();
    await expect(page.getByRole("button", { name: "09:00–09:30" })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} create overflow`);
    await page.screenshot({ path: resolve(output, `${name}-create.png`), fullPage: true, animations: "disabled" });
    const dateTrigger = page.getByRole("button", { name: /Fecha local del centro/ });
    assert.equal(await dateTrigger.evaluate(element => getComputedStyle(element).cursor), "pointer");
    await dateTrigger.click();
    await expect(page.getByRole("group", { name: "Calendario" })).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-create-calendar.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "martes 3 de noviembre de 2026" }).press("Escape");
    const slot = page.getByRole("button", { name: "09:00–09:30" });
    assert.equal(await slot.evaluate(element => getComputedStyle(element).cursor), "pointer");
    await slot.click();
    await expect(slot).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("03/11/2026", { exact: true }).last()).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-create-selected.png`), fullPage: true, animations: "disabled" });

    await page.goto("http://127.0.0.1:31031/?detail");
    await expect(page.getByRole("link", { name: "Volver a turnos" })).toHaveAttribute("href", `/centers/11111111-1111-4111-8111-111111111111/appointments`);
    await expect(page.getByText("Nota vacía.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar nota" })).toHaveCount(0);
    await page.getByRole("button", { name: "Elegir nuevo horario" }).click();
    const modal = page.getByRole("dialog", { name: "Reprogramar turno" });
    await expect(modal.getByRole("button", { name: "09:00–09:30" })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} modal overflow`);
    await page.screenshot({ path: resolve(output, `${name}-reschedule.png`), animations: "disabled" });
    const lastSlot = modal.getByRole("button", { name: "14:30–15:00" });
    await lastSlot.click();
    await expect(lastSlot).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: resolve(output, `${name}-reschedule-selected.png`), animations: "disabled" });
    await modal.getByRole("button", { name: /Fecha local del centro/ }).click();
    await expect(modal.getByRole("group", { name: "Calendario" })).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-reschedule-calendar.png`), animations: "disabled" });
    assert.deepEqual(errors, []);
    results.push({ name, create: true, calendar: true, twelveSlots: true, reschedule: true, returnLink: true, emptyNote: true, pointer: true, overflow: false, pageErrors: 0 });
    await context.close();
  }
  writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log("TASK-030 iteration 2 visual PASS", JSON.stringify(results));
} finally {
  await browser?.close();
  await server.close();
}
