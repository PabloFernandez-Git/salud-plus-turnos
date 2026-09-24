import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodError } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PlatformActionState,
  PlatformIdentityActionState,
} from "@/modules/access/domain/platform-action-state";
import {
  DEFAULT_PLATFORM_TIMEZONE,
  newPlatformAdminNamesSchema,
  newPlatformAdminSchema,
  platformCenterFormSchema,
  platformCenterStatusSchema,
  platformIdentityEmailSchema,
} from "@/modules/access/schemas/platform";

import {
  resolvePlatformIdentityByEmail,
  setCenterActive,
  type PlatformIdentityResolution,
} from "./administration";
import { AuthorizationError, requirePlatformAdmin } from "./authorization";
import { createCenterWithFirstAdmin, IdentityProvisioningError } from "./provisioning";
import { ProvisioningFailure } from "../domain/auth-compensation";

type ServerClient = SupabaseClient<Database>;

type PlatformActionDependencies = {
  createCenter: typeof createCenterWithFirstAdmin;
  createServerClient: () => Promise<ServerClient>;
  revalidatePlatform: () => void;
  requirePlatform: typeof requirePlatformAdmin;
  resolveIdentity: typeof resolvePlatformIdentityByEmail;
  updateCenterStatus: typeof setCenterActive;
};

const productionDependencies: Omit<PlatformActionDependencies, "revalidatePlatform"> = {
  createCenter: createCenterWithFirstAdmin,
  createServerClient: createSupabaseServerClient,
  requirePlatform: requirePlatformAdmin,
  resolveIdentity: resolvePlatformIdentityByEmail,
  updateCenterStatus: setCenterActive,
};

function fieldErrors(error: ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}

function unauthorizedState(error: unknown): PlatformActionState | null {
  if (!(error instanceof AuthorizationError)) return null;
  return {
    status: "error",
    message: "Tu sesión no tiene permiso para administrar la plataforma.",
  };
}

function provisioningErrorState(error: unknown): PlatformActionState {
  if (error instanceof ProvisioningFailure) {
    if (error.code === "DATABASE_PROVISIONING_FAILED") {
      return {
        status: "error",
        retryMode: "new-operation",
        message:
          "La alta no pudo completarse y fue revertida. Podés iniciar una nueva alta sin reutilizar esta intención.",
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
          adminInitialPassword: [
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
      message:
        error.code === "IDENTITY_RECONCILIATION_REQUIRED"
          ? "La identidad requiere reconciliación antes de continuar. Reintentá esta misma operación."
          : "No pudimos preparar la identidad. Reintentá esta misma operación.",
    };
  }

  return {
    status: "error",
    retryMode: "same-operation",
    message: "No pudimos completar la operación. Reintentá con la misma intención.",
  };
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function performResolvePlatformIdentityAction(
  rawEmail: string,
  overrides: Partial<PlatformActionDependencies> = {},
): Promise<PlatformIdentityActionState> {
  const dependencies = { ...productionDependencies, revalidatePlatform: () => {}, ...overrides };
  const client = await dependencies.createServerClient();

  try {
    await dependencies.requirePlatform(client);
  } catch (error) {
    return (
      unauthorizedState(error) ?? {
        status: "error",
        message: "No pudimos verificar tu sesión.",
      }
    );
  }

  const parsed = platformIdentityEmailSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    const identity = await dependencies.resolveIdentity(parsed.data.email, client);
    return {
      status: "success",
      email: parsed.data.email,
      identityExists: identity.identity_exists,
      message: identity.identity_exists
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

export async function performCreatePlatformCenterAction(
  previousState: PlatformActionState,
  formData: FormData,
  overrides: Partial<PlatformActionDependencies> = {},
): Promise<PlatformActionState> {
  const dependencies = { ...productionDependencies, revalidatePlatform: () => {}, ...overrides };
  const client = await dependencies.createServerClient();

  try {
    await dependencies.requirePlatform(client);
  } catch (error) {
    return (
      unauthorizedState(error) ?? {
        status: "error",
        message: "No pudimos verificar tu sesión.",
      }
    );
  }

  const parsed = platformCenterFormSchema.safeParse({
    operationId: formValue(formData, "operationId"),
    isRetryingOperation: formValue(formData, "isRetryingOperation"),
    centerName: formValue(formData, "centerName"),
    centerAddress: formValue(formData, "centerAddress"),
    centerPhone: formValue(formData, "centerPhone"),
    centerEmail: formValue(formData, "centerEmail"),
    centerTimezone: formValue(formData, "centerTimezone") || DEFAULT_PLATFORM_TIMEZONE,
    adminEmail: formValue(formData, "adminEmail"),
    adminFirstName: formValue(formData, "adminFirstName"),
    adminLastName: formValue(formData, "adminLastName"),
    adminInitialPassword: formValue(formData, "adminInitialPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  let identity: PlatformIdentityResolution;
  try {
    identity = await dependencies.resolveIdentity(parsed.data.adminEmail, client);
  } catch {
    return {
      status: "error",
      retryMode: "same-operation",
      message: "No pudimos resolver la identidad. Reintentá con la misma intención.",
    };
  }

  let admin: { email: string; firstName: string; lastName: string; initialPassword?: string };
  if (identity.identity_exists) {
    admin = {
      email: identity.email,
      firstName: identity.first_name,
      lastName: identity.last_name,
    };
  } else {
    const passwordCanBeReentered =
      parsed.data.isRetryingOperation && parsed.data.adminInitialPassword === "";
    const newAdmin = (
      passwordCanBeReentered ? newPlatformAdminNamesSchema : newPlatformAdminSchema
    ).safeParse({
      firstName: parsed.data.adminFirstName,
      lastName: parsed.data.adminLastName,
      initialPassword: parsed.data.adminInitialPassword,
    });
    if (!newAdmin.success) {
      const mapped = fieldErrors(newAdmin.error);
      const adminFieldErrors: Record<string, string[]> = {};
      if (mapped.firstName?.length) adminFieldErrors.adminFirstName = mapped.firstName;
      if (mapped.lastName?.length) adminFieldErrors.adminLastName = mapped.lastName;
      if (mapped.initialPassword?.length) {
        adminFieldErrors.adminInitialPassword = mapped.initialPassword;
      }
      return {
        status: "error",
        retryMode: "same-operation",
        fieldErrors: adminFieldErrors,
      };
    }
    admin = {
      email: parsed.data.adminEmail,
      ...newAdmin.data,
      initialPassword: parsed.data.adminInitialPassword || undefined,
    };
  }

  try {
    await dependencies.createCenter(
      {
        operationId: parsed.data.operationId,
        center: {
          name: parsed.data.centerName,
          address: parsed.data.centerAddress,
          phone: parsed.data.centerPhone,
          email: parsed.data.centerEmail,
          timezone: parsed.data.centerTimezone,
        },
        admin,
      },
      client,
    );
    dependencies.revalidatePlatform();

    return previousState.retryMode === "same-operation" || parsed.data.isRetryingOperation
      ? {
          status: "confirmed",
          message: "La operación quedó confirmada al reintentar, sin duplicar el centro.",
        }
      : {
          status: "success",
          message: "Centro creado con su primer administrador.",
        };
  } catch (error) {
    return provisioningErrorState(error);
  }
}

export async function performSetPlatformCenterActiveAction(
  previousState: PlatformActionState,
  formData: FormData,
  overrides: Partial<PlatformActionDependencies> = {},
): Promise<PlatformActionState> {
  void previousState;
  const dependencies = { ...productionDependencies, revalidatePlatform: () => {}, ...overrides };
  const client = await dependencies.createServerClient();

  try {
    await dependencies.requirePlatform(client);
  } catch (error) {
    return (
      unauthorizedState(error) ?? {
        status: "error",
        message: "No pudimos verificar tu sesión.",
      }
    );
  }

  const parsed = platformCenterStatusSchema.safeParse({
    centerId: formValue(formData, "centerId"),
    isActive: formValue(formData, "isActive"),
  });
  if (!parsed.success) {
    return { status: "error", message: "La acción solicitada no es válida." };
  }

  try {
    await dependencies.updateCenterStatus(parsed.data, client);
    dependencies.revalidatePlatform();
    return {
      status: "success",
      message: parsed.data.isActive ? "Centro reactivado." : "Centro desactivado.",
    };
  } catch {
    return {
      status: "error",
      message: parsed.data.isActive
        ? "No pudimos reactivar el centro. Verificá que conserve al menos un ADMIN activo."
        : "No pudimos desactivar el centro. Volvé a intentarlo.",
    };
  }
}
