import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { getPatientCenter } from "@/modules/patients/server/patient-management";
import NewAppointmentPage from "./page";

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
vi.mock("@/modules/patients/server/patient-management", () => ({ getPatientCenter: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
const otherCenterId = "22222222-2222-4222-8222-222222222222";
const patientCenterId = "33333333-3333-4333-8333-333333333333";
function page(id = centerId, candidate?: string) {
  return NewAppointmentPage({
    params: Promise.resolve({ centerId: id }),
    searchParams: Promise.resolve(candidate ? { patientCenterId: candidate } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    center: { id: centerId, name: "Centro", timezone: "UTC" },
    membership: { role: "RECEPTION" },
  } as never);
  vi.mocked(getPatientCenter).mockResolvedValue({
    patientCenterId,
    firstName: "Ana",
    lastName: "Sol",
    isActive: true,
  } as never);
});

describe("new appointment route", () => {
  it("requires tenant ADMIN or RECEPTION and revalidates same-Center active patient", async () => {
    const result = await page(centerId, patientCenterId);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN", "RECEPTION"], expect.anything());
    expect(getPatientCenter).toHaveBeenCalledWith(centerId, patientCenterId, expect.anything());
    expect(result.props.children.props.initialPatient).toEqual({
      patientCenterId,
      firstName: "Ana",
      lastName: "Sol",
    });
  });
  it("discards inactive, cross-Center and invalid selections", async () => {
    vi.mocked(getPatientCenter)
      .mockResolvedValueOnce({ patientCenterId, isActive: false } as never)
      .mockResolvedValueOnce(null);
    expect((await page(centerId, patientCenterId)).props.children.props.initialPatient).toBeNull();
    expect((await page(centerId, otherCenterId)).props.children.props.initialPatient).toBeNull();
    expect(
      (await page(centerId, "https://evil.test")).props.children.props.initialPatient,
    ).toBeNull();
    expect(getPatientCenter).toHaveBeenCalledTimes(2);
  });
  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED"] as const)(
    "denies %s before reading a patient",
    async (code) => {
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(page(centerId, patientCenterId)).rejects.toThrow("NOT_FOUND");
      expect(getPatientCenter).not.toHaveBeenCalled();
    },
  );
  it("redirects an unauthenticated user and rejects invalid Center IDs", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("UNAUTHENTICATED"));
    await expect(page()).rejects.toThrow("REDIRECT:/login");
    await expect(page("wrong")).rejects.toThrow("NOT_FOUND");
  });
});
