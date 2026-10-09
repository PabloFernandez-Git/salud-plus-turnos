"use server";

import { revalidatePath } from "next/cache";

import { performSpecialtyAction } from "../server/specialty-actions";

export async function createSpecialtyAction(formData: FormData) {
  return performSpecialtyAction("create", formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/specialties`),
  });
}

export async function updateSpecialtyAction(formData: FormData) {
  return performSpecialtyAction("update", formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/specialties`),
  });
}

export async function setSpecialtyActiveAction(formData: FormData) {
  return performSpecialtyAction("setActive", formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/specialties`),
  });
}
