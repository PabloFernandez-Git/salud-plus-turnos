import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE } from "./default-timezone";

describe("DEFAULT_TIMEZONE", () => {
  it("uses the approved MVP timezone", () => {
    expect(DEFAULT_TIMEZONE).toBe("America/Argentina/Buenos_Aires");
  });
});
