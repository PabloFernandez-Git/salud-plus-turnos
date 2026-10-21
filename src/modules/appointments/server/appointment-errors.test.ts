import { describe, expect, it } from "vitest";
import { AppointmentOutcomeUnknown } from "./appointment-rpc";
import { mapAppointmentError } from "./appointment-errors";

describe("appointment error mapping", () => {
  it.each([
    ["42501", "ACCESS_DENIED", "AUTH_ERROR"],
    ["42501", "APPOINTMENT_ACCESS_DENIED", "AUTH_ERROR"],
    ["P0002", "PATIENT_NOT_AVAILABLE", "BUSINESS_ERROR"],
    ["P0002", "PROFESSIONAL_NOT_AVAILABLE", "BUSINESS_ERROR"],
    ["P0002", "SPECIALTY_NOT_AVAILABLE", "BUSINESS_ERROR"],
    ["P0002", "SPECIALTY_NOT_ASSIGNED", "BUSINESS_ERROR"],
    ["22023", "OUTSIDE_AVAILABILITY", "BUSINESS_ERROR"],
    ["23P01", "SLOT_ALREADY_TAKEN", "BUSINESS_ERROR"],
    ["22023", "APPOINTMENT_IN_PAST", "BUSINESS_ERROR"],
    ["22023", "INVALID_LOCAL_TIME", "BUSINESS_ERROR"],
    ["22023", "AMBIGUOUS_LOCAL_TIME", "BUSINESS_ERROR"],
    ["P0001", "STALE_APPOINTMENT_STATE", "BUSINESS_ERROR"],
    ["P0001", "INVALID_STATUS_TRANSITION", "BUSINESS_ERROR"],
    ["P0002", "APPOINTMENT_NOT_FOUND", "BUSINESS_ERROR"],
    ["22023", "INVALID_TIMEZONE", "BUSINESS_ERROR"],
    ["22023", "INVALID_INPUT", "BUSINESS_ERROR"],
  ])("maps only exact %s/%s", (code, message, status) => {
    expect(mapAppointmentError({ code, message, details: "private constraint" }, true).status).toBe(
      status,
    );
  });
  it("does not infer slot conflict from unrelated 23P01 or partial text", () => {
    expect(mapAppointmentError({ code: "23P01", message: "other_constraint" }, true)).toEqual({
      status: "UNEXPECTED_ERROR",
    });
    expect(
      mapAppointmentError({ code: "P0001", message: "prefix_STALE_APPOINTMENT_STATE" }, true),
    ).toEqual({ status: "UNEXPECTED_ERROR" });
  });
  it("marks network and missing mutation output uncertain without retry", () => {
    for (const error of [
      new AppointmentOutcomeUnknown(),
      { code: "", message: "TypeError: fetch failed" },
      { code: "08006", message: "connection failure" },
    ]) {
      expect(mapAppointmentError(error, true)).toEqual({
        status: "UNKNOWN_RESULT",
        reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
      });
    }
    expect(mapAppointmentError(new TypeError("fetch failed"), false)).toEqual({
      status: "UNEXPECTED_ERROR",
    });
    expect(mapAppointmentError(new TypeError("fetch failed"), true)).toEqual({
      status: "UNEXPECTED_ERROR",
    });
  });
  it("returns reload guidance for stale CAS without echoing the token", () => {
    expect(
      mapAppointmentError({ code: "P0001", message: "STALE_APPOINTMENT_STATE" }, true),
    ).toEqual({
      status: "BUSINESS_ERROR",
      code: "STALE_APPOINTMENT_STATE",
      reload: true,
    });
  });
});
