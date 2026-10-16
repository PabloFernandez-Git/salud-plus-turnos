import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  availabilityIdSchema,
  createAvailabilitySchema,
  deactivateAvailabilitySchema,
  updateAppointmentDurationSchema,
  updateAvailabilitySchema,
} from "../schemas/availability";

type ServerClient = SupabaseClient<Database>;

export class AvailabilityNotFoundError extends Error {}

export type AvailabilityProfessionalCenter = {
  id: string;
  firstName: string;
  lastName: string;
  usualAppointmentDurationMinutes: number;
  updatedAt: string;
};
export type AvailabilityInterval = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  updatedAt: string;
};

export async function listAvailabilityProfessionalCenters(centerId: string, client?: ServerClient) {
  const parsedCenterId = availabilityIdSchema.parse(centerId);
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("staff_list_availability_professional_centers", {
    p_center_id: parsedCenterId,
  });
  if (error) throw error;
  return (data ?? []).map((row): AvailabilityProfessionalCenter => ({
    id: row.professional_center_id,
    firstName: row.first_name,
    lastName: row.last_name,
    usualAppointmentDurationMinutes: row.usual_appointment_duration_minutes,
    updatedAt: row.professional_center_updated_at,
  }));
}

export async function getAvailabilityForProfessionalCenter(
  centerId: string,
  professionalCenterId: string,
  client?: ServerClient,
) {
  const parsedCenterId = availabilityIdSchema.parse(centerId);
  const parsedProfessionalCenterId = availabilityIdSchema.parse(professionalCenterId);
  const supabase = client ?? (await createSupabaseServerClient());
  const visible = await listAvailabilityProfessionalCenters(parsedCenterId, supabase);
  const professional = visible.find((row) => row.id === parsedProfessionalCenterId);
  if (!professional) throw new AvailabilityNotFoundError();
  const { data, error } = await supabase
    .from("availabilities")
    .select("id, weekday, start_time, end_time, updated_at")
    .eq("center_id", parsedCenterId)
    .eq("professional_center_id", parsedProfessionalCenterId)
    .eq("is_active", true)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  const intervals: AvailabilityInterval[] = (data ?? []).map((row) => ({
    id: row.id,
    weekday: row.weekday,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    updatedAt: row.updated_at,
  }));
  return { professional, intervals };
}

export async function createAvailability(
  input: z.input<typeof createAvailabilitySchema>,
  client: ServerClient,
) {
  const value = createAvailabilitySchema.parse(input);
  const { data, error } = await client.rpc("staff_create_availability", {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_weekday: value.weekday,
    p_start_time: value.startTime,
    p_end_time: value.endTime,
  });
  if (error) throw error;
  if (!data?.[0]) throw new Error("AVAILABILITY_OUTCOME_UNKNOWN");
  return data[0];
}

export async function updateAvailability(
  input: z.input<typeof updateAvailabilitySchema>,
  client: ServerClient,
) {
  const value = updateAvailabilitySchema.parse(input);
  const { data, error } = await client.rpc("staff_update_availability", {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_availability_id: value.availabilityId,
    p_expected_updated_at: value.expectedUpdatedAt,
    p_start_time: value.startTime,
    p_end_time: value.endTime,
  });
  if (error) throw error;
  if (!data?.[0]) throw new Error("AVAILABILITY_OUTCOME_UNKNOWN");
  return data[0];
}

export async function deactivateAvailability(
  input: z.input<typeof deactivateAvailabilitySchema>,
  client: ServerClient,
) {
  const value = deactivateAvailabilitySchema.parse(input);
  const { data, error } = await client.rpc("staff_deactivate_availability", {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_availability_id: value.availabilityId,
    p_expected_updated_at: value.expectedUpdatedAt,
  });
  if (error) throw error;
  if (!data?.[0]) throw new Error("AVAILABILITY_OUTCOME_UNKNOWN");
  return data[0];
}

export async function updateUsualAppointmentDuration(
  input: z.input<typeof updateAppointmentDurationSchema>,
  client: ServerClient,
) {
  const value = updateAppointmentDurationSchema.parse(input);
  const { data, error } = await client.rpc("staff_update_usual_appointment_duration", {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_expected_updated_at: value.expectedUpdatedAt,
    p_minutes: value.minutes,
  });
  if (error) throw error;
  if (!data?.[0]) throw new Error("AVAILABILITY_OUTCOME_UNKNOWN");
  return data[0];
}
