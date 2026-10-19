import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  createAppointmentAction,
  rescheduleAppointmentAction,
  updateAppointmentNoteAction,
} from "./appointment-actions";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});
const centerId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const patientCenterId = "33333333-3333-4333-8333-333333333333";
const professionalCenterId = "44444444-4444-4444-8444-444444444444";
const specialtyId = "55555555-5555-4555-8555-555555555555";
const token = "2026-10-19T12:00:00.123456+00:00";
const create = {
  centerId,
  patientCenterId,
  professionalCenterId,
  specialtyId,
  localDate: "2026-10-20",
  localStartTime: "09:00",
};
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  vi.mocked(requireRole).mockResolvedValue({ membership: { role: "ADMIN" } } as never);
});

describe("appointment mutation actions", () => {
  it("rejects manipulated CREATE before creating a client or calling RPC", async () => {
    expect(await createAppointmentAction({ ...create, status: "ATTENDED" })).toMatchObject({
      status: "VALIDATION_ERROR",
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["UNAUTHENTICATED", "CENTER_ACCESS_DENIED", "ROLE_FORBIDDEN"] as const)(
    "blocks %s before RPC",
    async (reason) => {
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(reason));
      expect(await createAppointmentAction(create)).toEqual({
        status: "AUTH_ERROR",
        code: "ACCESS_DENIED",
      });
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("returns a safe unknown result for network loss and never retries CREATE", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "", message: "TypeError: fetch failed", details: "secret" },
    });
    expect(await createAppointmentAction(create)).toEqual({
      status: "UNKNOWN_RESULT",
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("distinguishes a client setup failure from an RPC outcome", async () => {
    vi.mocked(createSupabaseServerClient).mockRejectedValueOnce(new TypeError("cookie failure"));
    expect(await createAppointmentAction(create)).toEqual({ status: "UNEXPECTED_ERROR" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("marks a rejected in-flight RPC uncertain without another CREATE", async () => {
    rpc.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await createAppointmentAction(create)).toEqual({
      status: "UNKNOWN_RESULT",
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("returns DB slot and DST codes without raw SQL", async () => {
    for (const [code, message] of [
      ["23P01", "SLOT_ALREADY_TAKEN"],
      ["22023", "INVALID_LOCAL_TIME"],
      ["22023", "AMBIGUOUS_LOCAL_TIME"],
    ]) {
      rpc.mockResolvedValueOnce({
        data: null,
        error: { code, message, details: "secret constraint" },
      });
      expect(await createAppointmentAction(create)).toMatchObject({
        status: "BUSINESS_ERROR",
        code: message,
      });
    }
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it("passes stale CAS to UI as reload without changing the microsecond token", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "STALE_APPOINTMENT_STATE" },
    });
    expect(
      await rescheduleAppointmentAction({
        centerId,
        appointmentId,
        expectedUpdatedAt: token,
        professionalCenterId,
        specialtyId,
        localDate: "2026-10-20",
        localStartTime: "10:00",
      }),
    ).toEqual({ status: "BUSINESS_ERROR", code: "STALE_APPOINTMENT_STATE", reload: true });
    expect(rpc.mock.calls[0][1].p_expected_updated_at).toBe(token);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("passes NULL and no-op note result, and rejects 2001 characters", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ appointment_id: appointmentId, updated_at: token }],
      error: null,
    });
    expect(
      await updateAppointmentNoteAction({
        centerId,
        appointmentId,
        expectedUpdatedAt: token,
        administrativeNote: null,
      }),
    ).toEqual({
      status: "SUCCESS",
      data: { appointment_id: appointmentId, updated_at: token },
    });
    expect(rpc.mock.calls[0][1].p_administrative_note).toBeNull();
    expect(
      await updateAppointmentNoteAction({
        centerId,
        appointmentId,
        expectedUpdatedAt: token,
        administrativeNote: "x".repeat(2001),
      }),
    ).toMatchObject({ status: "VALIDATION_ERROR" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
