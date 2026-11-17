export const blockReasonLabels = {
  VACATION: "Vacaciones",
  ABSENCE: "Ausencia",
  HOLIDAY: "Feriado",
  OTHER: "Otro",
} as const;

export type AvailabilityBlockReason = keyof typeof blockReasonLabels;
