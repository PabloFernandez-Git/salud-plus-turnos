import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import {
  appointmentIdSchema,
  appointmentStatusSchema,
  appointmentTimestampSchema,
} from "../schemas/appointment-input";

export type AppointmentClient = SupabaseClient<Database>;
type Rpc = Database["public"]["Functions"];
type Args<N extends keyof Rpc> = Rpc[N]["Args"];
const id = appointmentIdSchema;
const timestamp = appointmentTimestampSchema;
const status = appointmentStatusSchema;
const names = { patient_first_name: z.string(), patient_last_name: z.string() };
const base = {
  appointment_id: id,
  starts_at: timestamp,
  ends_at: timestamp,
  status,
  updated_at: timestamp,
  ...names,
  specialty_name: z.string(),
};
const staffExtra = {
  professional_center_id: id,
  professional_first_name: z.string(),
  professional_last_name: z.string(),
};
export const professionalAppointmentSchema = z.object(base);
export const professionalAppointmentListRowSchema = professionalAppointmentSchema.extend({
  has_more: z.boolean(),
});
export const staffAppointmentListRowSchema = z.object({
  ...base,
  ...staffExtra,
  has_more: z.boolean(),
});
export const staffAppointmentSchema = z.object({
  ...base,
  ...staffExtra,
  patient_center_id: id,
  specialty_id: id,
  administrative_note: z.string().nullable(),
});
const specialtySchema = z.object({ specialty_id: id, specialty_name: z.string() });
const professionalChoiceSchema = z.object({
  professional_center_id: id,
  professional_first_name: z.string(),
  professional_last_name: z.string(),
  usual_appointment_duration_minutes: z.number().int(),
});
const slotSchema = z.object({ starts_at: timestamp, ends_at: timestamp });
const createdSchema = z.object({
  appointment_id: id,
  status: z.literal("PENDING"),
  updated_at: timestamp,
});
const rescheduledSchema = z.object({
  appointment_id: id,
  professional_center_id: id,
  specialty_id: id,
  starts_at: timestamp,
  ends_at: timestamp,
  status,
  updated_at: timestamp,
});
const statusResultSchema = z.object({ appointment_id: id, status, updated_at: timestamp });
const noteResultSchema = z.object({ appointment_id: id, updated_at: timestamp });

export type ProfessionalAppointment = z.infer<typeof professionalAppointmentSchema>;
export type StaffAppointment = z.infer<typeof staffAppointmentSchema>;
export class AppointmentOutcomeUnknown extends Error {}
export class AppointmentRpcContractError extends Error {}

function rows<T>(value: unknown, schema: z.ZodType<T>): T[] {
  const parsed = z.array(schema).safeParse(value);
  if (!parsed.success) throw new AppointmentRpcContractError();
  return parsed.data;
}
function one<T>(value: unknown, schema: z.ZodType<T>): T {
  const parsed = z.array(schema).safeParse(value);
  if (!parsed.success || parsed.data.length !== 1) throw new AppointmentOutcomeUnknown();
  return parsed.data[0];
}
async function mutationResult<T>(
  request: PromiseLike<{ data: unknown; error: unknown }>,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: { data: unknown; error: unknown };
  try {
    response = await request;
  } catch {
    throw new AppointmentOutcomeUnknown();
  }
  if (response.error) throw response.error;
  return one(response.data, schema);
}

export async function listBookableSpecialties(
  client: AppointmentClient,
  args: Args<"staff_list_bookable_specialties">,
) {
  const { data, error } = await client.rpc("staff_list_bookable_specialties", args);
  if (error) throw error;
  return rows(data, specialtySchema);
}
export async function listBookableProfessionals(
  client: AppointmentClient,
  args: Args<"staff_bookable_professional_centers_for_specialty">,
) {
  const { data, error } = await client.rpc(
    "staff_bookable_professional_centers_for_specialty",
    args,
  );
  if (error) throw error;
  return rows(data, professionalChoiceSchema);
}
export async function searchAppointmentSlots(
  client: AppointmentClient,
  args: Args<"staff_search_appointment_slots">,
) {
  const { data, error } = await client.rpc("staff_search_appointment_slots", args);
  if (error) throw error;
  return rows(data, slotSchema);
}
export async function listStaffAppointments(
  client: AppointmentClient,
  args: Args<"staff_list_appointments">,
) {
  const { data, error } = await client.rpc("staff_list_appointments", args);
  if (error) throw error;
  return rows(data, staffAppointmentListRowSchema);
}
export async function getStaffAppointment(
  client: AppointmentClient,
  args: Args<"staff_get_appointment">,
) {
  const { data, error } = await client.rpc("staff_get_appointment", args);
  if (error) throw error;
  return rows(data, staffAppointmentSchema)[0] ?? null;
}
export async function listProfessionalAppointments(
  client: AppointmentClient,
  args: Args<"professional_list_own_appointments">,
) {
  const { data, error } = await client.rpc("professional_list_own_appointments", args);
  if (error) throw error;
  return rows(data, professionalAppointmentListRowSchema);
}
export async function getProfessionalAppointment(
  client: AppointmentClient,
  args: Args<"professional_get_own_appointment">,
) {
  const { data, error } = await client.rpc("professional_get_own_appointment", args);
  if (error) throw error;
  return rows(data, professionalAppointmentSchema)[0] ?? null;
}
export async function createAppointment(
  client: AppointmentClient,
  args: Args<"staff_create_appointment">,
) {
  return mutationResult(client.rpc("staff_create_appointment", args), createdSchema);
}
export async function rescheduleAppointment(
  client: AppointmentClient,
  args: Args<"staff_reschedule_appointment">,
) {
  return mutationResult(client.rpc("staff_reschedule_appointment", args), rescheduledSchema);
}
export async function transitionAppointmentStatus(
  client: AppointmentClient,
  args: Args<"staff_transition_appointment_status">,
) {
  return mutationResult(
    client.rpc("staff_transition_appointment_status", args),
    statusResultSchema,
  );
}
export async function updateAppointmentNote(
  client: AppointmentClient,
  args: Omit<Args<"staff_update_appointment_note">, "p_administrative_note"> & {
    p_administrative_note: string | null;
  },
) {
  // PostgreSQL accepts NULL to clear the note; generated Supabase Args incorrectly says string.
  // Keep the one necessary assertion at this transport boundary and validate the response.
  const generatedArgs = args as Args<"staff_update_appointment_note">;
  return mutationResult(
    client.rpc("staff_update_appointment_note", generatedArgs),
    noteResultSchema,
  );
}
