import "server-only";

/** The portfolio deployment exposes read actions only. DB grants enforce this again. */
export function assertPortfolioWriteAllowed(): void {
  if (process.env.PORTFOLIO_DEMO_MODE === "true") {
    throw new Error("PORTFOLIO_DEMO_READ_ONLY");
  }
}

const portfolioSupabaseUrl = "https://oygrwetmxsqgcizopezq.supabase.co";

export function getPortfolioGuestLoginConfig() {
  const enabled = process.env.PORTFOLIO_GUEST_ACCESS_ENABLED === "true";
  const isDemo = process.env.PORTFOLIO_DEMO_MODE === "true";
  const siteKey = process.env.NEXT_PUBLIC_PORTFOLIO_TURNSTILE_SITE_KEY?.trim() || undefined;

  if (enabled) {
    if (!isDemo) throw new Error("PORTFOLIO_GUEST_REQUIRES_DEMO_MODE");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const localTestUrl = process.env.NODE_ENV !== "production" && url === "http://127.0.0.1:54321";
    if (url !== portfolioSupabaseUrl && !localTestUrl) {
      throw new Error("PORTFOLIO_GUEST_REQUIRES_DEMO_SUPABASE");
    }
    if (process.env.PORTFOLIO_GUEST_CAPTCHA_REQUIRED === "true" && !siteKey) {
      throw new Error("PORTFOLIO_GUEST_CAPTCHA_SITE_KEY_REQUIRED");
    }
  }

  return { enabled, siteKey };
}
