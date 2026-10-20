import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  requireProfessionalContext,
  requireRole,
} from "@/modules/access/server/authorization";
import { getAvailabilityForProfessionalCenter } from "@/modules/availability/server/availability";
import { getAppointment } from "@/modules/appointments/server/appointments";
import AppointmentDetailPage from "./page";

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
vi.mock("@/modules/availability/server/availability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/availability/server/availability")>()),
  getAvailabilityForProfessionalCenter: vi.fn(),
}));
vi.mock("@/modules/appointments/server/appointments", () => ({ getAppointment: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const row = {
  appointment_id: appointmentId,
  starts_at: "2026-10-20T12:00:00+00:00",
  ends_at: "2026-10-20T12:30:00+00:00",
  updated_at: "2026-10-19T12:00:00.123456+00:00",
  status: "PENDING" as const,
  patient_first_name: "Ana",
  patient_last_name: "Sol",
  specialty_name: "Clínica",
};
function page(id = centerId, appointment = appointmentId) {
  return AppointmentDetailPage({
    params: Promise.resolve({ centerId: id, appointmentId: appointment }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    center: { id: centerId, name: "Centro", timezone: "UTC" },
    membership: { role: "PROFESSIONAL" },
  } as never);
  vi.mocked(requireProfessionalContext).mockResolvedValue({} as never);
  vi.mocked(getAppointment).mockResolvedValue({ kind: "PROFESSIONAL", appointment: row });
});

describe("appointment detail route", () => {
  it("passes only the Professional projection and does not read administrative Availability", async () => {
    const result = await page();
    expect(requireProfessionalContext).toHaveBeenCalledWith(centerId, expect.anything());
    expect(getAppointment).toHaveBeenCalledWith({ centerId, appointmentId }, expect.anything());
    expect(result.props.children.props.detail).toEqual({ kind: "PROFESSIONAL", appointment: row });
    expect(JSON.stringify(result.props.children.props.detail)).not.toMatch(
      /administrative_note|patient_center_id/,
    );
    expect(getAvailabilityForProfessionalCenter).not.toHaveBeenCalled();
  });
  it("shows 404 for missing or cross-Center appointments", async () => {
    vi.mocked(getAppointment).mockResolvedValueOnce({ kind: "PROFESSIONAL", appointment: null });
    await expect(page()).rejects.toThrow("NOT_FOUND");
    vi.mocked(getAppointment).mockRejectedValueOnce({ code: "42501" });
    await expect(page()).rejects.toThrow("NOT_FOUND");
  });
  it.each(["CENTER_ACCESS_DENIED", "PROFESSIONAL_CONTEXT_MISSING"] as const)(
    "denies %s before the RPC",
    async (code) => {
      if (code === "CENTER_ACCESS_DENIED")
        vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      else
        vi.mocked(requireProfessionalContext).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(page()).rejects.toThrow("NOT_FOUND");
      expect(getAppointment).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid route identifiers", async () => {
    await expect(page("wrong")).rejects.toThrow("NOT_FOUND");
    await expect(page(centerId, "wrong")).rejects.toThrow("NOT_FOUND");
  });
  it("marks a failed staff Availability read indeterminate", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      center: { id: centerId, name: "Centro", timezone: "UTC" },
      membership: { role: "ADMIN" },
    } as never);
    vi.mocked(getAppointment).mockResolvedValue({
      kind: "STAFF",
      appointment: {
        ...row,
        patient_center_id: "33333333-3333-4333-8333-333333333333",
        professional_center_id: "44444444-4444-4444-8444-444444444444",
        professional_first_name: "Dr",
        professional_last_name: "Sol",
        specialty_id: "55555555-5555-4555-8555-555555555555",
        administrative_note: null,
        starts_at: "2099-10-20T12:00:00+00:00",
        ends_at: "2099-10-20T12:30:00+00:00",
      },
    });
    vi.mocked(getAvailabilityForProfessionalCenter).mockRejectedValue(new Error("read failed"));
    const result = await page();
    expect(result.props.children.props.outsideAvailability).toBeNull();
  });
});
