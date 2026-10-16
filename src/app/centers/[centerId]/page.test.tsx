import { describe, expect, it, vi } from "vitest";
import { PageReveal } from "@/components/page-reveal";
import { AuthorizationError, requireCenterMembership } from "@/modules/access/server/authorization";
import CenterPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireCenterMembership: vi.fn() };
});

const centerId = "11111111-1111-4111-8111-111111111111";

describe("Center route transition", () => {
  it("reveals the authorized center page", async () => {
    vi.mocked(requireCenterMembership).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro" },
      user: { firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
      membership: { role: "ADMIN" },
    } as never);

    const result = await CenterPage({ params: Promise.resolve({ centerId }) });
    expect(result.type).toBe(PageReveal);
    expect(result.props.children.type).toBe("main");
    expect(requireCenterMembership).toHaveBeenCalledWith(centerId);
  });

  it("keeps denied access outside the reveal", async () => {
    vi.mocked(requireCenterMembership).mockRejectedValueOnce(
      new AuthorizationError("CENTER_ACCESS_DENIED"),
    );
    await expect(CenterPage({ params: Promise.resolve({ centerId }) })).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});
