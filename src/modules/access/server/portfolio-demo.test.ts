import { afterEach, describe, expect, it } from "vitest";

import { getAppOrigin } from "./app-origin";
import { assertPortfolioWriteAllowed } from "./portfolio-demo";

const originalMode = process.env.PORTFOLIO_DEMO_MODE;
const originalOrigin = process.env.APP_ORIGIN;

afterEach(() => {
  if (originalMode === undefined) delete process.env.PORTFOLIO_DEMO_MODE;
  else process.env.PORTFOLIO_DEMO_MODE = originalMode;
  if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = originalOrigin;
});

describe("portfolio demo boundaries", () => {
  it("blocks server writes in demo mode", () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    expect(assertPortfolioWriteAllowed).toThrow("PORTFOLIO_DEMO_READ_ONLY");
  });

  it("blocks the password action before opening an Auth client", async () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    const { updatePasswordAction } = await import("../actions/auth-actions");
    await expect(updatePasswordAction({ status: "idle" }, new FormData())).rejects.toThrow(
      "PORTFOLIO_DEMO_READ_ONLY",
    );
  });

  it("accepts a canonical HTTPS origin for Auth redirects", () => {
    process.env.APP_ORIGIN = "https://salud-plus.vercel.app";
    expect(getAppOrigin()).toBe("https://salud-plus.vercel.app");
  });

  it("rejects an origin with a path or insecure public scheme", () => {
    process.env.APP_ORIGIN = "https://salud-plus.vercel.app/other";
    expect(getAppOrigin).toThrow();
    process.env.APP_ORIGIN = "http://salud-plus.vercel.app";
    expect(getAppOrigin).toThrow();
  });
});
