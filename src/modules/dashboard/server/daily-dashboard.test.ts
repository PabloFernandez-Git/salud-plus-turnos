import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  requireCenterMembership,
  requireProfessionalContext,
} from "@/modules/access/server/authorization";
import { callDailyDashboardRpc } from "../api/daily-dashboard-rpc";
import { getDailyDashboard } from "./daily-dashboard";

vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireCenterMembership: vi.fn(), requireProfessionalContext: vi.fn() };
});
vi.mock("../api/daily-dashboard-rpc", () => ({ callDailyDashboardRpc: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
const context = (role: string, id = centerId) => ({
  center: { id, timezone: "America/New_York", name: "Centro" },
  membership: {
    id: "membership-a",
    role,
    professionalCenterId: role === "PROFESSIONAL" ? "professional-a" : null,
  },
  user: { id: "user-a" },
});

describe("authorized dashboard service", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(["ADMIN", "RECEPTION", "PROFESSIONAL"])("uses the authorized %s scope", async (role) => {
    vi.mocked(requireCenterMembership).mockResolvedValueOnce(context(role) as never);
    if (role === "PROFESSIONAL")
      vi.mocked(requireProfessionalContext).mockResolvedValueOnce(context(role) as never);
    vi.mocked(callDailyDashboardRpc).mockResolvedValueOnce({
      row: { timezone: "America/New_York" },
      scope: role === "PROFESSIONAL" ? "professional" : "staff",
    } as never);
    const result = await getDailyDashboard(centerId, {} as never);
    expect(callDailyDashboardRpc).toHaveBeenCalledWith(
      expect.anything(),
      role === "PROFESSIONAL" ? "professional" : "staff",
      centerId,
    );
    expect(requireProfessionalContext).toHaveBeenCalledTimes(role === "PROFESSIONAL" ? 1 : 0);
    expect(result).toMatchObject({ role, membershipId: "membership-a" });
  });

  it("stops before RPC when center or professional membership is denied", async () => {
    vi.mocked(requireCenterMembership).mockRejectedValueOnce(
      new AuthorizationError("CENTER_ACCESS_DENIED"),
    );
    await expect(getDailyDashboard(centerId, {} as never)).rejects.toMatchObject({
      code: "CENTER_ACCESS_DENIED",
    });
    vi.mocked(requireCenterMembership).mockResolvedValueOnce(context("PROFESSIONAL") as never);
    vi.mocked(requireProfessionalContext).mockRejectedValueOnce(
      new AuthorizationError("PROFESSIONAL_CONTEXT_MISSING"),
    );
    await expect(getDailyDashboard(centerId, {} as never)).rejects.toMatchObject({
      code: "PROFESSIONAL_CONTEXT_MISSING",
    });
    expect(callDailyDashboardRpc).not.toHaveBeenCalled();
  });

  it("maps PostgreSQL denials but propagates internal errors", async () => {
    vi.mocked(requireCenterMembership).mockResolvedValueOnce(context("ADMIN") as never);
    vi.mocked(callDailyDashboardRpc).mockRejectedValueOnce({ code: "42501" });
    await expect(getDailyDashboard(centerId, {} as never)).rejects.toMatchObject({
      code: "CENTER_ACCESS_DENIED",
    });
    vi.mocked(requireCenterMembership).mockResolvedValueOnce(context("ADMIN") as never);
    const error = new Error("database unavailable");
    vi.mocked(callDailyDashboardRpc).mockRejectedValueOnce(error);
    await expect(getDailyDashboard(centerId, {} as never)).rejects.toBe(error);
  });
});
