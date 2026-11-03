import "server-only";

export function getAppOrigin(): string {
  const configured = process.env.APP_ORIGIN;
  if (!configured && process.env.NODE_ENV !== "production") return "http://localhost:3000";
  if (!configured) throw new Error("APP_ORIGIN is required in production");
  const url = new URL(configured);
  if (
    (url.protocol !== "https:" && url.origin !== "http://localhost:3000") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("APP_ORIGIN must be an HTTPS origin");
  }
  return url.origin;
}
