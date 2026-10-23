// Runs the real Dashboard components in Chromium with controlled action responses.
// No Supabase, Auth Admin, Next server, fixtures, or remote writes are used.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { buildPlan, expectedRows } from "./plan.mjs";
import { dashboardReady } from "../../tests/e2e/task-021-dashboard-ready.mjs";
import { patientLink } from "../../tests/e2e/task-021-patient-link.mjs";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const root = resolve(".");
const temporary = mkdtempSync(join(tmpdir(), "task021-chromium-controlled-"));
const modules = join(temporary, "node_modules");
symlinkSync(resolve("node_modules"), modules, "junction");
const plan = buildPlan("11111111-1111-4111-8111-111111111111", new Date("2026-10-22T15:00:00Z"));
const planJson = JSON.stringify(plan);
const write = (name, contents) => writeFileSync(join(temporary, name), contents);

write("index.html", '<div id="root"></div><script type="module" src="/entry.tsx"></script>');
write(
  "link.tsx",
  "import React from 'react'; export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a>; }",
);
write(
  "navigation.ts",
  "const router={refresh(){window.__routerRefresh=(window.__routerRefresh||0)+1}}; export function useRouter(){return router} export function usePathname(){return location.pathname}",
);
write(
  "dashboard-actions.ts",
  `const plan=${planJson};
const i=plan.ids;
export async function refreshDailyDashboardAction(centerId){
  window.__reads=(window.__reads||0)+1;
  const mode=window.__mockMode||'success'; window.__mockMode='success';
  if(mode==='hang') return new Promise(()=>{});
  if(mode==='delay') await new Promise(resolve=>setTimeout(resolve,6200));
  if(mode==='network') {
    try { await fetch(location.pathname+location.search,{method:'POST',headers:{'next-action':'mock'},body:'controlled'}); }
    catch { return {status:'error',message:'Fallo controlado'}; }
  }
  if(mode==='error') return {status:'error',message:'Fallo controlado'};
  if(mode==='denied') return {status:'denied',message:'Acceso cambiado'};
  const actor=new URLSearchParams(location.search).get('actor');
  const role=actor?.startsWith('professional')?'PROFESSIONAL':actor==='receptionA'?'RECEPTION':'ADMIN';
  const scope=role==='PROFESSIONAL'?'professional':'staff';
  const pc=actor==='professionalA'?i.pcA:actor==='professionalA2'?i.pcA2:null;
  const rows=(window.__mockRows||plan.appointments).filter(x=>centerId===i.centerA&&(!pc||i[x.professionalCenter]===pc));
  const count=status=>rows.filter(x=>x.status===status).length;
  const pending=count('PENDING'),confirmed=count('CONFIRMED'),attended=count('ATTENDED'),noShow=count('NO_SHOW');
  const upcoming=rows.filter(x=>['PENDING','CONFIRMED'].includes(x.status)&&x.startsAt>=plan.createdAt)
    .sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id)).slice(0,5)
    .map(x=>({appointment_id:x.id,starts_at:x.startsAt,ends_at:x.endsAt,status:x.status,
      patient_first_name:'Task021',patient_last_name:x.patient==='patientA'?'Patient A':'Patient A2',
      specialty_name:'TASK-021 Specialty '+plan.runId,
      ...(scope==='staff'?{professional_center_id:i[x.professionalCenter],
        professional_first_name:'Task021',professional_last_name:x.professionalCenter==='pcA'?'Professional A':'Professional A2'}:{})}));
  const row={as_of:plan.createdAt,local_date:plan.localDate,timezone:'America/Argentina/Buenos_Aires',
    pending_count:pending,confirmed_count:confirmed,attended_count:attended,no_show_count:noShow,
    cancelled_count:count('CANCELLED'),upcoming,
    ...(scope==='staff'?{professional_centers_with_appointments_count:new Set(rows.filter(x=>x.status!=='CANCELLED').map(x=>x.professionalCenter)).size}:{})};
  return {status:'success',data:{scope,role,membershipId:actor,activeTotal:pending+confirmed+attended+noShow,
    toAttend:pending+confirmed,row}};
}`,
);
write(
  "entry.tsx",
  `import React from 'react';
import {createRoot} from 'react-dom/client';
import {CenterDashboard} from '@/modules/access/components/center-dashboard';
import '@/app/globals.css';
const plan=${planJson};
const actor=new URLSearchParams(location.search).get('actor');
const centerId=location.pathname.split('/')[2];
const denied=actor==='unlinked'||(actor==='adminB'&&centerId===plan.ids.centerA);
const role=actor?.startsWith('professional')?'PROFESSIONAL':actor==='receptionA'?'RECEPTION':'ADMIN';
createRoot(document.getElementById('root')).render(denied?<h1>No encontramos esta página</h1>:
  <CenterDashboard centerId={centerId} membershipId={actor} role={role}/>);`,
);

const server = await createServer({
  configFile: false,
  root: temporary,
  cacheDir: join(temporary, ".vite"),
  envDir: temporary,
  css: { postcss: root },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "next/link", replacement: join(temporary, "link.tsx") },
      { find: "next/navigation", replacement: join(temporary, "navigation.ts") },
      {
        find: "../actions/daily-dashboard-actions",
        replacement: join(temporary, "dashboard-actions.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root, temporary] } },
});

let browser;
let url;
let passed = 0;
const activity = (page) => page.locator('section[aria-labelledby="activity-heading"]');
const upcoming = (page) => page.locator('section[aria-labelledby="upcoming-heading"]');
const cards = (page) =>
  page.getByRole("navigation", { name: "Navegación del centro" }).getByRole("link");
async function scenario(name, run) {
  await run();
  passed++;
  console.log(`TASK021_LOCAL_CHROMIUM_PASS ${name}`);
}
async function pageFor(actor, { center = plan.ids.centerA, width = 1440, mode = "success" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
  });
  await context.addInitScript(
    ({ mode, now }) => {
      Date.now = () => now;
      window.__mockMode = mode;
    },
    { mode, now: Date.parse(plan.createdAt) },
  );
  const page = await context.newPage();
  await page.goto(`${url}/centers/${center}?actor=${actor}`);
  return { context, page };
}
async function checkRole(actor, scope, cardCount, options = {}) {
  const { context, page } = await pageFor(actor, options);
  try {
    await dashboardReady(page);
    const expected = expectedRows(plan, scope);
    const professional = scope !== "staff";
    await expect(
      activity(page).getByRole("heading", {
        name: professional ? "Mi actividad de hoy" : "Actividad de hoy",
      }),
    ).toBeVisible();
    await expect(activity(page)).toContainText(
      "Jueves 22 de octubre · Actualizado a las 12:00 (hora del centro)",
    );
    const metricPositions = await activity(page)
      .locator("dl > div")
      .evaluateAll((items) => items.map((item) => ({ x: item.offsetLeft, y: item.offsetTop })));
    assert.equal(metricPositions.length, 4);
    if (options.width === 390) {
      assert.equal(metricPositions[0].y, metricPositions[1].y);
      assert.equal(metricPositions[2].y, metricPositions[3].y);
      assert(metricPositions[2].y > metricPositions[0].y);
      assert(metricPositions[1].x > metricPositions[0].x);
    } else {
      assert(metricPositions.every((item) => item.y === metricPositions[0].y));
    }
    const total =
      expected.pending_count +
      expected.confirmed_count +
      expected.attended_count +
      expected.no_show_count;
    const label = professional ? "Mis turnos del día" : "Turnos del día";
    await expect(
      activity(page).getByText(label, { exact: true }).locator("xpath=following-sibling::dd"),
    ).toContainText(String(total));
    await expect(activity(page)).toContainText(
      `${expected.pending_count} pendientes · ${expected.confirmed_count} confirmados`,
    );
    await expect(activity(page)).toContainText(
      `Cancelados con fecha de hoy: ${expected.cancelled_count}`,
    );
    await expect(cards(page)).toHaveCount(cardCount);
    const list = upcoming(page).locator("ol > li");
    await expect(list).toHaveCount(expected.upcoming.length);
    for (let n = 0; n < expected.upcoming.length; n++) {
      const item = plan.appointments.find((x) => x.id === expected.upcoming[n]);
      const name = item.patient === "patientA" ? "Task021 Patient A" : "Task021 Patient A2";
      await expect(list.nth(n).getByRole("link")).toHaveAttribute(
        "href",
        `/centers/${plan.ids.centerA}/appointments/${item.id}`,
      );
      await expect(patientLink(list.nth(n), name)).toHaveCount(1);
    }
    if (professional) {
      const forbidden = scope === plan.ids.pcA ? "Task021 Patient A2" : "Task021 Patient A";
      await expect(patientLink(upcoming(page), forbidden)).toHaveCount(0);
      const html = await page.content();
      for (const marker of [
        `T021-PAT-A-${plan.runId}`,
        `T021-PAT-A2-${plan.runId}`,
        `task021-patient-a-${plan.runId}@example.test`,
        `task021-patient-a2-${plan.runId}@example.test`,
      ])
        assert(!html.includes(marker));
      await expect(
        activity(page).getByText("Profesionales con turnos hoy", { includeHidden: true }),
      ).toHaveCount(0);
    } else await expect(activity(page)).toContainText("Profesionales con turnos hoy: 2");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  } finally {
    await context.close();
  }
}

try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");
  url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
  for (const [name, scope, count, options] of [
    ["ADMIN", "staff", 7, {}],
    ["RECEPTION", "staff", 4, {}],
    ["PROFESSIONAL_A", plan.ids.pcA, 3, {}],
    ["PROFESSIONAL_A2", plan.ids.pcA2, 3, {}],
    ["PROFESSIONAL_A_MOBILE", plan.ids.pcA, 3, { width: 390 }],
  ]) {
    const actor = {
      ADMIN: "adminA",
      RECEPTION: "receptionA",
      PROFESSIONAL_A: "professionalA",
      PROFESSIONAL_A2: "professionalA2",
      PROFESSIONAL_A_MOBILE: "professionalA",
    }[name];
    await scenario(name, () => checkRole(actor, scope, count, options));
  }
  await scenario("DELAYED_MOBILE_READY", async () => {
    const { context, page } = await pageFor("professionalA", { width: 390, mode: "delay" });
    try {
      await expect(activity(page).getByRole("status")).toHaveText("Cargando actividad…");
      const start = Date.now();
      await dashboardReady(page);
      assert(Date.now() - start >= 5000);
      await expect(activity(page).getByRole("status")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
  await scenario("ERROR_IS_NOT_READY", async () => {
    const { context, page } = await pageFor("adminA", { mode: "error" });
    try {
      await assert.rejects(() => dashboardReady(page), /Dashboard returned error/);
      await expect(activity(page).getByRole("alert")).toContainText(
        "No pudimos cargar la actividad",
      );
      await expect(activity(page).locator("dl")).toHaveCount(0);
      await expect(activity(page).getByText("Fecha y hora del centro al cargar")).toHaveCount(0);
      await expect(activity(page).getByRole("button", { name: "Actualizar" })).toHaveCount(0);
      await expect(activity(page).getByRole("button", { name: "Reintentar" })).toHaveCount(1);
    } finally {
      await context.close();
    }
  });
  await scenario("PERSISTENT_LOADING_IS_NOT_READY", async () => {
    const { context, page } = await pageFor("adminA", { mode: "hang" });
    try {
      await assert.rejects(
        () => dashboardReady(page, { timeout: 300 }),
        /status=.*Cargando actividad/,
      );
    } finally {
      await context.close();
    }
  });
  await scenario("EMPTY_INFO_WITH_DATA_IS_READY", async () => {
    const { context, page } = await pageFor("adminB", { center: plan.ids.centerB });
    try {
      await dashboardReady(page);
      await expect(activity(page)).toContainText("No hay turnos vigentes para hoy.");
      await expect(upcoming(page)).toContainText("No hay próximos turnos de hoy.");
    } finally {
      await context.close();
    }
  });
  await scenario("DENIED_NOT_READY", async () => {
    const { context, page } = await pageFor("professionalA", { mode: "denied" });
    try {
      await assert.rejects(() => dashboardReady(page), /Dashboard returned error/);
    } finally {
      await context.close();
    }
  });
  await scenario("CROSS_CENTER_AND_UNLINKED", async () => {
    for (const [actor, center] of [
      ["adminB", plan.ids.centerA],
      ["unlinked", plan.ids.centerA],
    ]) {
      const { context, page } = await pageFor(actor, { center });
      try {
        await expect(
          page.getByRole("heading", { name: "No encontramos esta página" }),
        ).toBeVisible();
        await expect(activity(page)).toHaveCount(0);
      } finally {
        await context.close();
      }
    }
  });
  await scenario("SERVER_ACTION_ROUTE_ABORT_AND_RETRY", async () => {
    const { context, page } = await pageFor("adminA");
    try {
      await dashboardReady(page);
      let aborted = false;
      await page.route(`**/centers/${plan.ids.centerA}*`, async (route) => {
        const request = route.request();
        if (!aborted && request.method() === "POST" && request.headers()["next-action"]) {
          aborted = true;
          await route.abort("failed");
        } else await route.continue();
      });
      await page.evaluate(() => {
        window.__mockMode = "network";
      });
      await activity(page).getByRole("button", { name: "Actualizar" }).click();
      await expect.poll(() => aborted).toBe(true);
      await expect(activity(page).getByRole("alert")).toContainText(
        "No pudimos cargar la actividad",
      );
      await expect(activity(page).locator("dl")).toHaveCount(0);
      await expect(cards(page)).toHaveCount(7);
      await page.unrouteAll();
      await activity(page).getByRole("button", { name: "Reintentar" }).click();
      await dashboardReady(page);
    } finally {
      await context.close();
    }
  });
  await scenario("ERROR_RETRY_REFRESH_EMPTY", async () => {
    const { context, page } = await pageFor("adminA");
    try {
      await dashboardReady(page);
      await page.evaluate(() => {
        window.__mockMode = "error";
      });
      await activity(page).getByRole("button", { name: "Actualizar" }).click();
      await expect(activity(page).getByRole("alert")).toContainText(
        "No pudimos cargar la actividad",
      );
      await expect(activity(page).locator("dl")).toHaveCount(0);
      await expect(cards(page)).toHaveCount(7);
      await activity(page).getByRole("button", { name: "Reintentar" }).click();
      await dashboardReady(page);
      await page.evaluate((source) => {
        window.__mockRows = source.map((x) => ({ ...x }));
        window.__mockRows.find((x) => x.label === "a1-pending-1").status = "CONFIRMED";
      }, plan.appointments);
      await activity(page).getByRole("button", { name: "Actualizar" }).click();
      await expect(activity(page)).toContainText("3 pendientes · 4 confirmados");
      await page.evaluate(() => {
        for (const x of window.__mockRows)
          if (["PENDING", "CONFIRMED"].includes(x.status)) x.status = "ATTENDED";
      });
      await activity(page).getByRole("button", { name: "Actualizar" }).click();
      await expect(upcoming(page)).toContainText("No quedan próximos turnos de hoy.");
      await page.evaluate(() => {
        for (const x of window.__mockRows) x.status = "CANCELLED";
      });
      await activity(page).getByRole("button", { name: "Actualizar" }).click();
      await expect(activity(page)).toContainText("No hay turnos vigentes para hoy.");
      await expect(upcoming(page)).toContainText("No hay próximos turnos de hoy.");
      await expect(cards(page)).toHaveCount(7);
    } finally {
      await context.close();
    }
  });
  console.log(`TASK021_LOCAL_CHROMIUM_INTEGRAL_PASS scenarios=${passed}`);
} finally {
  await browser?.close();
  await server.close();
  unlinkSync(modules);
  rmSync(temporary, { recursive: true, force: true });
}
