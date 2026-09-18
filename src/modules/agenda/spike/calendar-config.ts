import { format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { dateFnsLocalizer, type Messages } from "react-big-calendar";
import type { MockAppointment } from "./types";

const locales = { es };

export const calendarLocalizer = dateFnsLocalizer({
  format,
  getDay,
  locales,
  parse,
  startOfWeek,
});

export const CALENDAR_MESSAGES: Messages<MockAppointment> = {
  allDay: "Todo el día",
  date: "Fecha",
  day: "Día",
  event: "Turno",
  month: "Mes",
  next: "Siguiente",
  noEventsInRange: "Sin turnos ficticios en este rango.",
  previous: "Anterior",
  showMore: (count) => `+${count} más`,
  time: "Hora",
  today: "Referencia",
  week: "Semana",
};

export const MIN_TIME = new Date(2026, 3, 15, 8, 0, 0, 0);
export const MAX_TIME = new Date(2026, 3, 15, 18, 0, 0, 0);
export const SCROLL_TIME = new Date(2026, 3, 15, 8, 0, 0, 0);

export const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
});

export const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  weekday: "long",
  year: "numeric",
});

export const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});

export function formatSelection(date: Date) {
  return `${DATE_FORMATTER.format(date)} a las ${TIME_FORMATTER.format(date)}`;
}
