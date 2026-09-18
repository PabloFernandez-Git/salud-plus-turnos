"use client";

import { addDays, addMonths, addWeeks } from "date-fns";
import { useMemo, useState } from "react";
import { Calendar, type DateHeaderProps, type SlotInfo, type View } from "react-big-calendar";
import {
  CALENDAR_MESSAGES,
  calendarLocalizer,
  formatSelection,
  MAX_TIME,
  MIN_TIME,
  SCROLL_TIME,
} from "./calendar-config";
import { CalendarControls } from "./calendar-controls";
import {
  AppointmentEvent,
  MonthDateHeader,
  ProfessionalResourceHeader,
} from "./calendar-presentation";
import {
  ALL_PROFESSIONAL_IDS,
  filterAppointments,
  getProfessional,
  PROFESSIONALS,
  REFERENCE_DATE,
} from "./mock-calendar-data";
import type { MockAppointment, Professional, ProfessionalId, SpikeView } from "./types";

function isSpikeView(view: View): view is SpikeView {
  return view === "day" || view === "week" || view === "month";
}

export function ReactBigCalendarSpike() {
  const [view, setView] = useState<SpikeView>("day");
  const [date, setDate] = useState(REFERENCE_DATE);
  const [selectedProfessionalIds, setSelectedProfessionalIds] =
    useState<ProfessionalId[]>(ALL_PROFESSIONAL_IDS);
  const [selectionMessage, setSelectionMessage] = useState(
    "Seleccioná un espacio libre para inspeccionar la respuesta del calendario.",
  );

  const appointments = useMemo(
    () => filterAppointments(selectedProfessionalIds),
    [selectedProfessionalIds],
  );
  const resources = useMemo(
    () => PROFESSIONALS.filter(({ id }) => selectedProfessionalIds.includes(id)),
    [selectedProfessionalIds],
  );
  const components = useMemo(
    () => ({
      event: AppointmentEvent,
      month: {
        dateHeader: (props: DateHeaderProps) => (
          <MonthDateHeader {...props} appointments={appointments} />
        ),
      },
      resourceHeader: ProfessionalResourceHeader,
    }),
    [appointments],
  );

  function changeView(nextView: SpikeView) {
    setView(nextView);
    setSelectionMessage(
      nextView === "month"
        ? "Seleccioná un día para abrirlo en la vista Día."
        : "Seleccioná un espacio libre para inspeccionar la respuesta del calendario.",
    );
  }

  function navigate(direction: "previous" | "next" | "reference") {
    if (direction === "reference") {
      setDate(REFERENCE_DATE);
      return;
    }

    const amount = direction === "previous" ? -1 : 1;
    const moveDate = view === "day" ? addDays : view === "week" ? addWeeks : addMonths;
    setDate((currentDate) => moveDate(currentDate, amount));
  }

  function toggleProfessional(professionalId: ProfessionalId) {
    setSelectedProfessionalIds((currentIds) => {
      if (currentIds.includes(professionalId)) {
        return currentIds.length === 1
          ? currentIds
          : currentIds.filter((id) => id !== professionalId);
      }

      return [...currentIds, professionalId];
    });
  }

  function selectSlot({ resourceId, start }: SlotInfo) {
    const professional =
      view === "day" && resourceId
        ? getProfessional(resourceId as ProfessionalId)
        : selectedProfessionalIds.length === 1
          ? getProfessional(selectedProfessionalIds[0])
          : undefined;
    const professionalLabel = professional?.name ?? "varios profesionales visibles";

    setSelectionMessage(
      `Espacio seleccionado: ${professionalLabel}, ${formatSelection(start)}. No se guardó ningún turno.`,
    );
  }

  function selectEvent(event: MockAppointment) {
    const professional = getProfessional(event.professionalId);
    setSelectionMessage(
      `Turno ficticio: ${professional.name}, ${formatSelection(event.start)}–${new Intl.DateTimeFormat(
        "es-AR",
        { hour: "2-digit", hour12: false, minute: "2-digit" },
      ).format(event.end)}.`,
    );
  }

  function drillDown(nextDate: Date, nextView: View) {
    setDate(nextDate);
    setView(isSpikeView(nextView) ? nextView : "day");
    setSelectionMessage(`Día seleccionado: ${formatSelection(nextDate).split(" a las")[0]}.`);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1500px] space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                TASK-002 · Spike descartable
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                React Big Calendar — evaluación técnica
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                Datos ficticios deterministas. Esta pantalla no crea turnos, no usa autenticación y
                no se conecta a Supabase.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
              Experimental
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <CalendarControls
            date={date}
            onNavigate={navigate}
            onToggleProfessional={toggleProfessional}
            onViewChange={changeView}
            professionals={PROFESSIONALS}
            selectedProfessionalIds={selectedProfessionalIds}
            view={view}
          />

          <div
            aria-live="polite"
            className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-950"
          >
            <strong>Resultado de interacción:</strong>{" "}
            <span data-testid="selection-result">{selectionMessage}</span>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500 sm:hidden">
            En mobile, desplazá horizontalmente la grilla para conservar columnas legibles.
          </p>

          <div className="rbc-spike mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className={`rbc-spike-canvas rbc-spike-${view}`} data-current-view={view}>
              <Calendar<MockAppointment, Professional>
                components={components}
                culture="es"
                date={date}
                dayLayoutAlgorithm="overlap"
                drilldownView="day"
                endAccessor="end"
                eventPropGetter={(event) => {
                  const professional = getProfessional(event.professionalId);
                  return {
                    className: `event-professional-${event.professionalId}`,
                    style: {
                      backgroundColor: professional.color,
                      borderColor: professional.color,
                    },
                  };
                }}
                events={view === "month" ? [] : appointments}
                formats={{
                  dayFormat: "eeee d/M",
                  dayHeaderFormat: "eeee d 'de' MMMM",
                  monthHeaderFormat: "MMMM yyyy",
                  timeGutterFormat: "HH:mm",
                  weekdayFormat: "eee",
                }}
                getNow={() => REFERENCE_DATE}
                localizer={calendarLocalizer}
                longPressThreshold={120}
                max={MAX_TIME}
                messages={CALENDAR_MESSAGES}
                min={MIN_TIME}
                onDrillDown={drillDown}
                onNavigate={setDate}
                onSelectEvent={selectEvent}
                onSelectSlot={selectSlot}
                onView={(nextView) => {
                  if (isSpikeView(nextView)) changeView(nextView);
                }}
                resourceAccessor="professionalId"
                resourceIdAccessor="id"
                resources={view === "day" ? resources : undefined}
                resourceTitleAccessor="name"
                scrollToTime={SCROLL_TIME}
                selectable="ignoreEvents"
                startAccessor="start"
                step={5}
                timeslots={6}
                titleAccessor="title"
                toolbar={false}
                view={view}
                views={["day", "week", "month"]}
              />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
