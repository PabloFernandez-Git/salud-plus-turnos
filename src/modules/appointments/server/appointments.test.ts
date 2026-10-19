import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  requireProfessionalContext,
  requireRole,
} from "@/modules/access/server/authorization";
import { listPatientCenters } from "@/modules/patients/server/patients";
import {
  addAppointment,
  changeAppointmentStatus,
  editAppointmentNote,
  getAppointment,
  listAppointments,
  moveAppointment,
  searchAppointmentPatients,
} from "./appointments";
import type { AppointmentClient } from "./appointment-rpc";

vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn(), requireProfessionalContext: vi.fn() };
});
vi.mock("@/modules/patients/server/patients", () => ({ listPatientCenters: vi.fn() }));

const centerId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const patientCenterId = "33333333-3333-4333-8333-333333333333";
const professionalCenterId = "44444444-4444-4444-8444-444444444444";
const specialtyId = "55555555-5555-4555-8555-555555555555";
const token = "2026-10-19T12:00:00.123456+00:00";
const baseRow = {
  appointment_id: appointmentId,
  starts_at: "2026-10-20T12:00:00+00:00",
  ends_at: "2026-10-20T12:30:00+00:00",
  status: "PENDING",
  updated_at: token,
  patient_first_name: "Ana",
  patient_last_name: "Sol",
  specialty_name: "Clínica",
};
const sensitive = {
  administrative_note: "private",
  document_number: "123",
  nationality_code: "AR",
  phone: "555",
  email: "a@example.com",
  birth_date: "2000-01-01",
  patient_center_id: patientCenterId,
};
const calls = vi.fn();
const client = { rpc: calls } as unknown as AppointmentClient;
function role(value: "ADMIN" | "RECEPTION" | "PROFESSIONAL") {
  vi.mocked(requireRole).mockResolvedValue({ membership: { role: value } } as never);
  vi.mocked(requireProfessionalContext).mockResolvedValue({} as never);
}
beforeEach(() => {
  vi.clearAllMocks();
  role("ADMIN");
});

describe("appointments server contracts", () => {
  it("routes Professional list and detail only to own RPCs and strips surplus sensitive fields", async () => {
    role("PROFESSIONAL");
    calls.mockResolvedValueOnce({
      data: [{ ...baseRow, ...sensitive, has_more: false }],
      error: null,
    });
    const list = await listAppointments(
      { centerId, fromDate: "2026-10-20", toDate: "2026-10-20" },
      client,
    );
    expect(list.kind).toBe("PROFESSIONAL");
    expect(list.rows[0]).toEqual({ ...baseRow, has_more: false });
    expect(calls).toHaveBeenCalledWith(
      "professional_list_own_appointments",
      expect.objectContaining({ p_center_id: centerId }),
    );
    calls.mockResolvedValueOnce({ data: [{ ...baseRow, ...sensitive }], error: null });
    const detail = await getAppointment({ centerId, appointmentId }, client);
    expect(detail).toEqual({ kind: "PROFESSIONAL", appointment: baseRow });
    expect(calls).toHaveBeenLastCalledWith("professional_get_own_appointment", expect.anything());
    expect(JSON.stringify({ list, detail })).not.toMatch(
      /administrative_note|document_number|nationality_code|phone|email|birth_date|patient_center_id/,
    );
  });
  it("uses the administrative RPC and preserves historical inactive rows and cursor", async () => {
    const row = {
      ...baseRow,
      has_more: true,
      professional_center_id: professionalCenterId,
      professional_first_name: "Dr",
      professional_last_name: "Old",
      is_active: false,
    };
    calls.mockResolvedValueOnce({ data: [row], error: null });
    const result = await listAppointments(
      {
        centerId,
        fromDate: "2026-10-20",
        toDate: "2026-10-20",
        status: "PENDING",
        limit: 10,
        cursor: { startsAt: token, id: appointmentId },
        professionalCenterId,
      },
      client,
    );
    expect(result).toMatchObject({
      kind: "STAFF",
      hasMore: true,
      nextCursor: { id: appointmentId, startsAt: row.starts_at },
    });
    expect(result.rows[0]).not.toHaveProperty("is_active");
    expect(calls).toHaveBeenCalledWith(
      "staff_list_appointments",
      expect.objectContaining({
        p_limit: 10,
        p_cursor_starts_at: token,
        p_cursor_id: appointmentId,
        p_professional_center_id: professionalCenterId,
        p_status: "PENDING",
      }),
    );
  });
  it("does not call an RPC after denied authorization", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("CENTER_ACCESS_DENIED"));
    await expect(
      addAppointment(
        {
          centerId,
          patientCenterId,
          professionalCenterId,
          specialtyId,
          localDate: "2026-10-20",
          localStartTime: "09:00",
        },
        client,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(calls).not.toHaveBeenCalled();
  });
  it("keeps Professional out of CREATE, RESCHEDULE and NOTE", async () => {
    vi.mocked(requireRole).mockRejectedValue(new AuthorizationError("ROLE_FORBIDDEN"));
    await expect(
      addAppointment(
        {
          centerId,
          patientCenterId,
          professionalCenterId,
          specialtyId,
          localDate: "2026-10-20",
          localStartTime: "09:00",
        },
        client,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      moveAppointment(
        {
          centerId,
          appointmentId,
          expectedUpdatedAt: token,
          professionalCenterId,
          specialtyId,
          localDate: "2026-10-20",
          localStartTime: "10:00",
        },
        client,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      editAppointmentNote(
        { centerId, appointmentId, expectedUpdatedAt: token, administrativeNote: null },
        client,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(vi.mocked(requireRole).mock.calls.map((call) => call[1])).toEqual([
      ["ADMIN", "RECEPTION"],
      ["ADMIN", "RECEPTION"],
      ["ADMIN", "RECEPTION"],
    ]);
    expect(calls).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "RECEPTION"] as const)(
    "creates PENDING for %s without client status or UTC input",
    async (membershipRole) => {
      role(membershipRole);
      calls.mockResolvedValueOnce({
        data: [{ appointment_id: appointmentId, status: "PENDING", updated_at: token }],
        error: null,
      });
      const result = await addAppointment(
        {
          centerId,
          patientCenterId,
          professionalCenterId,
          specialtyId,
          localDate: "2026-10-20",
          localStartTime: "09:00",
          administrativeNote: "",
        },
        client,
      );
      expect(result).toEqual({
        appointment_id: appointmentId,
        status: "PENDING",
        updated_at: token,
      });
      const args = calls.mock.calls[0][1];
      expect(args).toMatchObject({ p_administrative_note: "", p_local_start_time: "09:00" });
      expect(Object.keys(args).some((key) => /status|ends_at|starts_at|duration/.test(key))).toBe(
        false,
      );
    },
  );
  it("passes exact microsecond CAS through reschedule and propagates stale", async () => {
    calls.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "STALE_APPOINTMENT_STATE" },
    });
    await expect(
      moveAppointment(
        {
          centerId,
          appointmentId,
          expectedUpdatedAt: token,
          professionalCenterId,
          specialtyId,
          localDate: "2026-10-20",
          localStartTime: "10:00",
        },
        client,
      ),
    ).rejects.toMatchObject({ code: "P0001" });
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls.mock.calls[0][1].p_expected_updated_at).toBe(token);
  });
  it("validates status against the role and current state before calling mutation", async () => {
    role("PROFESSIONAL");
    calls.mockResolvedValueOnce({ data: [baseRow], error: null });
    expect(
      await changeAppointmentStatus(
        { centerId, appointmentId, expectedUpdatedAt: token, requestedStatus: "CANCELLED" },
        client,
      ),
    ).toEqual({ kind: "INVALID_TRANSITION" });
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls).toHaveBeenCalledWith("professional_get_own_appointment", expect.anything());
  });
  it("returns stale before local transition validation when the token changed", async () => {
    role("ADMIN");
    calls.mockResolvedValueOnce({
      data: [
        {
          ...baseRow,
          status: "CONFIRMED",
          professional_center_id: professionalCenterId,
          professional_first_name: "Dr",
          professional_last_name: "Old",
          patient_center_id: patientCenterId,
          specialty_id: specialtyId,
          administrative_note: null,
        },
      ],
      error: null,
    });
    expect(
      await changeAppointmentStatus(
        {
          centerId,
          appointmentId,
          expectedUpdatedAt: "2026-10-19T12:00:00.000001+00:00",
          requestedStatus: "CONFIRMED",
        },
        client,
      ),
    ).toEqual({ kind: "STALE" });
    expect(calls).toHaveBeenCalledTimes(1);
  });
  it("allows Professional ATTENDED only through own read and shared DB mutation", async () => {
    role("PROFESSIONAL");
    calls.mockResolvedValueOnce({ data: [baseRow], error: null });
    calls.mockResolvedValueOnce({
      data: [{ appointment_id: appointmentId, status: "ATTENDED", updated_at: token }],
      error: null,
    });
    expect(
      await changeAppointmentStatus(
        { centerId, appointmentId, expectedUpdatedAt: token, requestedStatus: "ATTENDED" },
        client,
      ),
    ).toMatchObject({ kind: "CHANGED", result: { status: "ATTENDED" } });
    expect(calls.mock.calls.map((call) => call[0])).toEqual([
      "professional_get_own_appointment",
      "staff_transition_appointment_status",
    ]);
  });
  it("does not mutate a Professional appointment absent from the own projection", async () => {
    role("PROFESSIONAL");
    calls.mockResolvedValueOnce({ data: [], error: null });
    expect(
      await changeAppointmentStatus(
        { centerId, appointmentId, expectedUpdatedAt: token, requestedStatus: "ATTENDED" },
        client,
      ),
    ).toEqual({ kind: "NOT_FOUND" });
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls).toHaveBeenCalledWith("professional_get_own_appointment", expect.anything());
  });
  it.each(["text", "", null])(
    "sends administrative note %s including NULL exactly",
    async (note) => {
      calls.mockResolvedValueOnce({
        data: [{ appointment_id: appointmentId, updated_at: token }],
        error: null,
      });
      await editAppointmentNote(
        { centerId, appointmentId, expectedUpdatedAt: token, administrativeNote: note },
        client,
      );
      expect(calls).toHaveBeenCalledWith(
        "staff_update_appointment_note",
        expect.objectContaining({ p_administrative_note: note }),
      );
    },
  );
  it("reuses TASK-007 patient search and returns only selectable fields", async () => {
    vi.mocked(listPatientCenters).mockResolvedValue({
      rows: [
        {
          patient_center_id: patientCenterId,
          first_name: "Ana",
          last_name: "Sol",
          document_number: "private",
        },
      ],
      page: 1,
      hasNext: false,
    } as never);
    expect(await searchAppointmentPatients({ centerId, query: "Ana", page: 1 }, client)).toEqual({
      rows: [{ patientCenterId, firstName: "Ana", lastName: "Sol" }],
      page: 1,
      hasNext: false,
    });
  });
});
