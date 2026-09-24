import { z } from "zod";

import { DEFAULT_TIMEZONE } from "@/lib/time/default-timezone";

const requiredText = (message: string) => z.string().trim().min(1, message);
const optionalText = z.string().trim().optional().default("");
const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Ingresá un email válido o dejá el campo vacío.",
  });

export function isValidIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const platformIdentityEmailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Ingresá un email válido.")),
});

export const platformCenterFormSchema = z.object({
  operationId: z.uuid("La intención de alta no es válida."),
  isRetryingOperation: z.enum(["true", "false"]).transform((value) => value === "true"),
  centerName: requiredText("Ingresá el nombre del centro."),
  centerAddress: optionalText,
  centerPhone: optionalText,
  centerEmail: optionalEmail,
  centerTimezone: requiredText("Ingresá la zona horaria.").refine(isValidIanaTimezone, {
    message: "Ingresá una zona horaria IANA válida.",
  }),
  adminEmail: z.string().trim().toLowerCase().pipe(z.email("Ingresá un email válido.")),
  adminFirstName: z.string().trim().optional().default(""),
  adminLastName: z.string().trim().optional().default(""),
  adminInitialPassword: z.string().optional().default(""),
});

export const newPlatformAdminNamesSchema = z.object({
  firstName: requiredText("Ingresá el nombre del primer administrador."),
  lastName: requiredText("Ingresá el apellido del primer administrador."),
});

export const newPlatformAdminSchema = newPlatformAdminNamesSchema.extend({
  initialPassword: z.string().min(10, "La contraseña debe tener al menos 10 caracteres."),
});

export const platformCenterStatusSchema = z.object({
  centerId: z.uuid("El centro no es válido."),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const platformCenterIntentPayloadSchema = z
  .object({
    centerName: z.string(),
    centerAddress: z.string(),
    centerPhone: z.string(),
    centerEmail: z.string(),
    centerTimezone: z.string().refine(isValidIanaTimezone),
    adminEmail: z.email(),
    adminFirstName: z.string(),
    adminLastName: z.string(),
    identityExists: z.boolean(),
  })
  .strict();

export const persistedPlatformOperationIntentSchema = z
  .object({
    version: z.literal(1),
    scope: z.literal("platform-create-center"),
    actorUserId: z.uuid(),
    operationId: z.uuid(),
    payload: platformCenterIntentPayloadSchema,
  })
  .strict();

export const DEFAULT_PLATFORM_TIMEZONE = DEFAULT_TIMEZONE;

export type PlatformCenterFormInput = z.infer<typeof platformCenterFormSchema>;
export type PlatformCenterIntentPayload = z.infer<typeof platformCenterIntentPayloadSchema>;
export type PersistedPlatformOperationIntent = z.infer<
  typeof persistedPlatformOperationIntentSchema
>;
