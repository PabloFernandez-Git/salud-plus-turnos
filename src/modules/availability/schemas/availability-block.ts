import { z } from "zod";

const id = z.uuid();
const date = z.iso.date();
const base = z.object({ centerId: id, professionalCenterId: id });

export const blockPeriodSchema = base
  .extend({ startDate: date, endDate: date })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "La fecha final debe ser igual o posterior a la inicial.",
  });
export const createBlockSchema = blockPeriodSchema.safeExtend({
  reason: z.enum(["VACATION", "ABSENCE", "HOLIDAY", "OTHER"]),
  expectedAffectedCount: z.coerce.number<number>().int().min(0),
  confirmAffected: z.union([
    z.boolean(),
    z.enum(["true", "false"]).transform((value) => value === "true"),
  ]),
});
export const deactivateBlockSchema = base.extend({
  blockId: id,
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});
export type AvailabilityBlockReason = z.infer<typeof createBlockSchema>["reason"];
export const blockReasonLabels: Record<AvailabilityBlockReason, string> = {
  VACATION: "Vacaciones",
  ABSENCE: "Ausencia",
  HOLIDAY: "Feriado",
  OTHER: "Otro",
};
