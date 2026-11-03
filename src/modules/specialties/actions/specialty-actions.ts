"use server";

import { revalidatePath } from "next/cache";
import { assertPortfolioWriteAllowed } from "@/modules/access/server/portfolio-demo";

import { performSpecialtyAction } from "../server/specialty-actions";

export async function createSpecialtyAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performSpecialtyAction("create", formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/specialties`),
  });
}

export async function updateSpecialtyAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performSpecialtyAction("update", formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/specialties`),
  });
}

export async function setSpecialtyActiveAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performSpecialtyAction("setActive", formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/specialties`),
  });
}
