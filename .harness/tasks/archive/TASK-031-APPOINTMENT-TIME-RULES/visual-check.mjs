// Synthetic Chromium fixture for the real Turnos detail component. No Next/Supabase traffic.
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
const cache = resolve("node_modules/.cache/task031-visual");
const output = resolve(".harness/tasks/active/TASK-031/evidence");
mkdirSync(cache, { recursive: true });
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "link.tsx"),
  "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}",
);
writeFileSync(resolve(cache, "navigation.ts"), "export function useRouter(){return {refresh(){}}}");
writeFileSync(
  resolve(cache, "appointment-actions.ts"),
  `
export async function listBookableSpecialtiesAction(){return {status:'SUCCESS',data:[]}}
export async function listBookableProfessionalsAction(){return {status:'SUCCESS',data:[]}}
export async function searchAppointmentSlotsAction(){return {status:'SUCCESS',data:[]}}
export async function getAppointmentAvailabilityAction(){return {status:'SUCCESS',data:{intervals:[]}}}
export async function rescheduleAppointmentAction(){return {status:'BUSINESS_ERROR',code:'SLOT_ALREADY_TAKEN'}}
export async function transitionAppointmentStatusAction(){return {status:'BUSINESS_ERROR',code:'INVALID_STATUS_TRANSITION'}}
export async function updateAppointmentNoteAction(){return {status:'SUCCESS',data:{appointment_id:'22222222-2222-4222-8222-222222222222',updated_at:'2026-10-27T12:00:00+00:00'}}}
`,
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppointmentDetailScreen} from '@/modules/appointments/components/appointment-detail-screen';
import '@/app/globals.css';
const action=new URLSearchParams(location.search).get('action');
const future=action==='CONFIRMED';
const appointment={appointment_id:'22222222-2222-4222-8222-222222222222',
 starts_at:future?'2030-11-02T12:00:00+00:00':'2026-10-20T12:00:00+00:00',
 ends_at:future?'2030-11-02T12:30:00+00:00':'2026-10-20T12:30:00+00:00',
 updated_at:'2026-10-19T11:00:00+00:00',status:'PENDING',
 patient_first_name:'Ana',patient_last_name:'Paz',specialty_name:'Clínica médica',
 patient_center_id:'55555555-5555-4555-8555-555555555555',
 professional_center_id:'44444444-4444-4444-8444-444444444444',
 specialty_id:'33333333-3333-4333-8333-333333333333',
 professional_first_name:'Luisa',professional_last_name:'Vega',administrative_note:null};
createRoot(document.getElementById('root')!).render(
 <AppointmentDetailScreen centerId="11111111-1111-4111-8111-111111111111"
 centerName="Centro sintético" timezone="America/Argentina/Buenos_Aires"
 serverNow={Date.parse(future?'2026-10-20T11:00:00Z':'2026-10-20T13:00:00Z')}
 detail={{kind:'STAFF',appointment}} outsideAvailability={false}/>
);
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
        find: "../actions/appointment-actions",
        replacement: resolve(cache, "appointment-actions.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31031, strictPort: true, fs: { allow: [root] } },
});
const cases = [
  ["CONFIRMED", "Confirmar", "Confirmar turno"],
  ["ATTENDED", "Marcar atendido", "Marcar turno como atendido"],
  ["NO_SHOW", "Marcar ausente", "Registrar ausencia"],
  ["CANCELLED", "Cancelar turno", "Cancelar turno"],
];
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const [size, width, height] of [
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
    for (const [status, label, title] of cases) {
      await page.goto(`http://127.0.0.1:31031/?action=${status}`);
      if (status === "CONFIRMED") {
        await expect(
          page.getByText("Podés marcar el turno como atendido desde su hora de inicio."),
        ).toBeVisible();
        await expect(
          page.getByText("Podés registrar la ausencia cuando finalice el turno."),
        ).toBeVisible();
        for (const hintId of ["time-ATTENDED", "time-NO_SHOW"]) {
          const hint = page.locator(`#${hintId}`);
          const icon = hint.locator("svg");
          const message = hint.locator("span");
          await expect(icon).toHaveAttribute("aria-hidden", "true");
          await expect(icon).toHaveAttribute("stroke", "currentColor");
          const iconBox = await icon.boundingBox();
          const messageBox = await message.boundingBox();
          assert(iconBox && messageBox);
          assert(
            Math.abs(messageBox.x - (iconBox.x + iconBox.width) - 8) < 1,
            "clock gap must be 8px",
          );
          assert(Math.abs(iconBox.y - messageBox.y - 3) < 3, "clock must align with first line");
          if (width === 390)
            assert(messageBox.height > 24, "mobile message should wrap without moving the icon");
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await page
          .getByRole("heading", { name: "Acciones del turno" })
          .locator("..")
          .screenshot({
            path: resolve(output, `${size}-actions-clock.png`),
            animations: "disabled",
          });
        await page
          .getByText("Podés registrar la ausencia cuando finalice el turno.")
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: resolve(output, `${size}-messages-two.png`),
          animations: "disabled",
        });
      }
      if (status === "ATTENDED") {
        await expect(page.getByText("El turno ya comenzó; no se puede confirmar.")).toBeVisible();
        await expect(
          page.getByText("Podés registrar la ausencia cuando finalice el turno."),
        ).toHaveCount(0);
        await page
          .locator("#time-CONFIRMED")
          .evaluate((element) => element.scrollIntoView({ block: "center" }));
        await page.screenshot({
          path: resolve(output, `${size}-messages-one.png`),
          animations: "disabled",
        });
      }
      await page.getByRole("button", { name: label }).click();
      const dialog = page.getByRole("dialog", { name: title });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Ana Paz")).toBeVisible();
      const back = dialog.getByRole("button", { name: "Volver" });
      const confirm = dialog.getByRole("button", { name: label });
      await expect(back).toBeVisible();
      await expect(confirm).toBeVisible();
      const backBox = await back.boundingBox();
      const confirmBox = await confirm.boundingBox();
      const dialogBox = await dialog.boundingBox();
      assert(backBox && confirmBox && dialogBox);
      assert(backBox.x < confirmBox.x, "Volver must be to the left");
      assert(
        Math.abs(confirmBox.x - (backBox.x + backBox.width) - 12) < 1,
        "button gap must be uniform",
      );
      assert(
        Math.abs(
          (backBox.x + confirmBox.x + confirmBox.width) / 2 - (dialogBox.x + dialogBox.width / 2),
        ) < 2,
        "footer group must be centered",
      );
      assert(
        backBox.height >= 44 && confirmBox.height >= 44,
        "touch targets must be at least 44px",
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: resolve(output, `${size}-${status.toLowerCase()}.png`),
        animations: "disabled",
      });
      results.push({ size, status, horizontalOverflow: false });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  writeFileSync(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log("TASK031_VISUAL_PASS", results.length);
} finally {
  await browser?.close();
  await server.close();
}
