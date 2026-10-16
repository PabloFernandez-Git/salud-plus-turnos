"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import {
  createAvailabilityAction,
  deactivateAvailabilityAction,
  updateAppointmentDurationAction,
  updateAvailabilityAction,
} from "../actions/availability-actions";
import type { AvailabilityActionState } from "../server/availability-actions";
import type { AvailabilityInterval, AvailabilityProfessionalCenter } from "../server/availability";

const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-sky-700 px-4 py-2 font-semibold text-sky-800 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50";
const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50";
type Editor =
  { mode: "create"; weekday: number } | { mode: "update"; interval: AvailabilityInterval };

export function AvailabilityScreen({
  centerId,
  centerName,
  timezone,
  professional,
  intervals,
  canEdit,
  canViewProfessionals,
}: {
  centerId: string;
  centerName: string;
  timezone: string;
  professional: AvailabilityProfessionalCenter;
  intervals: AvailabilityInterval[];
  canEdit: boolean;
  canViewProfessionals: boolean;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [feedback, setFeedback] = useState<AvailabilityActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const firstTimeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editor) firstTimeInput.current?.focus();
  }, [editor]);

  function openEditor(next: Editor) {
    if (isPending) return;
    setEditor(next);
    setStartTime(next.mode === "update" ? next.interval.startTime : "");
    setEndTime(next.mode === "update" ? next.interval.endTime : "");
    setFeedback(null);
  }

  function run(action: (data: FormData) => Promise<AvailabilityActionState>, data: FormData) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await action(data);
        setFeedback(result);
        if (result.status === "success" || result.status === "stale") {
          setEditor(null);
          router.refresh();
        }
      } catch {
        setFeedback({
          status: "error",
          message: "No pudimos confirmar el resultado. Actualizá la página antes de reintentar.",
        });
      } finally {
        inFlight.current = false;
      }
    });
  }

  function baseForm() {
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("professionalCenterId", professional.id);
    return form;
  }

  function submitInterval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !editor || isPending) return;
    const form = baseForm();
    form.set("startTime", startTime);
    form.set("endTime", endTime);
    if (editor.mode === "create") {
      form.set("weekday", String(editor.weekday));
      run(createAvailabilityAction, form);
    } else {
      form.set("availabilityId", editor.interval.id);
      form.set("expectedUpdatedAt", editor.interval.updatedAt);
      run(updateAvailabilityAction, form);
    }
  }

  function removeInterval(interval: AvailabilityInterval) {
    if (!canEdit || isPending) return;
    const day = weekdays[interval.weekday - 1];
    if (
      !window.confirm(
        `¿Querés quitar el horario del ${day} de ${interval.startTime} a ${interval.endTime}?`,
      )
    )
      return;
    const form = baseForm();
    form.set("availabilityId", interval.id);
    form.set("expectedUpdatedAt", interval.updatedAt);
    run(deactivateAvailabilityAction, form);
  }

  function submitDuration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || isPending) return;
    const form = baseForm();
    form.set("expectedUpdatedAt", professional.updatedAt);
    form.set("minutes", String(new FormData(event.currentTarget).get("minutes") ?? ""));
    run(updateAppointmentDurationAction, form);
  }

  function intervalForm() {
    if (!editor) return null;
    const day =
      editor.mode === "create"
        ? weekdays[editor.weekday - 1]
        : weekdays[editor.interval.weekday - 1];
    return (
      <form
        onSubmit={submitInterval}
        className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-4"
      >
        <p className="font-semibold text-slate-900">
          {editor.mode === "create" ? "Agregar horario" : "Editar horario"} · {day}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="min-w-32 flex-1 text-sm font-medium text-slate-800">
            Hora desde
            <input
              ref={firstTimeInput}
              type="time"
              step="60"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(feedback?.fieldErrors?.startTime)}
              className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
            />
            {feedback?.fieldErrors?.startTime && (
              <span className="block text-red-700">{feedback.fieldErrors.startTime}</span>
            )}
          </label>
          <label className="min-w-32 flex-1 text-sm font-medium text-slate-800">
            Hora hasta
            <input
              type="time"
              step="60"
              required
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(feedback?.fieldErrors?.endTime)}
              className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
            />
            {feedback?.fieldErrors?.endTime && (
              <span className="block text-red-700">{feedback.fieldErrors.endTime}</span>
            )}
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" disabled={isPending} className={primaryClass}>
            {isPending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setEditor(null);
              setFeedback(null);
            }}
            className={buttonClass}
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-sky-700">Administración del centro</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Disponibilidad</h1>
              <p className="mt-1 text-lg text-slate-900">
                {professional.firstName} {professional.lastName}
              </p>
              <p className="text-slate-700">{centerName}</p>
              <p className="mt-2 text-sm text-slate-600">
                Horarios semanales en la zona horaria del centro: {timezone}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canViewProfessionals && (
                <Link className={buttonClass} href={`/centers/${centerId}/professionals`}>
                  Profesionales
                </Link>
              )}
              <Link className={buttonClass} href={`/centers/${centerId}`}>
                Volver al centro
              </Link>
            </div>
          </div>
        </header>

        {feedback && (
          <div
            className={`rounded-lg border p-4 ${feedback.status === "success" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}
            role={feedback.status === "success" ? "status" : "alert"}
          >
            <p>{feedback.message}</p>
            {feedback.warning && (
              <p className="mt-2">
                Hay turnos futuros fuera de la disponibilidad habitual; revisalos en Agenda cuando
                esté disponible.
              </p>
            )}
            {feedback.warning && (
              <button type="button" onClick={() => setFeedback(null)} className="mt-2 underline">
                Cerrar aviso
              </button>
            )}
          </div>
        )}

        <section
          className="rounded-xl border border-slate-200 bg-white p-5"
          aria-labelledby="duration-title"
        >
          <h2 id="duration-title" className="text-xl font-semibold text-slate-950">
            Duración habitual del turno
          </h2>
          {canEdit ? (
            <form onSubmit={submitDuration} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-slate-800">
                Minutos
                <input
                  key={professional.updatedAt}
                  name="minutes"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  required
                  defaultValue={professional.usualAppointmentDurationMinutes}
                  disabled={isPending}
                  aria-invalid={Boolean(feedback?.fieldErrors?.minutes)}
                  className="mt-1 block min-h-11 w-36 rounded-md border border-slate-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                />
                {feedback?.fieldErrors?.minutes && (
                  <span className="block text-red-700">{feedback.fieldErrors.minutes}</span>
                )}
              </label>
              <button type="submit" disabled={isPending} className={primaryClass}>
                {isPending ? "Guardando…" : "Guardar duración"}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-slate-700">
              {professional.usualAppointmentDurationMinutes} minutos
            </p>
          )}
        </section>

        {intervals.length === 0 && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-slate-800">
            Todavía no hay horarios semanales cargados.
          </p>
        )}
        <div className="space-y-4">
          {weekdays.map((day, index) => {
            const weekday = index + 1;
            const rows = intervals.filter((row) => row.weekday === weekday);
            return (
              <section
                key={day}
                aria-labelledby={`weekday-${weekday}`}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id={`weekday-${weekday}`} className="text-xl font-semibold text-slate-950">
                    {day}
                  </h2>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => openEditor({ mode: "create", weekday })}
                      className={buttonClass}
                    >
                      + Agregar horario
                    </button>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="mt-3 text-slate-600">Sin disponibilidad</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {rows.map((interval) => (
                      <li key={interval.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-medium text-slate-900">
                            {interval.startTime}–{interval.endTime}
                          </span>
                          {canEdit && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => openEditor({ mode: "update", interval })}
                                className={buttonClass}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => removeInterval(interval)}
                                className={buttonClass}
                              >
                                Quitar horario
                              </button>
                            </div>
                          )}
                        </div>
                        {editor?.mode === "update" &&
                          editor.interval.id === interval.id &&
                          intervalForm()}
                      </li>
                    ))}
                  </ul>
                )}
                {editor?.mode === "create" && editor.weekday === weekday && intervalForm()}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
