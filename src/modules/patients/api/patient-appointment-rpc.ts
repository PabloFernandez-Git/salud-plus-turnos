import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const timestamp = z.iso.datetime({ offset: true });
export const patientAppointmentRowSchema = z.strictObject({
  appointment_id: z.uuid(),
  starts_at: timestamp,
  ends_at: timestamp,
  status: z.enum(["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED", "NO_SHOW"]),
  professional_first_name: z.string(),
  professional_last_name: z.string(),
  specialty_name: z.string(),
  has_more: z.boolean(),
});
export type PatientAppointmentRow = z.infer<typeof patientAppointmentRowSchema>;
export type PatientAppointmentSection = "UPCOMING" | "HISTORY";
export type PatientAppointmentCursor = { startsAt: string; id: string };

export const patientAppointmentArgsSchema = z.strictObject({
  p_center_id: z.uuid(),
  p_patient_center_id: z.uuid(),
  p_section: z.enum(["UPCOMING", "HISTORY"]),
  p_as_of: timestamp,
  p_cursor_starts_at: timestamp.nullable(),
  p_cursor_id: z.uuid().nullable(),
  p_limit: z.number().int().min(1).max(50),
});
export type PatientAppointmentArgs = z.infer<typeof patientAppointmentArgsSchema>;

type Transport = (
  name: "staff_list_patient_appointments",
  args: PatientAppointmentArgs,
) => Promise<{ data: unknown; error: unknown }>;

export async function callPatientAppointmentRpc(
  client: SupabaseClient<Database>,
  args: PatientAppointmentArgs,
): Promise<PatientAppointmentRow[]> {
  const validated = patientAppointmentArgsSchema.parse(args);
  // The generated transport types predate TASK-022. PostgreSQL and this strict
  // eight-column contract are authoritative until types are regenerated.
  const rpc = client.rpc as unknown as Transport;
  const { data, error } = await rpc.call(client, "staff_list_patient_appointments", validated);
  if (error) throw error;
  return z.array(patientAppointmentRowSchema).parse(data);
}
