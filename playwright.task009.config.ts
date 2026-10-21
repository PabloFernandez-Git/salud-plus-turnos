import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  maxFailures: 0,
  retries: 0,
  reporter: [["line"], ["json", { outputFile: "test-results/task009-results.json" }]],
  use: {
    baseURL: "http://localhost:31009",
    actionTimeout: 30_000,
    trace: "on",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/task009-gate-d/isolated-dev-server.mjs",
    url: "http://localhost:31009/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
