"use server";

import { revalidatePath } from "next/cache";
import { performBlockAction } from "../server/availability-block-actions";

function revalidate(centerId: string, professionalCenterId: string) {
  revalidatePath(`/centers/${centerId}/professionals/${professionalCenterId}/availability`);
  revalidatePath(`/centers/${centerId}/agenda`);
  revalidatePath(`/centers/${centerId}/appointments`);
}

export async function previewAvailabilityBlockAction(formData: FormData) {
  return performBlockAction("preview", formData);
}
export async function createAvailabilityBlockAction(formData: FormData) {
  return performBlockAction("create", formData, { revalidate });
}
export async function deactivateAvailabilityBlockAction(formData: FormData) {
  return performBlockAction("deactivate", formData, { revalidate });
}
