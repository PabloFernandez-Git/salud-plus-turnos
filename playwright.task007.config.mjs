import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://localhost:31007",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/task007-gate-d/isolated-dev-server.mjs",
    url: "http://localhost:31007",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
