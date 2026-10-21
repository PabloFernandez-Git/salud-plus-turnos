"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ModuleHeader } from "@/components/module-header";
import {
  rescheduleAppointmentAction,
  transitionAppointmentStatusAction,
  updateAppointmentNoteAction,
  type AppointmentActionResult,
} from "../actions/appointment-actions";
import type { AppointmentFailure } from "../server/appointment-errors";
import type { ProfessionalAppointment, StaffAppointment } from "../server/appointment-rpc";
import { appointmentLocalParts } from "../search/appointment-search";
import { appointmentStatusLabels } from "./appointments-list";
import { AppointmentFeedback } from "./appointment-feedback";
import { BookingSelector, type BookingChoice } from "./booking-selector";

type StaffDetail = { kind: "STAFF"; appointment: StaffAppointment };
type ProfessionalDetail = { kind: "PROFESSIONAL"; appointment: ProfessionalAppointment };
type Detail = StaffDetail | ProfessionalDetail;
const buttonClass =
  "min-h-11 rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50";
const secondaryClass =
  "min-h-11 rounded-md border border-sky-700 px-4 py-2 font-semibold text-sky-800 disabled:opacity-50";

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
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="font-semibold text-slate-800">Paciente</dt>
        <dd>
          {appointment.patient_first_name} {appointment.patient_last_name}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-slate-800">Especialidad</dt>
        <dd>{appointment.specialty_name}</dd>
      </div>
      {staff && "professional_first_name" in appointment && (
        <div>
          <dt className="font-semibold text-slate-800">Profesional</dt>
          <dd>
            {appointment.professional_first_name} {appointment.professional_last_name}
          </dd>
        </div>
      )}
      <div>
        <dt className="font-semibold text-slate-800">Fecha local</dt>
        <dd>{start.date}</dd>
      </div>
      <div>
        <dt className="font-semibold text-slate-800">Horario</dt>
        <dd>
          {start.time}–{end.time}
          {end.date !== start.date ? ` (${end.date})` : ""}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-slate-800">Estado</dt>
        <dd>{appointmentStatusLabels[appointment.status]}</dd>
      </div>
    </dl>
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
  const [feedback, setFeedback] = useState<AppointmentFailure | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [choice, setChoice] = useState<BookingChoice | null>(null);
  const inFlight = useRef(false);
  const staff = detail.kind === "STAFF";
  const base = `/centers/${centerId}/appointments`;

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
    if (
      requestedStatus === "CANCELLED" &&
      !window.confirm("¿Cancelar este turno? El horario volverá a estar disponible.")
    )
      return;
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
        setAppointment((current) => ({ ...current, updated_at: data.updated_at }));
        setNote(value);
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
      },
      "Turno reprogramado.",
    );
  }
  const initialDate = appointmentLocalParts(appointment.starts_at, timezone).date;
  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1400px] space-y-6 [&>section]:max-w-4xl">
        <ModuleHeader
          centerId={centerId}
          title="Detalle del turno"
          description={`Consultá los datos y el estado del turno. Horarios en la zona del centro: ${timezone}.`}
          parent={{ label: "Turnos", href: base }}
        />
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Datos del turno</h2>
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
          <h2 className="text-xl font-semibold text-slate-900">Estado</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {availableTransitions(appointment.status, staff).map((status) => (
              <button
                type="button"
                key={status}
                className={status === "CANCELLED" ? secondaryClass : buttonClass}
                disabled={pending || blocked}
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
          {availableTransitions(appointment.status, staff).length === 0 && (
            <p className="mt-2 text-slate-600">
              El estado es terminal; no permite nuevas transiciones.
            </p>
          )}
        </section>
        {staff && "administrative_note" in appointment && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">Nota administrativa</h2>
            <p className="mt-2 text-sm text-slate-600">
              {appointment.administrative_note === null
                ? "Sin nota (NULL)."
                : appointment.administrative_note === ""
                  ? "Nota vacía."
                  : "Nota actual guardada."}
            </p>
            <label className="mt-3 block text-sm font-semibold text-slate-800">
              Editar nota
              <textarea
                className="mt-1 min-h-28 w-full rounded border border-slate-300 p-3"
                value={note ?? ""}
                onChange={(event) => {
                  if (Array.from(event.target.value).length <= 2000) setNote(event.target.value);
                }}
                disabled={pending || blocked}
              />
            </label>
            <p className="text-sm text-slate-600">
              {Array.from(note ?? "").length}/2.000 caracteres. No registrar información clínica.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={pending || blocked}
                onClick={() => saveNote(note ?? "")}
              >
                Guardar nota
              </button>
              <button
                type="button"
                className={secondaryClass}
                disabled={pending || blocked}
                onClick={() => saveNote(null)}
              >
                Quitar nota (NULL)
              </button>
            </div>
          </section>
        )}
        {staff &&
          "specialty_id" in appointment &&
          (appointment.status === "PENDING" || appointment.status === "CONFIRMED") && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-slate-900">Reprogramar</h2>
              <p className="mt-1 text-sm text-slate-600">
                Se conserva el paciente, el estado y la nota. Elegí un destino vigente.
              </p>
              {editingSchedule ? (
                <div className="mt-4 space-y-4">
                  <BookingSelector
                    centerId={centerId}
                    timezone={timezone}
                    onChange={setChoice}
                    initial={{
                      specialtyId: appointment.specialty_id,
                      professionalCenterId: appointment.professional_center_id,
                      localDate: initialDate,
                    }}
                  />
                  {choice && (
                    <p className="text-sm text-slate-700">
                      Nuevo horario: {choice.localDate} {choice.localStartTime}–
                      {choice.localEndTime}. {choice.duration} minutos.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={!choice || pending || blocked}
                      onClick={reschedule}
                    >
                      Guardar reprogramación
                    </button>
                    <button
                      type="button"
                      className={secondaryClass}
                      disabled={pending}
                      onClick={() => {
                        setEditingSchedule(false);
                        setChoice(null);
                      }}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${secondaryClass} mt-3`}
                  disabled={pending || blocked}
                  onClick={() => setEditingSchedule(true)}
                >
                  Elegir nuevo horario
                </button>
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
