import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { createProfessionalWithCenterSchema } from "../schemas/create-professional-with-center";
import {
  linkProfessionalSchema,
  professionalCenterIdSchema,
  resolveProfessionalSchema,
  setProfessionalCenterActiveSchema,
  updateProfessionalCenterSchema,
} from "../schemas/professional-center";
import {
  createProfessional,
  linkProfessional,
  resolveProfessional,
  setProfessionalCenterActive,
  updateProfessionalCenter,
} from "./professionals";

type ServerClient = SupabaseClient<Database>;
export type ProfessionalActionState = {
  status: "success" | "error" | "stale" | "resolved";
  message: string;
  resolution?: Awaited<ReturnType<typeof resolveProfessional>>;
  fieldErrors?: Record<string, string[]>;
};
type Operation = "resolve" | "create" | "link" | "update" | "setActive";
type Dependencies = {
  createServerClient: () => Promise<ServerClient>;
  requireAdmin: typeof requireRole;
  resolve: typeof resolveProfessional;
  create: typeof createProfessional;
  link: typeof linkProfessional;
  update: typeof updateProfessionalCenter;
  setActive: typeof setProfessionalCenterActive;
  revalidate: (centerId: string) => void;
};

const defaults: Dependencies = {
  createServerClient: createSupabaseServerClient,
  requireAdmin: requireRole,
  resolve: resolveProfessional,
  create: createProfessional,
  link: linkProfessional,
  update: updateProfessionalCenter,
  setActive: setProfessionalCenterActive,
  revalidate: () => undefined,
};

function errorState(error: unknown): ProfessionalActionState {
  if (error instanceof AuthorizationError)
    return { status: "error", message: "Ya no tenés permiso para administrar este centro." };
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (code === "42501")
    return { status: "error", message: "Ya no tenés permiso para administrar este centro." };
  if (code === "22023" && message === "INVALID_PROFESSIONAL_INPUT")
    return {
      status: "error",
      message: "El documento o la nacionalidad no son válidos. Revisá los datos ingresados.",
    };
  if (code === "P0001" && message === "STALE_PROFESSIONAL_CENTER_STATE")
    return {
      status: "stale",
      message:
        "La configuración cambió en otra sesión. Revisá el listado actualizado antes de reintentar.",
    };
  if (code === "P0001" && message === "PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP")
    return {
      status: "error",
      message:
        "Este profesional tiene una cuenta PROFESSIONAL activa. Administrá primero su acceso desde Usuarios.",
    };
  if (code === "P0001" && message === "PROFESSIONAL_IDENTITY_ALREADY_EXISTS")
    return {
      status: "stale",
      message:
        "Otro administrador creó esta identidad. Resolvé nuevamente el documento para confirmar el vínculo.",
    };
  if (code === "P0001" && message === "PROFESSIONAL_IDENTITY_MISMATCH")
    return {
      status: "stale",
      message: "La identidad ya no coincide con la búsqueda. Resolvé nuevamente el documento.",
    };
  if (code === "P0002")
    return {
      status: "stale",
      message:
        "El profesional ya no está disponible en este centro. Revisá el listado actualizado.",
    };
  return {
    status: "error",
    message:
      "No pudimos completar la operación. Actualizá la página y revisá el estado antes de reintentar.",
  };
}

export async function performProfessionalAction(
  operation: Operation,
  formData: FormData,
  overrides: Partial<Dependencies> = {},
): Promise<ProfessionalActionState> {
  const dependencies = { ...defaults, ...overrides };
  const centerId = professionalCenterIdSchema.safeParse(formData.get("centerId"));
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
    nationalityCode: formData.get("nationalityCode"),
    documentNumber: formData.get("documentNumber"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    licenseNumber: formData.get("licenseNumber"),
    usualAppointmentDurationMinutes: Number(formData.get("usualAppointmentDurationMinutes")),
    professionalId: formData.get("professionalId"),
    professionalCenterId: formData.get("professionalCenterId"),
    expectedProfessionalCenterUpdatedAt:
      formData.get("expectedProfessionalCenterUpdatedAt") || null,
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    isActive:
      formData.get("isActive") === "true"
        ? true
        : formData.get("isActive") === "false"
          ? false
          : null,
    confirmed: formData.get("confirmed") === "true",
  };
  const schema =
    operation === "resolve"
      ? resolveProfessionalSchema
      : operation === "create"
        ? createProfessionalWithCenterSchema
        : operation === "link"
          ? linkProfessionalSchema
          : operation === "update"
            ? updateProfessionalCenterSchema
            : setProfessionalCenterActiveSchema;
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return {
      status: "error",
      message: fieldErrors.documentNumber?.[0] ?? "Revisá los datos ingresados.",
      fieldErrors,
    };
  }

  try {
    if (operation === "resolve") {
      const resolution = await dependencies.resolve(
        resolveProfessionalSchema.parse(values),
        client,
      );
      return { status: "resolved", message: "Resultado de la búsqueda.", resolution };
    }
    if (operation === "create")
      await dependencies.create(createProfessionalWithCenterSchema.parse(values), client);
    if (operation === "link") await dependencies.link(linkProfessionalSchema.parse(values), client);
    if (operation === "update")
      await dependencies.update(updateProfessionalCenterSchema.parse(values), client);
    if (operation === "setActive")
      await dependencies.setActive(setProfessionalCenterActiveSchema.parse(values), client);
    dependencies.revalidate(centerId.data);
    return {
      status: "success",
      message:
        operation === "create"
          ? "Profesional creado y vinculado al centro."
          : operation === "link"
            ? "Profesional vinculado o reactivado en el centro."
            : "Configuración del profesional actualizada.",
    };
  } catch (error) {
    return errorState(error);
  }
}
