"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ModuleHeader, moduleSecondaryActionClass } from "@/components/module-header";
import {
  rescheduleAppointmentAction,
  transitionAppointmentStatusAction,
  updateAppointmentNoteAction,
  type AppointmentActionResult,
} from "../actions/appointment-actions";
import type { AppointmentFailure } from "../server/appointment-errors";
import type { ProfessionalAppointment, StaffAppointment } from "../server/appointment-rpc";
import {
  appointmentLocalParts,
  appointmentHasAmbiguousLocalTime,
  appointmentTimezoneLabel,
  readableCivilDate,
} from "../search/appointment-search";
import { appointmentStatusClass, appointmentStatusLabels } from "./appointments-list";
import { AppointmentFeedback } from "./appointment-feedback";
import { BookingSelector, type BookingChoice } from "./booking-selector";

type StaffDetail = { kind: "STAFF"; appointment: StaffAppointment };
type ProfessionalDetail = { kind: "PROFESSIONAL"; appointment: ProfessionalAppointment };
type Detail = StaffDetail | ProfessionalDetail;
const buttonClass =
  "min-h-11 cursor-pointer rounded-md bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "min-h-11 cursor-pointer rounded-md border border-sky-700 px-4 py-2 font-semibold text-sky-800 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50";
const dangerClass =
  "min-h-11 cursor-pointer rounded-md border border-red-300 px-4 py-2 font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50";

function Details({
  appointment,
  timezone,
  staff,
}: {
  appointment: ProfessionalAppointment | StaffAppointment;
  timezone: string;
  staff: boolean;
}) {
  const start = appointmentLocalParts(appointment.starts_at, timezone);
  const end = appointmentLocalParts(appointment.ends_at, timezone);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600">Paciente</p>
          <h2 className="text-2xl font-bold text-slate-950">
            {appointment.patient_first_name} {appointment.patient_last_name}
          </h2>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${appointmentStatusClass[appointment.status]}`}
        >
          {appointmentStatusLabels[appointment.status]}
        </span>
      </div>
      <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-slate-600">Fecha</p>
          <p className="text-lg font-semibold text-slate-950">{readableCivilDate(start.date)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">Horario</p>
          <p className="text-lg font-semibold text-slate-950">
            {start.time}–{end.time}
            {end.date !== start.date ? ` (${readableCivilDate(end.date)})` : ""}
          </p>
          {appointmentHasAmbiguousLocalTime(appointment.starts_at, timezone) && (
            <p className="text-xs text-slate-600">
              {appointmentTimezoneLabel(appointment.starts_at, timezone)}
            </p>
          )}
        </div>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-700">Especialidad</dt>
          <dd className="text-slate-950">{appointment.specialty_name}</dd>
        </div>
        {staff && "professional_first_name" in appointment && (
          <div>
            <dt className="font-semibold text-slate-700">Profesional</dt>
            <dd className="text-slate-950">
              {appointment.professional_first_name} {appointment.professional_last_name}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function availableTransitions(status: ProfessionalAppointment["status"], staff: boolean) {
  if (status !== "PENDING" && status !== "CONFIRMED") return [];
  return staff
    ? [
        ...(status === "PENDING" ? ["CONFIRMED" as const] : []),
        "ATTENDED" as const,
        "NO_SHOW" as const,
        "CANCELLED" as const,
      ]
    : (["ATTENDED", "NO_SHOW"] as const);
}

function AppointmentDetailBody({
  centerId,
  timezone,
  detail,
  outsideAvailability,
}: {
  centerId: string;
  centerName: string;
  timezone: string;
  detail: Detail;
  outsideAvailability: boolean | null;
}) {
  const router = useRouter();
  const [appointment, setAppointment] = useState(detail.appointment);
  const [note, setNote] = useState(
    detail.kind === "STAFF" ? detail.appointment.administrative_note : null,
  );
  const [editingNote, setEditingNote] = useState(false);
  const [feedback, setFeedback] = useState<AppointmentFailure | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [discardSchedule, setDiscardSchedule] = useState(false);
  const [choice, setChoice] = useState<BookingChoice | null>(null);
  const inFlight = useRef(false);
  const scheduleDialog = useRef<HTMLDialogElement>(null);
  const scheduleTrigger = useRef<HTMLButtonElement>(null);
  const staff = detail.kind === "STAFF";
  const base = `/centers/${centerId}/appointments`;

  useEffect(() => {
    const dialog = scheduleDialog.current;
    if (!editingSchedule || !dialog) return;
    const trigger = scheduleTrigger.current;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("h2")?.focus();
    return () => {
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, [editingSchedule]);
  useEffect(() => {
    if (editingSchedule && scheduleDialog.current?.open)
      scheduleDialog.current.querySelector<HTMLElement>("h2")?.focus();
  }, [editingSchedule, discardSchedule]);

  async function execute<T>(
    work: () => Promise<AppointmentActionResult<T>>,
    complete: (data: T) => void,
    message: string,
  ) {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setPending(true);
    setFeedback(null);
    setNotice("");
    try {
      const result = await work();
      if (result.status === "SUCCESS") {
        complete(result.data);
        setNotice(message);
        router.refresh();
      } else {
        setFeedback(result);
        if (
          result.status === "UNKNOWN_RESULT" ||
          result.status === "UNEXPECTED_ERROR" ||
          (result.status === "BUSINESS_ERROR" && result.code === "STALE_APPOINTMENT_STATE")
        )
          setBlocked(true);
      }
    } catch {
      setFeedback({ status: "UNKNOWN_RESULT", reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY" });
      setBlocked(true);
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }
  function changeStatus(requestedStatus: "CONFIRMED" | "ATTENDED" | "NO_SHOW" | "CANCELLED") {
    const confirmation = {
      CONFIRMED: null,
      ATTENDED: "¿Marcar este turno como atendido? Esta acción no se puede deshacer.",
      NO_SHOW: "¿Marcar este turno como ausente? Esta acción no se puede deshacer.",
      CANCELLED: "¿Cancelar este turno? El horario volverá a estar disponible.",
    }[requestedStatus];
    if (confirmation && !window.confirm(confirmation)) return;
    void execute(
      () =>
        transitionAppointmentStatusAction({
          centerId,
          appointmentId: appointment.appointment_id,
          expectedUpdatedAt: appointment.updated_at,
          requestedStatus,
        }),
      (data) =>
        setAppointment((current) => ({
          ...current,
          status: data.status,
          updated_at: data.updated_at,
        })),
      "Estado actualizado.",
    );
  }
  function saveNote(value: string | null) {
    if (!staff) return;
    void execute(
      () =>
        updateAppointmentNoteAction({
          centerId,
          appointmentId: appointment.appointment_id,
          expectedUpdatedAt: appointment.updated_at,
          administrativeNote: value,
        }),
      (data) => {
        setAppointment((current) => ({
          ...current,
          updated_at: data.updated_at,
          administrative_note: value,
        }));
        setNote(value);
        setEditingNote(false);
      },
      "Nota guardada.",
    );
  }
  function reschedule() {
    if (!staff || !choice) return;
    void execute(
      () =>
        rescheduleAppointmentAction({
          centerId,
          appointmentId: appointment.appointment_id,
          expectedUpdatedAt: appointment.updated_at,
          specialtyId: choice.specialtyId,
          professionalCenterId: choice.professionalCenterId,
          localDate: choice.localDate,
          localStartTime: choice.localStartTime,
        }),
      (data) => {
        setAppointment(
          (current) =>
            ({
              ...current,
              specialty_id: data.specialty_id,
              professional_center_id: data.professional_center_id,
              starts_at: data.starts_at,
              ends_at: data.ends_at,
              updated_at: data.updated_at,
            }) as StaffAppointment,
        );
        setEditingSchedule(false);
        setScheduleDirty(false);
        setDiscardSchedule(false);
        setChoice(null);
      },
      "Turno reprogramado.",
    );
  }
  const initialDate = appointmentLocalParts(appointment.starts_at, timezone).date;
  const noteDirty =
    note !== ("administrative_note" in appointment ? appointment.administrative_note : null);
  const actions = availableTransitions(appointment.status, staff);
  useEffect(() => {
    if (!editingNote || !noteDirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    const protectLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
      if (window.confirm("¿Descartar los cambios de la nota?")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", protectLink, true);
    return () => {
      window.removeEventListener("beforeunload", protectDraft);
      document.removeEventListener("click", protectLink, true);
    };
  }, [editingNote, noteDirty]);
  function closeNote() {
    if (noteDirty && !window.confirm("¿Descartar los cambios de la nota?")) return;
    setNote("administrative_note" in appointment ? appointment.administrative_note : null);
    setEditingNote(false);
  }
  function closeSchedule() {
    if (pending) return;
    if (scheduleDirty || choice) {
      setDiscardSchedule(true);
      return;
    }
    setEditingSchedule(false);
    setChoice(null);
  }
  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <ModuleHeader
          centerId={centerId}
          title="Detalle del turno"
          description="Consultá los datos y el estado del turno."
          parent={{ label: "Turnos", href: base }}
          actions={
            <Link
              className={`${moduleSecondaryActionClass} cursor-pointer hover:border-sky-600 hover:text-sky-800`}
              href={base}
            >
              Volver a turnos
            </Link>
          }
        />
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="sr-only">Datos del turno</h2>
          <Details appointment={appointment} timezone={timezone} staff={staff} />
          {staff && outsideAvailability && (
            <p
              role="status"
              className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-amber-900"
            >
              Este turno futuro está fuera de la disponibilidad actual o su profesional ya no está
              activo. Conserva su fecha y estado hasta que lo gestiones.
            </p>
          )}
          {staff && outsideAvailability === null && (
            <p
              role="status"
              className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-amber-900"
            >
              No pudimos verificar la disponibilidad actual de este turno. Recargá el detalle para
              comprobarla.
            </p>
          )}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-slate-900">Acciones del turno</h2>
          <div
            className={`mt-4 grid gap-2 sm:flex sm:flex-wrap ${actions.length <= 1 ? "grid-cols-1" : "grid-cols-2"}`}
          >
            {actions.map((status, index) => (
              <button
                type="button"
                key={status}
                className={`${
                  status === "CONFIRMED"
                    ? buttonClass
                    : status === "CANCELLED"
                      ? dangerClass
                      : secondaryClass
                } min-w-0 w-full text-sm leading-tight sm:w-auto sm:text-base ${actions.length === 3 && index === 0 ? "col-span-2 sm:col-auto" : ""}`}
                disabled={pending || blocked || (editingNote && noteDirty)}
                onClick={() => changeStatus(status)}
              >
                {status === "CONFIRMED"
                  ? "Confirmar"
                  : status === "ATTENDED"
                    ? "Marcar atendido"
                    : status === "NO_SHOW"
                      ? "Marcar ausente"
                      : "Cancelar turno"}
              </button>
            ))}
          </div>
          {editingNote && noteDirty && (
            <p className="mt-3 text-sm text-slate-600">
              Guardá o cancelá la edición de la nota para cambiar el estado.
            </p>
          )}
          {actions.length === 0 && (
            <p className="mt-2 text-slate-600">
              El estado es terminal; no permite nuevas transiciones.
            </p>
          )}
        </section>
        {staff && "administrative_note" in appointment && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">Nota administrativa</h2>
            {editingNote ? (
              <>
                <label className="mt-3 block text-sm font-semibold text-slate-800">
                  Editar nota
                  <textarea
                    className="mt-1 min-h-28 w-full rounded border border-slate-300 p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                    value={note ?? ""}
                    onChange={(event) => {
                      if (Array.from(event.target.value).length <= 2000)
                        setNote(event.target.value);
                    }}
                    disabled={pending || blocked}
                  />
                </label>
                <p className="text-sm text-slate-600">
                  {Array.from(note ?? "").length}/2.000 caracteres. No registrar información
                  clínica.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={pending || blocked || !noteDirty}
                    onClick={() => saveNote(note ?? "")}
                  >
                    Guardar nota
                  </button>
                  <button
                    type="button"
                    className={secondaryClass}
                    disabled={pending}
                    onClick={closeNote}
                  >
                    Cancelar edición
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 whitespace-pre-wrap break-words text-slate-800">
                  {appointment.administrative_note === null ||
                  appointment.administrative_note === ""
                    ? "Sin nota administrativa."
                    : appointment.administrative_note}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondaryClass}
                    disabled={pending || blocked}
                    onClick={() => {
                      setNote(appointment.administrative_note ?? "");
                      setEditingNote(true);
                    }}
                  >
                    {appointment.administrative_note === null ||
                    appointment.administrative_note === ""
                      ? "Agregar nota"
                      : "Editar nota"}
                  </button>
                  {appointment.administrative_note !== null &&
                    appointment.administrative_note !== "" && (
                      <button
                        type="button"
                        className={dangerClass}
                        disabled={pending || blocked}
                        onClick={() => {
                          if (window.confirm("¿Eliminar la nota administrativa?")) saveNote(null);
                        }}
                      >
                        Eliminar nota
                      </button>
                    )}
                </div>
              </>
            )}
          </section>
        )}
        {staff &&
          "specialty_id" in appointment &&
          (appointment.status === "PENDING" || appointment.status === "CONFIRMED") && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-slate-900">Reprogramar</h2>
              <p className="mt-1 text-sm text-slate-600">
                Elegí otro horario. El paciente, el estado y la nota se conservan.
              </p>
              <button
                ref={scheduleTrigger}
                type="button"
                className={`${secondaryClass} mt-3`}
                disabled={pending || blocked || (editingNote && noteDirty)}
                onClick={() => setEditingSchedule(true)}
              >
                Elegir nuevo horario
              </button>
              {editingSchedule && (
                <dialog
                  ref={scheduleDialog}
                  aria-labelledby="reschedule-title"
                  aria-describedby="reschedule-description"
                  onCancel={(event) => {
                    event.preventDefault();
                    if (discardSchedule) setDiscardSchedule(false);
                    else closeSchedule();
                  }}
                  className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/50"
                >
                  {discardSchedule ? (
                    <div className="p-5 sm:p-6">
                      <h2
                        id="reschedule-title"
                        tabIndex={-1}
                        className="text-xl font-semibold text-slate-950"
                      >
                        ¿Descartar cambios?
                      </h2>
                      <p id="reschedule-description" className="mt-2 text-slate-700">
                        Se perderá la selección del nuevo horario.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryClass}
                          onClick={() => setDiscardSchedule(false)}
                        >
                          Seguir editando
                        </button>
                        <button
                          type="button"
                          className={dangerClass}
                          onClick={() => {
                            setEditingSchedule(false);
                            setDiscardSchedule(false);
                            setScheduleDirty(false);
                            setChoice(null);
                          }}
                        >
                          Descartar cambios
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5 p-5 sm:p-6">
                      <div>
                        <h2
                          id="reschedule-title"
                          tabIndex={-1}
                          className="text-xl font-semibold text-slate-950"
                        >
                          Reprogramar turno
                        </h2>
                        <p id="reschedule-description" className="mt-1 text-sm text-slate-700">
                          {appointment.patient_first_name} {appointment.patient_last_name} ·{" "}
                          {readableCivilDate(initialDate)}. Elegí el nuevo horario.
                        </p>
                      </div>
                      <BookingSelector
                        centerId={centerId}
                        timezone={timezone}
                        onChange={setChoice}
                        onInteraction={() => setScheduleDirty(true)}
                        stabilizeInitialLoad
                        initial={{
                          specialtyId: appointment.specialty_id,
                          professionalCenterId: appointment.professional_center_id,
                          localDate: initialDate,
                        }}
                      />
                      {choice ? (
                        <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-950">
                          Nuevo horario: {readableCivilDate(choice.localDate)}{" "}
                          {choice.localStartTime}–{choice.localEndTime}. {choice.duration} minutos.
                          {choice.displayOffset ? ` ${choice.displayOffset}.` : ""}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-600">
                          Seleccioná un horario disponible para guardar.
                        </p>
                      )}
                      <AppointmentFeedback result={feedback} />
                      {blocked && (
                        <button
                          type="button"
                          className={secondaryClass}
                          onClick={() => window.location.reload()}
                        >
                          Recargar y verificar el turno
                        </button>
                      )}
                      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap gap-2 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-4px_12px_-8px_rgba(15,23,42,0.3)] sm:-mx-6 sm:-mb-6 sm:px-6">
                        <button
                          type="button"
                          className={`${buttonClass} w-full sm:w-auto`}
                          disabled={!choice || pending || blocked}
                          onClick={reschedule}
                        >
                          Guardar reprogramación
                        </button>
                        <button
                          type="button"
                          className={`${secondaryClass} w-full sm:w-auto`}
                          disabled={pending}
                          onClick={closeSchedule}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </dialog>
              )}
            </section>
          )}
        <div aria-live="polite" className="space-y-3">
          {notice && (
            <p
              role="status"
              className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"
            >
              {notice}
            </p>
          )}
          {!editingSchedule && <AppointmentFeedback result={feedback} />}
          {blocked && !editingSchedule && (
            <button
              type="button"
              className={secondaryClass}
              onClick={() => window.location.reload()}
            >
              Recargar y verificar el turno
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export function AppointmentDetailScreen(props: {
  centerId: string;
  centerName: string;
  timezone: string;
  detail: Detail;
  outsideAvailability: boolean | null;
}) {
  return <AppointmentDetailBody {...props} />;
}
