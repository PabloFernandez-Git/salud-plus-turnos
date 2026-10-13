"use server";

import { revalidatePath } from "next/cache";
import { performProfessionalSpecialtyAction } from "../server/professional-specialty-actions";

export async function updateProfessionalSpecialtiesAction(formData: FormData) {
  return performProfessionalSpecialtyAction(formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/professionals`),
  });
}
