import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { expect, it, vi } from "vitest";
import { ORIGINAL_SEARCH_HEADER } from "@/lib/original-search-header";
import { proxy } from "./proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/public-env", () => ({
  getSupabasePublicEnv: () => ({ url: "https://example.test", publishableKey: "public-test-key" }),
}));

it("forwards refreshed cookies and the trusted original search together", async () => {
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    const cookies = options.cookies as {
      getAll: () => unknown;
      setAll: (values: { name: string; value: string; options: { path: string } }[]) => void;
    };
    return {
      auth: {
        getClaims: async () => {
          cookies.getAll();
          cookies.setAll([
            { name: "session", value: "new", options: { path: "/" } },
            { name: "renewed", value: "fresh", options: { path: "/" } },
          ]);
          return { data: { claims: { sub: "user-a" } }, error: null };
        },
      },
    } as never;
  });
  const nextSpy = vi.spyOn(NextResponse, "next");
  try {
    const request = new NextRequest("https://example.test/centers/1/patients?q=%41na", {
      headers: {
        cookie: "session=old; retained=keep",
        [ORIGINAL_SEARCH_HEADER]: "?q=spoofed",
      },
    });
    const response = await proxy(request);

    expect(nextSpy).toHaveBeenCalledTimes(2);
    for (const [options] of nextSpy.mock.calls) {
      expect(options?.request?.headers?.get(ORIGINAL_SEARCH_HEADER)).toBe("?q=%41na");
    }
    expect(nextSpy.mock.calls[0]?.[0]?.request?.headers?.get("cookie")).toBe(
      "session=old; retained=keep",
    );
    const forwardedCookie = response.headers.get("x-middleware-request-cookie");
    expect(forwardedCookie).toContain("session=new");
    expect(forwardedCookie).toContain("renewed=fresh");
    expect(forwardedCookie).toContain("retained=keep");
    expect(forwardedCookie).not.toContain("session=old");
    expect(response.headers.get("x-middleware-request-x-salud-plus-original-search")).toBe(
      "?q=%41na",
    );
    expect(response.cookies.get("session")?.value).toBe("new");
    expect(response.cookies.get("renewed")?.value).toBe("fresh");
    expect(response.headers.get("set-cookie")).toContain("session=new");
    expect(response.headers.get("set-cookie")).toContain("renewed=fresh");
  } finally {
    nextSpy.mockRestore();
  }
});

it("keeps the original cookie when no refresh occurs and overwrites a spoofed search header", async () => {
  vi.mocked(createServerClient).mockImplementation(
    () =>
      ({
        auth: {
          getClaims: async () => ({ data: { claims: { sub: "user-a" } }, error: null }),
        },
      }) as never,
  );
  const request = new NextRequest("https://example.test/centers/1/patients?q=%41na", {
    headers: {
      cookie: "session=old; retained=keep",
      [ORIGINAL_SEARCH_HEADER]: "?q=spoofed",
    },
  });

  const response = await proxy(request);

  expect(response.headers.get("x-middleware-request-cookie")).toBe("session=old; retained=keep");
  expect(response.headers.get("x-middleware-request-x-salud-plus-original-search")).toBe(
    "?q=%41na",
  );
  expect(response.cookies.getAll()).toHaveLength(0);
});
