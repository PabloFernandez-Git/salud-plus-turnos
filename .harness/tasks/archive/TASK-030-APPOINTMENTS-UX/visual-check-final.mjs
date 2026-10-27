// Local Chromium fixture for the three final visual adjustments. Synthetic data only.
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
const cache = resolve("node_modules/.cache/task030-final-visual");
const output = resolve(".harness/tasks/active/TASK-030/evidence-final");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(resolve(cache, "index.html"), '<div id="root"></div><script type="module" src="/entry.tsx"></script>');
writeFileSync(resolve(cache, "link.tsx"), "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}");
writeFileSync(resolve(cache, "navigation.ts"), "export function useRouter(){return {refresh(){}}}");
writeFileSync(resolve(cache, "appointment-actions.ts"), `
export async function listBookableSpecialtiesAction(){return {status:'SUCCESS',data:[]}}
export async function listBookableProfessionalsAction(){return {status:'SUCCESS',data:[]}}
export async function searchAppointmentSlotsAction(){return {status:'SUCCESS',data:[]}}
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
const base={appointment_id:'22222222-2222-4222-8222-222222222222',starts_at:'2026-11-02T12:00:00+00:00',ends_at:'2026-11-02T12:30:00+00:00',updated_at:'2026-10-27T11:00:00+00:00',patient_first_name:'Ana',patient_last_name:'Paz',specialty_name:'Clínica médica'};
const params=new URLSearchParams(location.search);
const view=params.get('view')||'list';
const status=view==='three'?'CONFIRMED':'PENDING';
const note=view==='empty-null'||view==='three'?null:view==='empty-string'?'':'Confirmar cobertura al llegar.';
const appointment={...base,status,patient_center_id:'55555555-5555-4555-8555-555555555555',professional_center_id:'44444444-4444-4444-8444-444444444444',specialty_id:'33333333-3333-4333-8333-333333333333',professional_first_name:'Luisa',professional_last_name:'Vega',administrative_note:note};
createRoot(document.getElementById('root')!).render(view==='list' ?
 <AppointmentsList centerId={centerId} centerName="Centro sintético" timezone="America/Argentina/Buenos_Aires" today="2026-10-27" role="ADMIN" filters={{fromDate:'2026-10-27',toDate:'2026-11-26'}} result={{kind:'STAFF',rows:[{...base,...appointment,has_more:false}],hasMore:false,nextCursor:null}} loadFailed={false} professionals={[]}/> :
 <AppointmentDetailScreen centerId={centerId} centerName="Centro sintético" timezone="America/Argentina/Buenos_Aires" detail={view==='professional'?{kind:'PROFESSIONAL',appointment:{...base,status:'PENDING'}}:{kind:'STAFF',appointment}} outsideAvailability={false}/>
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
  server: { host: "127.0.0.1", port: 31033, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [name, width, height] of [["desktop-1440",1440,900],["mobile-390",390,844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const open = view => page.goto(`http://127.0.0.1:31033/?view=${view}`);
    await open("list");
    const upcoming = page.getByRole("link", {name:"Próximos turnos"});
    const recent = page.getByRole("link", {name:"Últimos 30 días, incluidos cancelados"});
    await expect(upcoming).toHaveAttribute("aria-current", "true");
    if (width===390) {
      const a=await upcoming.boundingBox(),b=await recent.boundingBox();
      assert.ok(a&&b&&Math.abs(a.width-b.width)<1&&Math.abs(a.x-b.x)<1&&b.y>a.y,"unequal mobile quick links");
    }
    await page.screenshot({path:resolve(output,`${name}-list-quick.png`),fullPage:true,animations:"disabled"});
    await open("four");
    const four = ["Confirmar","Marcar atendido","Marcar ausente","Cancelar turno"];
    for (const label of four) await expect(page.getByRole("button",{name:label})).toBeVisible();
    if (width===390) {
      const boxes=await Promise.all(four.map(async label=>page.getByRole("button",{name:label}).boundingBox()));
      assert.ok(boxes.every(Boolean)&&boxes[0].y===boxes[1].y&&boxes[2].y===boxes[3].y&&boxes[2].y>boxes[0].y,"four-action grid");
    }
    await expect(page.getByText("Confirmar cobertura al llegar.")).toBeVisible();
    await expect(page.getByRole("button",{name:"Editar nota"})).toBeVisible();
    await page.screenshot({path:resolve(output,`${name}-four-actions-note-text.png`),fullPage:true,animations:"disabled"});
    await open("three");
    await expect(page.getByRole("button",{name:"Confirmar"})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Marcar atendido"})).toBeVisible();
    if (width===390) {
      const a=await page.getByRole("button",{name:"Marcar atendido"}).boundingBox();
      const b=await page.getByRole("button",{name:"Marcar ausente"}).boundingBox();
      const c=await page.getByRole("button",{name:"Cancelar turno"}).boundingBox();
      assert.ok(a&&b&&c&&a.width>b.width&&b.y===c.y&&b.y>a.y,"three-action grid");
    }
    await page.screenshot({path:resolve(output,`${name}-three-actions-note-null.png`),fullPage:true,animations:"disabled"});
    await open("empty-string");
    await expect(page.getByText("Sin nota administrativa.")).toBeVisible();
    await expect(page.getByRole("button",{name:"Agregar nota"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Eliminar nota"})).toHaveCount(0);
    await page.screenshot({path:resolve(output,`${name}-note-empty-string.png`),fullPage:true,animations:"disabled"});
    await open("professional");
    await expect(page.getByRole("button",{name:"Marcar atendido"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Cancelar turno"})).toHaveCount(0);
    await page.screenshot({path:resolve(output,`${name}-two-actions-professional.png`),fullPage:true,animations:"disabled"});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`${name} overflow`);
    assert.deepEqual(errors,[]);
    results.push({name,quickLinks:true,fourActions:true,threeActions:true,emptyNote:true,textNote:true,twoProfessionalActions:true,overflow:false,pageErrors:0});
    await context.close();
  }
  writeFileSync(resolve(output,"results.json"),JSON.stringify(results,null,2));
  console.log("TASK-030 final visual PASS",JSON.stringify(results));
} finally {
  await browser?.close();
  await server.close();
}
