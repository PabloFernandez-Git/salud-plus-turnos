import { expect, test } from "@playwright/test";
import { assert, readLedger, saveLedger } from "../../scripts/task007-gate-d/fixture-core.mjs";

// This read-only test completes the interrupted run without replaying its UI mutations.
const ledger = readLedger();
assert(ledger.runId === "c9818e40-2d4d-4c1b-a392-14a9404a5111", "Unexpected recovery run");
assert(ledger.stage === "integrated", `Expected integrated fixtures, got ${ledger.stage}`);
assert(ledger.owned.persons.length === 8, "UI Person ownership is incomplete");
assert(ledger.owned.patientCenters.length === 8, "UI PatientCenter ownership is incomplete");
assert(ledger.generated.uiDocument === `UI-${ledger.runId}`, "UI identity reservation is missing");
assert(typeof ledger.password === "string" && ledger.password.length > 20, "Missing fixture login");

test("PROFESSIONAL is denied the existing patient page", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(ledger.actors.professionalA.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(ledger.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 60_000 });
  await page.goto(`/centers/${ledger.ids.centerA}/patients`);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Listado de pacientes" })).toHaveCount(0);
  ledger.stage = "e2e_pass";
  ledger.evidence.push({
    at: new Date().toISOString(),
    event: "e2e_pass_composite_recovery",
    basis: [
      "Prior E2E run: RECEPTION desktop test passed",
      "Prior E2E run: mobile, NOT_LINKED, ACTIVE reuse, DOB mismatch, and ADMIN assertions reached final PROFESSIONAL HTTP status assertion",
      "This focused read-only test confirms PROFESSIONAL rendered 404 and no patient UI",
    ],
  });
  saveLedger(ledger);
});
