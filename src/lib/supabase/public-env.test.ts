import { afterEach, describe, expect, it } from "vitest";

import { getSupabasePublicEnv } from "./public-env";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
});

describe("getSupabasePublicEnv", () => {
  it("returns only the public URL and publishable key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-publishable-key";

    expect(getSupabasePublicEnv()).toEqual({
      publishableKey: "synthetic-publishable-key",
      url: "https://abcdefghijklmnopqrst.supabase.co",
    });
  });

  it("rejects non-Supabase hosts", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-publishable-key";

    expect(() => getSupabasePublicEnv()).toThrow("URL pública de Supabase es inválida");
  });
});
