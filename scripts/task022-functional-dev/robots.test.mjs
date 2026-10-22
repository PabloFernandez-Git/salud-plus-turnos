import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { analyzeRobotsMetaContents } from "./robots.mjs";

test("accepts multiple compatible noindex directives", () => {
  assert.deepEqual(analyzeRobotsMetaContents(["noindex", "NOINDEX, nofollow"]), {
    hasNoindex: true,
    hasIndexConflict: false,
  });
});

test("rejects indexing directives and substring-only matches", () => {
  assert.deepEqual(analyzeRobotsMetaContents(["noindex", "index, follow"]), {
    hasNoindex: true,
    hasIndexConflict: true,
  });
  assert.deepEqual(analyzeRobotsMetaContents(["noindexing", "nofollow"]), {
    hasNoindex: false,
    hasIndexConflict: false,
  });
  assert.equal(analyzeRobotsMetaContents(["noindex", "all"]).hasIndexConflict, true);
});

test("Chromium reads both compatible robots metas without an exact count requirement", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <html><head>
        <meta name="robots" content="noindex">
        <meta name="ROBOTS" content="NOINDEX, nofollow">
      </head><body><h1>No encontramos esta página</h1></body></html>
    `);
    const contents = await page
      .locator('meta[name="robots" i]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("content")));
    assert.equal(contents.length, 2);
    assert.deepEqual(analyzeRobotsMetaContents(contents), {
      hasNoindex: true,
      hasIndexConflict: false,
    });
  } finally {
    await browser.close();
  }
});
