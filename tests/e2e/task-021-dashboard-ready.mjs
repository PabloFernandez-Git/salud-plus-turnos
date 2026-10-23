import { expect } from "@playwright/test";

const activity = (page) => page.locator('section[aria-labelledby="activity-heading"]');
const upcoming = (page) => page.locator('section[aria-labelledby="upcoming-heading"]');

export async function dashboardReady(page, { timeout = 30000 } = {}) {
  const section = activity(page);
  const data = section.locator("dl");
  const error = section.getByRole("alert");
  try {
    // A server action can outlast Playwright's default assertion timeout. Wait for a
    // semantic outcome within the configured action budget, not for loading to vanish.
    await expect(data.or(error).first()).toBeVisible({ timeout });
  } catch (cause) {
    const statuses = await section.getByRole("status").allTextContents();
    throw new Error(`Dashboard did not reach data or error; status=${JSON.stringify(statuses)}`, {
      cause,
    });
  }
  if (await error.isVisible())
    throw new Error(`Dashboard returned error: ${await error.innerText()}`);
  await expect(data).toBeVisible();
  await expect(section.getByRole("status")).toHaveCount(0);
  await expect(upcoming(page).getByRole("heading")).toBeVisible();
}
