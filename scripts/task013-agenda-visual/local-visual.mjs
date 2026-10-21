// Local presentation review only: real Agenda component, synthetic props,
// no Next server, Supabase credentials, database or availability requests.
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
const cache = resolve("node_modules/.cache/task013-local-visual");
const baseline = process.argv.includes("--baseline");
const output = resolve(
  ".harness/tasks/archive/TASK-013/evidence",
  baseline ? "local-visual-before" : "local-visual-final",
);
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
export function useRouter() { return { push: navigate }; }
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
  resolve(cache, "booking.tsx"),
  `
export function BookingSelector() { throw new Error('Availability is outside local visual review'); }
`,
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AgendaCalendar} from '@/modules/agenda/components/agenda-calendar';
import '@/app/globals.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/modules/agenda/components/agenda-calendar.css';
window.React = React;
const professionals = ['Elena Demo', 'Martín Demo', 'Lucía Demo'].map((name, index) => ({
  id: 'professional-' + index, firstName: name.split(' ')[0], lastName: 'Demo',
  usualAppointmentDurationMinutes: 30, updatedAt: '2026-10-01T00:00:00Z',
}));
const appointments = [];
function add(id, date, time, professional, patient) {
  const startsAt = date + 'T' + time + ':00Z';
  appointments.push({id, startsAt, endsAt: new Date(Date.parse(startsAt) + 1800000).toISOString(),
    status: professional === 1 ? 'CONFIRMED' : 'PENDING', patientName: patient,
    specialtyName: 'Clínica médica', professionalCenterId: professionals[professional].id,
    professionalName: professionals[professional].firstName + ' Demo'});
}
for (let day = 26; day <= 31; day++) add('day-' + day, '2026-10-' + day, '09:00', 0, 'Paciente Alba');
add('sunday', '2026-11-01', '09:00', 0, 'Paciente Alba');
add('simultaneous', '2026-10-28', '09:00', 1, 'Paciente Bruno');
add('later', '2026-10-28', '10:30', 2, 'Paciente Celeste');
add('night', '2026-10-28', '22:30', 0, 'Paciente Nocturno');
function App() {
  const [, refresh] = useState(0);
  useEffect(() => { const update = () => refresh(v => v + 1); addEventListener('popstate', update); return () => removeEventListener('popstate', update); }, []);
  const query = new URLSearchParams(location.search);
  const view = query.get('view') || 'day';
  const date = query.get('date') || '2026-10-28';
  const rows = query.has('empty') ? [] : appointments.filter(row => view === 'day' ? row.startsAt.startsWith(date) : view === 'month' ? row.startsAt.startsWith(date.slice(0,7)) : true);
  if (location.pathname.includes('/appointments/')) return <main><h1>Destino local de detalle</h1><p>{location.pathname}</p></main>;
  return <AgendaCalendar centerId="local" centerName="Centro de prueba local" timezone="UTC" today="2026-10-28"
    role="ADMIN" filters={{view, date}} appointments={rows} professionals={professionals}
    specialties={[{specialty_id:'specialty',specialty_name:'Clínica médica y seguimiento integral de pacientes — prueba de nombre extenso'}]} loadFailed={false}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
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
        find: "@/modules/appointments/components/booking-selector",
        replacement: resolve(cache, "booking.tsx"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31014, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [];
const blocked = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      timezoneId: "UTC",
      hasTouch: name === "mobile",
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") return route.continue();
      blocked.push(url.origin);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const view of ["day", "week", "month"]) {
      await page.goto("http://127.0.0.1:31014/?view=" + view);
      await page.getByRole("heading", { name: "Agenda", exact: true }).waitFor();
      await page.locator(".rbc-calendar").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(output, name + "-" + view + ".png"), fullPage: true });
      const metrics = await page.evaluate(() => {
        const scroll = document.querySelector(".agenda-calendar");
        const time = document.querySelector(".rbc-time-content");
        return {
          pageWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          calendarWidth: scroll.clientWidth,
          calendarContent: scroll.scrollWidth,
          timeHeight: time?.clientHeight,
          timeContent: time?.scrollHeight,
          scrollTop: time?.scrollTop,
          eventHeights: [...document.querySelectorAll(".rbc-event")].map(
            (el) => el.getBoundingClientRect().height,
          ),
        };
      });
      assert.equal(metrics.pageWidth, width, "Page overflow");
      const checks = [];
      if (!baseline) {
        const grid = page.locator(".agenda-calendar");
        const time = page.locator(".rbc-time-content");
        if (view !== "month") {
          assert(
            metrics.eventHeights.every((height) => height >= 44),
            "30-minute targets",
          );
          assert(metrics.scrollTop > 750 && metrics.scrollTop < 850, "Initial 08:30 position");
          await time.evaluate((el) => {
            el.scrollTop = 0;
          });
          assert.equal(await time.evaluate((el) => el.scrollTop), 0);
          await time.evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          });
          const night = page.locator(".rbc-event").filter({ hasText: "Paciente Nocturno" });
          assert(
            await night.evaluate((el) => {
              const box = el.getBoundingClientRect();
              const clip = el.closest(".rbc-time-content").getBoundingClientRect();
              return box.top >= clip.top && box.bottom <= clip.bottom;
            }),
            "Night appointment reachable vertically",
          );
          if (name === "desktop" && view === "day") {
            await page.screenshot({
              path: resolve(output, "desktop-day-night.png"),
              fullPage: true,
            });
          }
          await page.getByRole("button", { name: "Primer turno · 09:00" }).click();
          await expect.poll(() => time.evaluate((el) => el.scrollTop)).toBeGreaterThan(750);
          assert(await time.evaluate((el) => el.scrollTop < 850));
          checks.push(
            "30-minute targets >=44px",
            "00:00 and 22:30 reachable",
            "return to first appointment",
          );
        }
        if (name === "mobile") {
          const headers = page.locator(".rbc-header:visible");
          const allHeaders = await headers.allTextContents();
          const seen = new Set();
          const collect = async () => {
            for (const text of await headers.evaluateAll((elements) =>
              elements
                .filter((el) => {
                  const clip = el.closest(".agenda-calendar").getBoundingClientRect();
                  const box = el.getBoundingClientRect();
                  return box.left >= clip.left - 1 && box.right <= clip.right + 1;
                })
                .map((el) => el.textContent),
            ))
              seen.add(text);
          };
          await collect();
          const next = page.getByRole("button", { name: "Columnas siguientes" });
          for (let step = 0; step < 10; step++) {
            if (await grid.evaluate((el) => el.scrollLeft + el.clientWidth >= el.scrollWidth - 1))
              break;
            const before = await grid.evaluate((el) => el.scrollLeft);
            await next.click();
            await expect.poll(() => grid.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
            await collect();
          }
          await expect(next).toBeDisabled();
          assert(
            allHeaders.every((header) => seen.has(header)),
            `Every column fully accessible: ${view} ${JSON.stringify({ allHeaders, seen: [...seen] })}`,
          );
          await page.screenshot({
            path: resolve(output, `mobile-${view}-last-columns.png`),
            fullPage: true,
          });
          const previous = page.getByRole("button", { name: "Columnas anteriores" });
          for (let step = 0; step < 10; step++) {
            if (await grid.evaluate((el) => el.scrollLeft <= 1)) break;
            const before = await grid.evaluate((el) => el.scrollLeft);
            await previous.click();
            await expect.poll(() => grid.evaluate((el) => el.scrollLeft)).toBeLessThan(before);
          }
          await expect(previous).toBeDisabled();
          assert.equal(await grid.evaluate((el) => el.scrollLeft), 0);
          checks.push({ allColumnsAccessible: [...seen] });
          await page
            .getByRole("combobox", { name: "Especialidad", exact: true })
            .selectOption("specialty");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
          if (view === "day")
            await page.screenshot({
              path: resolve(output, "mobile-specialty.png"),
              fullPage: true,
            });
          checks.push("long specialty selected: no page overflow");
        }
        await page.locator("summary").click();
        const detail = page.locator("details a").filter({ hasText: "Paciente Bruno" });
        await expect(detail).toContainText("Martín Demo");
        await expect(detail).toContainText("09:00");
        await expect(detail).toContainText("Confirmado");
        if (name === "mobile" && view === "week") {
          await page
            .locator("details")
            .screenshot({ path: resolve(output, "mobile-week-list.png") });
        }
        await detail.click();
        await expect(page).toHaveURL(/\/appointments\/simultaneous$/);
        checks.push("full concurrent appointment readable in list; detail link works");
        await page.goto("http://127.0.0.1:31014/?view=" + view);
        if (view !== "month") {
          const event = page.locator(".rbc-event").filter({ hasText: "Paciente Alba" }).first();
          await event.focus();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/\/appointments\/day-\d+$/);
          checks.push("event keyboard detail navigation");
        } else {
          await page.getByRole("button", { name: "28: 4 turnos. Abrir día", exact: true }).click();
          await expect(page).toHaveURL(/view=day/);
          checks.push("month summary opens day");
        }
        await page.goto("http://127.0.0.1:31014/?view=" + view + "&empty");
        await expect(
          page.getByText("No hay turnos para esta vista y estos filtros."),
        ).toBeVisible();
        if (view !== "month") {
          await expect.poll(() => time.evaluate((el) => el.scrollTop)).toBeGreaterThan(750);
          assert(
            await time.evaluate((el) => el.scrollTop < 790),
            "Empty calendar defaults to 08:00",
          );
          checks.push("empty view opens at 08:00 with full 24 hours");
        }
      }
      assert.deepEqual(errors, []);
      results.push({ name, view, ...metrics, checks });
    }
    await context.close();
  }
  assert.deepEqual(blocked, [], "Unexpected network request");
  writeFileSync(
    resolve(output, "results.json"),
    JSON.stringify({ baseline, results, blocked }, null, 2),
  );
  console.log(JSON.stringify({ output, results }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
