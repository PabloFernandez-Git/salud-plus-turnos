// Local Chromium check with synthetic data; no Next.js or Supabase requests.
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
const cache = resolve("node_modules/.cache/task026-specialties-visual");
mkdirSync(cache, { recursive: true });
writeFileSync(
  resolve(cache, "index.html"),
  '<div id="root"></div><script type="module" src="/entry.tsx"></script>',
);
writeFileSync(
  resolve(cache, "navigation.ts"),
  "export function useRouter() { return { refresh() {} }; }",
);
writeFileSync(
  resolve(cache, "actions.ts"),
  "export async function createSpecialtyAction() {} export async function updateSpecialtyAction() {} export async function setSpecialtyActiveAction() {}",
);
writeFileSync(
  resolve(cache, "link.tsx"),
  "import React from 'react'; export default function Link({href, children, ...props}) { return <a href={href} {...props}>{children}</a>; }",
);
writeFileSync(
  resolve(cache, "entry.tsx"),
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SpecialtiesScreen } from '@/modules/specialties/components/specialties-screen';
import '@/app/globals.css';
createRoot(document.getElementById('root')).render(<div className="min-h-screen bg-slate-100/80">
  <SpecialtiesScreen centerId="11111111-1111-4111-8111-111111111111" centerName="Centro Salud"
    loadFailed={false} specialties={[
      {id:'22222222-2222-4222-8222-222222222222', name:'Cardiología', description:'Atención de adultos', is_active:true, updated_at:'2026-10-09T12:00:00+00:00'},
      {id:'33333333-3333-4333-8333-333333333333', name:'Pediatría', description:null, is_active:false, updated_at:'2026-10-09T12:00:00+00:00'}
    ]} />
</div>);
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
      { find: "../actions/specialty-actions", replacement: resolve(cache, "actions.ts") },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: { host: "127.0.0.1", port: 31026, strictPort: true, fs: { allow: [root] } },
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:31026/");
  const table = page.getByRole("table");
  const scroller = page.getByRole("region", { name: "Listado de especialidades" });
  const hint = page.getByText("Deslizá horizontalmente para ver todas las columnas");

  for (const width of [390, 556, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(table).toBeVisible();
    const overflow = await scroller.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    );
    assert.equal(overflow, width !== 1440, `overflow at ${width}px`);
    if (overflow) await expect(hint).toBeVisible();
    else await expect(hint).toHaveCount(0);

    for (const [name, actionLabel] of [
      ["Cardiología", "Desactivar"],
      ["Pediatría", "Activar"],
    ]) {
      const row = table.getByRole("row", { name: new RegExp(name) });
      const geometry = await row.evaluate((element) => {
        const buttons = [...element.querySelectorAll("button")];
        return buttons.map((button) => {
          const box = button.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(button);
          const text = range.getBoundingClientRect();
          const style = getComputedStyle(button);
          return {
            label: button.textContent.trim(),
            left: box.left,
            right: box.right,
            centerY: box.top + box.height / 2,
            textCenterY: text.top + text.height / 2,
            height: style.height,
            paddingTop: style.paddingTop,
            paddingBottom: style.paddingBottom,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            cursor: style.cursor,
          };
        });
      });
      assert.deepEqual(
        geometry.map(({ label }) => label),
        ["Editar", actionLabel],
      );
      assert.deepEqual(
        geometry.map(({ height }) => height),
        ["44px", "44px"],
      );
      for (const property of ["paddingTop", "paddingBottom", "fontSize", "lineHeight"])
        assert.equal(geometry[0][property], geometry[1][property]);
      assert.ok(geometry[0].right < geometry[1].left);
      assert.ok(Math.abs(geometry[0].centerY - geometry[1].centerY) < 1);
      assert.ok(geometry.every(({ centerY, textCenterY }) => Math.abs(centerY - textCenterY) < 2));
      assert.deepEqual(
        geometry.map(({ cursor }) => cursor),
        ["pointer", "pointer"],
      );
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `page overflow at ${width}px`,
    );
    if (overflow) {
      await scroller.evaluate((element) => (element.scrollLeft = element.scrollWidth));
      assert.ok((await scroller.evaluate((element) => element.scrollLeft)) > 0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    console.log(`PASS Chromium ${width}px: actions, 44px, overflow, hint, page width`);
  }
  await page.close();
} finally {
  await browser?.close();
  await server.close();
}
