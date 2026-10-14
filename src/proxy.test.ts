import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { expect, it, vi } from "vitest";
import { ORIGINAL_SEARCH_HEADER } from "@/lib/original-search-header";
import { proxy } from "./proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/public-env", () => ({
  getSupabasePublicEnv: () => ({ url: "https://example.test", publishableKey: "public-test-key" }),
}));

it("overwrites a spoofed original search header and preserves it during cookie refresh", async () => {
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    const cookies = options.cookies as {
      getAll: () => unknown;
      setAll: (values: { name: string; value: string; options: { path: string } }[]) => void;
    };
    return {
      auth: {
        getClaims: async () => {
          cookies.getAll();
          cookies.setAll([{ name: "session", value: "refreshed", options: { path: "/" } }]);
          return { data: { claims: { sub: "user-a" } }, error: null };
        },
      },
    } as never;
  });
  const nextSpy = vi.spyOn(NextResponse, "next");
  try {
    const request = new NextRequest("https://example.test/centers/1/patients?q=%41na", {
      headers: { [ORIGINAL_SEARCH_HEADER]: "?q=spoofed" },
    });
    const response = await proxy(request);

    expect(nextSpy).toHaveBeenCalledTimes(2);
    for (const [options] of nextSpy.mock.calls) {
      expect(options?.request?.headers?.get(ORIGINAL_SEARCH_HEADER)).toBe("?q=%41na");
    }
    expect(response.cookies.get("session")?.value).toBe("refreshed");
  } finally {
    nextSpy.mockRestore();
  }
});
