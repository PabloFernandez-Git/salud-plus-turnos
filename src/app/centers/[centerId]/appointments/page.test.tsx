import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  requireProfessionalContext,
  requireRole,
} from "@/modules/access/server/authorization";
import { listAvailabilityProfessionalCenters } from "@/modules/availability/server/availability";
import { listAppointments } from "@/modules/appointments/server/appointments";
import AppointmentsPage from "./page";

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
  return { ...original, requireRole: vi.fn(), requireProfessionalContext: vi.fn() };
});
vi.mock("@/modules/availability/server/availability", () => ({
  listAvailabilityProfessionalCenters: vi.fn(),
}));
vi.mock("@/modules/appointments/server/appointments", () => ({ listAppointments: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
function page(id = centerId, searchParams: Record<string, string> = {}) {
  return AppointmentsPage({
    params: Promise.resolve({ centerId: id }),
    searchParams: Promise.resolve(searchParams),
  });
}
function role(value: "ADMIN" | "RECEPTION" | "PROFESSIONAL") {
  vi.mocked(requireRole).mockResolvedValue({
    center: { id: centerId, name: "Centro", timezone: "America/Argentina/Buenos_Aires" },
    membership: { role: value },
  } as never);
}
beforeEach(() => {
  vi.clearAllMocks();
  role("ADMIN");
  vi.mocked(requireProfessionalContext).mockResolvedValue({} as never);
  vi.mocked(listAppointments).mockResolvedValue({
    kind: "STAFF",
    rows: [],
    hasMore: false,
    nextCursor: null,
  });
  vi.mocked(listAvailabilityProfessionalCenters).mockResolvedValue([]);
});

describe("appointment list route", () => {
  it.each(["ADMIN", "RECEPTION"] as const)(
    "passes %s filters to the staff query",
    async (value) => {
      role(value);
      const result = await page(centerId, {
        from: "2026-10-01",
        to: "2026-10-31",
        status: "CANCELLED",
      });
      expect(result.props.children.props.role).toBe(value);
      expect(listAppointments).toHaveBeenCalledWith(
        { centerId, fromDate: "2026-10-01", toDate: "2026-10-31", status: "CANCELLED" },
        expect.anything(),
      );
      expect(listAvailabilityProfessionalCenters).toHaveBeenCalled();
    },
  );
  it("requires Professional context and never requests a staff filter catalogue", async () => {
    role("PROFESSIONAL");
    vi.mocked(listAppointments).mockResolvedValue({
      kind: "PROFESSIONAL",
      rows: [],
      hasMore: false,
      nextCursor: null,
    });
    const result = await page(centerId, {
      professional: centerId,
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(requireProfessionalContext).toHaveBeenCalledWith(centerId, expect.anything());
    expect(listAvailabilityProfessionalCenters).not.toHaveBeenCalled();
    expect(result.props.children.props.filters).not.toHaveProperty("professionalCenterId");
  });
  it.each(["CENTER_ACCESS_DENIED", "ROLE_FORBIDDEN", "PROFESSIONAL_CONTEXT_MISSING"] as const)(
    "denies %s before listing",
    async (code) => {
      if (code === "PROFESSIONAL_CONTEXT_MISSING") {
        role("PROFESSIONAL");
        vi.mocked(requireProfessionalContext).mockRejectedValueOnce(new AuthorizationError(code));
      } else vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(page()).rejects.toThrow("NOT_FOUND");
      expect(listAppointments).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid Center IDs and redirects unauthenticated users", async () => {
    await expect(page("invalid")).rejects.toThrow("NOT_FOUND");
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("UNAUTHENTICATED"));
    await expect(page()).rejects.toThrow("REDIRECT:/login");
  });
});
