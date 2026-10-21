import { z } from "zod";
import { appointmentStatusSchema, localDateSchema } from "../schemas/appointment-input";

export type AppointmentFilters = {
  fromDate: string;
  toDate: string;
  status?: z.infer<typeof appointmentStatusSchema>;
  professionalCenterId?: string;
  cursor?: { startsAt: string; id: string };
};
type SearchParams = Record<string, string | string[] | undefined>;

export function centerLocalDate(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addCivilDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
}

export function appointmentLocalParts(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function appointmentSearchUrl(centerId: string, filters: AppointmentFilters): string {
  const params = new URLSearchParams();
  params.set("from", filters.fromDate);
  params.set("to", filters.toDate);
  if (filters.status) params.set("status", filters.status);
  if (filters.professionalCenterId) params.set("professional", filters.professionalCenterId);
  if (filters.cursor) {
    params.set("cursorStartsAt", filters.cursor.startsAt);
    params.set("cursorId", filters.cursor.id);
  }
  return `/centers/${centerId}/appointments?${params}`;
}

export function parseAppointmentSearch(
  input: SearchParams,
  today: string,
  staff: boolean,
): AppointmentFilters {
  const fromDate =
    typeof input.from === "string" && localDateSchema.safeParse(input.from).success
      ? input.from
      : today;
  const toDate =
    typeof input.to === "string" && localDateSchema.safeParse(input.to).success
      ? input.to
      : addCivilDays(fromDate, 30);
  const fromMillis = Date.parse(`${fromDate}T00:00:00Z`);
  const toMillis = Date.parse(`${toDate}T00:00:00Z`);
  const boundedTo =
    toMillis >= fromMillis && toMillis - fromMillis <= 30 * 86400000
      ? toDate
      : addCivilDays(fromDate, 30);
  const status =
    typeof input.status === "string" ? appointmentStatusSchema.safeParse(input.status) : null;
  const professionalCenterId =
    staff &&
    typeof input.professional === "string" &&
    z.uuid().safeParse(input.professional).success
      ? input.professional
      : undefined;
  const startsAt = typeof input.cursorStartsAt === "string" ? input.cursorStartsAt : "";
  const id = typeof input.cursorId === "string" ? input.cursorId : "";
  const cursor = z
    .strictObject({ startsAt: z.iso.datetime({ offset: true }), id: z.uuid() })
    .safeParse({ startsAt, id });
  return {
    fromDate,
    toDate: boundedTo,
    ...(status?.success ? { status: status.data } : {}),
    ...(professionalCenterId ? { professionalCenterId } : {}),
    ...(cursor.success ? { cursor: cursor.data } : {}),
  };
}
