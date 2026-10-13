import { z } from "zod";
import { professionalCenterIdSchema } from "./professional-center";

export const updateProfessionalSpecialtiesSchema = z
  .object({
    centerId: professionalCenterIdSchema,
    professionalCenterId: z.uuid(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    activateSpecialtyIds: z.array(z.uuid()),
    deactivateSpecialtyIds: z.array(z.uuid()),
  })
  .refine(
    (value) =>
      new Set(value.activateSpecialtyIds).size === value.activateSpecialtyIds.length &&
      new Set(value.deactivateSpecialtyIds).size === value.deactivateSpecialtyIds.length &&
      value.activateSpecialtyIds.every((id) => !value.deactivateSpecialtyIds.includes(id)),
    { message: "Lote de especialidades inválido." },
  );
