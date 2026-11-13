// Local visual QA for the real center shell and Dashboard components with synthetic data.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const root = resolve(".");
const temporary = mkdtempSync(join(tmpdir(), "task037-sidebar-"));
const output = resolve("artifacts/task037-sidebar-visual");
mkdirSync(output, { recursive: true });
symlinkSync(resolve("node_modules"), join(temporary, "node_modules"), "junction");
const write = (name, contents) => writeFileSync(join(temporary, name), contents);

write(
  "index.html",
  '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
write(
  "link.tsx",
  "import React from 'react'; export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a>; } export function useLinkStatus(){return {pending:false}};",
);
write(
  "navigation.ts",
  "const router={refresh(){}}; export function usePathname(){return location.pathname} export function useRouter(){return router}",
);
write("auth-actions.ts", "export async function logoutAction(){return {status:'idle'}}");
write("navigation-loader.tsx", "export function NavigationLoader(){return null}");
write(
  "dashboard-actions.ts",
  `let calls=0; export async function refreshDailyDashboardAction(){
  calls++; if(calls>1) await new Promise(resolve=>setTimeout(resolve,600));
  return {status:'success',data:{scope:'staff',role:'ADMIN',membershipId:'member',activeTotal:3,toAttend:2,
    row:{as_of:'2026-11-13T15:00:00Z',local_date:'2026-11-13',timezone:'America/Argentina/Buenos_Aires',
      pending_count:1,confirmed_count:1,attended_count:1,no_show_count:0,cancelled_count:0,
      professional_centers_with_appointments_count:2,upcoming:[]}}};
}`,
);
write(
  "entry.tsx",
  `import React from 'react';
import {createRoot} from 'react-dom/client';
import {CenterSidebar} from '@/modules/access/components/center-sidebar';
import {CenterHeader} from '@/modules/access/components/center-header';
import {PlatformHeader} from '@/modules/access/components/platform-header';
import {CenterDashboard} from '@/modules/access/components/center-dashboard';
import {ModuleHeader} from '@/components/module-header';
import '@/app/globals.css';
const centerId='11111111-1111-4111-8111-111111111111';
const role=new URLSearchParams(location.search).get('role')||'ADMIN';
const platform=new URLSearchParams(location.search).get('platform')!=='false';
const centerCount=new URLSearchParams(location.search).get('centers');
const centerDestination=centerCount==='none'?null:centerCount==='many'?{href:'/select-center',label:'Seleccionar centro'}:{href:'/centers/'+centerId,label:'Ir a mi centro'};
const module=location.pathname.split('/')[3];
const titles={agenda:'Agenda',appointments:'Turnos',patients:'Pacientes',professionals:'Profesionales',availability:'Disponibilidad',specialties:'Especialidades',users:'Gestión de usuarios',settings:'Configuración del centro'};
createRoot(document.getElementById('root')).render(location.pathname==='/platform'
  ? <div className='min-h-dvh bg-slate-50'><PlatformHeader email='admin@example.test' centerDestination={centerDestination}/><main className='px-5 py-8'><h2>Centros registrados</h2></main></div>
  :
  <div className='center-layout grid min-h-dvh grid-rows-[auto_minmax(0,1fr)] bg-slate-100/80'>
    <CenterHeader centerId={centerId} centerName='Centro Médico Salud Plus' user={{id:'user',firstName:'Ana',lastName:'Pérez',email:'ana@example.test'}} role={role} isPlatformAdmin={platform}/>
    <div className='min-w-0 md:flex'>
      <CenterSidebar centerId={centerId} role={role}/>
      <div className='min-w-0 flex-1'>
      {module ? <main className='px-5 py-8 sm:px-8 sm:py-10'><div className='mx-auto max-w-[1400px]'><ModuleHeader centerId={centerId} title={location.pathname.split('/')[4]?'Detalle del turno':titles[module]||'Detalle'} description='Pantalla operativa del centro' parent={location.pathname.split('/')[4]?{label:'Turnos',href:'/centers/'+centerId+'/appointments'}:undefined}/></div></main>
        : <CenterDashboard centerId={centerId} membershipId='member' role={role}/>}
      </div>
    </div>
  </div>);
`,
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
      { find: "../actions/auth-actions", replacement: join(temporary, "auth-actions.ts") },
      {
        find: "@/components/navigation-loader",
        replacement: join(temporary, "navigation-loader.tsx"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root, temporary] } },
});

let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}/centers/11111111-1111-4111-8111-111111111111`;
  browser = await chromium.launch({ headless: true });
  for (const [width, height] of [
    [1366, 608],
    [1366, 768],
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
    if (width !== 390)
      await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(overflow <= 0, `${width}x${height}: horizontal overflow ${overflow}px`);
    const platform = page.getByRole("link", { name: "Administrar plataforma" });
    const logout = page.getByRole("button", { name: "Cerrar sesión" });
    const refresh = page.getByRole("button", { name: "Actualizar" });
    await expect(platform).toBeVisible();
    await expect(logout).toBeVisible();
    await expect(refresh).toBeVisible();
    for (const control of [platform, logout, refresh]) {
      const box = await control.boundingBox();
      assert(box && Math.abs(box.width - 44) < 1 && Math.abs(box.height - 44) < 1);
      const tooltip = control.locator('span[aria-hidden="true"]');
      await expect(tooltip).toHaveCSS("opacity", "0");
      await control.hover();
      await expect(tooltip).toHaveCSS("opacity", "1");
      assert(
        (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
        `${width}x${height}: tooltip caused horizontal overflow`,
      );
      await page.mouse.move(width / 2, height - 20);
      await expect(tooltip).toHaveCSS("opacity", "0");
    }
    for (let i = 0; i < 5 && !(await platform.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press("Tab");
    await expect(platform).toBeFocused();
    await expect(platform.locator('span[aria-hidden="true"]')).toHaveCSS("opacity", "1");
    await page.keyboard.press("Tab");
    await expect(logout).toBeFocused();
    await expect(logout.locator('span[aria-hidden="true"]')).toHaveCSS("opacity", "1");
    for (let i = 0; i < 15 && !(await refresh.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press("Tab");
    await expect(refresh).toBeFocused();
    await expect(refresh.locator('span[aria-hidden="true"]')).toHaveCSS("opacity", "1");
    const headerBox = await page.getByRole("banner").boundingBox();
    assert(headerBox && headerBox.x === 0 && Math.abs(headerBox.width - width) < 1);
    const brand = page.getByRole("banner").getByRole("link", { name: "Salud Plus" });
    const [brandBox, iconBox, labelBox] = await Promise.all([
      brand.boundingBox(),
      brand.locator("svg").boundingBox(),
      brand.locator("span").boundingBox(),
    ]);
    assert(brandBox && iconBox && labelBox);
    assert(brandBox.x >= 16 && brandBox.x <= 24, `${width}x${height}: brand left margin`);
    assert(Math.abs(iconBox.y + iconBox.height / 2 - labelBox.y - labelBox.height / 2) < 2);
    assert.equal(await brand.evaluate((link) => getComputedStyle(link).cursor), "pointer");
    await expect(brand).toHaveAttribute("href", "/centers/11111111-1111-4111-8111-111111111111");
    if (width !== 390) {
      const [platformBox, logoutBox] = await Promise.all([
        platform.boundingBox(),
        logout.boundingBox(),
      ]);
      assert(platformBox && logoutBox);
      assert(
        Math.abs(platformBox.y - logoutBox.y) < 2 &&
          platformBox.x + platformBox.width < logoutBox.x,
        `${width}x${height}: header actions are not on one row`,
      );
      assert(logoutBox.x + logoutBox.width <= width, `${width}x${height}: header overflow`);
    }
    await page.screenshot({
      path: join(output, `${width}x${height}-dashboard.png`),
      fullPage: true,
    });
    if (width !== 390) {
      const sidebar = page.getByRole("complementary", { name: "Barra lateral del centro" });
      const sidebarBefore = await sidebar.boundingBox();
      assert(sidebarBefore && sidebarBefore.y >= headerBox.y + headerBox.height - 1);
      const mainBefore = await page.locator("main").boundingBox();
      await expect(sidebar).toHaveAttribute("data-expanded", "false");
      assert(Math.abs((await sidebar.boundingBox()).width - 64) < 1);
      await page.mouse.move(32, 125);
      await expect(sidebar).toHaveAttribute("data-expanded", "true");
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBeGreaterThan(235);
      await page.mouse.move(180, 125);
      await expect(sidebar).toHaveAttribute("data-expanded", "true");
      assert.notEqual(await sidebar.evaluate((el) => getComputedStyle(el).boxShadow), "none");
      const mainExpanded = await page.locator("main").boundingBox();
      const headerExpanded = await page.getByRole("banner").boundingBox();
      assert(
        mainBefore &&
          mainExpanded &&
          mainExpanded.x === mainBefore.x &&
          mainExpanded.width === mainBefore.width,
      );
      assert.deepEqual(headerExpanded, headerBox, `${width}x${height}: header moved on expand`);
      await page.screenshot({ path: join(output, `${width}x${height}-dashboard-expanded.png`) });
      await page.mouse.move(300, 125);
      await expect(sidebar).toHaveAttribute("data-expanded", "false");
      await expect.poll(async () => (await sidebar.boundingBox()).width).toBeLessThan(65);
      if (width === 1366 && height === 768) {
        await page.reload();
        const dashboardLink = page.getByRole("link", { name: "Dashboard" });
        for (
          let i = 0;
          i < 4 && !(await dashboardLink.evaluate((el) => el === document.activeElement));
          i++
        )
          await page.keyboard.press("Tab");
        await expect(dashboardLink).toBeFocused();
        await expect(sidebar).toHaveAttribute("data-expanded", "true");
        await page.mouse.move(300, 125);
        await expect(sidebar).toHaveAttribute("data-expanded", "true");
        await page.getByRole("button", { name: "Cerrar sesión" }).focus();
        await expect(sidebar).toHaveAttribute("data-expanded", "false");
        await page.getByRole("link", { name: "Turnos" }).click();
        await expect(page.getByRole("heading", { name: "Turnos" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Turnos" })).toHaveAttribute(
          "aria-current",
          "page",
        );
      }
    }
    if (width === 390) {
      await page.getByRole("button", { name: "Actualizar" }).click({ timeout: 5000 });
      await expect(page.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
      await page.getByRole("button", { name: "Abrir menú de navegación" }).click();
      await expect(page.getByRole("dialog", { name: "Menú de navegación" })).toBeVisible();
      await expect(
        page.getByRole("dialog").getByRole("link", { name: "Dashboard" }),
      ).toHaveAttribute("aria-current", "page");
      await page.screenshot({ path: join(output, `${width}x${height}-menu.png`) });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Menú de navegación" })).toHaveCount(0);
      await page.getByRole("button", { name: "Abrir menú de navegación" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Agenda" }).click();
      await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Menú de navegación" })).toHaveCount(0);
    }
    assert.deepEqual(errors, [], `${width}x${height}: browser errors`);
    await page.close();
    console.log(`PASS ${width}x${height} dashboard, active link, overflow`);
  }
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`${base}/appointments/123`);
  await expect(
    page
      .getByRole("navigation", { name: "Navegación del centro" })
      .getByRole("link", { name: "Turnos" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(`${base}/patients?role=RECEPTION`);
  await expect(page.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Profesionales" })).toHaveCount(0);
  await page.goto(`${base}/agenda?role=PROFESSIONAL`);
  await expect(page.getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Pacientes" })).toHaveCount(0);
  await page.goto(`${base}/professionals/123/availability?role=PROFESSIONAL`);
  await expect(page.getByRole("link", { name: "Disponibilidad" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.close();
  console.log("PASS module active states and role visibility");
  const scrollPage = await browser.newPage({ viewport: { width: 1366, height: 608 } });
  await scrollPage.goto(`${base}/settings`);
  const shortHeight = await scrollPage.evaluate(() => document.documentElement.scrollHeight);
  assert(shortHeight <= 609, `short module has unnecessary vertical scroll: ${shortHeight}px`);
  await scrollPage.locator("main").evaluate((main) => {
    main.style.minHeight = "180vh";
  });
  await scrollPage.evaluate(() => scrollTo(0, 400));
  const scrollPosition = await scrollPage.evaluate(() => scrollY);
  assert(scrollPosition > 0, "vertical page scrolling failed");
  const stickySidebar = await scrollPage
    .getByRole("complementary", { name: "Barra lateral del centro" })
    .boundingBox();
  assert(stickySidebar && Math.abs(stickySidebar.y) < 1, "sidebar did not remain sticky");
  await scrollPage.close();
  console.log("PASS short page height and vertical scrolling");
  for (const [width, height] of [
    [1366, 608],
    [1366, 768],
    [1440, 900],
    [390, 844],
  ]) {
    const modulePage = await browser.newPage({ viewport: { width, height } });
    for (const [modulePath, title] of Object.entries({
      agenda: "Agenda",
      appointments: "Turnos",
      patients: "Pacientes",
      professionals: "Profesionales",
      availability: "Disponibilidad",
      specialties: "Especialidades",
      users: "Gestión de usuarios",
      settings: "Configuración del centro",
    })) {
      await modulePage.goto(`${base}/${modulePath}`);
      await expect(modulePage.getByRole("heading", { name: title })).toBeVisible();
      await expect(modulePage.getByRole("navigation", { name: "Ruta de navegación" })).toHaveCount(
        0,
      );
      const overflow = await modulePage.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      );
      assert(overflow <= 0, `${width}x${height} ${modulePath}: horizontal overflow ${overflow}px`);
      if (["appointments", "patients", "professionals"].includes(modulePath))
        await modulePage.screenshot({ path: join(output, `${width}x${height}-${modulePath}.png`) });
      if (modulePath === "settings") {
        const brand = modulePage.getByRole("banner").getByRole("link", { name: "Salud Plus" });
        await modulePage.keyboard.press("Tab");
        await expect(brand).toBeFocused();
        assert.notEqual(
          await brand.evaluate((link) => getComputedStyle(link).outlineStyle),
          "none",
          `${width}x${height}: brand focus indicator is missing`,
        );
        await modulePage.keyboard.press("Enter");
        await expect(modulePage.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
      }
      if (width !== 390 && modulePath === "appointments") {
        const sidebar = modulePage.getByRole("complementary", { name: "Barra lateral del centro" });
        const mainBefore = await modulePage.locator("main").boundingBox();
        await modulePage.mouse.move(32, 125);
        await expect(sidebar).toHaveAttribute("data-expanded", "true");
        const mainExpanded = await modulePage.locator("main").boundingBox();
        assert(
          mainBefore &&
            mainExpanded &&
            mainExpanded.x === mainBefore.x &&
            mainExpanded.width === mainBefore.width,
        );
        await modulePage.mouse.move(300, 125);
      }
    }
    await modulePage.goto(`${base}/appointments/123`);
    await expect(modulePage.getByRole("navigation", { name: "Ruta de navegación" })).toBeVisible();
    await expect(
      modulePage
        .getByRole("navigation", { name: "Ruta de navegación" })
        .getByRole("link", { name: "Turnos" }),
    ).toBeVisible();
    await modulePage.goto(`${base}/agenda?role=RECEPTION&platform=false`);
    await expect(modulePage.getByRole("link", { name: "Administrar plataforma" })).toHaveCount(0);
    await expect(modulePage.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await modulePage.close();
    console.log(`PASS ${width}x${height} main modules, detail return, no-platform header`);
  }
  const touchPage = await browser.newPage({
    viewport: { width: 820, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  await touchPage.goto(base);
  await expect(
    touchPage.getByRole("complementary", { name: "Barra lateral del centro" }),
  ).toBeHidden();
  await touchPage.getByRole("button", { name: "Abrir menú de navegación" }).click();
  await expect(touchPage.getByRole("dialog", { name: "Menú de navegación" })).toBeVisible();
  await expect(touchPage.getByRole("dialog").getByRole("link", { name: "Agenda" })).toBeVisible();
  await touchPage.close();
  console.log("PASS 820x900 touch menu");
  const platformOrigin = new URL(base).origin;
  for (const [width, height] of [
    [1366, 608],
    [1366, 768],
    [1440, 900],
    [390, 844],
  ]) {
    const platformPage = await browser.newPage({ viewport: { width, height } });
    await platformPage.goto(`${platformOrigin}/platform`);
    const header = platformPage.getByRole("banner");
    const headerBox = await header.boundingBox();
    assert(headerBox && headerBox.x === 0 && Math.abs(headerBox.width - width) < 1);
    const platformBrand = header.getByRole("link", { name: "Salud Plus" });
    await expect(platformBrand).toHaveAttribute("href", "/platform");
    await expect(platformBrand).toHaveCSS("cursor", "pointer");
    const brandBox = await platformBrand.boundingBox();
    const contextBox = await header
      .getByText("Administración de plataforma", { exact: true })
      .locator("..")
      .boundingBox();
    assert(brandBox && contextBox);
    if (width >= 640) {
      assert(
        Math.abs(brandBox.y + brandBox.height / 2 - (contextBox.y + contextBox.height / 2)) < 2,
        `${width}x${height}: platform brand is not vertically centered`,
      );
    }
    await expect(header.getByRole("heading", { name: "Centros" })).toBeVisible();
    await expect(header.getByText("Cuenta: admin@example.test")).toBeVisible();
    await expect(
      header.getByText("Desde este panel no se accede a pacientes, agenda ni datos clínicos."),
    ).toBeVisible();
    await expect(platformPage.getByRole("complementary")).toHaveCount(0);
    const centerLink = header.getByRole("link", { name: "Ir a mi centro" });
    const logout = header.getByRole("button", { name: "Cerrar sesión" });
    for (const control of [centerLink, logout]) {
      const box = await control.boundingBox();
      assert(box && Math.abs(box.width - 44) < 1 && Math.abs(box.height - 44) < 1);
      await expect(control).toHaveCSS("cursor", "pointer");
      const tooltip = control.locator('span[aria-hidden="true"]');
      await control.hover();
      await expect(tooltip).toHaveCSS("opacity", "1");
      assert(
        (await platformPage.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
        `${width}x${height}: platform header horizontal overflow`,
      );
      await platformPage.mouse.move(width / 2, height - 20);
    }
    await platformPage.keyboard.press("Tab");
    await expect(platformBrand).toBeFocused();
    await platformPage.keyboard.press("Tab");
    await expect(centerLink).toBeFocused();
    await expect(centerLink.locator('span[aria-hidden="true"]')).toHaveCSS("opacity", "1");
    await platformPage.keyboard.press("Tab");
    await expect(logout).toBeFocused();
    await expect(logout.locator('span[aria-hidden="true"]')).toHaveCSS("opacity", "1");
    await platformPage.screenshot({ path: join(output, `${width}x${height}-platform.png`) });
    await expect(centerLink).toHaveAttribute(
      "href",
      "/centers/11111111-1111-4111-8111-111111111111",
    );
    await centerLink.click();
    await expect(platformPage.getByRole("heading", { name: "Actividad de hoy" })).toBeVisible();
    await platformPage.goto(`${platformOrigin}/platform?centers=many`);
    await expect(platformPage.getByRole("link", { name: "Seleccionar centro" })).toHaveAttribute(
      "href",
      "/select-center",
    );
    await platformPage.goto(`${platformOrigin}/platform?centers=none`);
    await expect(platformPage.getByRole("link", { name: "Ir a mi centro" })).toHaveCount(0);
    await platformPage.close();
    console.log(`PASS ${width}x${height} platform header, actions, overflow`);
  }
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const refreshPage = await browser.newPage({
      viewport: { width: 1366, height: 768 },
      reducedMotion,
    });
    await refreshPage.goto(base);
    const refresh = refreshPage.getByRole("button", { name: "Actualizar" });
    await expect(refresh).toHaveCSS("cursor", "pointer");
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await expect(refresh).toHaveAttribute("aria-busy", "true");
    await expect(refresh.locator("svg")).toHaveCSS(
      "animation-name",
      reducedMotion === "reduce" ? "none" : "spin",
    );
    await refreshPage.screenshot({
      path: join(output, `1366x768-refresh-${reducedMotion}.png`),
    });
    await expect(refresh).toBeEnabled();
    await expect(refresh).toHaveAttribute("aria-busy", "false");
    await expect(refresh.locator("svg")).toHaveCSS("animation-name", "none");
    await refreshPage.close();
    console.log(`PASS refresh animation with reducedMotion=${reducedMotion}`);
  }
} finally {
  await browser?.close();
  await server.close();
  rmSync(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
