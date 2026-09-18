import type { DateHeaderProps, EventProps, ResourceHeaderProps } from "react-big-calendar";
import { TIME_FORMATTER } from "./calendar-config";
import { getDaySummary, getProfessional } from "./mock-calendar-data";
import type { MockAppointment, Professional } from "./types";

export function AppointmentEvent({ event }: EventProps<MockAppointment>) {
  const professional = getProfessional(event.professionalId);

  return (
    <div className="spike-event-content" data-event-id={event.id}>
      <strong>{professional.name}</strong>
      <span>{event.title}</span>
      <time>
        {TIME_FORMATTER.format(event.start)}–{TIME_FORMATTER.format(event.end)}
      </time>
    </div>
  );
}

export function ProfessionalResourceHeader({ resource }: ResourceHeaderProps<Professional>) {
  return (
    <div className="py-1" data-resource-id={resource.id}>
      <strong className="block text-sm text-slate-900">{resource.name}</strong>
      <span className="text-xs font-normal text-slate-500">{resource.specialty}</span>
    </div>
  );
}

type MonthDateHeaderProps = DateHeaderProps & {
  appointments: MockAppointment[];
};

export function MonthDateHeader({
  appointments,
  date,
  isOffRange,
  label,
  onDrillDown,
}: MonthDateHeaderProps) {
  const summary = getDaySummary(date, appointments);
  const summaryLabel =
    summary.appointmentCount === 0
      ? "Sin turnos"
      : `${summary.appointmentCount} ${summary.appointmentCount === 1 ? "turno" : "turnos"}`;

  return (
    <button
      aria-label={`${label}: ${summaryLabel}. Abrir vista Día`}
      className="month-day-summary"
      data-date={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`}
      disabled={isOffRange}
      onClick={onDrillDown}
      type="button"
    >
      <span className="month-day-number">{label}</span>
      <span className="month-day-count">{summaryLabel}</span>
      {summary.professionalNames.length > 0 ? (
        <span className="month-day-professionals">
          {summary.professionalNames.map((name) => name.replace(/^(Dra?\.) /, "")).join(", ")}
        </span>
      ) : null}
    </button>
  );
}
