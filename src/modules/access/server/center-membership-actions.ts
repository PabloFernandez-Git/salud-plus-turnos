import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CenterMembershipActionState } from "@/modules/access/domain/center-user-action-state";
import { centerMembershipManagementSchema } from "@/modules/access/schemas/center-membership-management";

import { CenterMembershipMutationError, setCenterMembership } from "./administration";
import { AuthorizationError, requireRole } from "./authorization";

type ServerClient = SupabaseClient<Database>;

const centerIdSchema = z.uuid();

type Dependencies = {
  createServerClient: () => Promise<ServerClient>;
  requireCenterAdmin: typeof requireRole;
  updateMembership: typeof setCenterMembership;
  revalidateUsers: (centerId: string) => void;
};

const defaultDependencies: Dependencies = {
  createServerClient: createSupabaseServerClient,
  requireCenterAdmin: requireRole,
  updateMembership: setCenterMembership,
  revalidateUsers: () => undefined,
};

function formValues(formData: FormData) {
  return {
    centerId: formData.get("centerId"),
    membershipId: formData.get("membershipId"),
    expectedRole: formData.get("expectedRole"),
    expectedProfessionalCenterId: formData.get("expectedProfessionalCenterId"),
    expectedIsActive: formData.get("expectedIsActive"),
    role: formData.get("role"),
    professionalCenterId: formData.get("professionalCenterId"),
    isActive: formData.get("isActive"),
  };
}

function fieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

function databaseErrorState(error: unknown): CenterMembershipActionState {
  if (error instanceof AuthorizationError) {
    return {
      status: "error",
      message: "Ya no tenés permiso para administrar accesos de este centro.",
    };
  }
  if (error instanceof CenterMembershipMutationError) {
    return error.code === "STALE"
      ? {
          status: "error",
          message:
            "El acceso cambió mientras lo estabas editando. Actualizá la página y revisá el estado actual.",
        }
      : {
          status: "error",
          message: "La membership ya no existe en este centro o no está disponible.",
        };
  }

  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  const message =
    typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";

  if (code === "42501") {
    return {
      status: "error",
      message: "Ya no tenés permiso para administrar accesos de este centro.",
    };
  }
  if (code === "P0002") {
    return {
      status: "error",
      message:
        "La membership cambió o ya no pertenece a este centro. Actualizá la página antes de reintentar.",
    };
  }
  if (code === "23505" || /already has an active PROFESSIONAL membership/i.test(message)) {
    return {
      status: "error",
      message:
        "Ese profesional acaba de ser asignado a otra membership activa. Elegí otro vínculo.",
    };
  }
  if (/retain an active ADMIN/i.test(message)) {
    return {
      status: "error",
      message: "No se puede completar: el centro debe conservar al menos un Administrador activo.",
    };
  }
  if (/ProfessionalCenter|professional link/i.test(message)) {
    return {
      status: "error",
      message: "El profesional seleccionado ya no es válido, activo o disponible en este centro.",
    };
  }

  return {
    status: "error",
    message:
      "No pudimos guardar el acceso. Actualizá la página para comprobar su estado antes de reintentar.",
  };
}

export async function performUpdateCenterMembershipAction(
  formData: FormData,
  dependencyOverrides: Partial<Dependencies> = {},
): Promise<CenterMembershipActionState> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const centerId = centerIdSchema.safeParse(formData.get("centerId"));
  if (!centerId.success) {
    return { status: "error", message: "El centro no es válido." };
  }

  const client = await dependencies.createServerClient();
  try {
    await dependencies.requireCenterAdmin(centerId.data, ["ADMIN"], client);
  } catch (error) {
    return databaseErrorState(error);
  }

  const parsed = centerMembershipManagementSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    const result = await dependencies.updateMembership(parsed.data, client);
    dependencies.revalidateUsers(parsed.data.centerId);
    const losesAdministration =
      result.actorUserId === result.targetUserId &&
      (!result.membership.is_active || result.membership.role !== "ADMIN");
    const navigation = losesAdministration
      ? result.membership.is_active
        ? `/centers/${parsed.data.centerId}`
        : "/select-center"
      : undefined;

    return {
      status: "success",
      message: "Acceso actualizado con el estado confirmado por el servidor.",
      membership: {
        id: result.membership.membership_id,
        isActive: result.membership.is_active,
        professionalCenterId: result.membership.professional_center_id,
        role: result.membership.role,
      },
      navigation,
    };
  } catch (error) {
    return databaseErrorState(error);
  }
}
