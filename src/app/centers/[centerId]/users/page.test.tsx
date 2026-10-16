import { describe, expect, it, vi } from "vitest";
import { PageReveal } from "@/components/page-reveal";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  listAvailableProfessionalCenters,
  listCenterUsers,
  listManageableProfessionalCenters,
} from "@/modules/access/server/center-users";
import CenterUsersPage from "./page";

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
vi.mock("@/modules/access/server/center-users", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/center-users")>();
  return {
    ...original,
    listCenterUsers: vi.fn(async () => []),
    listAvailableProfessionalCenters: vi.fn(async () => []),
    listManageableProfessionalCenters: vi.fn(async () => []),
  };
});

const centerId = "11111111-1111-4111-8111-111111111111";

describe("Users route transition", () => {
  it("reveals the authorized users screen", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro" },
      user: { id: "22222222-2222-4222-8222-222222222222" },
    } as never);

    const result = await CenterUsersPage({ params: Promise.resolve({ centerId }) });
    expect(result.type).toBe(PageReveal);
    expect(result.props.children.props.centerId).toBe(centerId);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN"], expect.anything());
    expect(listCenterUsers).toHaveBeenCalledWith(centerId, expect.anything());
    expect(listAvailableProfessionalCenters).toHaveBeenCalledWith(centerId, expect.anything());
    expect(listManageableProfessionalCenters).toHaveBeenCalledWith(centerId, expect.anything());
  });

  it("keeps denied access outside the reveal", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));
    await expect(CenterUsersPage({ params: Promise.resolve({ centerId }) })).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});
