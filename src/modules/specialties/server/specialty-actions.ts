import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  createSpecialtySchema,
  setSpecialtyActiveSchema,
  specialtyCenterIdSchema,
  updateSpecialtySchema,
} from "../schemas/specialty";
import { createSpecialty, setSpecialtyActive, updateSpecialty } from "./specialties";

type ServerClient = SupabaseClient<Database>;
export type SpecialtyActionState = {
  status: "success" | "error" | "stale";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

type Dependencies = {
  createServerClient: () => Promise<ServerClient>;
  requireAdmin: typeof requireRole;
  create: typeof createSpecialty;
  update: typeof updateSpecialty;
  setActive: typeof setSpecialtyActive;
  revalidate: (centerId: string) => void;
};

const defaults: Dependencies = {
  createServerClient: createSupabaseServerClient,
  requireAdmin: requireRole,
  create: createSpecialty,
  update: updateSpecialty,
  setActive: setSpecialtyActive,
  revalidate: () => undefined,
};

function errorState(error: unknown): SpecialtyActionState {
  if (error instanceof AuthorizationError) {
    return { status: "error", message: "Ya no tenés permiso para administrar este centro." };
  }
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (code === "42501") {
    return { status: "error", message: "Ya no tenés permiso para administrar este centro." };
  }
  if (code === "P0001" && message === "STALE_SPECIALTY_STATE") {
    return {
      status: "stale",
      message:
        "La especialidad cambió en otra sesión. Revisá el listado actualizado antes de reintentar.",
    };
  }
  if ((code === "P0001" && message === "SPECIALTY_NAME_ALREADY_EXISTS") || code === "23505") {
    return {
      status: "error",
      message: "Ya existe una especialidad con ese nombre en el centro, incluso si está inactiva.",
    };
  }
  if (code === "P0002") {
    return {
      status: "stale",
      message:
        "La especialidad ya no está disponible en este centro. Revisá el listado actualizado.",
    };
  }
  return {
    status: "error",
    message: "No pudimos guardar la especialidad. Actualizá la página y revisá su estado.",
  };
}

type Operation = "create" | "update" | "setActive";

export async function performSpecialtyAction(
  operation: Operation,
  formData: FormData,
  overrides: Partial<Dependencies> = {},
): Promise<SpecialtyActionState> {
  const dependencies = { ...defaults, ...overrides };
  const centerId = specialtyCenterIdSchema.safeParse(formData.get("centerId"));
  if (!centerId.success) return { status: "error", message: "El centro no es válido." };

  let client: ServerClient;
  try {
    client = await dependencies.createServerClient();
    await dependencies.requireAdmin(centerId.data, ["ADMIN"], client);
  } catch (error) {
    return errorState(error);
  }

  const values = {
    centerId: centerId.data,
    specialtyId: formData.get("specialtyId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    name: formData.get("name"),
    isActive:
      formData.get("isActive") === "true"
        ? true
        : formData.get("isActive") === "false"
          ? false
          : null,
    confirmed: formData.get("confirmed") === "true",
  };
  const schema =
    operation === "create"
      ? createSpecialtySchema
      : operation === "update"
        ? updateSpecialtySchema
        : setSpecialtyActiveSchema;
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los datos ingresados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    if (operation === "create")
      await dependencies.create(createSpecialtySchema.parse(values), client);
    if (operation === "update")
      await dependencies.update(updateSpecialtySchema.parse(values), client);
    if (operation === "setActive")
      await dependencies.setActive(setSpecialtyActiveSchema.parse(values), client);
    dependencies.revalidate(centerId.data);
    return {
      status: "success",
      message: operation === "create" ? "Especialidad creada." : "Especialidad actualizada.",
    };
  } catch (error) {
    return errorState(error);
  }
}
