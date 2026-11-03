"use server";

import { revalidatePath } from "next/cache";
import { assertPortfolioWriteAllowed } from "@/modules/access/server/portfolio-demo";
import { performProfessionalSpecialtyAction } from "../server/professional-specialty-actions";

export async function updateProfessionalSpecialtiesAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performProfessionalSpecialtyAction(formData, {
    revalidate: (centerId) => revalidatePath(`/centers/${centerId}/professionals`),
  });
}
