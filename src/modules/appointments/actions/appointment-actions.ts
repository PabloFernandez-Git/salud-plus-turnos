"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapAppointmentError,
  validationFailure,
  type AppointmentFailure,
} from "../server/appointment-errors";
import type { AppointmentClient } from "../server/appointment-rpc";
import {
  addAppointment,
  appointmentOperationSchemas,
  changeAppointmentStatus,
  editAppointmentNote,
  getAppointment,
  getAppointmentSlots,
  getBookableProfessionals,
  getBookableSpecialties,
  listAppointments,
  moveAppointment,
  resolveAppointmentPatientSelection,
  searchAppointmentPatients,
} from "../server/appointments";

export type AppointmentActionResult<T> = { status: "SUCCESS"; data: T } | AppointmentFailure;
type StatusChangeResult = Extract<
  Awaited<ReturnType<typeof changeAppointmentStatus>>,
  { kind: "CHANGED" }
>["result"];

async function perform<T>(
  schema: z.ZodType,
  input: unknown,
  mutation: boolean,
  run: (input: unknown, client: AppointmentClient) => Promise<T>,
): Promise<AppointmentActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const client = await createSupabaseServerClient();
    return { status: "SUCCESS", data: await run(parsed.data, client) };
  } catch (error) {
    return mapAppointmentError(error, mutation);
  }
}

export async function listAppointmentsAction(input: unknown) {
  // The role-specific list schema is selected after reading the real membership.
  return perform(z.object({ centerId: z.uuid() }).passthrough(), input, false, listAppointments);
}
export async function getAppointmentAction(input: unknown) {
  const result = await perform(appointmentOperationSchemas.detail, input, false, getAppointment);
  if (result.status === "SUCCESS" && result.data.appointment === null) {
    return {
      status: "BUSINESS_ERROR" as const,
      code: "APPOINTMENT_NOT_FOUND" as const,
      reload: false,
    };
  }
  return result;
}
export async function listBookableSpecialtiesAction(input: unknown) {
  return perform(appointmentOperationSchemas.specialties, input, false, getBookableSpecialties);
}
export async function listBookableProfessionalsAction(input: unknown) {
  return perform(appointmentOperationSchemas.professionals, input, false, getBookableProfessionals);
}
export async function searchAppointmentSlotsAction(input: unknown) {
  return perform(appointmentOperationSchemas.slots, input, false, getAppointmentSlots);
}
export async function createAppointmentAction(input: unknown) {
  return perform(appointmentOperationSchemas.create, input, true, addAppointment);
}
export async function rescheduleAppointmentAction(input: unknown) {
  return perform(appointmentOperationSchemas.reschedule, input, true, moveAppointment);
}
export async function transitionAppointmentStatusAction(
  input: unknown,
): Promise<AppointmentActionResult<StatusChangeResult>> {
  const parsed = appointmentOperationSchemas.status.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const client = await createSupabaseServerClient();
    const outcome = await changeAppointmentStatus(parsed.data, client);
    if (outcome.kind === "NOT_FOUND")
      return { status: "BUSINESS_ERROR", code: "APPOINTMENT_NOT_FOUND", reload: false };
    if (outcome.kind === "STALE")
      return { status: "BUSINESS_ERROR", code: "STALE_APPOINTMENT_STATE", reload: true };
    if (outcome.kind === "INVALID_TRANSITION")
      return { status: "BUSINESS_ERROR", code: "INVALID_STATUS_TRANSITION", reload: false };
    return { status: "SUCCESS", data: outcome.result };
  } catch (error) {
    return mapAppointmentError(error, true);
  }
}
export async function updateAppointmentNoteAction(input: unknown) {
  return perform(appointmentOperationSchemas.note, input, true, editAppointmentNote);
}
export async function searchAppointmentPatientsAction(input: unknown) {
  return perform(
    appointmentOperationSchemas.patientSearch,
    input,
    false,
    searchAppointmentPatients,
  );
}
export async function resolveAppointmentPatientSelectionAction(input: unknown) {
  return perform(
    appointmentOperationSchemas.patientSelection,
    input,
    false,
    resolveAppointmentPatientSelection,
  );
}
