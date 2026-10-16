"use server";

import { revalidatePath } from "next/cache";
import { performAvailabilityAction } from "../server/availability-actions";

function revalidate(centerId: string, professionalCenterId: string) {
  revalidatePath(`/centers/${centerId}/availability`);
  revalidatePath(`/centers/${centerId}/professionals/${professionalCenterId}/availability`);
  revalidatePath(`/centers/${centerId}/professionals`);
}

export async function createAvailabilityAction(formData: FormData) {
  return performAvailabilityAction("create", formData, { revalidate });
}
export async function updateAvailabilityAction(formData: FormData) {
  return performAvailabilityAction("update", formData, { revalidate });
}
export async function deactivateAvailabilityAction(formData: FormData) {
  return performAvailabilityAction("deactivate", formData, { revalidate });
}
export async function updateAppointmentDurationAction(formData: FormData) {
  return performAvailabilityAction("duration", formData, { revalidate });
}
