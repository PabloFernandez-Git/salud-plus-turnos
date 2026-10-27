// Chromium visual check with synthetic data; no Supabase or existing Next server.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const root = resolve(".");
const cache = resolve("node_modules/.cache/task032-visual");
const output = resolve(".harness/tasks/active/TASK-032/evidence/modal");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  "export function useRouter(){return {refresh(){},replace(){}}}",
);
writeFileSync(
  resolve(cache, "actions.ts"),
  `
export async function updateCenterMembershipAction(){return {status:'success',message:'Acceso actualizado.'}}
export async function resolveCenterIdentityAction(centerId,email){return {status:'success',email,identityExists:email.startsWith('existing'),firstName:'Mario',lastName:'Existente',membershipExists:false}}
export async function provisionCenterUserAction(_,formData){window.__provisionCalls=(window.__provisionCalls||0)+1;return {status:'success',identityCreated:String(formData.get('email')).startsWith('new'),message:'Usuario agregado al centro.'}}
`,
);
const baseline = execFileSync(
  "git",
  ["show", "origin/main:src/modules/access/components/center-users-table.tsx"],
  { encoding: "utf8" },
).replace(
  "./manage-center-membership-panel",
  "@/modules/access/components/manage-center-membership-panel",
);
writeFileSync(resolve(cache, "baseline-table.tsx"), baseline);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CenterUsersTable} from '@/modules/access/components/center-users-table';
import {CenterUsersTable as BaselineTable} from './baseline-table';
import {AddCenterUserPanel} from '@/modules/access/components/add-center-user-panel';
import '@/app/globals.css';
const centerId='11111111-1111-4111-8111-111111111111';
const users=[
 {id:'22222222-2222-4222-8222-222222222222',userId:'a',firstName:'Ana',lastName:'Administradora',email:'ana.admin@example.test',role:'ADMIN',isActive:true,professional:null},
 {id:'33333333-3333-4333-8333-333333333333',userId:'b',firstName:'Bruno',lastName:'Recepción',email:'bruno.con.un.correo.muy.largo.para.verificar.el.ajuste@example.test',role:'RECEPTION',isActive:true,professional:null},
 {id:'44444444-4444-4444-8444-444444444444',userId:'c',firstName:'Carla',lastName:'Profesional',email:'carla@example.test',role:'PROFESSIONAL',isActive:false,professional:{id:'55555555-5555-4555-8555-555555555555',firstName:'Paula',lastName:'Médica',licenseNumber:'MP 1234',isActive:false}}
];
const options=[{id:'55555555-5555-4555-8555-555555555555',firstName:'Paula',lastName:'Médica',licenseNumber:'MP 1234',occupiedMembershipId:null}];
const baseline=location.search.includes('before');
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-[1400px] space-y-6 px-5 py-8 sm:px-8">
 <h1 className="text-2xl font-semibold">Gestión de usuarios</h1>
 {!baseline&&<AddCenterUserPanel actorUserId="99999999-9999-4999-8999-999999999999" centerId={centerId} professionalCenters={options}/>}
 <section className="space-y-3"><h2 className="text-xl font-semibold">Usuarios del centro</h2>
 {baseline?<BaselineTable centerId={centerId} professionalCenters={options} users={users}/>:<CenterUsersTable centerId={centerId} professionalCenters={options} users={users}/>}</section>
</main>);
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
      { find: "next/navigation", replacement: resolve(cache, "navigation.ts") },
      { find: "../actions/center-user-actions", replacement: resolve(cache, "actions.ts") },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31032, strictPort: true, fs: { allow: [root] } },
});
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
    await page.goto("http://127.0.0.1:31032/?before");
    await expect(page.getByRole("heading", { name: "Usuarios del centro" })).toBeVisible();
    await page.screenshot({ path: resolve(output, `before-${width}-list.png`), fullPage: true });
    await page.goto("http://127.0.0.1:31032/");
    await expect(page.getByRole("heading", { name: "Usuarios del centro" })).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${width} list overflow`,
    );
    await page.screenshot({ path: resolve(output, `after-${width}-list.png`), fullPage: true });
    const listY = (await page.getByRole("heading", { name: "Usuarios del centro" }).boundingBox())
      .y;
    await page.getByRole("button", { name: "Agregar usuario" }).click();
    const addDialog = page.getByRole("dialog", { name: "Agregar usuario" });
    await expect(addDialog).toBeVisible();
    await expect(addDialog.getByRole("button", { name: "Cerrar" })).toBeFocused();
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => ({
        inside: Boolean(document.activeElement?.closest("dialog")),
        tag: document.activeElement?.tagName,
        label: document.activeElement?.getAttribute("aria-label"),
      }));
      assert.equal(active.inside, true, `${width} focus escaped dialog: ${JSON.stringify(active)}`);
    }
    assert.equal(
      (await page.getByRole("heading", { name: "Usuarios del centro" }).boundingBox()).y,
      listY,
      `${width} list moved`,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${width} email overflow`,
    );
    await page.screenshot({ path: resolve(output, `modal-email-${width}.png`), fullPage: true });
    await page.getByLabel("Email").fill("new@example.test");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await page.getByLabel("Nombre").fill("Nueva");
    await page.getByLabel("Apellido").fill("Cuenta");
    await page.getByLabel("Contraseña inicial").fill("password-12345");
    await page.getByLabel("Confirmar contraseña").fill("password-1234X");
    await page.getByRole("button", { name: "Revisar alta" }).click();
    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
    assert.equal(await page.evaluate(() => window.__provisionCalls || 0), 0);
    await page.screenshot({
      path: resolve(output, `modal-password-error-${width}.png`),
      fullPage: true,
    });
    await page.getByLabel("Confirmar contraseña").fill("password-12345");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${width} details overflow`,
    );
    await page.screenshot({
      path: resolve(output, `modal-password-confirm-${width}.png`),
      fullPage: true,
    });
    if (width === 390) {
      await page.setViewportSize({ width, height: 600 });
      const bounds = await addDialog.boundingBox();
      assert.equal(Boolean(bounds && bounds.height <= 584), true, "keyboard viewport height");
      await addDialog.getByRole("button", { name: "Revisar alta" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, "modal-keyboard-390.png") });
      await page.setViewportSize({ width, height: 900 });
    }
    await addDialog.locator(".overflow-y-auto").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.screenshot({
      path: resolve(output, `modal-details-actions-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Revisar alta" }).click();
    await expect(
      page.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
    assert.equal(await page.evaluate(() => window.__provisionCalls || 0), 0);
    await page.screenshot({ path: resolve(output, `modal-review-${width}.png`), fullPage: true });
    await addDialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(
      page.getByRole("dialog", { name: "Cerrar alta" }).getByText("¿Descartar alta?"),
    ).toBeVisible();
    await page.screenshot({ path: resolve(output, `modal-discard-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(
      addDialog.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
    await addDialog.getByRole("button", { name: "Volver a editar" }).click();
    await expect(addDialog.getByLabel("Nombre")).toHaveValue("Nueva");
    await expect(addDialog.getByLabel("Contraseña inicial")).toHaveValue("password-12345");
    await expect(addDialog.getByLabel("Confirmar contraseña")).toHaveValue("password-12345");
    await addDialog.getByRole("button", { name: "Revisar alta" }).click();
    await addDialog.getByRole("button", { name: "Confirmar creación" }).click();
    const successDialog = page.getByRole("dialog", { name: "Usuario creado" });
    await expect(successDialog).toBeVisible();
    await expect(
      successDialog.getByText("El usuario se creó correctamente y ya tiene acceso al centro."),
    ).toBeVisible();
    await expect(successDialog.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
    assert.equal(await page.evaluate(() => window.__provisionCalls || 0), 1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${width} success overflow`,
    );
    await page.screenshot({ path: resolve(output, `modal-success-${width}.png`), fullPage: true });
    await successDialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Agregar usuario" }).click();
    await page.getByLabel("Email").fill("existing@example.test");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Revisar alta" }).click();
    await page.getByRole("button", { name: "Confirmar incorporación" }).click();
    const existingSuccessDialog = page.getByRole("dialog", { name: "Usuario agregado" });
    await expect(
      existingSuccessDialog.getByText("El usuario se agregó correctamente al centro."),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${width} existing success overflow`,
    );
    await page.screenshot({
      path: resolve(output, `modal-existing-success-${width}.png`),
      fullPage: true,
    });
    await existingSuccessDialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.reload();
    const manage =
      width < 768
        ? page.getByRole("article").first().getByRole("button", { name: "Administrar acceso" })
        : page
            .getByRole("row", { name: /Ana Administradora/ })
            .getByRole("button", { name: "Administrar acceso" });
    await manage.click();
    const dialog = page.getByRole("dialog", { name: "Administrar acceso" });
    await expect(dialog.getByRole("button", { name: "Revisar cambios" })).toBeDisabled();
    await page.screenshot({
      path: resolve(output, `manage-unchanged-${width}.png`),
      fullPage: true,
    });
    await dialog.getByLabel("Estado del acceso").selectOption("inactive");
    await expect(dialog.getByRole("button", { name: "Revisar cambios" })).toBeDisabled();
    await page.screenshot({ path: resolve(output, `last-admin-${width}.png`), fullPage: true });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await page
      .getByRole("dialog", { name: "Descartar cambios" })
      .getByRole("button", { name: "Descartar cambios" })
      .click();
    const other =
      width < 768
        ? page.getByRole("article").nth(1).getByRole("button", { name: "Administrar acceso" })
        : page
            .getByRole("row", { name: /Bruno Recepción/ })
            .getByRole("button", { name: "Administrar acceso" });
    await other.click();
    await dialog.getByLabel("Estado del acceso").selectOption("inactive");
    await expect(dialog.getByRole("button", { name: "Revisar cambios" })).toBeEnabled();
    await page.screenshot({ path: resolve(output, `manage-changed-${width}.png`), fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${width} overflow`,
    );
    assert.deepEqual(errors, []);
    results.push({ width, overflow: false, pageErrors: 0, reviewHasNoMutation: true });
    await context.close();
  }
  writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log("TASK-032 visual PASS", JSON.stringify(results));
} finally {
  await browser?.close();
  await server.close();
}
