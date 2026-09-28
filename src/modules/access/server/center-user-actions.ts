import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodError } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProvisioningFailure } from "@/modules/access/domain/auth-compensation";
import type {
  CenterUserActionState,
  CenterUserIdentityActionState,
} from "@/modules/access/domain/center-user-action-state";
import {
  centerUserIdentityEmailSchema,
  centerUserProvisionFormSchema,
  newCenterUserNamesSchema,
  newCenterUserSchema,
} from "@/modules/access/schemas/center-user-provisioning";

import { AuthorizationError, requireRole } from "./authorization";
import { resolveCenterIdentityByEmail, type CenterIdentityResolution } from "./center-users";
import {
  IdentityProvisioningError,
  provisionCenterUser,
  type ProvisionCenterUserInput,
} from "./provisioning";

type ServerClient = SupabaseClient<Database>;

type CenterUserActionDependencies = {
  createServerClient: () => Promise<ServerClient>;
  provisionUser: typeof provisionCenterUser;
  requireCenterAdmin: (centerId: string, client: ServerClient) => Promise<unknown>;
  resolveIdentity: typeof resolveCenterIdentityByEmail;
  revalidateUsers: (centerId: string) => void;
};

const productionDependencies: Omit<CenterUserActionDependencies, "revalidateUsers"> = {
  createServerClient: createSupabaseServerClient,
  provisionUser: provisionCenterUser,
  requireCenterAdmin: (centerId, client) => requireRole(centerId, ["ADMIN"], client),
  resolveIdentity: resolveCenterIdentityByEmail,
};

function fieldErrors(error: ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function unauthorizedState(error: unknown): CenterUserActionState | null {
  if (!(error instanceof AuthorizationError)) return null;
  return {
    status: "error",
    message: "Tu sesión no tiene permiso para administrar los usuarios de este centro.",
  };
}

function existingMembershipState(identity: CenterIdentityResolution): CenterUserActionState {
  return {
    status: "error",
    message: identity.center_membership_is_active
      ? "Esta cuenta ya pertenece al centro y tiene acceso activo."
      : "Esta cuenta ya pertenece al centro con acceso inactivo. Su reactivación no forma parte de esta alta.",
  };
}

function provisioningErrorState(error: unknown, identityExists: boolean): CenterUserActionState {
  if (error instanceof ProvisioningFailure) {
    if (error.code === "DATABASE_PROVISIONING_FAILED" && !identityExists) {
      return {
        status: "error",
        retryMode: "new-operation",
        message:
          "La alta no pudo completarse y la identidad nueva fue revertida. Iniciá una nueva alta para volver a intentarlo.",
      };
    }

    return {
      status: "error",
      retryMode: "same-operation",
      message:
        error.code === "COMPENSATION_REQUIRED"
          ? "La operación requiere reconciliación. Conservá esta intención y reintentá más tarde."
          : "No pudimos confirmar el resultado. Reintentá la misma operación sin cambiar sus datos.",
    };
  }

  if (error instanceof IdentityProvisioningError) {
    if (error.code === "AUTH_CREATE_FAILED") {
      return {
        status: "error",
        retryMode: "same-operation",
        fieldErrors: {
          initialPassword: [
            "Volvé a ingresar la contraseña inicial para continuar con esta misma intención.",
          ],
        },
        message:
          "La operación todavía necesita preparar la identidad. Conservamos la misma intención.",
      };
    }

    return {
      status: "error",
      retryMode: "same-operation",
      message: "La identidad requiere reconciliación. Reintentá esta misma operación.",
    };
  }

  return {
    status: "error",
    retryMode: "same-operation",
    message: "No pudimos completar la operación. Reintentá con la misma intención.",
  };
}

function isProfessionalCenterProvisioningError(error: unknown) {
  if (!(error instanceof ProvisioningFailure)) return false;
  const cause = error.databaseCause;
  if (!cause || typeof cause !== "object") return false;
  const code = "code" in cause ? cause.code : undefined;
  const message = "message" in cause ? cause.message : undefined;
  return (
    (code === "23514" || code === "23505") &&
    typeof message === "string" &&
    message.includes("ProfessionalCenter")
  );
}

export async function performResolveCenterIdentityAction(
  centerId: string,
  rawEmail: string,
  overrides: Partial<CenterUserActionDependencies> = {},
): Promise<CenterUserIdentityActionState> {
  const dependencies = { ...productionDependencies, revalidateUsers: () => {}, ...overrides };
  const client = await dependencies.createServerClient();

  try {
    await dependencies.requireCenterAdmin(centerId, client);
  } catch (error) {
    return (
      unauthorizedState(error) ?? {
        status: "error",
        message: "No pudimos verificar tu sesión.",
      }
    );
  }

  const parsed = centerUserIdentityEmailSchema.safeParse({ centerId, email: rawEmail });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    const identity = await dependencies.resolveIdentity(
      parsed.data.centerId,
      parsed.data.email,
      client,
    );
    const membershipExists = identity.center_membership_exists;
    const membershipIsActive = membershipExists
      ? Boolean(identity.center_membership_is_active)
      : undefined;

    return {
      status: "success",
      email: identity.identity_exists && identity.email ? identity.email : parsed.data.email,
      identityExists: identity.identity_exists,
      firstName: identity.identity_exists ? (identity.first_name ?? undefined) : undefined,
      lastName: identity.identity_exists ? (identity.last_name ?? undefined) : undefined,
      membershipExists,
      membershipIsActive,
      message: membershipExists
        ? membershipIsActive
          ? "Esta cuenta ya pertenece al centro y tiene acceso activo."
          : "Esta cuenta ya pertenece al centro con acceso inactivo. Su reactivación no forma parte de esta alta."
        : identity.identity_exists
          ? "La identidad ya existe. Conservaremos sus datos y credenciales actuales."
          : "La identidad es nueva. Completá sus datos y contraseña inicial.",
    };
  } catch {
    return {
      status: "error",
      message: "No pudimos resolver ese email. Volvé a intentarlo.",
    };
  }
}

export async function performProvisionCenterUserAction(
  previousState: CenterUserActionState,
  formData: FormData,
  overrides: Partial<CenterUserActionDependencies> = {},
): Promise<CenterUserActionState> {
  const dependencies = { ...productionDependencies, revalidateUsers: () => {}, ...overrides };
  const client = await dependencies.createServerClient();
  const rawCenterId = formValue(formData, "centerId");

  try {
    await dependencies.requireCenterAdmin(rawCenterId, client);
  } catch (error) {
    return (
      unauthorizedState(error) ?? {
        status: "error",
        message: "No pudimos verificar tu sesión.",
      }
    );
  }

  const parsed = centerUserProvisionFormSchema.safeParse({
    operationId: formValue(formData, "operationId"),
    centerId: rawCenterId,
    isRetryingOperation: formValue(formData, "isRetryingOperation"),
    email: formValue(formData, "email"),
    firstName: formValue(formData, "firstName"),
    lastName: formValue(formData, "lastName"),
    initialPassword: formValue(formData, "initialPassword"),
    role: formValue(formData, "role"),
    professionalCenterId: formValue(formData, "professionalCenterId"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  let identity: CenterIdentityResolution;
  try {
    identity = await dependencies.resolveIdentity(parsed.data.centerId, parsed.data.email, client);
  } catch {
    return {
      status: "error",
      retryMode: "same-operation",
      message: "No pudimos resolver la identidad. Reintentá con la misma intención.",
    };
  }

  if (identity.center_membership_exists && !parsed.data.isRetryingOperation) {
    return existingMembershipState(identity);
  }

  let provisionIdentity: ProvisionCenterUserInput["identity"];
  if (identity.identity_exists) {
    if (!identity.email || !identity.first_name || !identity.last_name) {
      return {
        status: "error",
        retryMode: "same-operation",
        message: "No pudimos confirmar los datos de la identidad. Reintentá la misma operación.",
      };
    }
    provisionIdentity = {
      email: identity.email,
      firstName: identity.first_name,
      lastName: identity.last_name,
    };
  } else {
    const passwordCanBeReentered =
      parsed.data.isRetryingOperation && parsed.data.initialPassword === "";
    const newIdentity = (
      passwordCanBeReentered ? newCenterUserNamesSchema : newCenterUserSchema
    ).safeParse({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      initialPassword: parsed.data.initialPassword,
    });

    if (!newIdentity.success) {
      return { status: "error", fieldErrors: fieldErrors(newIdentity.error) };
    }

    provisionIdentity = {
      email: parsed.data.email,
      firstName: newIdentity.data.firstName,
      lastName: newIdentity.data.lastName,
      initialPassword: parsed.data.initialPassword || undefined,
    };
  }

  try {
    await dependencies.provisionUser(
      {
        operationId: parsed.data.operationId,
        centerId: parsed.data.centerId,
        identity: provisionIdentity,
        role: parsed.data.role,
        professionalCenterId: parsed.data.professionalCenterId,
      },
      client,
    );
    dependencies.revalidateUsers(parsed.data.centerId);

    return previousState.retryMode === "same-operation" || parsed.data.isRetryingOperation
      ? {
          status: "confirmed",
          message: "La operación quedó confirmada al reintentar, sin duplicar el acceso.",
        }
      : {
          status: "success",
          message: "Usuario agregado al centro.",
        };
  } catch (error) {
    if (
      identity.center_membership_exists &&
      error instanceof IdentityProvisioningError &&
      error.code === "IDENTITY_RECONCILIATION_REQUIRED"
    ) {
      return existingMembershipState(identity);
    }

    if (!parsed.data.isRetryingOperation) {
      try {
        const currentIdentity = await dependencies.resolveIdentity(
          parsed.data.centerId,
          parsed.data.email,
          client,
        );
        if (currentIdentity.center_membership_exists) {
          return existingMembershipState(currentIdentity);
        }
      } catch {
        // Preserve the original provisioning result when the race check cannot be completed.
      }
    }

    if (parsed.data.role === "PROFESSIONAL" && isProfessionalCenterProvisioningError(error)) {
      return {
        status: "error",
        retryMode: "new-operation",
        message:
          "No pudimos asignar ese profesional. Verificá que siga activo y disponible en este centro antes de iniciar una nueva alta.",
      };
    }

    return provisioningErrorState(error, identity.identity_exists);
  }
}
