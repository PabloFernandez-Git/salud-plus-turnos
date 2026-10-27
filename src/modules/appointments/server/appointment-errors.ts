import { z } from "zod";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { AppointmentOutcomeUnknown } from "./appointment-rpc";

export const appointmentBusinessCodes = [
  "ACCESS_DENIED",
  "PATIENT_NOT_AVAILABLE",
  "PROFESSIONAL_NOT_AVAILABLE",
  "SPECIALTY_NOT_AVAILABLE",
  "SPECIALTY_NOT_ASSIGNED",
  "OUTSIDE_AVAILABILITY",
  "SLOT_ALREADY_TAKEN",
  "APPOINTMENT_IN_PAST",
  "INVALID_LOCAL_TIME",
  "AMBIGUOUS_LOCAL_TIME",
  "STALE_APPOINTMENT_STATE",
  "INVALID_STATUS_TRANSITION",
  "APPOINTMENT_TIME_RESTRICTION",
  "APPOINTMENT_NOT_FOUND",
  "INVALID_TIMEZONE",
  "INVALID_INPUT",
] as const;
export type AppointmentBusinessCode = (typeof appointmentBusinessCodes)[number];

const sqlErrors: Readonly<Record<string, AppointmentBusinessCode>> = {
  "42501:ACCESS_DENIED": "ACCESS_DENIED",
  "42501:APPOINTMENT_ACCESS_DENIED": "ACCESS_DENIED",
  "P0002:PATIENT_NOT_AVAILABLE": "PATIENT_NOT_AVAILABLE",
  "P0002:PROFESSIONAL_NOT_AVAILABLE": "PROFESSIONAL_NOT_AVAILABLE",
  "P0002:SPECIALTY_NOT_AVAILABLE": "SPECIALTY_NOT_AVAILABLE",
  "P0002:SPECIALTY_NOT_ASSIGNED": "SPECIALTY_NOT_ASSIGNED",
  "22023:OUTSIDE_AVAILABILITY": "OUTSIDE_AVAILABILITY",
  "23P01:SLOT_ALREADY_TAKEN": "SLOT_ALREADY_TAKEN",
  "22023:APPOINTMENT_IN_PAST": "APPOINTMENT_IN_PAST",
  "22023:INVALID_LOCAL_TIME": "INVALID_LOCAL_TIME",
  "22023:AMBIGUOUS_LOCAL_TIME": "AMBIGUOUS_LOCAL_TIME",
  "P0001:STALE_APPOINTMENT_STATE": "STALE_APPOINTMENT_STATE",
  "P0001:INVALID_STATUS_TRANSITION": "INVALID_STATUS_TRANSITION",
  "P0001:APPOINTMENT_TIME_RESTRICTION": "APPOINTMENT_TIME_RESTRICTION",
  "P0002:APPOINTMENT_NOT_FOUND": "APPOINTMENT_NOT_FOUND",
  "22023:INVALID_TIMEZONE": "INVALID_TIMEZONE",
  "22023:INVALID_INPUT": "INVALID_INPUT",
  // Gate A returns these two generic helper failures without a more specific
  // public cause. Do not guess which booking entity changed.
  "P0002:APPOINTMENT_CHOICE_NOT_AVAILABLE": "INVALID_INPUT",
  "22023:INVALID_AVAILABILITY": "INVALID_INPUT",
};

export type AppointmentFailure =
  | { status: "VALIDATION_ERROR"; fields: Record<string, string> }
  | {
      status: "BUSINESS_ERROR";
      code: Exclude<AppointmentBusinessCode, "ACCESS_DENIED">;
      reload: boolean;
    }
  | { status: "AUTH_ERROR"; code: "ACCESS_DENIED" }
  | { status: "UNKNOWN_RESULT"; reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY" }
  | { status: "UNEXPECTED_ERROR" };

export function validationFailure(error: z.ZodError): AppointmentFailure {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "input");
    fields[field] ??= "Revisá este campo.";
  }
  return { status: "VALIDATION_ERROR", fields };
}

export function mapAppointmentError(error: unknown, mutation: boolean): AppointmentFailure {
  if (error instanceof z.ZodError) return validationFailure(error);
  if (error instanceof AuthorizationError) return { status: "AUTH_ERROR", code: "ACCESS_DENIED" };
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    if (
      mutation &&
      (error.code === "" ||
        error.code.startsWith("08") ||
        ["PGRST000", "PGRST001", "PGRST002"].includes(error.code))
    ) {
      return { status: "UNKNOWN_RESULT", reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY" };
    }
    const code = sqlErrors[`${error.code}:${error.message}`];
    if (code === "ACCESS_DENIED") return { status: "AUTH_ERROR", code };
    if (code === "INVALID_INPUT") return { status: "BUSINESS_ERROR", code, reload: false };
    if (code)
      return {
        status: "BUSINESS_ERROR",
        code,
        reload: code === "STALE_APPOINTMENT_STATE" || code === "APPOINTMENT_TIME_RESTRICTION",
      };
    return { status: "UNEXPECTED_ERROR" };
  }
  if (mutation && error instanceof AppointmentOutcomeUnknown) {
    return { status: "UNKNOWN_RESULT", reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY" };
  }
  return { status: "UNEXPECTED_ERROR" };
}
