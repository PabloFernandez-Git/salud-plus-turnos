import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z, type ZodError } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centerSettingsFormSchema } from "../schemas/center-institutional";
import { AuthorizationError, requireRole } from "./authorization";
import {
  CenterSettingsConflictError,
  updateCenterSettings,
  type PersistedCenterSettings,
} from "./center-settings";

type ServerClient = SupabaseClient<Database>;

export type CenterSettingsActionResult =
  | { status: "success"; settings: PersistedCenterSettings; refreshPending?: true }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "conflict" | "forbidden" | "error" | "uncertain"; message: string };

type Dependencies = {
  createClient: () => Promise<ServerClient>;
  authorize: typeof requireRole;
  persist: typeof updateCenterSettings;
  revalidate: (centerId: string) => void;
};

function fieldErrors(error: ZodError) {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

export async function performUpdateCenterSettingsAction(
  formData: FormData,
  overrides: Partial<Dependencies> = {},
): Promise<CenterSettingsActionResult> {
  const deps: Dependencies = {
    createClient: createSupabaseServerClient,
    authorize: requireRole,
    persist: updateCenterSettings,
    revalidate: () => {},
    ...overrides,
  };
  const centerId = z.uuid().safeParse(value(formData, "centerId"));
  if (!centerId.success) return { status: "invalid", fieldErrors: fieldErrors(centerId.error) };

  let client: ServerClient;
  try {
    client = await deps.createClient();
    await deps.authorize(centerId.data, ["ADMIN"], client);
  } catch (error) {
    return {
      status: error instanceof AuthorizationError ? "forbidden" : "error",
      message: "No pudimos verificar el permiso para administrar este centro.",
    };
  }

  const parsed = centerSettingsFormSchema.safeParse({
    centerId: centerId.data,
    expectedUpdatedAt: value(formData, "expectedUpdatedAt"),
    centerName: value(formData, "centerName"),
    centerPhone: value(formData, "centerPhone"),
    centerEmail: value(formData, "centerEmail"),
    centerAddress: value(formData, "centerAddress"),
  });
  if (!parsed.success) return { status: "invalid", fieldErrors: fieldErrors(parsed.error) };

  let settings: PersistedCenterSettings;
  try {
    settings = await deps.persist(parsed.data, client);
  } catch (error) {
    if (error instanceof CenterSettingsConflictError) {
      return {
        status: "conflict",
        message:
          "Los datos del centro cambiaron mientras editabas. Revisá la versión actual antes de guardar.",
      };
    }
    if (error && typeof error === "object" && "code" in error && error.code === "42501") {
      return { status: "forbidden", message: "Ya no tenés permiso para modificar este centro." };
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "PGRST202" || error.code === "22023")
    ) {
      return {
        status: "error",
        message: "No pudimos guardar los cambios en este momento. Intentá de nuevo más tarde.",
      };
    }
    return {
      status: "uncertain",
      message:
        "No pudimos confirmar si se guardaron los cambios. Recargá los datos antes de volver a guardar.",
    };
  }

  try {
    deps.revalidate(centerId.data);
    return { status: "success", settings };
  } catch {
    return { status: "success", settings, refreshPending: true };
  }
}
