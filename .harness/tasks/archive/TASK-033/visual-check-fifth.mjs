// Visual and synthetic navigation verification with real UI components and fake data.
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
const cache = resolve("node_modules/.cache/task033-visual-fifth");
const output = resolve(".harness/tasks/active/TASK-033/evidence/fifth-iteration");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  'export function useRouter(){return {refresh(){}}} export function usePathname(){return location.pathname} export function redirect(path){throw new Error("REDIRECT:"+path)}',
);
writeFileSync(
  resolve(cache, "link.tsx"),
  [
    'import React,{createContext,useContext,useState} from "react";',
    "const Status=createContext({pending:false});",
    "export function useLinkStatus(){return useContext(Status)}",
    "export default function Link({href,children,onClick,...rest}){const[pending,setPending]=useState(false);return <Status.Provider value={{pending}}><a href={href} {...rest} onClick={event=>{onClick?.(event);if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();setPending(true);window.__pendingHref=href}}>{children}</a></Status.Provider>}",
  ].join("\n"),
);
writeFileSync(
  resolve(cache, "supabase.ts"),
  "export async function createSupabaseServerClient(){return {}}",
);
writeFileSync(
  resolve(cache, "access.ts"),
  'export async function getAccessOverview(){return {centers:[{id:"11111111-1111-4111-8111-111111111111"}]}}',
);
writeFileSync(
  resolve(cache, "authorization.ts"),
  'export class AuthorizationError extends Error{} export async function requirePlatformAdmin(){return {id:"99999999-9999-4999-8999-999999999999",email:"ana@example.test"}}',
);
writeFileSync(
  resolve(cache, "administration.ts"),
  'export async function listPlatformCenters(){return [{center_id:"11111111-1111-4111-8111-111111111111",name:"Centro Norte",is_active:true,address:"Av. Salud 123",phone:"+54 11 4444 5555",email:"centro@example.test",created_at:"2026-09-23T12:00:00.000Z",active_membership_count:4,active_professional_center_count:2,active_specialty_count:3}]}',
);
writeFileSync(
  resolve(cache, "platform-actions.ts"),
  'export async function createPlatformCenterAction(){return {status:"success"}} export async function resolvePlatformIdentityAction(email){return {status:"success",email,identityExists:false}} export async function setPlatformCenterActiveAction(){return {status:"success"}}',
);
writeFileSync(
  resolve(cache, "auth-actions.ts"),
  'export async function logoutAction(){return {status:"idle"}}',
);
writeFileSync(
  resolve(cache, "dashboard-actions.ts"),
  [
    "export async function refreshDailyDashboardAction(){",
    "if(window.__holdDashboard)await new Promise(resolve=>window.__releaseDashboard=resolve);",
    'if(window.__failDashboard)return {status:"error",message:"fallo sintético"};',
    "const now=new Date().toISOString();",
    'return {status:"success",data:{scope:"staff",role:"ADMIN",membershipId:"member",activeTotal:0,toAttend:0,row:{as_of:now,local_date:now.slice(0,10),timezone:"UTC",pending_count:0,confirmed_count:0,attended_count:0,no_show_count:0,cancelled_count:0,professional_centers_with_appointments_count:0,upcoming:[]}}};',
    "}",
  ].join("\n"),
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  [
    'import React,{useEffect,useState} from "react";',
    'import {createRoot} from "react-dom/client";',
    'import PlatformPage from "@/app/platform/page";',
    'import PlatformLoading from "@/app/platform/loading";',
    'import {CenterHeader} from "@/modules/access/components/center-header";',
    'import {CenterDashboard} from "@/modules/access/components/center-dashboard";',
    'import {PageReveal} from "@/components/page-reveal";',
    'import "@/app/globals.css";',
    'const centerPath="/centers/11111111-1111-4111-8111-111111111111";',
    'window.__holdDashboard=location.search.includes("dashboard-hold");window.__failDashboard=location.search.includes("dashboard-fail");',
    "const platformView=await PlatformPage();",
    'function App(){const[route,setRoute]=useState(location.pathname);const[platformWaiting,setPlatformWaiting]=useState(location.search.includes("platform-loading"));',
    'useEffect(()=>{window.__commitNavigation=()=>{const href=window.__pendingHref;history.pushState({},"",href);setRoute(href);setPlatformWaiting(false)};window.__releasePlatform=()=>setPlatformWaiting(false);const onPop=()=>setRoute(location.pathname);addEventListener("popstate",onPop);return()=>removeEventListener("popstate",onPop)},[]);',
    'if(route==="/platform")return platformWaiting?<PlatformLoading/>:platformView;',
    'return <div className="min-h-screen bg-slate-100/80"><CenterHeader centerId="11111111-1111-4111-8111-111111111111" centerName="Centro Norte" user={{id:"99999999-9999-4999-8999-999999999999",firstName:"Ana",lastName:"Admin",email:"ana@example.test"}} role="ADMIN" isPlatformAdmin={true}/><PageReveal><CenterDashboard centerId="11111111-1111-4111-8111-111111111111" membershipId="member" role="ADMIN"/></PageReveal></div>}',
    'createRoot(document.getElementById("root")).render(<App/>);',
  ].join("\n"),
);

const server = await createServer({
  configFile: false,
  root: cache,
  envDir: cache,
  css: { postcss: root },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "next/navigation", replacement: resolve(cache, "navigation.ts") },
      { find: "next/link", replacement: resolve(cache, "link.tsx") },
      { find: "@/lib/supabase/server", replacement: resolve(cache, "supabase.ts") },
      { find: "@/modules/access/server/access", replacement: resolve(cache, "access.ts") },
      {
        find: "@/modules/access/server/administration",
        replacement: resolve(cache, "administration.ts"),
      },
      {
        find: "@/modules/access/server/authorization",
        replacement: resolve(cache, "authorization.ts"),
      },
      { find: "../actions/platform-actions", replacement: resolve(cache, "platform-actions.ts") },
      { find: "../actions/auth-actions", replacement: resolve(cache, "auth-actions.ts") },
      {
        find: "../actions/daily-dashboard-actions",
        replacement: resolve(cache, "dashboard-actions.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31034, strictPort: true, fs: { allow: [root] } },
});

const centerPath = "/centers/11111111-1111-4111-8111-111111111111";
const results = [];
const loader = (page) => page.getByRole("status").filter({ hasText: "Salud Plus, cargando" });
async function expectVisibleLoader(page) {
  await expect(loader(page)).toBeVisible();
  await expect(loader(page)).toHaveCSS("opacity", "1");
}
async function expectAccessibleNavigationWait(page) {
  await expectVisibleLoader(page);
  assert.equal(
    await page.evaluate(() => {
      const portal = document.querySelector("[data-navigation-loader]");
      return (
        portal === document.activeElement &&
        [...document.body.children].every((child) => child === portal || child.inert)
      );
    }),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => (document.activeElement?.closest("[inert]") ? false : true)),
    true,
  );
}
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [390, 556, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`http://127.0.0.1:31034${centerPath}?dashboard-hold`);
    await expectVisibleLoader(page);
    const dashboardLoaderBounds = await loader(page).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const headerBottom = document.querySelector("header").getBoundingClientRect().bottom;
      return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight, headerBottom };
    });
    assert.equal(
      dashboardLoaderBounds.top >= dashboardLoaderBounds.headerBottom &&
        dashboardLoaderBounds.bottom <= dashboardLoaderBounds.viewportHeight,
      true,
      `dashboard loader layout at ${width}: ${JSON.stringify(dashboardLoaderBounds)}`,
    );
    await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Navegación del centro" })).toHaveCount(0);
    await page.screenshot({ path: resolve(output, `dashboard-loading-${width}.png`) });
    await page.evaluate(() => {
      window.__holdDashboard = false;
      window.__releaseDashboard?.();
    });
    await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación del centro" })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);
    await page.screenshot({
      path: resolve(output, `dashboard-loaded-${width}.png`),
      fullPage: true,
    });

    await page.reload();
    await expectVisibleLoader(page);
    await page.evaluate(() => {
      window.__holdDashboard = false;
      window.__releaseDashboard?.();
    });
    await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);

    await page.getByRole("link", { name: "Administrar plataforma" }).dispatchEvent("click");
    await expectAccessibleNavigationWait(page);
    await page.screenshot({ path: resolve(output, `navigation-to-platform-${width}.png`) });
    await page.evaluate(() => window.__commitNavigation());
    await expect(page.getByRole("heading", { name: "Centros", exact: true })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);
    const header = page.locator("header").first();
    const headerHeight = (await header.boundingBox()).height;
    await page.screenshot({
      path: resolve(output, `platform-loaded-${width}.png`),
      fullPage: true,
    });
    await header.screenshot({ path: resolve(output, `platform-header-${width}.png`) });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `platform overflow at ${width}`,
    );

    await page.getByRole("link", { name: "Ir a mi centro" }).dispatchEvent("click");
    await expectAccessibleNavigationWait(page);
    await page.screenshot({ path: resolve(output, `navigation-to-center-${width}.png`) });
    await page.evaluate(() => window.__commitNavigation());
    await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);

    for (let repeat = 0; repeat < 2; repeat++) {
      await page.getByRole("link", { name: "Administrar plataforma" }).dispatchEvent("click");
      await expectVisibleLoader(page);
      await page.evaluate(() => window.__commitNavigation());
      await expect(page.getByRole("heading", { name: "Centros", exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Ir a mi centro" }).dispatchEvent("click");
      await expectVisibleLoader(page);
      await page.evaluate(() => window.__commitNavigation());
      await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
      await expect(loader(page)).toHaveCount(0);
    }

    await page.goto("http://127.0.0.1:31034/platform?platform-loading");
    await expectVisibleLoader(page);
    assert.equal(await page.locator(".animate-pulse.bg-white").count(), 0);
    await page.screenshot({ path: resolve(output, `platform-loading-${width}.png`) });
    await page.evaluate(() => window.__releasePlatform());
    await expect(page.getByRole("heading", { name: "Centros", exact: true })).toBeVisible();
    await page.reload();
    await expectVisibleLoader(page);
    await page.evaluate(() => window.__releasePlatform());
    await expect(page.getByRole("heading", { name: "Centros", exact: true })).toBeVisible();
    await page.goto("http://127.0.0.1:31034/platform");
    await expect(page.getByRole("heading", { name: "Centros", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Centros", exact: true })).toBeVisible();
    await page.goto(`http://127.0.0.1:31034${centerPath}?dashboard-fail`);
    await expect(page.getByRole("alert")).toHaveText(/No pudimos cargar la actividad/);
    await expect(loader(page)).toHaveCount(0);
    assert.deepEqual(errors, [], `page errors at ${width}`);
    results.push({ width, headerHeight, status: "PASS" });
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
