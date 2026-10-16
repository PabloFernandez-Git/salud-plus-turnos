import { z } from "zod";

export const availabilityIdSchema = z.uuid();
export const availabilityTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora HH:MM.");
export const availabilityWeekdaySchema = z.coerce.number<number>().int().min(1).max(7);
export const appointmentDurationSchema = z.coerce
  .number<number>()
  .int()
  .min(5)
  .max(480)
  .refine((value) => value % 5 === 0, "Ingresá un múltiplo de 5 minutos.");
const updatedAtSchema = z.iso.datetime({ offset: true });
const baseSchema = z.object({
  centerId: availabilityIdSchema,
  professionalCenterId: availabilityIdSchema,
});
const intervalSchema = z
  .object({
    startTime: availabilityTimeSchema,
    endTime: availabilityTimeSchema,
  })
  .refine((value) => value.startTime < value.endTime, {
    path: ["endTime"],
    message: "La hora hasta debe ser posterior a la hora desde.",
  });

export const createAvailabilitySchema = baseSchema
  .extend({
    weekday: availabilityWeekdaySchema,
  })
  .safeExtend(intervalSchema.shape)
  .refine((value) => value.startTime < value.endTime, {
    path: ["endTime"],
    message: "La hora hasta debe ser posterior a la hora desde.",
  });
export const updateAvailabilitySchema = baseSchema
  .extend({
    availabilityId: availabilityIdSchema,
    expectedUpdatedAt: updatedAtSchema,
  })
  .safeExtend(intervalSchema.shape)
  .refine((value) => value.startTime < value.endTime, {
    path: ["endTime"],
    message: "La hora hasta debe ser posterior a la hora desde.",
  });
export const deactivateAvailabilitySchema = baseSchema.extend({
  availabilityId: availabilityIdSchema,
  expectedUpdatedAt: updatedAtSchema,
});
export const updateAppointmentDurationSchema = baseSchema.extend({
  expectedUpdatedAt: updatedAtSchema,
  minutes: appointmentDurationSchema,
});

export const availabilityOperationSchemas = {
  create: createAvailabilitySchema,
  update: updateAvailabilitySchema,
  deactivate: deactivateAvailabilitySchema,
  duration: updateAppointmentDurationSchema,
} as const;

export type AvailabilityOperation = keyof typeof availabilityOperationSchemas;
