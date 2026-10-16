import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  availabilityIdSchema,
  createAvailabilitySchema,
  deactivateAvailabilitySchema,
  updateAppointmentDurationSchema,
  updateAvailabilitySchema,
  type AvailabilityOperation,
} from "../schemas/availability";
import { availabilityErrorMessages, mapAvailabilityError } from "./availability-errors";
import {
  createAvailability,
  deactivateAvailability,
  updateAvailability,
  updateUsualAppointmentDuration,
} from "./availability";

type ServerClient = SupabaseClient<Database>;
export type AvailabilityActionState = {
  status: "success" | "error" | "stale";
  message: string;
  warning?: boolean;
  fieldErrors?: Record<string, string>;
};

type Dependencies = {
  createServerClient: () => Promise<ServerClient>;
  authorize: typeof requireRole;
  create: typeof createAvailability;
  update: typeof updateAvailability;
  deactivate: typeof deactivateAvailability;
  updateDuration: typeof updateUsualAppointmentDuration;
  revalidate: (centerId: string, professionalCenterId: string) => void;
};
const defaults: Dependencies = {
  createServerClient: createSupabaseServerClient,
  authorize: requireRole,
  create: createAvailability,
  update: updateAvailability,
  deactivate: deactivateAvailability,
  updateDuration: updateUsualAppointmentDuration,
  revalidate: () => undefined,
};

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fields[field]) fields[field] = issue.message;
  }
  return fields;
}

export async function performAvailabilityAction(
  operation: AvailabilityOperation,
  formData: FormData,
  overrides: Partial<Dependencies> = {},
): Promise<AvailabilityActionState> {
  const deps = { ...defaults, ...overrides };
  const centerId = availabilityIdSchema.safeParse(formData.get("centerId"));
  if (!centerId.success) return { status: "error", message: "El centro no es válido." };

  let client: ServerClient;
  try {
    client = await deps.createServerClient();
    await deps.authorize(centerId.data, ["ADMIN", "RECEPTION"], client);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "error", message: availabilityErrorMessages.denied };
    }
    return { status: "error", message: availabilityErrorMessages.unexpected };
  }

  const raw = {
    centerId: centerId.data,
    professionalCenterId: formData.get("professionalCenterId"),
    availabilityId: formData.get("availabilityId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    minutes: formData.get("minutes"),
  };
  try {
    let warning = false;
    let professionalCenterId: string;
    if (operation === "create") {
      const parsed = createAvailabilitySchema.safeParse(raw);
      if (!parsed.success)
        return {
          status: "error",
          message: availabilityErrorMessages.invalid,
          fieldErrors: fieldErrors(parsed.error.issues),
        };
      professionalCenterId = parsed.data.professionalCenterId;
      warning = (await deps.create(parsed.data, client)).has_future_outside_availability;
    } else if (operation === "update") {
      const parsed = updateAvailabilitySchema.safeParse(raw);
      if (!parsed.success)
        return {
          status: "error",
          message: availabilityErrorMessages.invalid,
          fieldErrors: fieldErrors(parsed.error.issues),
        };
      professionalCenterId = parsed.data.professionalCenterId;
      warning = (await deps.update(parsed.data, client)).has_future_outside_availability;
    } else if (operation === "deactivate") {
      const parsed = deactivateAvailabilitySchema.safeParse(raw);
      if (!parsed.success)
        return {
          status: "error",
          message: availabilityErrorMessages.invalid,
          fieldErrors: fieldErrors(parsed.error.issues),
        };
      professionalCenterId = parsed.data.professionalCenterId;
      warning = (await deps.deactivate(parsed.data, client)).has_future_outside_availability;
    } else {
      const parsed = updateAppointmentDurationSchema.safeParse(raw);
      if (!parsed.success)
        return {
          status: "error",
          message: availabilityErrorMessages.invalid,
          fieldErrors: fieldErrors(parsed.error.issues),
        };
      professionalCenterId = parsed.data.professionalCenterId;
      await deps.updateDuration(parsed.data, client);
    }
    deps.revalidate(centerId.data, professionalCenterId);
    return {
      status: "success",
      message: operation === "duration" ? "Duración habitual actualizada." : "Horario guardado.",
      warning,
    };
  } catch (error) {
    const code = mapAvailabilityError(error);
    return {
      status: code === "stale" || code === "missing" ? "stale" : "error",
      message: availabilityErrorMessages[code],
    };
  }
}
