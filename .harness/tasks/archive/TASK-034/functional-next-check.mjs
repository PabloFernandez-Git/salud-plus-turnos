import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const taskDir = dirname(fileURLToPath(import.meta.url));
const evidenceDir = join(taskDir, "evidence");
const base = "http://127.0.0.1:31034";
const center = "/centers/11111111-1111-4111-8111-111111111111";
const results = [];
const selectedScenarios = new Set(process.argv.slice(2));

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function scenario(name, cookie, path, verify) {
  if (selectedScenarios.size > 0 && !selectedScenarios.has(name)) return;
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies([{ name: "task034_case", value: cookie, url: base }]);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    const response = await page.goto(`${base}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await verify({ page, context, response });
    results.push({
      name,
      outcome: "PASS",
      status: response?.status() ?? null,
      finalUrl: page.url(),
      consoleErrors,
      pageErrors,
    });
  } catch (error) {
    results.push({
      name,
      outcome: "FAIL",
      error: String(error),
      finalUrl: page.url(),
      consoleErrors,
      pageErrors,
    });
  } finally {
    await context.close();
  }
}

await scenario(
  "A direct center with failed optional query",
  "center-ok-global-error",
  center,
  async ({ page, response }) => {
    assert.equal(response?.status(), 200);
    await page.getByText("Contenido del centro").waitFor();
    assert.equal(await page.getByRole("link", { name: "Administrar plataforma" }).count(), 0);
    assert.equal(await page.getByText("No pudimos cargar la página").count(), 0);
    await page.screenshot({ path: join(evidenceDir, "center-global-error.png") });
  },
);

await scenario("B post-login one center", "center-ok-global-error", "/", async ({ page }) => {
  await page.getByText("Contenido del centro").waitFor();
  assert.equal(new URL(page.url()).pathname, center);
  assert.equal(await page.getByRole("link", { name: "Administrar plataforma" }).count(), 0);
});

await scenario("B post-login two centers", "two-centers-global-error", "/", async ({ page }) => {
  await page.getByRole("heading", { name: "Seleccioná un centro" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/select-center");
  assert.equal(await page.locator(`a[href^="/centers/"]`).count(), 2);
});

await scenario(
  "B selector with one center",
  "center-ok-global-error",
  "/select-center",
  async ({ page }) => {
    await page.getByText("Contenido del centro").waitFor();
    assert.equal(new URL(page.url()).pathname, center);
  },
);

await scenario("B center and platform links", "platform-yes", center, async ({ page }) => {
  await page.getByText("Contenido del centro").waitFor();
  await page.getByRole("link", { name: "Administrar plataforma" }).click();
  await page.getByRole("heading", { name: "Centros", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/platform");
  await page.getByRole("link", { name: "Ir a mi centro" }).click();
  await page.getByText("Contenido del centro").waitFor();
  assert.equal(new URL(page.url()).pathname, center);
});

await scenario(
  "C unknown global permission retries and recovers",
  "none-global-error",
  "/",
  async ({ page, context }) => {
    await page.getByRole("heading", { name: "No pudimos cargar la página" }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.getByRole("button", { name: "Reintentar" }).count(), 1);
    assert.equal((await page.locator("body").innerText()).includes("synthetic"), false);
    await page.screenshot({ path: join(evidenceDir, "unknown-global-error.png") });

    const failedRetry = page.waitForResponse(
      (response) => response.url() === `${base}/` && response.request().isNavigationRequest(),
    );
    await page.getByRole("button", { name: "Reintentar" }).click();
    assert.equal((await failedRetry).status(), 500);
    await page.getByRole("heading", { name: "No pudimos cargar la página" }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    await page.waitForTimeout(1200);
    assert.equal(new URL(page.url()).pathname, "/");

    await context.addCookies([{ name: "task034_case", value: "none-global-yes", url: base }]);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await page.getByRole("heading", { name: "Centros", exact: true }).waitFor({ timeout: 30_000 });
    assert.equal(new URL(page.url()).pathname, "/platform");
    await page.screenshot({ path: join(evidenceDir, "retry-recovered.png") });
  },
);

await scenario("C confirmed negative without centers", "none-global-no", "/", async ({ page }) => {
  await page.getByRole("heading", { name: "Sin acceso activo" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/no-access");
});

await scenario(
  "D positive platform permission",
  "platform-yes",
  "/platform",
  async ({ page, response }) => {
    assert.equal(response?.status(), 200);
    await page.getByRole("heading", { name: "Centros", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Ir a mi centro" }).count(), 1);
  },
);

await scenario(
  "D denied platform permission with tenant membership",
  "platform-no",
  "/platform",
  async ({ page }) => {
    assert.notEqual(new URL(page.url()).pathname, "/platform");
    assert.equal(await page.getByRole("heading", { name: "Centros", exact: true }).count(), 0);
  },
);

await scenario(
  "D failed strict platform permission",
  "platform-error",
  "/platform",
  async ({ page }) => {
    assert.notEqual(new URL(page.url()).pathname, "/platform");
    assert.equal(await page.getByRole("heading", { name: "Centros", exact: true }).count(), 0);
  },
);

for (const [name, cookie, expectedPath] of [
  ["E no membership", "no-membership", center],
  ["E inactive membership", "inactive-membership", center],
  ["E inactive center", "inactive-center", center],
  ["E insufficient role", "role-reception", `${center}/users`],
]) {
  await scenario(name, cookie, expectedPath, async ({ page, response }) => {
    assert.equal(response?.status(), 404);
    assert.equal(await page.getByText("Contenido del centro").count(), 0);
  });
}

await scenario("E invalid session", "invalid-session", center, async ({ page }) => {
  await page.getByText("Login sintético").waitFor();
  assert.equal(new URL(page.url()).pathname, "/login");
});

for (const [name, cookie] of [
  ["E membership query failure", "membership-error"],
  ["E center query failure", "center-error"],
]) {
  await scenario(name, cookie, center, async ({ page }) => {
    await page.getByRole("heading", { name: "No pudimos cargar la página" }).waitFor();
    assert.equal(await page.getByText("Contenido del centro").count(), 0);
  });
}

if (selectedScenarios.size === 0 || selectedScenarios.has("F platform loading resolves")) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies([{ name: "task034_case", value: "platform-slow", url: base }]);
  const page = await context.newPage();
  try {
    const navigation = page.goto(`${base}/platform`, { waitUntil: "domcontentloaded" });
    await page.getByRole("status").waitFor({ state: "visible", timeout: 20_000 });
    await page.screenshot({ path: join(evidenceDir, "platform-loading.png") });
    await navigation;
    await page.getByRole("heading", { name: "Centros", exact: true }).waitFor();
    assert.equal(await page.getByRole("status").count(), 0);
    results.push({
      name: "F platform loading resolves",
      outcome: "PASS",
      finalUrl: page.url(),
    });
  } catch (error) {
    results.push({
      name: "F platform loading resolves",
      outcome: "FAIL",
      error: String(error),
      finalUrl: page.url(),
    });
  } finally {
    await context.close();
  }
}

await browser.close();
const resultsFile =
  selectedScenarios.size === 0
    ? "results.json"
    : selectedScenarios.has("F platform loading resolves")
      ? "results-loading.json"
      : selectedScenarios.has("B center and platform links")
        ? "results-navigation.json"
        : "results-focused.json";
await writeFile(join(evidenceDir, resultsFile), `${JSON.stringify(results, null, 2)}\n`);
for (const result of results) {
  console.log(`${result.outcome} ${result.name}: ${result.status ?? "-"} ${result.finalUrl}`);
  if (result.outcome === "FAIL") console.error(result.error);
}
if (results.some((result) => result.outcome === "FAIL")) process.exitCode = 1;
