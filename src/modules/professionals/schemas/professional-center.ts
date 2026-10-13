import { z } from "zod";
import { professionalDocumentSchema } from "./professional-document";

export const professionalCenterIdSchema = z.uuid();

const documentIdentity = z.object({
  centerId: professionalCenterIdSchema,
  nationalityCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  documentNumber: z.string().trim().min(1),
});

export const resolveProfessionalSchema = documentIdentity.extend({
  documentNumber: professionalDocumentSchema,
});

export const linkProfessionalSchema = documentIdentity.extend({
  professionalId: z.uuid(),
  expectedProfessionalCenterUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
  confirmed: z.literal(true),
});

const centerIdentity = z.object({
  centerId: professionalCenterIdSchema,
  professionalCenterId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const updateProfessionalCenterSchema = centerIdentity.extend({
  licenseNumber: z
    .string()
    .trim()
    .nullable()
    .transform((value) => value || null),
  usualAppointmentDurationMinutes: z.number().int().min(5).max(480).multipleOf(5),
});

export const setProfessionalCenterActiveSchema = centerIdentity.extend({
  isActive: z.boolean(),
  confirmed: z.literal(true),
});
