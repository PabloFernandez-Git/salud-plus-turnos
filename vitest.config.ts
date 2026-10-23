import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./scripts/test-support/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    exclude: [
      ...configDefaults.exclude,
      "scripts/task007-gate-d/audit-clean.test.mjs",
      "scripts/task007-gate-d/finalize-core.test.mjs",
      "scripts/task007-gate-d/ledger-lifecycle.test.mjs",
      "scripts/task022-functional-dev/*.test.mjs",
      "scripts/task021-dev/*.test.mjs",
      "scripts/task021-functional-dev/*.test.mjs",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
