"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type DateHeaderProps,
  type EventProps,
  type ResourceHeaderProps,
  type SlotInfo,
} from "react-big-calendar";
import {
  ModuleHeader,
  modulePrimaryActionClass,
  moduleSecondaryActionClass,
} from "@/components/module-header";
import type { AvailabilityProfessionalCenter } from "@/modules/availability/server/availability";
import { appointmentStatusLabels } from "@/modules/appointments/components/appointments-list";
import {
  BookingSelector,
  type BookingChoice,
} from "@/modules/appointments/components/booking-selector";
import {
  agendaUrl,
  appointmentPrefillUrl,
  calendarDate,
  centerWallTime,
  civilDate,
  moveAgendaDate,
  type AgendaFilters,
} from "../agenda-search";
import type { AgendaAppointment } from "../server/agenda-appointments";

const localizer = dateFnsLocalizer({
  format,
  getDay,
  parse,
  startOfWeek,
  locales: { es },
});
const statuses = ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"] as const;
const timeSlotMinutes = 30;
const linkClass =
  "inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-700";
const activeLinkClass =
  "inline-flex min-h-11 items-center rounded-md border border-sky-700 bg-sky-700 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-slate-900";
type Resource = { id: string; name: string };
type Event = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId: string;
  professionalName: string;
  specialtyName: string;
  status: AgendaAppointment["status"];
  timeLabel: string;
};

function AgendaEvent({ event }: EventProps<Event>) {
  const detail = `${event.timeLabel} · ${event.title} · ${event.professionalName} · ${event.specialtyName} · ${appointmentStatusLabels[event.status]}`;
  return (
    <div className="agenda-event-content" title={detail} aria-label={detail}>
      <strong>{event.title}</strong>
      <span>
        {event.timeLabel} · {event.professionalName} · {appointmentStatusLabels[event.status]}
      </span>
    </div>
  );
}

function ResourceHeading({ resource }: ResourceHeaderProps<Resource>) {
  return <strong className="text-xs text-slate-900 sm:text-sm">{resource.name}</strong>;
}

export function AgendaCalendar({
  centerId,
  timezone,
  today,
  role,
  filters,
  appointments,
  professionals,
  specialties = [],
  specialtyUnavailable = false,
  loadFailed,
}: {
  centerId: string;
  centerName: string;
  timezone: string;
  today: string;
  role: "ADMIN" | "RECEPTION" | "PROFESSIONAL";
  filters: AgendaFilters;
  appointments: AgendaAppointment[];
  professionals: AvailabilityProfessionalCenter[];
  specialties?: { specialty_id: string; specialty_name: string }[];
  specialtyUnavailable?: boolean;
  loadFailed: boolean;
}) {
  const router = useRouter();
  const calendarScroll = useRef<HTMLDivElement>(null);
  const [columnScroll, setColumnScroll] = useState({ before: false, after: false });
  const [slotSelection, setSlotSelection] = useState<{
    date: string;
    professionalCenterId: string;
    requestedTime: string;
  } | null>(null);
  const [slotHelp, setSlotHelp] = useState<string | null>(null);
  const [bookingChoice, setBookingChoice] = useState<BookingChoice | null>(null);
  const [currentInstant, setCurrentInstant] = useState<Date | null>(null);
  const date = useMemo(() => calendarDate(filters.date), [filters.date]);
  useEffect(() => {
    if (filters.view !== "day") return;
    let timeout: number;
    const update = () => {
      setCurrentInstant(new Date());
      timeout = window.setTimeout(update, 60_000 - (Date.now() % 60_000));
    };
    update();
    return () => window.clearTimeout(timeout);
  }, [filters.view]);
  const currentSlotMinute = useMemo(() => {
    if (filters.view !== "day" || !currentInstant) return null;
    const centerNow = centerWallTime(currentInstant.toISOString(), timezone);
    if (centerNow.localDate !== filters.date) return null;
    const [hour, minute] = centerNow.localTime.split(":").map(Number);
    return Math.floor((hour * 60 + minute) / timeSlotMinutes) * timeSlotMinutes;
  }, [currentInstant, filters.date, filters.view, timezone]);
  const projected = useMemo(
    () =>
      appointments.map((row) => ({
        row,
        start: centerWallTime(row.startsAt, timezone),
        end: centerWallTime(row.endsAt, timezone),
      })),
    [appointments, timezone],
  );
  const events = useMemo<Event[]>(
    () =>
      projected
        .filter(({ start, end }) => start.representable && end.representable)
        .map(({ row, start, end }) => ({
          id: row.id,
          title: row.patientName,
          start: start.date,
          end: end.date,
          resourceId: row.professionalCenterId,
          professionalName: row.professionalName,
          specialtyName: row.specialtyName,
          status: row.status,
          timeLabel: `${start.localTime}–${end.localTime}`,
        })),
    [projected],
  );
  const exceptional = projected.filter(
    ({ start, end }) => !start.representable || !end.representable,
  );
  const firstMinute = events.length
    ? Math.min(...events.map((event) => event.start.getHours() * 60 + event.start.getMinutes()))
    : null;
  const initialMinute = firstMinute === null ? 8 * 60 : Math.max(0, firstMinute - 30);
  const initialTime = useMemo(
    () => new Date(2020, 0, 1, Math.floor(initialMinute / 60), initialMinute % 60),
    [initialMinute],
  );
  const firstTimeLabel = `${String(Math.floor((firstMinute ?? 480) / 60)).padStart(2, "0")}:${String((firstMinute ?? 480) % 60).padStart(2, "0")}`;
  const resources = useMemo<Resource[]>(() => {
    const names = new Map(
      professionals
        .filter(
          (person) => !filters.professionalCenterId || person.id === filters.professionalCenterId,
        )
        .map((person) => [person.id, `${person.firstName} ${person.lastName}`]),
    );
    for (const row of appointments) names.set(row.professionalCenterId, row.professionalName);
    if (role === "PROFESSIONAL" && names.size === 0) names.set("own", "Mi agenda");
    return [...names].map(([id, name]) => ({ id, name }));
  }, [appointments, filters.professionalCenterId, professionals, role]);
  useEffect(() => {
    const element = calendarScroll.current;
    if (!element) return;
    const update = () =>
      setColumnScroll({
        before: element.scrollLeft > 1,
        after: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update);
    const frame = requestAnimationFrame(update);
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [filters.view, filters.date, loadFailed, resources.length]);

  function moveColumns(direction: number) {
    const element = calendarScroll.current;
    if (!element) return;
    const columnWidth = element.querySelector(".rbc-header")?.getBoundingClientRect().width ?? 180;
    const columns = Math.max(1, Math.floor((element.clientWidth - 60) / columnWidth));
    element.scrollBy({ left: direction * columns * columnWidth });
  }
  function returnToInitialTime() {
    const element = calendarScroll.current?.querySelector<HTMLElement>(".rbc-time-content");
    if (element) element.scrollTop = (element.scrollHeight * initialMinute) / (24 * 60);
  }
  const counts = useMemo(() => {
    const byDate = new Map<string, { count: number; professionals: Set<string> }>();
    for (const { row, start } of projected) {
      const key = start.localDate;
      const item = byDate.get(key) ?? { count: 0, professionals: new Set<string>() };
      item.count++;
      item.professionals.add(row.professionalName);
      byDate.set(key, item);
    }
    return byDate;
  }, [projected]);
  const components = useMemo(
    () => ({
      event: AgendaEvent,
      resourceHeader: ResourceHeading,
      month: {
        dateHeader: ({ date: day, label, isOffRange, onDrillDown }: DateHeaderProps) => {
          const summary = counts.get(civilDate(day));
          const count = summary?.count ?? 0;
          return (
            <button
              type="button"
              disabled={isOffRange}
              onClick={onDrillDown}
              className="agenda-month-summary"
              aria-label={`${label}: ${count} ${count === 1 ? "turno" : "turnos"}. Abrir día`}
            >
              <strong>{label}</strong>
              <span>
                {count} {count === 1 ? "turno" : "turnos"}
              </span>
              {summary && <small>{[...summary.professionals].join(", ")}</small>}
            </button>
          );
        },
      },
    }),
    [counts],
  );
  const period = new Intl.DateTimeFormat(
    "es-AR",
    filters.view === "month"
      ? { month: "long", year: "numeric" }
      : { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  ).format(date);
  function selectSlot({ start, resourceId }: SlotInfo) {
    if (role === "PROFESSIONAL" || filters.view === "month") return;
    if (!filters.specialtyId) {
      setSlotHelp("Elegí una especialidad en los filtros antes de buscar un horario.");
      setSlotSelection(null);
      setBookingChoice(null);
      return;
    }
    const professionalCenterId =
      typeof resourceId === "string" ? resourceId : filters.professionalCenterId;
    if (!professionalCenterId) {
      setSlotHelp("Elegí un profesional en los filtros para buscar horarios en Semana.");
      setSlotSelection(null);
      setBookingChoice(null);
      return;
    }
    setSlotHelp(null);
    setBookingChoice(null);
    setSlotSelection({
      date: civilDate(start),
      professionalCenterId,
      requestedTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
    });
  }
  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <ModuleHeader
          centerId={centerId}
          title="Agenda"
          description={`Consultá la actividad por día, semana o mes. Horarios en la zona del centro: ${timezone}.`}
          actions={
            <>
              {role !== "PROFESSIONAL" && (
                <Link
                  className={modulePrimaryActionClass}
                  href={`/centers/${centerId}/appointments/new`}
                >
                  Crear turno
                </Link>
              )}
              <Link
                className={moduleSecondaryActionClass}
                href={`/centers/${centerId}/appointments`}
              >
                Lista de turnos
              </Link>
            </>
          }
        />
        <section
          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
          aria-label="Controles de agenda"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Vista de agenda">
              {(["day", "week", "month"] as const).map((view) => (
                <Link
                  key={view}
                  href={agendaUrl(centerId, { ...filters, view })}
                  aria-current={filters.view === view ? "page" : undefined}
                  className={filters.view === view ? activeLinkClass : linkClass}
                >
                  {{ day: "Día", week: "Semana", month: "Mes" }[view]}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className={linkClass}
                href={agendaUrl(centerId, {
                  ...filters,
                  date: moveAgendaDate(filters.date, filters.view, -1),
                })}
              >
                Anterior
              </Link>
              <Link className={linkClass} href={agendaUrl(centerId, { ...filters, date: today })}>
                Hoy
              </Link>
              <Link
                className={linkClass}
                href={agendaUrl(centerId, {
                  ...filters,
                  date: moveAgendaDate(filters.date, filters.view, 1),
                })}
              >
                Siguiente
              </Link>
            </div>
          </div>
          <p className="mt-3 capitalize text-lg font-bold text-slate-900">{period}</p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            method="get"
            action={`/centers/${centerId}/agenda`}
          >
            <input type="hidden" name="view" value={filters.view} />
            <input type="hidden" name="date" value={filters.date} />
            {role !== "PROFESSIONAL" && (
              <>
                <label className="min-w-0 w-full text-sm font-medium text-slate-800 sm:w-80">
                  Especialidad
                  <select
                    className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                    name="specialty"
                    defaultValue={filters.specialtyId ?? ""}
                  >
                    <option value="">Todas</option>
                    {specialties.map((item) => (
                      <option key={item.specialty_id} value={item.specialty_id}>
                        {item.specialty_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 w-full text-sm font-medium text-slate-800 sm:w-56">
                  Profesional
                  <select
                    className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                    name="professional"
                    defaultValue={filters.professionalCenterId ?? ""}
                  >
                    <option value="">Todos</option>
                    {professionals.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="min-w-0 w-full text-sm font-medium text-slate-800 sm:w-64">
              Estado
              <select
                className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                name="status"
                defaultValue={filters.status ?? ""}
              >
                <option value="">Activos (sin cancelados)</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {appointmentStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="min-h-11 rounded-md bg-sky-700 px-4 font-semibold text-white"
              type="submit"
            >
              Aplicar filtros
            </button>
          </form>
        </section>
        {role !== "PROFESSIONAL" && (slotHelp || slotSelection) && (
          <section
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
            aria-label="Horarios disponibles"
          >
            {slotHelp ? (
              <p role="status">{slotHelp}</p>
            ) : (
              slotSelection && (
                <>
                  <h2 className="text-lg font-semibold text-slate-900">Horarios disponibles</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {slotSelection.date} · franja señalada {slotSelection.requestedTime}. Confirmá
                    un horario ofrecido por el centro.
                  </p>
                  <div className="mt-4">
                    <BookingSelector
                      key={`${slotSelection.date}:${slotSelection.professionalCenterId}`}
                      centerId={centerId}
                      timezone={timezone}
                      onChange={setBookingChoice}
                      initial={{
                        specialtyId: filters.specialtyId!,
                        professionalCenterId: slotSelection.professionalCenterId,
                        localDate: slotSelection.date,
                      }}
                    />
                  </div>
                  {bookingChoice && (
                    <Link
                      className="mt-4 inline-flex min-h-11 items-center rounded-md bg-sky-700 px-4 font-semibold text-white"
                      href={appointmentPrefillUrl(centerId, bookingChoice)}
                    >
                      Continuar para crear turno
                    </Link>
                  )}
                </>
              )
            )}
          </section>
        )}
        <section
          className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5"
          aria-label="Calendario de turnos"
        >
          {loadFailed ? (
            <p role="alert">No pudimos cargar la agenda completa. Reintentá la consulta.</p>
          ) : (
            <>
              {appointments.length === 0 && (
                <p className="mb-3 text-sm text-slate-600">
                  {specialtyUnavailable
                    ? "La especialidad seleccionada ya no está disponible."
                    : "No hay turnos para esta vista y estos filtros."}
                </p>
              )}
              {exceptional.length > 0 && (
                <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-slate-900">
                  <h2 className="font-semibold">Turnos con horario especial</h2>
                  <p>Estos horarios se muestran según la zona del centro.</p>
                  <ul className="mt-2 space-y-1">
                    {exceptional.map(({ row, start, end }) => (
                      <li key={row.id}>
                        <Link
                          className="font-semibold text-sky-800 underline"
                          href={`/centers/${centerId}/appointments/${row.id}`}
                        >
                          {start.localDate} · {start.localTime} {start.offsetLabel}–{end.localTime}{" "}
                          · {row.patientName} · {row.professionalName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {filters.view !== "month" && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">
                    La grilla incluye las 24 horas. Desplazala para ver otros horarios.
                  </p>
                  <button type="button" className={linkClass} onClick={returnToInitialTime}>
                    {firstMinute === null ? "Ir a" : "Primer turno ·"} {firstTimeLabel}
                  </button>
                </div>
              )}
              {(columnScroll.before || columnScroll.after) && (
                <div className="mb-3 space-y-2" aria-label="Navegación de columnas">
                  <p className="text-sm text-slate-600">
                    Deslizá el calendario o usá las flechas para ver todas las columnas.
                  </p>
                  <div className="flex justify-between gap-2">
                    <button
                      type="button"
                      className={`${linkClass} disabled:opacity-40`}
                      aria-label="Columnas anteriores"
                      disabled={!columnScroll.before}
                      onClick={() => moveColumns(-1)}
                    >
                      ← Anteriores
                    </button>
                    <button
                      type="button"
                      className={`${linkClass} disabled:opacity-40`}
                      aria-label="Columnas siguientes"
                      disabled={!columnScroll.after}
                      onClick={() => moveColumns(1)}
                    >
                      Siguientes →
                    </button>
                  </div>
                </div>
              )}
              <div
                key={`${filters.view}:${filters.date}`}
                ref={calendarScroll}
                role="region"
                aria-label="Grilla de la agenda, desplazable"
                tabIndex={0}
                className={`agenda-calendar agenda-calendar-${filters.view} overflow-x-auto`}
              >
                <div
                  className="agenda-calendar-inner"
                  style={{
                    minWidth:
                      filters.view === "day"
                        ? Math.max(360, resources.length * 280 + 60)
                        : filters.view === "week"
                          ? 1120
                          : 800,
                  }}
                >
                  <Calendar<Event, Resource>
                    key={`${filters.view}:${filters.date}:${initialMinute}`}
                    culture="es"
                    localizer={localizer}
                    date={date}
                    view={filters.view}
                    events={filters.view === "month" ? [] : events}
                    resources={
                      filters.view === "day" && resources.length > 0 ? resources : undefined
                    }
                    resourceIdAccessor="id"
                    resourceTitleAccessor="name"
                    startAccessor="start"
                    endAccessor="end"
                    components={components}
                    scrollToTime={initialTime}
                    slotPropGetter={
                      currentSlotMinute === null
                        ? undefined
                        : (slot) =>
                            slot.getHours() * 60 + slot.getMinutes() === currentSlotMinute
                              ? { className: "agenda-current-time-slot" }
                              : {}
                    }
                    dayLayoutAlgorithm="no-overlap"
                    toolbar={false}
                    selectable={
                      role !== "PROFESSIONAL" &&
                      filters.view !== "month" &&
                      (filters.view !== "day" || resources.length > 0)
                    }
                    min={new Date(2020, 0, 1, 0)}
                    max={new Date(2020, 0, 1, 23, 59)}
                    step={timeSlotMinutes}
                    timeslots={2}
                    messages={{
                      noEventsInRange: "Sin turnos en este período",
                      showMore: (count) => `+${count} más`,
                    }}
                    onNavigate={() => undefined}
                    onView={() => undefined}
                    onSelectEvent={(event) =>
                      router.push(`/centers/${centerId}/appointments/${event.id}`)
                    }
                    onKeyPressEvent={(event, key) => {
                      if ("key" in key && (key.key === "Enter" || key.key === " ")) {
                        key.preventDefault();
                        router.push(`/centers/${centerId}/appointments/${event.id}`);
                      }
                    }}
                    onSelectSlot={selectSlot}
                    onDrillDown={(day) =>
                      router.push(
                        agendaUrl(centerId, { ...filters, date: civilDate(day), view: "day" }),
                      )
                    }
                  />
                </div>
              </div>
              {projected.length > 0 && (
                <details className="mt-4 rounded-md border border-slate-200">
                  <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-sky-800">
                    Ver turnos en lista ({projected.length})
                  </summary>
                  <ul className="divide-y divide-slate-200 px-3">
                    {[...projected]
                      .sort((a, b) => a.row.startsAt.localeCompare(b.row.startsAt))
                      .map(({ row, start, end }) => (
                        <li key={row.id}>
                          <Link
                            className="block min-h-11 rounded py-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-sky-700"
                            href={`/centers/${centerId}/appointments/${row.id}`}
                          >
                            <strong className="block text-sky-800 underline">
                              {row.patientName}
                            </strong>
                            <span className="block">
                              {start.localDate} · {start.localTime} {start.offsetLabel}–
                              {end.localTime} {end.offsetLabel}
                            </span>
                            <span className="block">
                              {row.professionalName} · {row.specialtyName} ·{" "}
                              {appointmentStatusLabels[row.status]}
                            </span>
                            <span className="block font-semibold text-sky-800">Ver detalle →</span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
