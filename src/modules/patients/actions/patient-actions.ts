"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { mapPatientError, patientErrorMessages } from "../server/patient-errors";
import {
  patientOperationSchemas,
  runPatientOperation,
  type PatientOperation,
} from "../server/patient-management";

export type PatientActionResult =
  | { status: "success"; data: Awaited<ReturnType<typeof runPatientOperation>> }
  | {
      status: "error";
      code: ReturnType<typeof mapPatientError>;
      message: string;
      fields?: Record<string, string>;
    };

async function perform(kind: PatientOperation, input: unknown): Promise<PatientActionResult> {
  const base = z.object({ centerId: z.uuid() }).safeParse(input);
  if (!base.success)
    return { status: "error", code: "invalid", message: patientErrorMessages.invalid };
  const validation = patientOperationSchemas[kind].safeParse(input);
  if (!validation.success) {
    const fields: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fields[field]) fields[field] = "Revisá este campo.";
    }
    return { status: "error", code: "invalid", message: patientErrorMessages.invalid, fields };
  }
  const client = await createSupabaseServerClient();
  try {
    await requireRole(base.data.centerId, ["ADMIN", "RECEPTION"], client);
    const data = await runPatientOperation(kind, input, client);
    if (kind !== "resolve") revalidatePath(`/centers/${base.data.centerId}/patients`);
    return { status: "success", data };
  } catch (error) {
    let code = mapPatientError(error);
    if (error instanceof AuthorizationError) code = "denied";
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field && !fields[field]) fields[field] = "Revisá este campo.";
      }
      return { status: "error", code: "invalid", message: patientErrorMessages.invalid, fields };
    }
    return { status: "error", code, message: patientErrorMessages[code] };
  }
}

export async function resolvePatientAction(input: unknown) {
  return perform("resolve", input);
}
export async function createPatientAction(input: unknown) {
  return perform("create", input);
}
export async function linkPatientAction(input: unknown) {
  return perform("link", input);
}
export async function reactivatePatientAction(input: unknown) {
  return perform("reactivate", input);
}
export async function updatePatientAction(input: unknown) {
  return perform("update", input);
}
export async function deactivatePatientAction(input: unknown) {
  return perform("deactivate", input);
}
