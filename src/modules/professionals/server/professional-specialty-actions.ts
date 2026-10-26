import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { updateProfessionalSpecialtiesSchema } from "../schemas/professional-specialties";
import { updateProfessionalSpecialties } from "./professional-specialties";

type ServerClient = SupabaseClient<Database>;
export type ProfessionalSpecialtyActionState = {
  status: "success" | "error" | "stale";
  message: string;
  updatedAt?: string;
};
type Dependencies = {
  createServerClient: () => Promise<ServerClient>;
  requireAdmin: typeof requireRole;
  update: typeof updateProfessionalSpecialties;
  revalidate: (centerId: string) => void;
};
const defaults: Dependencies = {
  createServerClient: createSupabaseServerClient,
  requireAdmin: requireRole,
  update: updateProfessionalSpecialties,
  revalidate: () => undefined,
};

function errorState(error: unknown): ProfessionalSpecialtyActionState {
  if (error instanceof AuthorizationError)
    return { status: "error", message: "Ya no tenés permiso para administrar este centro." };
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (code === "42501")
    return { status: "error", message: "Ya no tenés permiso para administrar este centro." };
  if (code === "P0001" && message === "STALE_PROFESSIONAL_CENTER_STATE")
    return {
      status: "stale",
      message: "Las especialidades cambiaron en otra sesión. Revisá el listado actualizado.",
    };
  if (code === "P0001" && message === "PROFESSIONAL_CENTER_NOT_ACTIVE")
    return {
      status: "stale",
      message: "El profesional está inactivo. Revisá el listado actualizado.",
    };
  if (code === "P0001" && message === "SPECIALTY_NOT_ACTIVE")
    return {
      status: "stale",
      message: "Una especialidad se desactivó. Revisá el listado actualizado antes de guardar.",
    };
  if (code === "P0002" || (code === "22023" && message === "INVALID_SPECIALTY_BATCH"))
    return {
      status: "stale",
      message: "La selección ya no es válida para este centro. Revisá el listado actualizado.",
    };
  if (code === "22023" && message === "NO_SPECIALTY_CHANGES")
    return { status: "error", message: "No hay cambios de especialidades para guardar." };
  return {
    status: "error",
    message: "No pudimos guardar las especialidades. Actualizá la página antes de reintentar.",
  };
}

export async function performProfessionalSpecialtyAction(
  formData: FormData,
  overrides: Partial<Dependencies> = {},
): Promise<ProfessionalSpecialtyActionState> {
  const dependencies = { ...defaults, ...overrides };
  const parsed = updateProfessionalSpecialtiesSchema.safeParse({
    centerId: formData.get("centerId"),
    professionalCenterId: formData.get("professionalCenterId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    activateSpecialtyIds: formData.getAll("activateSpecialtyIds"),
    deactivateSpecialtyIds: formData.getAll("deactivateSpecialtyIds"),
  });
  if (!parsed.success)
    return { status: "error", message: "La selección de especialidades no es válida." };
  try {
    const client = await dependencies.createServerClient();
    await dependencies.requireAdmin(parsed.data.centerId, ["ADMIN"], client);
    // An empty submit has no intent. Keep the RPC's NO_SPECIALTY_CHANGES as a defensive error.
    if (!parsed.data.activateSpecialtyIds.length && !parsed.data.deactivateSpecialtyIds.length)
      return { status: "error", message: "No hay cambios de especialidades para guardar." };
    const result = await dependencies.update(parsed.data, client);
    dependencies.revalidate(parsed.data.centerId);
    return {
      status: "success",
      message: "Especialidades del profesional actualizadas",
      updatedAt: result.professional_center_updated_at,
    };
  } catch (error) {
    return errorState(error);
  }
}
