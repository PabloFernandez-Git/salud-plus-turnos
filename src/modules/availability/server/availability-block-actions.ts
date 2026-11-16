import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  blockPeriodSchema,
  createBlockSchema,
  deactivateBlockSchema,
} from "../schemas/availability-block";
import {
  createAvailabilityBlock,
  deactivateAvailabilityBlock,
  previewAvailabilityBlock,
} from "./availability-blocks";

export type BlockActionResult = {
  status: "success" | "error" | "stale" | "unknown";
  message: string;
  affectedCount?: number;
  fieldErrors?: Record<string, string>;
};

type Operation = "preview" | "create" | "deactivate";

function publicError(error: unknown): BlockActionResult {
  if (error instanceof AuthorizationError)
    return { status: "error", message: "No tenés permiso para administrar estos bloqueos." };
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const message = error && typeof error === "object" && "message" in error ? error.message : null;
  if (code === "42501")
    return { status: "error", message: "No tenés permiso para administrar estos bloqueos." };
  if (code === "23P01")
    return { status: "error", message: "Ya existe un bloqueo activo en esas fechas." };
  if (code === "22023")
    return { status: "error", message: "Revisá las fechas y el motivo ingresados." };
  if (code === "P0002")
    return {
      status: "stale",
      message: "El vínculo o bloqueo ya no está disponible. Actualizá la página.",
    };
  if (code === "P0001" && message === "STALE_BLOCK_PREVIEW")
    return {
      status: "stale",
      message: "Cambió la cantidad de turnos afectados. Revisá y confirmá de nuevo.",
    };
  if (code === "P0001")
    return {
      status: "stale",
      message: "El bloqueo cambió. Actualizá la página antes de reintentar.",
    };
  return {
    status: "unknown",
    message: "No pudimos confirmar el resultado. Actualizá la página antes de reintentar.",
  };
}

export async function performBlockAction(
  operation: Operation,
  formData: FormData,
  dependencies: {
    client?: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    revalidate?: (centerId: string, professionalCenterId: string) => void;
  } = {},
): Promise<BlockActionResult> {
  const centerId = z.uuid().safeParse(formData.get("centerId"));
  if (!centerId.success) return { status: "error", message: "El centro no es válido." };
  try {
    const client = dependencies.client ?? (await createSupabaseServerClient());
    await requireRole(centerId.data, ["ADMIN", "RECEPTION"], client);
    const raw = {
      centerId: centerId.data,
      professionalCenterId: formData.get("professionalCenterId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason"),
      expectedAffectedCount: formData.get("expectedAffectedCount"),
      confirmAffected: formData.get("confirmAffected"),
      blockId: formData.get("blockId"),
      expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    };
    const schema =
      operation === "preview"
        ? blockPeriodSchema
        : operation === "create"
          ? createBlockSchema
          : deactivateBlockSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      return { status: "error", message: "Revisá los datos ingresados.", fieldErrors };
    }
    if (operation === "preview") {
      const value = blockPeriodSchema.parse(raw);
      const affectedCount = await previewAvailabilityBlock(value, client);
      return { status: "success", message: "Revisión completada.", affectedCount };
    }
    if (operation === "create") {
      const value = createBlockSchema.parse(raw);
      const result = await createAvailabilityBlock(value, client);
      dependencies.revalidate?.(value.centerId, value.professionalCenterId);
      return {
        status: "success",
        message: "Bloqueo guardado. Los turnos existentes conservan su estado.",
        affectedCount: result.affected_count,
      };
    }
    const value = deactivateBlockSchema.parse(raw);
    await deactivateAvailabilityBlock(value, client);
    dependencies.revalidate?.(value.centerId, value.professionalCenterId);
    return { status: "success", message: "Bloqueo quitado." };
  } catch (error) {
    return publicError(error);
  }
}
