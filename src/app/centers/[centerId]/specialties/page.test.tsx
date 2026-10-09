import { describe, expect, it, vi } from "vitest";

import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { listSpecialties } from "@/modules/specialties/server/specialties";
import SpecialtiesPage from "./page";

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
vi.mock("@/modules/specialties/server/specialties", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/modules/specialties/server/specialties")>();
  return { ...original, listSpecialties: vi.fn(async () => []) };
});

const centerId = "11111111-1111-4111-8111-111111111111";
const page = (id = centerId) => SpecialtiesPage({ params: Promise.resolve({ centerId: id }) });

describe("Specialties route authorization", () => {
  it("renders for active ADMIN and lists the scoped center", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro Salud" },
    } as never);
    const result = await page();
    expect(result.props.centerId).toBe(centerId);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN"], expect.anything());
    expect(listSpecialties).toHaveBeenCalledWith(centerId, expect.anything());
  });

  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED"] as const)(
    "returns not-found for %s",
    async (code) => {
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(page()).rejects.toThrow("NOT_FOUND");
    },
  );

  it("denies a platform-only user and invalid center IDs", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("CENTER_ACCESS_DENIED"));
    await expect(page()).rejects.toThrow("NOT_FOUND");
    await expect(page("invalid")).rejects.toThrow("NOT_FOUND");
  });

  it("redirects an unauthenticated user to login", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("UNAUTHENTICATED"));
    await expect(page()).rejects.toThrow("REDIRECT:/login");
  });
});
