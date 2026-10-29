// Chromium verification of mounted product components with synthetic data.
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
const cache = resolve("node_modules/.cache/task033-visual-sixth-v2");
const output = resolve(".harness/tasks/active/TASK-033/evidence/sixth-iteration");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  'export function useRouter(){return {refresh(){}}} export function usePathname(){return location.search.includes("module") ? "/centers/11111111-1111-4111-8111-111111111111/appointments" : "/centers/11111111-1111-4111-8111-111111111111"} export function redirect(path){throw new Error("REDIRECT:"+path)}',
);
writeFileSync(
  resolve(cache, "link.tsx"),
  'import React from "react"; export function useLinkStatus(){return {pending:false}} export default function Link({href,children,...rest}){return <a href={href} {...rest}>{children}</a>}',
);
writeFileSync(
  resolve(cache, "actions.ts"),
  [
    'export async function createPlatformCenterAction(_,formData){window.__createCalls=(window.__createCalls||0)+1;if(window.__holdCreate)await new Promise(resolve=>window.__releaseCreate=resolve);if(window.__returnUncertain)return {status:"error",retryMode:"same-operation",message:"No pudimos confirmar el resultado. Reintentá esta misma operación."};return {status:"success",message:"Centro creado."}}',
    'export async function resolvePlatformIdentityAction(email){return {status:"success",email,identityExists:false,message:"La identidad es nueva."}}',
    'export async function setPlatformCenterActiveAction(_,formData){window.__statusCalls=(window.__statusCalls||0)+1;return {status:"success",message:formData.get("isActive")==="false"?"Centro desactivado.":"Centro reactivado."}}',
  ].join("\n"),
);
writeFileSync(
  resolve(cache, "auth-actions.ts"),
  'export async function logoutAction(){return {status:"idle"}}',
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
  [
    "export async function listPlatformCenters(){return [",
    '{center_id:"11111111-1111-4111-8111-111111111111",name:"Centro Norte",is_active:true,address:"Av. Salud 123",phone:"+54 11 4444 5555",email:"administracion-contacto-institucional-muy-largo@subdominio.example.test",created_at:"2026-09-23T12:00:00.000Z",active_membership_count:4,active_professional_center_count:2,active_specialty_count:3},',
    '{center_id:"22222222-2222-4222-8222-222222222222",name:"Centro Sur",is_active:false,address:null,phone:null,email:null,created_at:"2026-09-24T12:00:00.000Z",active_membership_count:1,active_professional_center_count:0,active_specialty_count:0}',
    "]}",
  ].join("\n"),
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  [
    'import React from "react";',
    'import {createRoot} from "react-dom/client";',
    'import PlatformPage from "@/app/platform/page";',
    'import {CenterHeader} from "@/modules/access/components/center-header";',
    'import "@/app/globals.css";',
    'const actor="99999999-9999-4999-8999-999999999999";',
    'const isCenter=location.search.includes("center") || location.search.includes("module");',
    'createRoot(document.getElementById("root")).render(isCenter ?',
    '<CenterHeader centerId="11111111-1111-4111-8111-111111111111" centerName="Centro Norte" user={{id:actor,firstName:"Ana",lastName:"Admin",email:"ana@example.test"}} role="ADMIN" isPlatformAdmin={true}/> :',
    "await PlatformPage());",
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
      { find: "../actions/platform-actions", replacement: resolve(cache, "actions.ts") },
      { find: "../actions/auth-actions", replacement: resolve(cache, "auth-actions.ts") },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31035, strictPort: true, fs: { allow: [root] } },
});
async function assertModalCursors(dialog, state, width) {
  const incorrect = await dialog.evaluate((element) =>
    Array.from(element.querySelectorAll("button"))
      .filter((button) => button.getClientRects().length > 0)
      .filter(
        (button) =>
          getComputedStyle(button).cursor !== (button.disabled ? "not-allowed" : "pointer"),
      )
      .map((button) => button.getAttribute("aria-label") || button.textContent.trim()),
  );
  assert.deepEqual(incorrect, [], `cursor mismatch in ${state} at ${width}`);
}
let browser;
const results = [];
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
    await page.goto("http://127.0.0.1:31035/");
    await expect(page.getByRole("heading", { name: "Centros", exact: true }).first()).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "administracion-contacto-institucional-muy-largo@subdominio.example.test",
    );
    const centerLink = page.getByRole("link", { name: "Ir a mi centro" });
    await expect(centerLink).toBeVisible();
    assert.equal(
      await centerLink.evaluate((element) => getComputedStyle(element).cursor),
      "pointer",
    );
    const descriptionGap = await page
      .getByText("Gestioná los centros, sus estados y sus administradores iniciales.")
      .evaluate(
        (element) =>
          element.nextElementSibling.getBoundingClientRect().top -
          element.getBoundingClientRect().bottom,
      );
    assert.equal(descriptionGap, 4, "platform description gap at " + width);
    assert.deepEqual(
      await centerLink.evaluate((element) => {
        const icon = element.querySelector("svg");
        return [
          icon?.getAttribute("aria-hidden"),
          icon?.getAttribute("stroke"),
          getComputedStyle(icon).width,
          getComputedStyle(element).columnGap,
        ];
      }),
      ["true", "currentColor", "17px", "8px"],
    );
    await centerLink.screenshot({
      path: resolve(output, "navigation-to-center-" + width + ".png"),
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "list overflow at " + width,
    );
    await page.screenshot({
      path: resolve(output, "platform-overview-" + width + ".png"),
      fullPage: true,
    });
    await page
      .locator("body > #root header")
      .first()
      .screenshot({
        path: resolve(output, "platform-header-" + width + ".png"),
      });
    await page
      .locator("body > #root header")
      .first()
      .screenshot({
        path: resolve(output, "platform-description-" + width + ".png"),
      });
    await page.getByRole("region", { name: "Centros registrados" }).screenshot({
      path: resolve(output, "centers-section-" + width + ".png"),
    });
    const listY = await page
      .getByRole("heading", { name: "Centros registrados" })
      .evaluate((element) => element.getBoundingClientRect().top + scrollY);
    assert.equal(
      await page
        .getByRole("button", { name: "Crear centro" })
        .evaluate((element) => getComputedStyle(element).cursor),
      "pointer",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Desactivar" })
        .first()
        .evaluate((element) => getComputedStyle(element).cursor),
      "pointer",
    );
    await page.getByRole("button", { name: "Desactivar" }).first().click();
    const statusDialog = page.getByRole("dialog", { name: "Desactivar centro" });
    await expect(statusDialog).toBeVisible();
    await assertModalCursors(statusDialog, "deactivation", width);
    await expect(statusDialog.getByRole("button", { name: "Volver" })).toBeFocused();
    assert.equal(await page.evaluate(() => window.__statusCalls || 0), 0);
    await statusDialog.screenshot({
      path: resolve(output, "deactivation-modal-" + width + ".png"),
    });
    await page.keyboard.press("Escape");
    await expect(statusDialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Desactivar" }).first()).toBeFocused();
    assert.equal(await page.evaluate(() => window.__statusCalls || 0), 0);
    await page.getByRole("button", { name: "Desactivar" }).first().click();
    await page.keyboard.press("Tab");
    await expect(statusDialog.getByRole("button", { name: "Desactivar centro" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(statusDialog.getByRole("button", { name: "Volver" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(statusDialog.getByRole("button", { name: "Desactivar centro" })).toBeFocused();
    await statusDialog.getByRole("button", { name: "Desactivar centro" }).click();
    await expect(statusDialog).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.__statusCalls || 0), 1);
    await expect(page.getByRole("status")).toHaveText("Centro desactivado.");
    await page.getByRole("button", { name: "Crear centro" }).click();
    const dialog = page.getByRole("dialog", { name: "Crear centro" });
    await expect(dialog).toBeVisible();
    await assertModalCursors(dialog, "step 1", width);
    await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => Boolean(document.activeElement?.closest("dialog"))),
      true,
      "focus left dialog at " + width,
    );
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Continuar" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    assert.deepEqual(
      await dialog.evaluate((element) => [
        getComputedStyle(element.firstElementChild).borderBottomWidth,
        getComputedStyle(element.querySelector("[data-center-modal-footer]")).borderTopWidth,
      ]),
      ["0px", "0px"],
      "step 1 dividers at " + width,
    );
    const stepOneBounds = await dialog.boundingBox();
    const continueBounds = await dialog.getByRole("button", { name: "Continuar" }).boundingBox();
    assert.equal(
      Math.abs(
        continueBounds.x + continueBounds.width / 2 - (stepOneBounds.x + stepOneBounds.width / 2),
      ) < 2,
      true,
      "step 1 action not centered at " + width,
    );
    assert.equal(
      await dialog
        .getByRole("button", { name: "Continuar" })
        .evaluate((element) => getComputedStyle(element).cursor),
      "pointer",
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Centros registrados" })
        .evaluate((element) => element.getBoundingClientRect().top + scrollY),
      listY,
      "list moved at " + width,
    );
    await page.locator("dialog").screenshot({
      path: resolve(output, "modal-step1-" + width + ".png"),
    });
    const firstStepEmail = dialog.getByLabel("Email del primer administrador");
    await firstStepEmail.fill("dfs@asda");
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog.getByText("Ingresá un email válido.")).toBeVisible();
    await expect(firstStepEmail).toBeFocused();
    assert.equal(await firstStepEmail.evaluate((field) => field.form.noValidate), true);
    await dialog.screenshot({ path: resolve(output, "email-invalid-" + width + ".png") });
    await firstStepEmail.fill("new.admin@example.test");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Cerrar alta de centro" }).getByText("¿Descartar alta?"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Seguir editando" })).toBeFocused();
    await assertModalCursors(page.getByRole("dialog"), "discard", width);
    await page
      .locator("dialog")
      .screenshot({ path: resolve(output, "modal-discard-" + width + ".png") });
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(dialog.getByLabel("Email del primer administrador")).toHaveValue(
      "new.admin@example.test",
    );
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(dialog.getByText("Paso 2 de 3 · Datos del centro")).toBeVisible();
    await assertModalCursors(dialog, "step 2", width);
    const timezone = dialog.getByRole("combobox", { name: "Zona horaria" });
    await expect(timezone).toHaveValue("Buenos Aires, Argentina (GMT-3)");
    assert.equal(
      await dialog.locator('input[name="centerTimezone"]').inputValue(),
      "America/Argentina/Buenos_Aires",
    );
    await timezone.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("option", { name: /Buenos Aires/ }).first()).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("button", { name: "Mostrar zonas horarias" }).click();
    assert.equal(
      (await page.getByRole("option").count()) > 400,
      true,
      "timezone suggestions missing at " + width,
    );
    await expect(page.getByRole("listbox")).toHaveCSS("overflow-y", "auto");
    await timezone.fill("Buenos");
    await expect(page.getByRole("option", { name: /Buenos Aires/ }).first()).toBeVisible();
    await timezone.press("ArrowDown");
    await timezone.press("Enter");
    await expect(timezone).toHaveValue("Buenos Aires, Argentina (GMT-3)");
    await timezone.scrollIntoViewIfNeeded();
    await page.locator("dialog").screenshot({
      path: resolve(output, "timezone-selector-" + width + ".png"),
    });
    await timezone.click();
    await timezone.press("ArrowDown");
    await page.locator("dialog").screenshot({
      path: resolve(output, "timezone-focused-" + width + ".png"),
    });
    await timezone.fill("Paris");
    await page.getByRole("option", { name: /Europe\/Paris/ }).click();
    await expect(timezone).toHaveValue(/Paris, Francia \(GMT[+-]/);
    await timezone.fill("US/Eastern");
    await expect(timezone).toHaveValue("US/Eastern");
    await timezone.fill("America/Argentina/Buenos_Aires");
    await page.setViewportSize({ width, height: 540 });
    await timezone.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Mostrar zonas horarias" }).click();
    const timezoneGeometry = await page.getByRole("listbox").evaluate((list) => {
      const field = document.querySelector('input[role="combobox"]');
      const modal = list.closest("dialog");
      const listRect = list.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const modalRect = modal.getBoundingClientRect();
      const footerRect = modal.querySelector("[data-center-modal-footer]").getBoundingClientRect();
      const headerRect = modal.firstElementChild.getBoundingClientRect();
      return {
        aligned:
          Math.abs(listRect.left - fieldRect.left) <= 2 &&
          Math.abs(listRect.width - fieldRect.width) <= 2,
        contained: listRect.top >= modalRect.top && listRect.bottom <= modalRect.bottom,
        clearOfFooter: listRect.bottom <= footerRect.top,
        clearOfHeader: listRect.top >= headerRect.bottom,
        scrollable: list.scrollHeight > list.clientHeight,
        height: listRect.height,
      };
    });
    assert.deepEqual(
      [
        timezoneGeometry.aligned,
        timezoneGeometry.contained,
        timezoneGeometry.clearOfFooter,
        timezoneGeometry.clearOfHeader,
        timezoneGeometry.scrollable,
        timezoneGeometry.height <= 240,
      ],
      [true, true, true, true, true, true],
      "timezone popup geometry at " + width,
    );
    await page
      .locator("dialog")
      .screenshot({ path: resolve(output, "timezone-short-" + width + ".png") });
    await timezone.press("Escape");
    await page.setViewportSize({ width, height: 900 });
    await dialog.locator('input[name="centerName"]').fill("Centro Nuevo");
    await dialog.locator('input[name="centerAddress"]').fill("Calle Salud 456");
    await dialog.locator('input[name="centerPhone"]').fill("+54 11 5555 5555");
    await dialog.locator('input[name="centerEmail"]').fill("nuevo@example.test");
    await dialog.locator('input[name="adminFirstName"]').fill("Nueva");
    await dialog.locator('input[name="adminLastName"]').fill("Administradora");
    await page.setViewportSize({ width, height: 540 });
    await dialog.locator("[data-center-modal-scroll]").evaluate((element) => {
      element.scrollTop = 0;
    });
    const backgroundY = await page.evaluate(() => document.scrollingElement.scrollTop);
    await dialog.getByRole("button", { name: "Revisar centro" }).click();
    const password = dialog.locator('input[name="adminInitialPassword"]');
    await expect(password).toBeFocused();
    await expect(
      dialog.getByText("La contraseña debe tener al menos 10 caracteres."),
    ).toBeVisible();
    assert.deepEqual(
      await password.evaluate((element) => [
        element.getAttribute("aria-invalid"),
        document.getElementById(element.getAttribute("aria-describedby"))?.textContent,
      ]),
      ["true", "La contraseña debe tener al menos 10 caracteres."],
    );
    await expect
      .poll(() =>
        dialog.locator("[data-center-modal-scroll]").evaluate((element) => element.scrollTop),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        dialog.getByText("La contraseña debe tener al menos 10 caracteres.").evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const scrollBounds = element
            .closest("[data-center-modal-scroll]")
            .getBoundingClientRect();
          return bounds.top >= scrollBounds.top && bounds.bottom <= scrollBounds.bottom;
        }),
      )
      .toBe(true);
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollTop), backgroundY);
    assert.equal(
      await dialog.evaluate((element) => {
        const header = element.firstElementChild.getBoundingClientRect();
        const scroll = element.querySelector("[data-center-modal-scroll]").getBoundingClientRect();
        const footer = element.querySelector("[data-center-modal-footer]").getBoundingClientRect();
        return header.bottom <= scroll.top + 1 && scroll.bottom <= footer.top + 1;
      }),
      true,
      "modal regions overlap at " + width,
    );
    await page
      .locator("dialog")
      .screenshot({ path: resolve(output, "modal-errors-" + width + ".png") });
    assert.equal(
      await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
      true,
      "modal horizontal overflow at " + width,
    );
    await page.setViewportSize({ width, height: 900 });
    await dialog.locator('input[name="adminInitialPassword"]').fill("password-12345");
    await dialog.getByLabel("Confirmar contraseña").fill("password-12345");
    await dialog.locator("[data-center-modal-scroll]").evaluate((element) => {
      element.scrollTop = 0;
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "details overflow at " + width,
    );
    await page.locator("dialog").screenshot({
      path: resolve(output, "modal-step2-" + width + ".png"),
    });
    if (width === 390) {
      await page.setViewportSize({ width, height: 540 });
      const bounds = await dialog.boundingBox();
      assert.equal(Boolean(bounds && bounds.height <= 524), true, "keyboard viewport height");
      await expect(dialog.getByRole("button", { name: "Revisar centro" })).toBeVisible();
      await page.locator("dialog").screenshot({ path: resolve(output, "modal-keyboard-390.png") });
      await page.setViewportSize({ width, height: 900 });
    }
    await dialog.locator("[data-center-modal-scroll]").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.locator("dialog").screenshot({
      path: resolve(output, "modal-step2-bottom-" + width + ".png"),
    });
    assert.equal(
      await dialog.evaluate((element) => {
        const buttons = Array.from(element.querySelectorAll("[data-center-modal-footer] button"));
        const first = buttons[0].getBoundingClientRect();
        const last = buttons.at(-1).getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        return Math.abs((first.left + last.right) / 2 - (bounds.left + bounds.right) / 2) < 2;
      }),
      true,
      "step 2 actions not centered at " + width,
    );
    await dialog.getByRole("button", { name: "Revisar centro" }).click();
    await expect(dialog.getByText("Paso 3 de 3 · Revisión")).toBeVisible();
    await assertModalCursors(dialog, "review", width);
    await dialog.getByRole("button", { name: "Volver a editar" }).click();
    await expect(dialog.locator('input[name="centerName"]')).toHaveValue("Centro Nuevo");
    await dialog.getByRole("button", { name: "Revisar centro" }).click();
    await expect(dialog.getByText("Paso 3 de 3 · Revisión")).toBeVisible();
    for (const label of ["Confirmar creación", "Cambiar email"]) {
      const rect = await dialog.getByRole("button", { name: label }).boundingBox();
      const dialogRect = await dialog.boundingBox();
      assert.equal(
        Boolean(
          rect &&
          dialogRect &&
          rect.y >= dialogRect.y &&
          rect.y + rect.height <= dialogRect.y + dialogRect.height,
        ),
        true,
        label + " clipped at " + width,
      );
    }
    assert.equal(
      await page.evaluate(() => window.__createCalls || 0),
      0,
      "review mutated at " + width,
    );
    await expect(dialog.getByText(/Hay una creación pendiente de confirmar/)).toHaveCount(0);
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    await page.locator("dialog").screenshot({
      path: resolve(output, "modal-step3-normal-" + width + ".png"),
    });
    assert.equal(
      await dialog.evaluate((element) => {
        const buttons = Array.from(element.querySelectorAll("[data-center-modal-footer] button"));
        const first = buttons[0].getBoundingClientRect();
        const last = buttons.at(-1).getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        return Math.abs((first.left + last.right) / 2 - (bounds.left + bounds.right) / 2) < 2;
      }),
      true,
      "step 3 actions not centered at " + width,
    );
    await page.evaluate(() => {
      window.__holdCreate = true;
    });
    await dialog.getByRole("button", { name: "Confirmar creación" }).click();
    await expect(dialog.getByText(/Hay una creación pendiente de confirmar/)).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Creando centro…" })).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Abandonar e iniciar nueva alta" }),
    ).toHaveCount(0);
    await assertModalCursors(dialog, "pending", width);
    assert.equal(await page.evaluate(() => window.__createCalls || 0), 1);
    assert.equal(
      await page.evaluate(() =>
        Object.values(sessionStorage).join("\n").includes("password-12345"),
      ),
      false,
    );
    await page.locator("dialog").screenshot({
      path: resolve(output, "modal-pending-intentional-" + width + ".png"),
    });
    await page.evaluate(() => {
      window.__holdCreate = false;
      window.__releaseCreate?.();
    });
    await expect(
      page
        .getByRole("dialog", { name: "Centro creado" })
        .getByText("El centro se creó correctamente y ya está disponible para su administración."),
    ).toBeVisible();
    await assertModalCursors(page.getByRole("dialog", { name: "Centro creado" }), "success", width);
    await page.locator("dialog").screenshot({
      path: resolve(output, "modal-success-" + width + ".png"),
    });
    assert.equal(
      await page.evaluate(() => window.__createCalls || 0),
      1,
      "create count at " + width,
    );
    await page.getByRole("button", { name: "Crear otro centro" }).click();
    await dialog.getByLabel("Email del primer administrador").fill("retry.admin@example.test");
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await dialog.locator('input[name="centerName"]').fill("Centro pendiente");
    await dialog.locator('input[name="adminFirstName"]').fill("Nueva");
    await dialog.locator('input[name="adminLastName"]').fill("Administradora");
    await dialog.locator('input[name="adminInitialPassword"]').fill("password-12345");
    await dialog.getByLabel("Confirmar contraseña").fill("password-12345");
    await dialog.getByRole("button", { name: "Revisar centro" }).click();
    const uncertainOperationId = await dialog.locator('input[name="operationId"]').inputValue();
    await page.evaluate(() => {
      window.__returnUncertain = true;
    });
    await dialog.getByRole("button", { name: "Confirmar creación" }).click();
    await expect(dialog.getByText(/Hay una creación pendiente de confirmar/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Reintentar / verificar" })).toBeVisible();
    assert.equal(
      await dialog.locator('input[name="operationId"]').inputValue(),
      uncertainOperationId,
    );
    await expect(
      dialog.getByRole("button", { name: /iniciar nueva alta|Crear otro centro/i }),
    ).toHaveCount(0);
    await dialog.screenshot({ path: resolve(output, "modal-uncertain-" + width + ".png") });
    await page.goto("http://127.0.0.1:31035/?center");
    const platformLink = page.getByRole("link", { name: "Administrar plataforma" });
    await expect(platformLink).toBeVisible();
    assert.deepEqual(
      await platformLink.evaluate((element) => {
        const icon = element.querySelector("svg");
        return [
          icon?.getAttribute("aria-hidden"),
          icon?.getAttribute("stroke"),
          getComputedStyle(icon).width,
          getComputedStyle(element).columnGap,
        ];
      }),
      ["true", "currentColor", "17px", "8px"],
    );
    await platformLink.screenshot({
      path: resolve(output, "navigation-to-platform-" + width + ".png"),
    });
    await page.screenshot({
      path: resolve(output, "center-header-" + width + ".png"),
      fullPage: true,
    });
    const platformBounds = await platformLink.boundingBox();
    const logoutBounds = await page.getByRole("button", { name: "Cerrar sesión" }).boundingBox();
    assert.equal(
      await platformLink.evaluate((element) => getComputedStyle(element).cursor),
      "pointer",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Cerrar sesión" })
        .evaluate((element) => getComputedStyle(element).cursor),
      "pointer",
    );
    if (width === 1440) assert.equal(platformBounds.width, 232);
    assert.equal(
      Boolean(
        platformBounds &&
        logoutBounds &&
        Math.abs(platformBounds.width - logoutBounds.width) < 1 &&
        Math.abs(platformBounds.height - logoutBounds.height) < 1,
      ),
      true,
      "dashboard actions differ in size at " + width,
    );
    await page.goto("http://127.0.0.1:31035/?module");
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administrar plataforma" })).toHaveCount(0);
    await page.screenshot({ path: resolve(output, "module-header-" + width + ".png") });
    assert.deepEqual(errors, [], "page errors at " + width);
    results.push({ width, status: "PASS" });
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
console.log(results);
