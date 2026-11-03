"use server";

import { revalidatePath } from "next/cache";
import { assertPortfolioWriteAllowed } from "@/modules/access/server/portfolio-demo";
import { performAvailabilityAction } from "../server/availability-actions";

function revalidate(centerId: string, professionalCenterId: string) {
  revalidatePath(`/centers/${centerId}/availability`);
  revalidatePath(`/centers/${centerId}/professionals/${professionalCenterId}/availability`);
  revalidatePath(`/centers/${centerId}/professionals`);
}

export async function createAvailabilityAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performAvailabilityAction("create", formData, { revalidate });
}
export async function updateAvailabilityAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performAvailabilityAction("update", formData, { revalidate });
}
export async function deactivateAvailabilityAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performAvailabilityAction("deactivate", formData, { revalidate });
}
export async function updateAppointmentDurationAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performAvailabilityAction("duration", formData, { revalidate });
}
