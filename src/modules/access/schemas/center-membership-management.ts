import { z } from "zod";

export const membershipRoleSchema = z.enum(["ADMIN", "RECEPTION", "PROFESSIONAL"]);

const nullableProfessionalCenterSchema = z
  .union([z.literal(""), z.uuid("Seleccioná un vínculo profesional válido."), z.null()])
  .transform((value) => value || null);

const booleanFormValue = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const centerMembershipManagementSchema = z
  .object({
    centerId: z.uuid("El centro no es válido."),
    membershipId: z.uuid("La membership no es válida."),
    expectedRole: membershipRoleSchema,
    expectedProfessionalCenterId: nullableProfessionalCenterSchema,
    expectedIsActive: booleanFormValue,
    role: membershipRoleSchema,
    professionalCenterId: nullableProfessionalCenterSchema,
    isActive: booleanFormValue,
  })
  .superRefine((value, context) => {
    if ((value.role === "PROFESSIONAL") !== (value.professionalCenterId !== null)) {
      context.addIssue({
        code: "custom",
        message:
          value.role === "PROFESSIONAL"
            ? "Seleccioná un profesional disponible."
            : "El rol seleccionado no admite un vínculo profesional.",
        path: ["professionalCenterId"],
      });
    }

    const changed =
      value.role !== value.expectedRole ||
      value.professionalCenterId !== value.expectedProfessionalCenterId ||
      value.isActive !== value.expectedIsActive;
    if (!changed) {
      context.addIssue({
        code: "custom",
        message: "No hay cambios para guardar.",
        path: ["membershipId"],
      });
    }
  });

export type CenterMembershipManagementInput = z.infer<typeof centerMembershipManagementSchema>;
