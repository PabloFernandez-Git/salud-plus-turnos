import { z } from "zod";

export const specialtyCenterIdSchema = z.uuid();

const name = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(120, "El nombre debe tener como máximo 120 caracteres.");

const identity = z.object({
  centerId: specialtyCenterIdSchema,
  specialtyId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const createSpecialtySchema = z.object({
  centerId: specialtyCenterIdSchema,
  name,
});

export const updateSpecialtySchema = identity.extend({ name });

export const setSpecialtyActiveSchema = identity.extend({
  isActive: z.boolean(),
  confirmed: z.literal(true),
});
