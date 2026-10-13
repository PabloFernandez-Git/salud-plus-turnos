import { describe, expect, it, vi } from "vitest";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  listProfessionalSpecialtyConfiguration,
  listProfessionals,
} from "@/modules/professionals/server/professionals";
import ProfessionalsPage from "./page";
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
vi.mock("@/modules/professionals/server/professionals", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/modules/professionals/server/professionals")>();
  return {
    ...original,
    listProfessionals: vi.fn(async () => []),
    listProfessionalSpecialtyConfiguration: vi.fn(async () => ({
      specialties: [],
      associations: [],
    })),
  };
});
const centerId = "11111111-1111-4111-8111-111111111111";
const page = (id = centerId) => ProfessionalsPage({ params: Promise.resolve({ centerId: id }) });
describe("Professionals route authorization", () => {
  it("allows ADMIN and lists the scoped center", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro" },
    } as never);
    const result = await page();
    expect(result.props.centerId).toBe(centerId);
    expect(listProfessionals).toHaveBeenCalledWith(centerId, expect.anything());
    expect(listProfessionalSpecialtyConfiguration).toHaveBeenCalledWith(
      centerId,
      expect.anything(),
    );
  });
  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED"] as const)("denies %s", async (code) => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
    await expect(page()).rejects.toThrow("NOT_FOUND");
  });
  it("denies platform-only and invalid center", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("CENTER_ACCESS_DENIED"));
    await expect(page()).rejects.toThrow("NOT_FOUND");
    await expect(page("invalid")).rejects.toThrow("NOT_FOUND");
  });
});
