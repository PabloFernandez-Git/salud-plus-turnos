import { z } from "zod";

export const centerInstitutionalFieldsSchema = z.object({
  centerName: z.string().trim().min(1, "Ingresá el nombre del centro."),
  centerPhone: z.string().trim().optional().default(""),
  centerEmail: z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Ingresá un email válido o dejá el campo vacío.",
    }),
  centerAddress: z.string().trim().optional().default(""),
});

export const centerSettingsFormSchema = centerInstitutionalFieldsSchema.extend({
  centerId: z.uuid("El centro no es válido."),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export type CenterInstitutionalFields = z.output<typeof centerInstitutionalFieldsSchema>;
