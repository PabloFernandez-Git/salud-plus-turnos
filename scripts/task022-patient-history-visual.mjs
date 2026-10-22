// Isolated Chromium fixture for the real patient panel. No Supabase or Next server calls.
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
const cache = resolve("node_modules/.cache/task022-patient-history-visual");
const output = resolve("artifacts/task022-patient-history");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "link.tsx"),
  "import React from 'react'; export default function Link({href,children,...props}) { return <a href={href} {...props} onClick={event => { if (href.includes('/patients')) { event.preventDefault(); window.dispatchEvent(new CustomEvent('fixture:navigate', { detail: href })); } }}>{children}</a>; }",
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  "export function useRouter() { return { push(href) { window.dispatchEvent(new CustomEvent('fixture:navigate', { detail: href })); }, refresh() {} }; }",
);
writeFileSync(
  resolve(cache, "patient-actions.ts"),
  `
export async function createPatientAction() { throw new Error('fixture write blocked'); }
export async function deactivatePatientAction() { throw new Error('fixture write blocked'); }
export async function linkPatientAction() { throw new Error('fixture write blocked'); }
export async function reactivatePatientAction() { throw new Error('fixture write blocked'); }
export async function resolvePatientAction() { throw new Error('fixture write blocked'); }
export async function updatePatientAction() { return { status: 'success', data: { outcome: 'UPDATED' } }; }
`,
);
writeFileSync(
  resolve(cache, "user-actions.ts"),
  `
export async function resolveCenterIdentityAction() { throw new Error('fixture write blocked'); }
export async function provisionCenterUserAction() { throw new Error('fixture write blocked'); }
export async function updateCenterMembershipAction() { throw new Error('fixture write blocked'); }
`,
);
writeFileSync(
  resolve(cache, "appointment-actions.ts"),
  `
const centerId = '11111111-1111-4111-8111-111111111111';
const rows = [
  ['33333333-3333-4333-8333-333333333333','2026-10-22T12:00:00Z','PENDING','Clínica médica'],
  ['44444444-4444-4444-8444-444444444444','2026-10-23T15:30:00Z','CONFIRMED','Cardiología'],
  ['55555555-5555-4555-8555-555555555555','2026-10-21T11:00:00Z','ATTENDED','Clínica médica'],
  ['66666666-6666-4666-8666-666666666666','2026-10-20T10:00:00Z','NO_SHOW','Dermatología'],
  ['77777777-7777-4777-8777-777777777777','2026-10-24T18:00:00Z','CANCELLED','Cardiología'],
].map(([appointment_id, starts_at, status, specialty_name]) => ({
  appointment_id, starts_at, ends_at: new Date(Date.parse(starts_at)+1800000).toISOString(),
  status, professional_first_name: 'María', professional_last_name: 'Gómez', specialty_name, has_more: false,
}));
const page = (items, hasMore = false) => ({ rows: items, hasMore, nextCursor: items.length ? { startsAt: items.at(-1).starts_at, id: items.at(-1).appointment_id } : null });
let sectionReads = 0;
export async function loadPatientAppointmentSectionsAction(input) {
  if (input.centerId !== centerId) throw new Error('wrong center');
  if (++sectionReads > 1) await new Promise(resolve => setTimeout(resolve, 300));
  return { status: 'success', data: { asOf: '2026-10-22T10:00:00.000Z', upcoming: page(rows.slice(0,1), true), history: page(rows.slice(2,4), true) } };
}
export async function loadPatientAppointmentPageAction(input) {
  if (input.centerId !== centerId || input.asOf !== '2026-10-22T10:00:00.000Z') throw new Error('invalid cursor context');
  return { status: 'success', data: page(input.section === 'UPCOMING' ? rows.slice(1,2) : rows.slice(4,5)) };
}
`,
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PatientsScreen } from '@/modules/patients/components/patients-screen';
import { CenterUsersScreen } from '@/modules/access/components/center-users-screen';
import '@/app/globals.css';
const centerId='11111111-1111-4111-8111-111111111111';
const patientCenterId='22222222-2222-4222-8222-222222222222';
const detail={patientCenterId,phone:'011 5555-0101',email:'ana@example.test',insuranceName:'Plan Salud',administrativeNotes:'',isActive:true,updatedAt:'2026-10-22T09:00:00Z',firstName:'Ana',lastName:'Pérez',birthDate:'1990-01-02',nationalityCode:'AR',documentNumber:'12345678'};
const row={patient_center_id:patientCenterId,person_id:'88888888-8888-4888-8888-888888888888',first_name:'Ana',last_name:'Pérez',nationality_code:'AR',document_number:'12345678',birth_date:'1990-01-02',phone:'011 5555-0101',email:'ana@example.test',insurance_name:'Plan Salud',is_active:true,updated_at:'2026-10-22T09:00:00Z'};
const users=[
  {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',firstName:'Ana',lastName:'Admin',email:'ana@example.test',role:'ADMIN',isActive:true,professional:null},
  {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',userId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',firstName:'Pablo',lastName:'Profesional',email:'pablo@example.test',role:'PROFESSIONAL',isActive:true,professional:{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',firstName:'Paula',lastName:'Médica',licenseNumber:'MP 1234',isActive:true}}
];
function App() {
  const [selected,setSelected]=useState(false);
  const [multi,setMulti]=useState(false);
  const [page,setPage]=useState(1);
  useEffect(() => {
    const onNavigate=event => { const url=new URL(event.detail,location.href); setSelected(url.searchParams.has('patient')); setPage(Number(url.searchParams.get('page') || 1)); };
    const onMulti=event => { setMulti(event.detail); setPage(1); };
    window.addEventListener('fixture:navigate',onNavigate);
    window.addEventListener('fixture:multi',onMulti);
    return () => { window.removeEventListener('fixture:navigate',onNavigate); window.removeEventListener('fixture:multi',onMulti); };
  },[]);
  const result={rows:[row],page,hasPrevious:multi && page>1,hasNext:multi && page===1,atOffsetCeiling:false};
  if (location.search.includes('view=users')) return <CenterUsersScreen actorUserId={users[0].userId} centerId={centerId} centerName="Centro Norte" loadFailed={false} manageableProfessionalCenters={[]} professionalCenters={[]} users={users}/>;
  return <PatientsScreen centerId={centerId} centerName="Centro Norte" timezone="America/Argentina/Buenos_Aires" selectedPatientCenterId={selected ? patientCenterId : null} filters={{query:'',state:'ACTIVE',page}} result={result} detail={selected ? detail : null}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
);

const server = await createServer({
  configFile: false,
  root: cache,
  envDir: cache,
  optimizeDeps: { force: true },
  css: { postcss: root },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "next/link", replacement: resolve(cache, "link.tsx") },
      { find: "next/navigation", replacement: resolve(cache, "navigation.ts") },
      {
        find: /\.\.\/actions\/patient-actions$/,
        replacement: resolve(cache, "patient-actions.ts"),
      },
      {
        find: /\.\.\/actions\/patient-appointment-actions$/,
        replacement: resolve(cache, "appointment-actions.ts"),
      },
      {
        find: /\.\.\/actions\/center-user-actions$/,
        replacement: resolve(cache, "user-actions.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31023, strictPort: true, fs: { allow: [root] } },
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
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:31023/");
    const manage = page.getByRole("link", { name: "Administrar paciente" });
    await expect(manage).toBeVisible();
    await expect(page.locator("th").filter({ hasText: "Acciones" })).toHaveCount(1, {
      timeout: 1000,
    });
    await expect(page.getByRole("navigation", { name: "Paginación de pacientes" })).toHaveCount(0);
    await expect(page.getByText("Página 1")).toHaveCount(0);
    await page.screenshot({ path: resolve(output, `${name}-list.png`), fullPage: true });
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("fixture:multi", { detail: true })),
    );
    const pagination = page.getByRole("navigation", { name: "Paginación de pacientes" });
    await expect(pagination.getByText("Página 1")).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-list-paged.png`), fullPage: true });
    await pagination.getByRole("link", { name: "Siguiente" }).click();
    await expect(pagination.getByText("Página 2")).toBeVisible();
    await expect(pagination.getByRole("link", { name: "Anterior" })).toBeVisible();
    await pagination.getByRole("link", { name: "Anterior" }).click();
    await expect(pagination.getByText("Página 1")).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("fixture:multi", { detail: false })),
    );
    await expect(pagination).toHaveCount(0);
    await manage.click();
    const dialog = page.getByRole("dialog", { name: "Administrar paciente" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("tab", { name: "Datos del paciente" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: "Cerrar" })).toBeFocused();
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    await page.screenshot({ path: resolve(output, `${name}-data.png`) });
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Desactivar paciente" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Ver en listado" })).toHaveCount(0);
    if (width < 500) {
      await page.getByRole("button", { name: "Desactivar paciente" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, `${name}-data-bottom.png`) });
    }
    const deactivate = page.getByRole("button", { name: "Desactivar paciente" });
    await expect(deactivate).toHaveClass(/border-rose-300/);
    await deactivate.click();
    const deactivateConfirmation = page.getByRole("group", { name: "Confirmar desactivación" });
    await expect(deactivateConfirmation).toBeVisible();
    await deactivateConfirmation.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `${name}-deactivate.png`) });
    await deactivateConfirmation.getByRole("button", { name: "Cancelar" }).click();
    await expect(deactivateConfirmation).toHaveCount(0);
    await page.getByRole("tab", { name: "Turnos" }).click();
    await expect(page.getByRole("region", { name: "Próximos turnos" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Historial" })).toBeVisible();
    const refresh = page.getByRole("button", { name: "Actualizar turnos" });
    await expect(refresh).toHaveClass(/border-sky-300/);
    await page.getByRole("tab", { name: "Turnos" }).focus();
    await page.keyboard.press("Tab");
    await expect(refresh).toBeFocused();
    await refresh.click();
    await expect(page.getByText("Cargando turnos…")).toBeVisible();
    await expect(refresh).toBeVisible();
    await page
      .getByRole("region", { name: "Próximos turnos" })
      .getByRole("button", { name: "Cargar más" })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Próximos turnos" })
        .getByRole("link", { name: "Ver detalle" }),
    ).toHaveCount(2);
    await page
      .getByRole("region", { name: "Historial" })
      .getByRole("button", { name: "Cargar más" })
      .click();
    await expect(
      page.getByRole("region", { name: "Historial" }).getByRole("link", { name: "Ver detalle" }),
    ).toHaveCount(3);
    await expect(
      page
        .getByRole("region", { name: "Historial" })
        .getByRole("link", { name: "Ver detalle" })
        .first(),
    ).toHaveAttribute("href", /\/appointments\/[0-9a-f-]+$/);
    await page.getByRole("heading", { name: "Turnos del paciente" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `${name}-appointments.png`) });
    if (width < 500) {
      await page
        .getByRole("region", { name: "Historial" })
        .getByRole("link", { name: "Ver detalle" })
        .last()
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, `${name}-appointments-bottom.png`) });
    }
    const dialogGeometry = await dialog.evaluate((element) => ({
      dialogWidth: Math.round(element.getBoundingClientRect().width),
      dialogScrollWidth: element.scrollWidth,
      dialogClientWidth: element.clientWidth,
    }));
    await page.getByRole("tab", { name: "Datos del paciente" }).click();
    await page.getByRole("textbox", { name: "Teléfono" }).fill("011 5555-9999");
    await page.getByRole("tab", { name: "Turnos" }).click();
    await page.getByRole("tab", { name: "Datos del paciente" }).click();
    await expect(page.getByRole("textbox", { name: "Teléfono" })).toHaveValue("011 5555-9999");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Datos administrativos guardados.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar" })).toBeEnabled();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("dialog")).toHaveCount(0);
    await expect(manage).toBeFocused();
    await manage.click();
    await expect(dialog).toBeVisible();
    await page.getByRole("textbox", { name: "Teléfono" }).fill("sin guardar");
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(manage).toBeFocused();
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    const geometry = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
    }));
    Object.assign(geometry, dialogGeometry);
    assert(geometry.pageWidth <= width, `${name}: horizontal page overflow`);
    assert(
      geometry.dialogScrollWidth <= geometry.dialogClientWidth + 1,
      `${name}: horizontal panel overflow`,
    );
    assert.deepEqual(errors, [], `${name}: browser errors`);
    results.push({ name, ...geometry, errors });
    await page.goto("http://127.0.0.1:31023/?view=users");
    const noProfessional = page.getByLabel("Sin profesional asociado");
    await expect(noProfessional).toBeVisible();
    await noProfessional.scrollIntoViewIfNeeded();
    const alignment = await noProfessional.evaluate((element) => {
      const cell = element.closest("td");
      const symbol = element.getBoundingClientRect();
      const bounds = cell.getBoundingClientRect();
      return {
        centerDelta: Math.abs((symbol.left + symbol.right - bounds.left - bounds.right) / 2),
        cellWidth: bounds.width,
      };
    });
    assert(alignment.centerDelta <= 1, `${name}: missing professional is not centered`);
    await expect(page.getByText("Paula Médica")).toBeVisible();
    await page.screenshot({ path: resolve(output, `${name}-users.png`), fullPage: true });
    assert.deepEqual(errors, [], `${name}: users browser errors`);
    results.push({ name: `${name}-users`, ...alignment, errors });
    await context.close();
  }
  writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2) + "\n");
  process.stdout.write(JSON.stringify(results) + "\n");
} finally {
  await browser?.close();
  await server.close();
}
