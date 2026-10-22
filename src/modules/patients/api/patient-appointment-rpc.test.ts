import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { callPatientAppointmentRpc, patientAppointmentRowSchema } from "./patient-appointment-rpc";

const centerId = "11111111-1111-4111-8111-111111111111";
const patientCenterId = "22222222-2222-4222-8222-222222222222";
const appointmentId = "33333333-3333-4333-8333-333333333333";
const row = {
  appointment_id: appointmentId,
  starts_at: "2026-10-22T12:00:00+00:00",
  ends_at: "2026-10-22T12:30:00+00:00",
  status: "CONFIRMED",
  professional_first_name: "Ana",
  professional_last_name: "Pérez",
  specialty_name: "Clínica",
  has_more: false,
};
const args = {
  p_center_id: centerId,
  p_patient_center_id: patientCenterId,
  p_section: "UPCOMING" as const,
  p_as_of: "2026-10-22T00:00:00.000Z",
  p_cursor_starts_at: null,
  p_cursor_id: null,
  p_limit: 20,
};

describe("patient appointment RPC contract", () => {
  it("calls the exact RPC with Center and PatientCenter and accepts only eight columns", async () => {
    const rpc = vi.fn(async () => ({ data: [row], error: null }));
    const client = { rpc } as unknown as SupabaseClient<Database>;
    expect(await callPatientAppointmentRpc(client, args)).toEqual([row]);
    expect(rpc).toHaveBeenCalledWith("staff_list_patient_appointments", args);
    expect(
      patientAppointmentRowSchema.safeParse({ ...row, administrative_note: "secret" }).success,
    ).toBe(false);
  });

  it("rejects missing fields and returns database errors without exposing extra data", async () => {
    const rpc = vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({
      data: [{ ...row, specialty_name: null }],
      error: null,
    }));
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await expect(callPatientAppointmentRpc(client, args)).rejects.toThrow();
    rpc.mockResolvedValueOnce({
      data: [],
      error: { code: "42501", message: "APPOINTMENT_ACCESS_DENIED" },
    });
    await expect(callPatientAppointmentRpc(client, args)).rejects.toMatchObject({ code: "42501" });
  });
});
