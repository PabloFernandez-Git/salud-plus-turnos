import { z } from "zod";

const requiredText = (message: string) => z.string().trim().min(1, message);
const membershipRoleSchema = z.enum(["ADMIN", "RECEPTION", "PROFESSIONAL"]);
const optionalProfessionalCenterIdSchema = z
  .union([z.literal(""), z.uuid("Seleccioná un vínculo profesional válido.")])
  .transform((value) => value || null);

export const centerUserIdentityEmailSchema = z.object({
  centerId: z.uuid("El centro no es válido."),
  email: z.string().trim().toLowerCase().pipe(z.email("Ingresá un email válido.")),
});

export const centerUserProvisionFormSchema = z
  .object({
    operationId: z.uuid("La intención de alta no es válida."),
    centerId: z.uuid("El centro no es válido."),
    isRetryingOperation: z.enum(["true", "false"]).transform((value) => value === "true"),
    email: z.string().trim().toLowerCase().pipe(z.email("Ingresá un email válido.")),
    firstName: z.string().trim().optional().default(""),
    lastName: z.string().trim().optional().default(""),
    initialPassword: z.string().optional().default(""),
    role: membershipRoleSchema,
    professionalCenterId: optionalProfessionalCenterIdSchema,
  })
  .superRefine((value, context) => {
    const shouldHaveProfessionalCenter = value.role === "PROFESSIONAL";
    if (shouldHaveProfessionalCenter !== (value.professionalCenterId !== null)) {
      context.addIssue({
        code: "custom",
        message:
          value.role === "PROFESSIONAL"
            ? "Seleccioná un profesional disponible."
            : "El rol seleccionado no admite un vínculo profesional.",
        path: ["professionalCenterId"],
      });
    }
  });

export const newCenterUserNamesSchema = z.object({
  firstName: requiredText("Ingresá el nombre del usuario."),
  lastName: requiredText("Ingresá el apellido del usuario."),
});

export const newCenterUserSchema = newCenterUserNamesSchema.extend({
  initialPassword: z.string().min(10, "La contraseña debe tener al menos 10 caracteres."),
});

export const centerUserIntentPayloadSchema = z
  .object({
    email: z.email(),
    identityExists: z.boolean(),
    firstName: requiredText("La intención debe conservar el nombre."),
    lastName: requiredText("La intención debe conservar el apellido."),
    role: membershipRoleSchema,
    professionalCenterId: z.uuid().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.role === "PROFESSIONAL") !== (value.professionalCenterId !== null)) {
      context.addIssue({
        code: "custom",
        message: "El vínculo profesional no coincide con el rol.",
        path: ["professionalCenterId"],
      });
    }
  });

export const persistedCenterUserOperationIntentSchema = z
  .object({
    version: z.literal(1),
    scope: z.literal("tenant-provision-user"),
    actorUserId: z.uuid(),
    centerId: z.uuid(),
    operationId: z.uuid(),
    payload: centerUserIntentPayloadSchema,
  })
  .strict();

export type CenterUserIntentPayload = z.infer<typeof centerUserIntentPayloadSchema>;
export type PersistedCenterUserOperationIntent = z.infer<
  typeof persistedCenterUserOperationIntentSchema
>;
