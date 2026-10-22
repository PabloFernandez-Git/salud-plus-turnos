"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { centerWallTime } from "@/modules/agenda/agenda-search";
import {
  loadPatientAppointmentPageAction,
  loadPatientAppointmentSectionsAction,
} from "../actions/patient-appointment-actions";
import type { PatientAppointmentSection } from "../api/patient-appointment-rpc";
import type { PatientAppointmentPage } from "../server/patient-appointments";

type SectionState = { page: PatientAppointmentPage; error: boolean; loading: boolean };
type Sections = Record<PatientAppointmentSection, SectionState>;
const emptyPage = (): PatientAppointmentPage => ({ rows: [], hasMore: false, nextCursor: null });
const emptySections = (): Sections => ({
  UPCOMING: { page: emptyPage(), error: false, loading: false },
  HISTORY: { page: emptyPage(), error: false, loading: false },
});
const labels = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  ATTENDED: "Atendido",
  CANCELLED: "Cancelado",
  NO_SHOW: "Ausente",
} as const;

function localDate(value: string) {
  return value.split("-").reverse().join("/");
}

export function patientAppointmentTime(startsAt: string, endsAt: string, timezone: string) {
  const start = centerWallTime(startsAt, timezone);
  const end = centerWallTime(endsAt, timezone);
  const hours =
    start.offsetLabel === end.offsetLabel
      ? `${start.localTime}–${end.localTime} ${start.offsetLabel}`
      : `${start.localTime} ${start.offsetLabel}–${end.localTime} ${end.offsetLabel}`;
  return `${localDate(start.localDate)} · ${hours}${start.localDate !== end.localDate ? ` (${localDate(end.localDate)})` : ""}`;
}

export function PatientAppointments({
  centerId,
  patientCenterId,
  timezone,
}: {
  centerId: string;
  patientCenterId: string;
  timezone: string;
}) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${centerId}:${patientCenterId}:${revision}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [initialError, setInitialError] = useState(false);
  const [sections, setSections] = useState<Sections>(emptySections);
  const generation = useRef(0);
  const inFlight = useRef<Record<PatientAppointmentSection, boolean>>({
    UPCOMING: false,
    HISTORY: false,
  });

  useEffect(() => {
    const current = ++generation.current;
    let active = true;
    inFlight.current = { UPCOMING: false, HISTORY: false };
    void loadPatientAppointmentSectionsAction({ centerId, patientCenterId })
      .then((result) => {
        if (!active || generation.current !== current) return;
        if (result.status === "error") {
          setInitialError(true);
          return;
        }
        setInitialError(false);
        setAsOf(result.data.asOf);
        setSections({
          UPCOMING: {
            page: result.data.upcoming ?? emptyPage(),
            error: !result.data.upcoming,
            loading: false,
          },
          HISTORY: {
            page: result.data.history ?? emptyPage(),
            error: !result.data.history,
            loading: false,
          },
        });
      })
      .catch(() => {
        if (active && generation.current === current) setInitialError(true);
      })
      .finally(() => {
        if (active && generation.current === current) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [centerId, patientCenterId, requestKey]);

  async function loadMore(section: PatientAppointmentSection) {
    const state = sections[section];
    if (
      loadedKey !== requestKey ||
      !asOf ||
      inFlight.current[section] ||
      (!state.error && (!state.page.hasMore || !state.page.nextCursor))
    )
      return;
    inFlight.current[section] = true;
    const current = generation.current;
    const cursor = state.page.rows.length ? state.page.nextCursor : null;
    setSections((previous) => ({
      ...previous,
      [section]: { ...previous[section], loading: true, error: false },
    }));
    try {
      const result = await loadPatientAppointmentPageAction({
        centerId,
        patientCenterId,
        section,
        asOf,
        cursor,
      });
      if (generation.current !== current) return;
      if (result.status === "error") {
        setSections((previous) => ({
          ...previous,
          [section]: { ...previous[section], error: true, loading: false },
        }));
        return;
      }
      setSections((previous) => ({
        ...previous,
        [section]: {
          page: {
            rows: cursor ? [...previous[section].page.rows, ...result.data.rows] : result.data.rows,
            hasMore: result.data.hasMore,
            nextCursor: result.data.nextCursor,
          },
          error: false,
          loading: false,
        },
      }));
    } catch {
      if (generation.current === current)
        setSections((previous) => ({
          ...previous,
          [section]: { ...previous[section], error: true, loading: false },
        }));
    } finally {
      if (generation.current === current) inFlight.current[section] = false;
    }
  }

  if (loadedKey !== requestKey)
    return (
      <p aria-live="polite" className="text-sm text-slate-600">
        Cargando turnos…
      </p>
    );
  if (initialError)
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
        <p>No pudimos cargar los turnos de este paciente.</p>
        <button
          className="mt-2 min-h-11 font-semibold text-sky-700 underline"
          onClick={() => setRevision((value) => value + 1)}
          type="button"
        >
          Reintentar
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-950">Turnos del paciente</h3>
        <button
          className="ml-auto min-h-10 rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          onClick={() => setRevision((value) => value + 1)}
          type="button"
        >
          Actualizar turnos
        </button>
      </div>
      {(["UPCOMING", "HISTORY"] as const).map((section) => {
        const state = sections[section];
        return (
          <section
            aria-label={section === "UPCOMING" ? "Próximos turnos" : "Historial"}
            className="rounded-xl border border-slate-200 bg-white p-4"
            key={section}
          >
            <h4 className="font-semibold text-slate-900">
              {section === "UPCOMING" ? "Próximos turnos" : "Historial"}
            </h4>
            {state.page.rows.length === 0 && !state.error ? (
              <p className="mt-3 text-sm text-slate-600">
                {section === "UPCOMING"
                  ? "No hay próximos turnos para este paciente."
                  : "Este paciente todavía no tiene turnos en el historial."}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {state.page.rows.map((row) => (
                  <li className="rounded-lg border border-slate-200 p-3" key={row.appointment_id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {patientAppointmentTime(row.starts_at, row.ends_at, timezone)}
                        </p>
                        <p className="text-sm text-slate-700">
                          {row.professional_first_name} {row.professional_last_name} ·{" "}
                          {row.specialty_name}
                        </p>
                        <p className="text-xs font-medium text-slate-600">{labels[row.status]}</p>
                      </div>
                      <Link
                        className="inline-flex min-h-11 items-center font-semibold text-sky-700 underline"
                        href={`/centers/${centerId}/appointments/${row.appointment_id}`}
                      >
                        Ver detalle
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {state.error && (
              <p className="mt-3 text-sm text-rose-700" role="alert">
                {state.page.rows.length
                  ? "No pudimos cargar más turnos."
                  : "No pudimos cargar los turnos de esta sección."}{" "}
                Intentá de nuevo.
              </p>
            )}
            {(state.error || state.page.hasMore) && (
              <button
                className="mt-3 min-h-11 rounded-md border border-sky-700 px-4 text-sm font-semibold text-sky-800 disabled:opacity-50"
                disabled={state.loading}
                onClick={() => void loadMore(section)}
                type="button"
              >
                {state.loading ? "Cargando…" : state.error ? "Reintentar carga" : "Cargar más"}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
