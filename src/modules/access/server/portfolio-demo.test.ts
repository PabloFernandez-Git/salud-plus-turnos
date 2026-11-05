import { afterEach, describe, expect, it } from "vitest";

import { getAppOrigin } from "./app-origin";
import { assertPortfolioWriteAllowed, getPortfolioGuestLoginConfig } from "./portfolio-demo";

const originalMode = process.env.PORTFOLIO_DEMO_MODE;
const originalOrigin = process.env.APP_ORIGIN;
const originalGuest = process.env.PORTFOLIO_GUEST_ACCESS_ENABLED;
const originalCaptcha = process.env.PORTFOLIO_CAPTCHA_REQUIRED;
const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  if (originalMode === undefined) delete process.env.PORTFOLIO_DEMO_MODE;
  else process.env.PORTFOLIO_DEMO_MODE = originalMode;
  if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = originalOrigin;
  for (const [name, value] of Object.entries({
    PORTFOLIO_GUEST_ACCESS_ENABLED: originalGuest,
    PORTFOLIO_CAPTCHA_REQUIRED: originalCaptcha,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: originalSiteKey,
    NEXT_PUBLIC_SUPABASE_URL: originalSupabaseUrl,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("portfolio demo boundaries", () => {
  it("blocks server writes in demo mode", () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    expect(assertPortfolioWriteAllowed).toThrow("PORTFOLIO_DEMO_READ_ONLY");
  });

  it("keeps guest entry disabled by default and confines activation to DEMO Supabase", () => {
    delete process.env.PORTFOLIO_GUEST_ACCESS_ENABLED;
    expect(getPortfolioGuestLoginConfig().enabled).toBe(false);
    process.env.PORTFOLIO_GUEST_ACCESS_ENABLED = "true";
    process.env.PORTFOLIO_DEMO_MODE = "false";
    expect(getPortfolioGuestLoginConfig).toThrow("PORTFOLIO_GUEST_REQUIRES_DEMO_MODE");
    process.env.PORTFOLIO_DEMO_MODE = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://some-dev-project.supabase.co";
    expect(getPortfolioGuestLoginConfig).toThrow("PORTFOLIO_GUEST_REQUIRES_DEMO_SUPABASE");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://oygrwetmxsqgcizopezq.supabase.co";
    process.env.PORTFOLIO_CAPTCHA_REQUIRED = "true";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "public-site-key";
    expect(getPortfolioGuestLoginConfig().enabled).toBe(true);
  });

  it("fails closed when CAPTCHA is required without a site key", () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    process.env.PORTFOLIO_GUEST_ACCESS_ENABLED = "true";
    process.env.PORTFOLIO_CAPTCHA_REQUIRED = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://oygrwetmxsqgcizopezq.supabase.co";
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    expect(getPortfolioGuestLoginConfig).toThrow("PORTFOLIO_GUEST_CAPTCHA_SITE_KEY_REQUIRED");
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "public-site-key";
    expect(getPortfolioGuestLoginConfig().siteKey).toBe("public-site-key");
    expect(getPortfolioGuestLoginConfig().captchaRequired).toBe(true);
  });

  it("does not enable CAPTCHA or guest access from a configured site key alone", () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    process.env.PORTFOLIO_GUEST_ACCESS_ENABLED = "false";
    process.env.PORTFOLIO_CAPTCHA_REQUIRED = "false";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "public-site-key";
    expect(getPortfolioGuestLoginConfig()).toEqual({
      enabled: false,
      captchaRequired: false,
      siteKey: "public-site-key",
    });
  });

  it("does not expose guest entry before CAPTCHA is required", () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    process.env.PORTFOLIO_GUEST_ACCESS_ENABLED = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://oygrwetmxsqgcizopezq.supabase.co";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "public-site-key";
    delete process.env.PORTFOLIO_CAPTCHA_REQUIRED;
    expect(getPortfolioGuestLoginConfig).toThrow("PORTFOLIO_GUEST_REQUIRES_CAPTCHA");
  });

  it("ignores DEMO CAPTCHA configuration outside DEMO", () => {
    process.env.PORTFOLIO_DEMO_MODE = "false";
    process.env.PORTFOLIO_CAPTCHA_REQUIRED = "true";
    delete process.env.PORTFOLIO_GUEST_ACCESS_ENABLED;
    expect(getPortfolioGuestLoginConfig()).toEqual({
      enabled: false,
      captchaRequired: false,
      siteKey: undefined,
    });
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
