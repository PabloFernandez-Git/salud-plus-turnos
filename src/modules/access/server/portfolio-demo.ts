import "server-only";

/** The portfolio deployment exposes read actions only. DB grants enforce this again. */
export function assertPortfolioWriteAllowed(): void {
  if (process.env.PORTFOLIO_DEMO_MODE === "true") {
    throw new Error("PORTFOLIO_DEMO_READ_ONLY");
  }
}
