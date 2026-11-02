import { describe, expect, it, vi } from "vitest";
import { PageReveal } from "@/components/page-reveal";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { getCenterSettings } from "@/modules/access/server/center-settings";
import CenterSettingsPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});
vi.mock("@/modules/access/server/center-settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/center-settings")>();
  return { ...original, getCenterSettings: vi.fn() };
});

const centerId = "11111111-1111-4111-8111-111111111111";

describe("center settings route", () => {
  it("requires ADMIN and loads only that center", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({} as never);
    vi.mocked(getCenterSettings).mockResolvedValueOnce({ id: centerId, name: "Centro" } as never);
    const result = await CenterSettingsPage({ params: Promise.resolve({ centerId }) });
    expect(result.type).toBe(PageReveal);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN"], expect.anything());
    expect(getCenterSettings).toHaveBeenCalledWith(centerId, expect.anything());
  });

  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED"] as const)(
    "denies %s before reading settings",
    async (code) => {
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      vi.mocked(getCenterSettings).mockClear();
      await expect(CenterSettingsPage({ params: Promise.resolve({ centerId }) })).rejects.toThrow(
        "NOT_FOUND",
      );
      expect(getCenterSettings).not.toHaveBeenCalled();
    },
  );
});
