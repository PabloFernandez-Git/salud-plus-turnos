import type { AvailabilityInterval } from "@/modules/availability/server/availability";
import type { StaffAppointment } from "../server/appointment-rpc";
import { appointmentLocalParts } from "./appointment-search";

export function outsideCurrentAvailability(
  appointment: StaffAppointment,
  timezone: string,
  intervals: AvailabilityInterval[],
  now = new Date(),
): boolean {
  if (appointment.status === "CANCELLED") return false;
  if (new Date(appointment.starts_at).getTime() <= now.getTime()) return false;
  const start = appointmentLocalParts(appointment.starts_at, timezone);
  const end = appointmentLocalParts(appointment.ends_at, timezone);
  if (start.date !== end.date) return true;
  const weekday = new Date(`${start.date}T00:00:00Z`).getUTCDay() || 7;
  return !intervals.some(
    (row) => row.weekday === weekday && row.startTime <= start.time && row.endTime >= end.time,
  );
}
