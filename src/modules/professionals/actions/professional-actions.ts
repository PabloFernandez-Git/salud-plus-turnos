"use server";

import { revalidatePath } from "next/cache";
import { assertPortfolioWriteAllowed } from "@/modules/access/server/portfolio-demo";
import { performProfessionalAction } from "../server/professional-actions";

const revalidate = (centerId: string) => revalidatePath(`/centers/${centerId}/professionals`);

export async function resolveProfessionalAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performProfessionalAction("resolve", formData);
}
export async function createProfessionalAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performProfessionalAction("create", formData, { revalidate });
}
export async function linkProfessionalAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performProfessionalAction("link", formData, { revalidate });
}
export async function updateProfessionalCenterAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performProfessionalAction("update", formData, { revalidate });
}
export async function setProfessionalCenterActiveAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performProfessionalAction("setActive", formData, { revalidate });
}
