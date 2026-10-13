"use server";

import { revalidatePath } from "next/cache";
import { performProfessionalAction } from "../server/professional-actions";

const revalidate = (centerId: string) => revalidatePath(`/centers/${centerId}/professionals`);

export async function resolveProfessionalAction(formData: FormData) {
  return performProfessionalAction("resolve", formData);
}
export async function createProfessionalAction(formData: FormData) {
  return performProfessionalAction("create", formData, { revalidate });
}
export async function linkProfessionalAction(formData: FormData) {
  return performProfessionalAction("link", formData, { revalidate });
}
export async function updateProfessionalCenterAction(formData: FormData) {
  return performProfessionalAction("update", formData, { revalidate });
}
export async function setProfessionalCenterActiveAction(formData: FormData) {
  return performProfessionalAction("setActive", formData, { revalidate });
}
