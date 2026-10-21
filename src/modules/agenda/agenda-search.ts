import { z } from "zod";
import { addCivilDays } from "@/modules/appointments/search/appointment-search";
import {
  localDateSchema,
  appointmentStatusSchema,
} from "@/modules/appointments/schemas/appointment-input";

export type AgendaView = "day" | "week" | "month";
export type AgendaFilters = {
  date: string;
  view: AgendaView;
  status?: z.infer<typeof appointmentStatusSchema>;
  specialtyId?: string;
  professionalCenterId?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

export function parseAgendaSearch(
  input: SearchParams,
  today: string,
  staff: boolean,
): AgendaFilters {
  const date =
    typeof input.date === "string" && localDateSchema.safeParse(input.date).success
      ? input.date
      : today;
  const view = input.view === "week" || input.view === "month" ? input.view : "day";
  const status =
    typeof input.status === "string" ? appointmentStatusSchema.safeParse(input.status) : null;
  const professionalCenterId =
    staff &&
    typeof input.professional === "string" &&
    z.uuid().safeParse(input.professional).success
      ? input.professional
      : undefined;
  const specialtyId =
    staff && typeof input.specialty === "string" && z.uuid().safeParse(input.specialty).success
      ? input.specialty
      : undefined;
  return {
    date,
    view,
    ...(status?.success ? { status: status.data } : {}),
    ...(specialtyId ? { specialtyId } : {}),
    ...(professionalCenterId ? { professionalCenterId } : {}),
  };
}

export function agendaRange({ date, view }: AgendaFilters) {
  if (view === "day") return { fromDate: date, toDate: date };
  const [year, month, day] = date.split("-").map(Number);
  if (view === "month") {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      fromDate: `${year}-${String(month).padStart(2, "0")}-01`,
      toDate: `${year}-${String(month).padStart(2, "0")}-${last}`,
    };
  }
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const fromDate = addCivilDays(date, -((weekday + 6) % 7));
  return { fromDate, toDate: addCivilDays(fromDate, 6) };
}

export function moveAgendaDate(date: string, view: AgendaView, direction: -1 | 1) {
  if (view !== "month") return addCivilDays(date, direction * (view === "day" ? 1 : 7));
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + direction, 1)).toISOString().slice(0, 10);
}

export function agendaUrl(centerId: string, filters: AgendaFilters) {
  const params = new URLSearchParams({ view: filters.view, date: filters.date });
  if (filters.status) params.set("status", filters.status);
  if (filters.specialtyId) params.set("specialty", filters.specialtyId);
  if (filters.professionalCenterId) params.set("professional", filters.professionalCenterId);
  return `/centers/${centerId}/agenda?${params}`;
}

export function appointmentPrefillUrl(
  centerId: string,
  slot: { specialtyId: string; professionalCenterId: string; localDate: string; startsAt: string },
) {
  const params = new URLSearchParams({
    specialtyId: slot.specialtyId,
    professionalCenterId: slot.professionalCenterId,
    localDate: slot.localDate,
    startsAt: slot.startsAt,
  });
  return `/centers/${centerId}/appointments/new?${params}`;
}

// React Big Calendar places events using browser-local Date fields. A browser
// DST gap may make a valid Center wall time impossible to represent; callers
// must present those appointments outside the hourly grid.
export function centerWallTime(instant: string, timezone: string) {
  const wallFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = wallFormatter.formatToParts(new Date(instant));
  const number = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = number("year");
  const month = number("month");
  const day = number("day");
  const hour = number("hour");
  const minute = number("minute");
  const date = new Date(year, month - 1, day, hour, minute);
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  function centerOffset(ms: number) {
    const label =
      offsetFormatter.formatToParts(new Date(ms)).find((part) => part.type === "timeZoneName")
        ?.value ?? "GMT";
    const parsed = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(label);
    if (!parsed) throw new Error("AGENDA_TIMEZONE_OFFSET_UNAVAILABLE");
    const minutes = parsed[1]
      ? (parsed[1] === "+" ? 1 : -1) * (Number(parsed[2]) * 60 + Number(parsed[3] ?? 0))
      : 0;
    return { label, minutes };
  }
  const instantMs = new Date(instant).getTime();
  const ownOffset = centerOffset(instantMs);
  const targetWall = `${year}-${month}-${day}-${hour}-${minute}`;
  const wallKey = (ms: number) => {
    const other = wallFormatter.formatToParts(new Date(ms));
    const value = (type: string) => Number(other.find((part) => part.type === type)?.value);
    return `${value("year")}-${value("month")}-${value("day")}-${value("hour")}-${value("minute")}`;
  };
  const centerAmbiguous = [-36, 36].some((hours) => {
    const otherOffset = centerOffset(instantMs + hours * 3600000).minutes;
    const alternative = instantMs + (ownOffset.minutes - otherOffset) * 60000;
    return alternative !== instantMs && wallKey(alternative) === targetWall;
  });
  const browserOffset = date.getTimezoneOffset();
  const browserAmbiguous = [-36, 36].some((hours) => {
    const otherOffset = new Date(date.getTime() + hours * 3600000).getTimezoneOffset();
    const alternative = new Date(date.getTime() + (otherOffset - browserOffset) * 60000);
    return (
      alternative.getTime() !== date.getTime() &&
      alternative.getFullYear() === year &&
      alternative.getMonth() === month - 1 &&
      alternative.getDate() === day &&
      alternative.getHours() === hour &&
      alternative.getMinutes() === minute
    );
  });
  return {
    date,
    localDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    localTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    offsetLabel: ownOffset.label,
    ambiguous: centerAmbiguous || browserAmbiguous,
    representable:
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      !centerAmbiguous &&
      !browserAmbiguous,
  };
}

export function civilDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
