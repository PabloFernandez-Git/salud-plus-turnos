import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { callPatientAppointmentRpc } from "../api/patient-appointment-rpc";
import { loadPatientAppointmentPage, loadPatientAppointmentSections } from "./patient-appointments";

vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});
vi.mock("../api/patient-appointment-rpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/patient-appointment-rpc")>();
  return { ...original, callPatientAppointmentRpc: vi.fn() };
});

const centerId = "11111111-1111-4111-8111-111111111111";
const patientCenterId = "22222222-2222-4222-8222-222222222222";
const appointmentId = "33333333-3333-4333-8333-333333333333";
const client = {} as SupabaseClient<Database>;
const row = {
  appointment_id: appointmentId,
  starts_at: "2026-10-22T12:00:00+00:00",
  ends_at: "2026-10-22T12:30:00+00:00",
  status: "PENDING" as const,
  professional_first_name: "Ana",
  professional_last_name: "Pérez",
  specialty_name: "Clínica",
  has_more: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({} as never);
  vi.mocked(callPatientAppointmentRpc).mockResolvedValue([row]);
});

describe("patient appointment service", () => {
  it("authorizes staff once, captures one cut, and sends it to both sections", async () => {
    const result = await loadPatientAppointmentSections({ centerId, patientCenterId }, client);
    expect(requireRole).toHaveBeenCalledOnce();
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN", "RECEPTION"], client);
    expect(callPatientAppointmentRpc).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(callPatientAppointmentRpc).mock.calls.map((call) => call[1].p_section),
    ).toEqual(["UPCOMING", "HISTORY"]);
    expect(
      vi
        .mocked(callPatientAppointmentRpc)
        .mock.calls.every(
          (call) =>
            call[1].p_as_of === result.asOf && call[1].p_patient_center_id === patientCenterId,
        ),
    ).toBe(true);
    expect(result.upcoming?.nextCursor).toEqual({ startsAt: row.starts_at, id: appointmentId });
  });

  it("does not call the RPC when the Center role is denied", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));
    await expect(
      loadPatientAppointmentSections({ centerId, patientCenterId }, client),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(callPatientAppointmentRpc).not.toHaveBeenCalled();
  });

  it("preserves a working section when the other read fails", async () => {
    vi.mocked(callPatientAppointmentRpc).mockRejectedValueOnce(new Error("network"));
    const result = await loadPatientAppointmentSections({ centerId, patientCenterId }, client);
    expect(result.upcoming).toBeNull();
    expect(result.history?.rows).toEqual([row]);
  });

  it("passes the fixed cut and strict tuple cursor for subsequent pages", async () => {
    const asOf = "2026-10-22T00:00:00.000Z";
    const cursor = { startsAt: row.starts_at, id: appointmentId };
    const page = await loadPatientAppointmentPage(
      { centerId, patientCenterId, section: "HISTORY", asOf, cursor },
      client,
    );
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN", "RECEPTION"], client);
    expect(callPatientAppointmentRpc).toHaveBeenCalledWith(client, {
      p_center_id: centerId,
      p_patient_center_id: patientCenterId,
      p_section: "HISTORY",
      p_as_of: asOf,
      p_cursor_starts_at: row.starts_at,
      p_cursor_id: appointmentId,
      p_limit: 20,
    });
    expect(page.hasMore).toBe(true);
  });
});
