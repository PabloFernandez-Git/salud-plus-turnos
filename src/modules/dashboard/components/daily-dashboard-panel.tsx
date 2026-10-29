"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppLoader } from "@/components/app-loader";
import type { Database } from "@/lib/supabase/database.types";
import { refreshDailyDashboardAction } from "../actions/daily-dashboard-actions";
import type { DailyDashboard } from "../api/daily-dashboard-rpc";

type Role = Database["public"]["Enums"]["membership_role"];
type Snapshot = DailyDashboard & { membershipId: string; role: Role };
type LoadState = {
  key: string;
  phase: "loading" | "error" | "denied" | "ready";
  snapshot: Snapshot | null;
};
const statusLabel = { PENDING: "Pendiente", CONFIRMED: "Confirmado" } as const;

export function centerDateAt(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function millisecondsUntilNextCenterDay(now: number, timezone: string) {
  const today = centerDateAt(now, timezone);
  let low = now;
  let high = now + 48 * 60 * 60 * 1000;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (centerDateAt(mid, timezone) === today) low = mid;
    else high = mid;
  }
  return Math.max(1000, high - now + 1000);
}

function centerTime(instant: string, timezone: string, withOffset = false) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(withOffset ? { timeZoneName: "shortOffset" as const } : {}),
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("hour")}:${part("minute")}${withOffset ? ` ${part("timeZoneName").replace("GMT", "UTC")}` : ""}`;
}

export function centerFriendlyDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  const weekday = part("weekday");
  return `${weekday.charAt(0).toLocaleUpperCase("es-AR")}${weekday.slice(1)} ${part("day")} de ${part("month")}`;
}

export function DailyDashboardPanel({
  centerId,
  membershipId,
  role,
  children,
}: {
  centerId: string;
  membershipId: string;
  role: Role;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const key = `${centerId}:${membershipId}:${role}:${revision}`;
  const [state, setState] = useState<LoadState>({ key, phase: "loading", snapshot: null });
  const visibleState =
    state.key === key ? state : { key, phase: "loading" as const, snapshot: null };

  useEffect(() => {
    let active = true;
    const requestedAt = Date.now();
    void refreshDailyDashboardAction(centerId)
      .then((result) => {
        if (!active) return;
        if (result.status === "denied") {
          setState({ key, phase: "denied", snapshot: null });
          router.refresh();
          return;
        }
        if (result.status === "error") {
          setState({ key, phase: "error", snapshot: null });
          return;
        }
        if (result.data.membershipId !== membershipId || result.data.role !== role) {
          setState({ key, phase: "error", snapshot: null });
          router.refresh();
          return;
        }
        if (
          centerDateAt(requestedAt, result.data.row.timezone) !==
          centerDateAt(Date.now(), result.data.row.timezone)
        ) {
          setRevision((n) => n + 1);
          return;
        }
        setState({ key, phase: "ready", snapshot: result.data });
      })
      .catch(() => {
        if (active) setState({ key, phase: "error", snapshot: null });
      });
    return () => {
      active = false;
    };
  }, [centerId, key, membershipId, revision, role, router]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setRevision((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const snapshot = visibleState.snapshot;
    if (!snapshot) return;
    const timer = window.setTimeout(
      () => setRevision((n) => n + 1),
      millisecondsUntilNextCenterDay(Date.now(), snapshot.row.timezone),
    );
    return () => window.clearTimeout(timer);
  }, [visibleState.snapshot]);

  if (visibleState.phase === "loading")
    return (
      <div className="h-[60dvh]">
        <AppLoader fullScreen={false} />
      </div>
    );

  const snapshot = visibleState.snapshot;
  const isProfessional = role === "PROFESSIONAL";
  return (
    <>
      <div className="space-y-9">
        <section
          aria-labelledby="activity-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1
                id="activity-heading"
                className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
              >
                {isProfessional ? "Mi actividad de hoy" : "Actividad de hoy"}
              </h1>
              {snapshot ? (
                <p className="mt-2 text-sm text-slate-600">
                  {centerFriendlyDate(snapshot.row.as_of, snapshot.row.timezone)} · Actualizado a
                  las {centerTime(snapshot.row.as_of, snapshot.row.timezone)} (hora del centro)
                </p>
              ) : null}
            </div>
            {visibleState.phase === "ready" && (
              <button
                type="button"
                onClick={() => setRevision((n) => n + 1)}
                className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              >
                Actualizar
              </button>
            )}
          </div>
          {visibleState.phase === "denied" && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              Tu acceso a este centro cambió. Actualizá la página.
            </p>
          )}
          {visibleState.phase === "error" && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            >
              <p>No pudimos cargar la actividad. Intentá de nuevo.</p>
              <button
                type="button"
                onClick={() => setRevision((n) => n + 1)}
                className="mt-3 min-h-11 rounded-md border border-rose-300 bg-white px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
              >
                Reintentar
              </button>
            </div>
          )}
          {snapshot && (
            <div className="mt-6">
              {snapshot.activeTotal === 0 && (
                <p className="mb-5 rounded-lg bg-sky-50 p-4 text-sm text-sky-900">
                  No hay turnos vigentes para hoy.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: isProfessional ? "Mis turnos del día" : "Turnos del día",
                    value: snapshot.activeTotal,
                  },
                  {
                    label: "Por atender",
                    value: snapshot.toAttend,
                    note: `${snapshot.row.pending_count} pendientes · ${snapshot.row.confirmed_count} confirmados`,
                  },
                  { label: "Atendidos", value: snapshot.row.attended_count },
                  { label: "Ausentes", value: snapshot.row.no_show_count },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
                  >
                    <dt className="break-words text-sm font-medium text-slate-600">{item.label}</dt>
                    <dd className="mt-1 break-words text-2xl font-bold text-slate-950 sm:text-3xl">
                      {item.value}
                      {item.note && (
                        <span className="mt-2 block break-words text-xs font-normal text-slate-600">
                          {item.note}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-slate-600">
                Cancelados con fecha de hoy: <strong>{snapshot.row.cancelled_count}</strong>
                {snapshot.scope === "staff" && (
                  <>
                    {" "}
                    · Profesionales con turnos hoy:{" "}
                    <strong>{snapshot.row.professional_centers_with_appointments_count}</strong>
                  </>
                )}
              </p>
            </div>
          )}
        </section>
        <section
          aria-labelledby="upcoming-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <h2 id="upcoming-heading" className="text-xl font-bold text-slate-950">
            {isProfessional ? "Mis próximos turnos de hoy" : "Próximos turnos de hoy"}
          </h2>
          {(visibleState.phase === "error" || visibleState.phase === "denied") && (
            <p className="mt-4 text-sm text-slate-600">Los próximos turnos no están disponibles.</p>
          )}
          {snapshot && snapshot.row.upcoming.length === 0 && (
            <p className="mt-4 text-sm text-slate-600">
              {snapshot.activeTotal === 0
                ? "No hay próximos turnos de hoy."
                : "No quedan próximos turnos de hoy."}
            </p>
          )}
          {snapshot && snapshot.row.upcoming.length > 0 && (
            <ol className="mt-4 divide-y divide-slate-200">
              {snapshot.row.upcoming.map((item) => (
                <li key={item.appointment_id}>
                  <Link
                    href={`/centers/${centerId}/appointments/${item.appointment_id}`}
                    className="flex flex-col gap-2 rounded-md py-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">
                        {centerTime(item.starts_at, snapshot.row.timezone, true)} ·{" "}
                        {item.patient_first_name} {item.patient_last_name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {snapshot.scope === "staff" && "professional_first_name" in item && (
                          <>
                            {item.professional_first_name} {item.professional_last_name} ·{" "}
                          </>
                        )}
                        {item.specialty_name} · {statusLabel[item.status]}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-sky-700">
                      Ver detalle
                      <span className="sr-only">
                        {" "}
                        de {item.patient_first_name} {item.patient_last_name}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {children}
    </>
  );
}
