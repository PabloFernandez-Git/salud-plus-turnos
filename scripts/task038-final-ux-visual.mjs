// Browser interaction with the real sidebar and Agenda components, using local synthetic props.
// The preview never contacts Supabase.
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
const cache = resolve("node_modules/.cache/task038-final-ux");
const output = resolve("artifacts/task038-final-ux");
const centerId = "11111111-1111-4111-8111-111111111111";
const base = `http://127.0.0.1:31039/centers/${centerId}`;
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  `import {useSyncExternalStore} from 'react';
export function subscribe(callback) { addEventListener('popstate',callback); return () => removeEventListener('popstate',callback); }
export function navigate(href) { history.pushState({},'',href); dispatchEvent(new PopStateEvent('popstate')); }
export function usePathname() { return useSyncExternalStore(subscribe,()=>location.pathname,()=>location.pathname); }
export function useCurrentUrl() { return useSyncExternalStore(subscribe,()=>location.pathname+location.search,()=>location.pathname+location.search); }
export function useRouter() { return { refresh() {}, push: navigate }; }`,
);
writeFileSync(
  resolve(cache, "link.tsx"),
  `import React from 'react'; import {navigate} from './navigation';
export default function Link({href,children,onClick,...props}) { return <a href={href} {...props} onClick={(event)=>{
  onClick?.(event); if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey) return;
  event.preventDefault(); navigate(href);
}}>{children}</a>; }`,
);
writeFileSync(resolve(cache, "booking.tsx"), "export function BookingSelector() { return null; }");
writeFileSync(
  resolve(cache, "entry.tsx"),
  `import React from 'react';
import {createRoot} from 'react-dom/client';
import {CenterSidebar,CenterMobileNavigation} from '@/modules/access/components/center-sidebar';
import {AgendaCalendar} from '@/modules/agenda/components/agenda-calendar';
import {useCurrentUrl} from './navigation';
import '@/app/globals.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/modules/agenda/components/agenda-calendar.css';
window.React=React;
const centerId='${centerId}';
function App(){
  const url=useCurrentUrl(); const current=new URL(url,location.origin);
  const agenda=current.pathname.endsWith('/agenda');
  const appointments=current.pathname.endsWith('/appointments');
  const date=current.searchParams.get('date')||'2026-11-18';
  const view=current.searchParams.get('view')||'day';
  return <div className="center-layout grid min-h-dvh grid-rows-[auto_minmax(0,1fr)] bg-slate-100/80">
    <header className="h-16 bg-white">Centro sintético</header>
    <div className="min-w-0 md:flex"><CenterSidebar centerId={centerId} role="ADMIN" />
    <div className="min-w-0 flex-1"><CenterMobileNavigation centerId={centerId} role="ADMIN" />
      <main className="min-h-dvh px-6 py-6">
        {agenda ? <AgendaCalendar centerId={centerId} centerName="Centro sintético" timezone="UTC"
          today={date} role="ADMIN" filters={{date,view}} appointments={[]} blocks={[]}
          professionals={[]} specialties={[]} loadFailed={false} />
        : <h1 className="text-2xl font-bold">{appointments?'Turnos':'Dashboard'}</h1>}
      </main>
    </div></div>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);`,
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
  server: { host: "127.0.0.1", port: 31039, strictPort: true, fs: { allow: [root] } },
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "UTC",
  });
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
    errors.push(`External request: ${route.request().url()}`);
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  const sidebar = page.getByRole("complementary", { name: "Barra lateral del centro" });
  await sidebar.waitFor();
  assert.equal(await sidebar.getAttribute("data-expanded"), "false");
  await sidebar.hover();
  assert.equal(await sidebar.getAttribute("data-expanded"), "true");
  await page.mouse.move(420, 220);
  assert.equal(await sidebar.getAttribute("data-expanded"), "false");
  for (const destination of ["Agenda", "Turnos", "Agenda", "Turnos"]) {
    await sidebar.hover();
    await sidebar.getByRole("link", { name: destination }).click();
    await page.getByRole("heading", { name: destination }).waitFor();
    assert.equal(
      await sidebar.getAttribute("data-expanded"),
      "true",
      `${destination} while pointer inside`,
    );
    const bounds = await sidebar.boundingBox();
    assert(
      bounds && bounds.width >= 230 && bounds.height >= 500,
      `${destination} sidebar dimensions`,
    );
    await page.screenshot({
      path: resolve(output, `desktop-${destination.toLowerCase()}-expanded.png`),
    });
    await page.mouse.move(420, 220);
    assert.equal(
      await sidebar.getAttribute("data-expanded"),
      "false",
      `${destination} after pointer exit`,
    );
  }
  await page.keyboard.press("Tab");
  assert.equal(await sidebar.getAttribute("data-expanded"), "true", "Keyboard focus opens sidebar");
  await page.mouse.move(420, 220);
  assert.equal(
    await sidebar.getAttribute("data-expanded"),
    "true",
    "Keyboard focus survives pointer exit",
  );
  await page.locator("main").click();
  assert.equal(await sidebar.getAttribute("data-expanded"), "false", "Blur closes sidebar");
  for (const [date, view, heading] of [
    ["2026-12-18", "month", "Diciembre de 2026"],
    ["2027-01-18", "month", "Enero de 2027"],
    ["2026-11-18", "day", "miércoles, 18 de noviembre de 2026"],
    ["2026-11-18", "week", "Semana del 16 al 22 de noviembre de 2026"],
  ]) {
    await page.goto(`${base}/agenda?date=${date}&view=${view}`);
    await page.getByText(heading, { exact: true }).waitFor();
    if (date === "2026-12-18")
      await page.screenshot({ path: resolve(output, "desktop-month.png") });
  }
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    timezoneId: "UTC",
  });
  await mobile.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
    errors.push(`External request: ${route.request().url()}`);
    return route.abort();
  });
  const mobilePage = await mobile.newPage();
  mobilePage.on("pageerror", (error) => errors.push(error.message));
  await mobilePage.goto(base);
  await mobilePage.getByRole("button", { name: "Abrir menú de navegación" }).tap();
  const dialog = mobilePage.getByRole("dialog", { name: "Menú de navegación" });
  await dialog.waitFor();
  await mobilePage.screenshot({ path: resolve(output, "mobile-menu.png") });
  await dialog.getByRole("link", { name: "Agenda" }).tap();
  await mobilePage.getByRole("heading", { name: "Agenda" }).waitFor();
  assert.equal(await dialog.isVisible(), false);
  assert.deepEqual(errors, []);
  await mobile.close();
  console.log(
    "TASK-038 final UX browser interaction: PASS (hover, route clicks, keyboard, mobile touch, day/week/month headings)",
  );
} finally {
  await browser?.close();
  await server.close();
}
