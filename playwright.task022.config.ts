import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  use: {
    baseURL: "http://localhost:31009",
    actionTimeout: 30_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/task022-functional-dev/isolated-server.mjs",
    url: "http://localhost:31009/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
