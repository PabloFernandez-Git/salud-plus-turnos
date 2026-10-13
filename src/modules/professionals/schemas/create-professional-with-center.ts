import { z } from "zod";
import { professionalDocumentSchema } from "./professional-document";
import { professionalEmailSchema } from "./professional-email";

const optionalTrimmedTextSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const createProfessionalWithCenterSchema = z.object({
  centerId: z.uuid(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  nationalityCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  documentNumber: professionalDocumentSchema,
  email: professionalEmailSchema,
  phone: optionalTrimmedTextSchema,
  licenseNumber: optionalTrimmedTextSchema,
  usualAppointmentDurationMinutes: z.number().int().min(5).max(480).multipleOf(5),
});

export type CreateProfessionalWithCenterInput = z.infer<typeof createProfessionalWithCenterSchema>;
