import { z } from "zod";

export const appointmentIdSchema = z.uuid();
export const appointmentStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "ATTENDED",
  "NO_SHOW",
  "CANCELLED",
]);
export const localDateSchema = z.iso.date().refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= days;
}, "Fecha inválida.");
export const localStartTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");
// Keep PostgreSQL's exact timestamptz text, including fractional microseconds.
export const appointmentTimestampSchema = z.iso.datetime({ offset: true });
export const administrativeNoteSchema = z
  .string()
  .refine((value) => Array.from(value).length <= 2000, "Máximo 2.000 caracteres.")
  .nullable();

const center = { centerId: appointmentIdSchema };
const appointment = { ...center, appointmentId: appointmentIdSchema };
const cursor = z.strictObject({
  startsAt: appointmentTimestampSchema,
  id: appointmentIdSchema,
});
const listBase = {
  ...center,
  fromDate: localDateSchema,
  toDate: localDateSchema,
  status: appointmentStatusSchema.optional(),
  limit: z.number().int().min(1).max(50).default(30),
  cursor: cursor.optional(),
};
function validRange(value: { fromDate: string; toDate: string }) {
  const [fy, fm, fd] = value.fromDate.split("-").map(Number);
  const [ty, tm, td] = value.toDate.split("-").map(Number);
  const days = (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000;
  return days >= 0 && days <= 30;
}
export const staffListSchema = z
  .strictObject({
    ...listBase,
    professionalCenterId: appointmentIdSchema.optional(),
  })
  .refine(validRange, { path: ["toDate"], message: "El rango máximo es de 31 días." });
export const professionalListSchema = z.strictObject(listBase).refine(validRange, {
  path: ["toDate"],
  message: "El rango máximo es de 31 días.",
});
export const appointmentDetailSchema = z.strictObject(appointment);
export const bookableSpecialtiesSchema = z.strictObject(center);
export const bookableProfessionalsSchema = z.strictObject({
  ...center,
  specialtyId: appointmentIdSchema,
});
export const searchSlotsSchema = z.strictObject({
  ...center,
  professionalCenterId: appointmentIdSchema,
  specialtyId: appointmentIdSchema,
  localDate: localDateSchema,
});
export const createAppointmentSchema = searchSlotsSchema.extend({
  patientCenterId: appointmentIdSchema,
  localStartTime: localStartTimeSchema,
  administrativeNote: administrativeNoteSchema.optional(),
});
export const rescheduleAppointmentSchema = z.strictObject({
  ...appointment,
  expectedUpdatedAt: appointmentTimestampSchema,
  professionalCenterId: appointmentIdSchema,
  specialtyId: appointmentIdSchema,
  localDate: localDateSchema,
  localStartTime: localStartTimeSchema,
});
export const statusTransitionSchema = z.strictObject({
  ...appointment,
  expectedUpdatedAt: appointmentTimestampSchema,
  requestedStatus: z.enum(["CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"]),
});
export const noteUpdateSchema = z.strictObject({
  ...appointment,
  expectedUpdatedAt: appointmentTimestampSchema,
  administrativeNote: administrativeNoteSchema,
});

export function canTransitionStatus(
  current: z.infer<typeof appointmentStatusSchema>,
  requested: z.infer<typeof statusTransitionSchema>["requestedStatus"],
  role: "ADMIN" | "RECEPTION" | "PROFESSIONAL",
) {
  if (role === "PROFESSIONAL" && requested !== "ATTENDED" && requested !== "NO_SHOW") return false;
  return current === "PENDING" || (current === "CONFIRMED" && requested !== "CONFIRMED");
}
