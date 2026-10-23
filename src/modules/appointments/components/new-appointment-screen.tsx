"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ModuleHeader, modulePrimaryActionClass } from "@/components/module-header";
import {
  createAppointmentAction,
  reconcileAppointmentCreateAction,
  searchAppointmentPatientsAction,
} from "../actions/appointment-actions";
import type { AppointmentFailure } from "../server/appointment-errors";
import { AppointmentFeedback } from "./appointment-feedback";
import { BookingSelector, type BookingChoice } from "./booking-selector";

type Patient = { patientCenterId: string; firstName: string; lastName: string };
type CreateIntent = {
  centerId: string;
  patientCenterId: string;
  professionalCenterId: string;
  specialtyId: string;
  localDate: string;
  startsAt: string;
  endsAt: string;
};
const buttonClass = modulePrimaryActionClass;

export function NewAppointmentScreen({
  centerId,
  timezone,
  initialPatient,
  initialBooking = null,
  initialBookingUnavailable = false,
}: {
  centerId: string;
  centerName: string;
  timezone: string;
  initialPatient: Patient | null;
  initialBooking?: {
    specialtyId: string;
    professionalCenterId: string;
    localDate: string;
    startsAt: string;
  } | null;
  initialBookingUnavailable?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [patientPage, setPatientPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [patientState, setPatientState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [choice, setChoice] = useState<BookingChoice | null>(null);
  const [selectorKey, setSelectorKey] = useState(0);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<AppointmentFailure | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const terminal = useRef(false);
  const searchId = useRef(0);
  const queryRef = useRef(query);
  const storageKey = `appointment-create-uncertain:${centerId}`;
  const intent = useRef<CreateIntent | null>(null);

  useEffect(() => {
    let active = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as CreateIntent;
        if (parsed.centerId === centerId) {
          intent.current = parsed;
          queueMicrotask(() => {
            if (active) setUncertain(true);
          });
        }
      }
    } catch {
      // The form remains blocked for the current mount if storage is unavailable.
    }
    return () => {
      active = false;
    };
  }, [centerId, storageKey]);

  function invalidateSearch(value: string) {
    queryRef.current = value;
    searchId.current++;
    setQuery(value);
    setPatients([]);
    setPatientPage(1);
    setHasNext(false);
    setPatientState("idle");
  }

  async function search(page = 1) {
    const requestId = ++searchId.current;
    const searchedQuery = queryRef.current;
    setPatientState("loading");
    try {
      const result = await searchAppointmentPatientsAction({
        centerId,
        query: searchedQuery,
        page,
      });
      if (requestId !== searchId.current || searchedQuery !== queryRef.current) return;
      if (result.status !== "SUCCESS") {
        setPatientState("error");
        return;
      }
      setPatients(result.data.rows);
      setPatientPage(page);
      setHasNext(result.data.hasNext);
      setPatientState("ready");
    } catch {
      if (requestId === searchId.current && searchedQuery === queryRef.current)
        setPatientState("error");
    }
  }
  async function reconcile() {
    if (!intent.current || checking) return;
    setChecking(true);
    try {
      const result = await reconcileAppointmentCreateAction(intent.current);
      if (result.status === "SUCCESS" && result.data.kind === "MATCH") {
        setMatchId(result.data.appointmentId);
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // A failed read cannot establish that CREATE did not commit.
    } finally {
      setChecking(false);
    }
  }
  async function create() {
    if (!patient || !choice || inFlight.current || terminal.current || uncertain) return;
    inFlight.current = true;
    const proposed: CreateIntent = {
      centerId,
      patientCenterId: patient.patientCenterId,
      professionalCenterId: choice.professionalCenterId,
      specialtyId: choice.specialtyId,
      localDate: choice.localDate,
      startsAt: choice.startsAt,
      endsAt: choice.endsAt,
    };
    intent.current = proposed;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(proposed));
    } catch {
      /* local lock remains */
    }
    setPending(true);
    setFeedback(null);
    try {
      const result = await createAppointmentAction({
        centerId,
        patientCenterId: patient.patientCenterId,
        specialtyId: choice.specialtyId,
        professionalCenterId: choice.professionalCenterId,
        localDate: choice.localDate,
        localStartTime: choice.localStartTime,
        administrativeNote: note,
      });
      if (result.status === "SUCCESS") {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* navigation remains terminal */
        }
        terminal.current = true;
        setCompleted(true);
        router.push(`/centers/${centerId}/appointments/${result.data.appointment_id}`);
        return;
      }
      setFeedback(result);
      if (result.status === "UNKNOWN_RESULT" || result.status === "UNEXPECTED_ERROR") {
        setUncertain(true);
      } else {
        intent.current = null;
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* no persistent storage */
        }
      }
      if (
        result.status === "BUSINESS_ERROR" &&
        [
          "SLOT_ALREADY_TAKEN",
          "OUTSIDE_AVAILABILITY",
          "INVALID_LOCAL_TIME",
          "AMBIGUOUS_LOCAL_TIME",
        ].includes(result.code)
      ) {
        setChoice(null);
        setSelectorKey((value) => value + 1);
      }
    } catch {
      setUncertain(true);
      setFeedback({ status: "UNKNOWN_RESULT", reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY" });
    } finally {
      setPending(false);
      if (!terminal.current) inFlight.current = false;
    }
  }
  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <ModuleHeader
          centerId={centerId}
          title="Crear turno"
          description="Seleccioná el paciente, el profesional y un horario disponible."
          parent={{ label: "Turnos", href: `/centers/${centerId}/appointments` }}
        />
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="w-full max-w-[800px]">
            <h2 className="text-xl font-semibold text-slate-900">1. Paciente</h2>
            {patient ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p>
                  Seleccionado:{" "}
                  <strong>
                    {patient.firstName} {patient.lastName}
                  </strong>
                </p>
                <button
                  type="button"
                  className="font-semibold text-sky-700 underline"
                  onClick={() => setPatient(null)}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <form
                  className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void search();
                  }}
                >
                  <label className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                    Buscar paciente activo
                    <input
                      className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                      value={query}
                      onChange={(event) => invalidateSearch(event.target.value)}
                      maxLength={100}
                      type="search"
                    />
                  </label>
                  <button
                    className={`${buttonClass} h-11 w-full sm:w-auto`}
                    type="submit"
                    disabled={patientState === "loading"}
                  >
                    Buscar
                  </button>
                </form>
                {patientState === "loading" && <p role="status">Buscando pacientes…</p>}
                {patientState === "error" && (
                  <p role="alert" className="text-red-700">
                    No pudimos buscar pacientes. Intentá de nuevo.
                  </p>
                )}
                {patientState === "ready" &&
                  (patients.length ? (
                    <ul className="mt-3 space-y-2">
                      {patients.map((item) => (
                        <li
                          key={item.patientCenterId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
                        >
                          <span>
                            {item.firstName} {item.lastName}
                          </span>
                          <button
                            type="button"
                            className="font-semibold text-sky-700 underline"
                            onClick={() => setPatient(item)}
                          >
                            Seleccionar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3">No encontramos pacientes activos.</p>
                  ))}
                {patientState === "ready" && hasNext && (
                  <button
                    type="button"
                    className="mt-3 font-semibold text-sky-700 underline"
                    onClick={() => void search(patientPage + 1)}
                  >
                    Siguiente página de pacientes
                  </button>
                )}
                <Link
                  className="mt-4 inline-block font-semibold text-sky-700 underline"
                  href={`/centers/${centerId}/patients?from=appointment`}
                >
                  Registrar o reactivar paciente
                </Link>
              </>
            )}
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="w-full max-w-[800px]">
            <h2 className="text-xl font-semibold text-slate-900">
              2. Especialidad, profesional y horario
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Elegí un horario ofrecido por el centro. La disponibilidad se confirma al crear.
            </p>
            {initialBookingUnavailable && (
              <p role="alert" className="mt-2 text-sm text-amber-900">
                El horario elegido desde la Agenda ya no está disponible. Elegí otro horario.
              </p>
            )}
            <div className="mt-4">
              <BookingSelector
                key={selectorKey}
                centerId={centerId}
                timezone={timezone}
                onChange={setChoice}
                initial={initialBooking ?? undefined}
              />
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="w-full max-w-[800px]">
            <h2 className="text-xl font-semibold text-slate-900">
              3. Nota administrativa opcional
            </h2>
            <label className="mt-3 block text-sm font-semibold text-slate-800">
              Nota
              <textarea
                className="mt-1 min-h-28 w-full rounded-md border border-slate-300 p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                value={note}
                onChange={(event) => {
                  if (Array.from(event.target.value).length <= 2000) setNote(event.target.value);
                }}
              />
            </label>
            <p className="text-sm text-slate-600">
              {Array.from(note).length}/2.000 caracteres. No registrar información clínica.
            </p>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="w-full max-w-[800px]">
            <h2 className="text-xl font-semibold text-slate-900">4. Resumen</h2>
            {patient && choice ? (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 [&>div]:rounded-lg [&>div]:border [&>div]:border-slate-200 [&>div]:bg-slate-50 [&>div]:px-3 [&>div]:py-2">
                <div>
                  <dt className="font-semibold">Paciente</dt>
                  <dd>
                    {patient.firstName} {patient.lastName}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Especialidad</dt>
                  <dd>{choice.specialtyName}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Profesional</dt>
                  <dd>{choice.professionalName}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Fecha local</dt>
                  <dd>{choice.localDate}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Horario</dt>
                  <dd>
                    {choice.localStartTime}–{choice.localEndTime}
                    {choice.localEndDate !== choice.localDate ? ` (${choice.localEndDate})` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Duración</dt>
                  <dd>{choice.duration} minutos</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold">Nota</dt>
                  <dd>{note || "Sin nota"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-slate-600">
                Seleccioná paciente y horario para revisar el turno.
              </p>
            )}
            <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
              <AppointmentFeedback result={feedback} />
              {uncertain && (
                <div className="space-y-2" role="status">
                  <p>
                    El resultado de esta reserva sigue sin confirmarse. Verificá el turno propuesto;
                    no vuelvas a crear desde este formulario.
                  </p>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={checking}
                    onClick={() => void reconcile()}
                  >
                    {checking ? "Verificando…" : "Verificar turno propuesto"}
                  </button>
                  {matchId ? (
                    <p>
                      Se encontró un turno coincidente.{" "}
                      <Link
                        className="font-semibold text-sky-700 underline"
                        href={`/centers/${centerId}/appointments/${matchId}`}
                      >
                        Ver detalle
                      </Link>
                    </p>
                  ) : (
                    <p>
                      Si la verificación no encuentra un turno, el resultado sigue siendo
                      indeterminado. Solicitá una comprobación administrativa antes de otro intento.
                    </p>
                  )}
                </div>
              )}
              <div className="flex justify-center">
                <button
                  type="button"
                  className={`${buttonClass} w-full sm:w-auto`}
                  disabled={!patient || !choice || pending || uncertain || completed}
                  onClick={() => void create()}
                >
                  {pending ? "Creando…" : completed ? "Turno creado" : "Confirmar y crear turno"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
