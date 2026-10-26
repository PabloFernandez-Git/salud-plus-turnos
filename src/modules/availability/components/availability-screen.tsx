"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { FormFieldError, formFieldErrorProps } from "@/components/form-field-error";
import { ModuleHeader, moduleSecondaryActionClass } from "@/components/module-header";
import { modalActionGroupClass } from "@/components/modal-action-group";
import {
  createAvailabilityAction,
  deactivateAvailabilityAction,
  updateAppointmentDurationAction,
  updateAvailabilityAction,
} from "../actions/availability-actions";
import type { AvailabilityActionState } from "../server/availability-actions";
import type { AvailabilityInterval, AvailabilityProfessionalCenter } from "../server/availability";
import {
  appointmentDurationSchema,
  availabilityTimeSchema,
  createAvailabilitySchema,
  updateAvailabilitySchema,
} from "../schemas/availability";

const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-sky-700 px-4 py-2 font-semibold text-sky-800 enabled:hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50";
const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-4 py-2 font-semibold text-white enabled:hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50";
const intervalActionClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 enabled:hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50";
type Editor =
  | { mode: "create"; weekday: number }
  | { mode: "update" | "remove"; interval: AvailabilityInterval };
type TimeField = "startTime" | "endTime";
const timeFormatError = "Ingresá una hora válida en formato HH:mm.";

function formatTimeInput(value: string, isDeleting = false) {
  if (/^\d{2}::/.test(value)) return value.replace("::", ":");
  if (isDeleting || !/^\d{2,4}$/.test(value)) return value;
  return `${value.slice(0, 2)}:${value.slice(2)}`;
}

function formatIntervalDuration(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const totalMinutes = endHour * 60 + endMinute - startHour * 60 - startMinute;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function AvailabilityScreen({
  centerId,
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
  const durationSnapshot = `${professional.updatedAt}:${professional.usualAppointmentDurationMinutes}`;
  const [durationDraft, setDurationDraft] = useState({
    snapshot: durationSnapshot,
    value: String(professional.usualAppointmentDurationMinutes),
  });
  const [savedDuration, setSavedDuration] = useState<{ snapshot: string; minutes: number } | null>(
    null,
  );
  const duration =
    durationDraft.snapshot === durationSnapshot
      ? durationDraft.value
      : String(professional.usualAppointmentDurationMinutes);
  const confirmedDuration =
    savedDuration?.snapshot === durationSnapshot
      ? savedDuration.minutes
      : professional.usualAppointmentDurationMinutes;
  const [feedback, setFeedback] = useState<AvailabilityActionState | null>(null);
  const [modalFeedback, setModalFeedback] = useState<AvailabilityActionState | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [discardRequested, setDiscardRequested] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const hadEditor = useRef(false);
  const wasDiscardRequested = useRef(false);
  const firstTimeInput = useRef<HTMLInputElement>(null);
  const endTimeInput = useRef<HTMLInputElement>(null);
  const startErrorId = useId();
  const endErrorId = useId();
  const timeHintId = useId();
  const durationErrorId = useId();

  useEffect(() => {
    if (!editor) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    if (editor.mode === "remove") closeButtonRef.current?.focus();
    else firstTimeInput.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [editor]);

  useEffect(() => {
    if (editor) hadEditor.current = true;
    else if (hadEditor.current) {
      hadEditor.current = false;
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [editor]);

  useEffect(() => {
    if (discardRequested) continueEditingRef.current?.focus();
    else if (wasDiscardRequested.current) closeButtonRef.current?.focus();
    wasDiscardRequested.current = discardRequested;
  }, [discardRequested]);

  useEffect(() => {
    if (isPending && editor) dialogRef.current?.focus();
  }, [isPending, editor]);

  const durationIsValid =
    /^\d+$/.test(duration) && appointmentDurationSchema.safeParse(duration).success;
  const durationChanged = durationIsValid && Number(duration) !== confirmedDuration;
  const hasUnsavedChanges =
    editor?.mode === "create"
      ? startTime !== "" || endTime !== ""
      : editor?.mode === "update"
        ? startTime !== editor.interval.startTime || endTime !== editor.interval.endTime
        : false;

  function openEditor(next: Editor, trigger: HTMLButtonElement) {
    if (isPending || inFlight.current) return;
    triggerRef.current = trigger;
    setEditor(next);
    setStartTime(next.mode === "create" ? "" : next.interval.startTime);
    setEndTime(next.mode === "create" ? "" : next.interval.endTime);
    setModalFeedback(null);
    setClientErrors({});
    setDiscardRequested(false);
  }

  function requestClose() {
    if (isPending || inFlight.current) return;
    if (hasUnsavedChanges) setDiscardRequested(true);
    else setEditor(null);
  }

  function keepTabInDialog(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled])",
      ) ?? [],
    ).filter((element) => !element.closest("[hidden]") && element.tabIndex >= 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      dialogRef.current?.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function run(
    action: (data: FormData) => Promise<AvailabilityActionState>,
    data: FormData,
    operation: "create" | "update" | "remove" | "duration",
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    setModalFeedback(null);
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result.status === "success") {
          const message =
            operation === "create"
              ? "Horario agregado correctamente."
              : operation === "update"
                ? "Horario actualizado correctamente."
                : operation === "remove"
                  ? "Horario quitado correctamente."
                  : result.message;
          setFeedback({ ...result, message });
          if (operation === "duration")
            setSavedDuration({ snapshot: durationSnapshot, minutes: Number(duration) });
          else setEditor(null);
          router.refresh();
        } else if (result.status === "stale") {
          setFeedback(result);
          if (operation !== "duration") setEditor(null);
          router.refresh();
        } else if (operation === "duration") setFeedback(result);
        else setModalFeedback(result);
      } catch {
        const error: AvailabilityActionState = {
          status: "error",
          message: "No pudimos confirmar el resultado. Actualizá la página antes de reintentar.",
        };
        if (operation === "duration") setFeedback(error);
        else setModalFeedback(error);
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

  function changeTime(field: TimeField, event: ChangeEvent<HTMLInputElement>) {
    const inputType = (event.nativeEvent as InputEvent).inputType;
    const value = formatTimeInput(event.currentTarget.value, inputType?.startsWith("delete"));
    if (field === "startTime") setStartTime(value);
    else setEndTime(value);
    setClientErrors((errors) => ({ ...errors, [field]: "" }));
    setModalFeedback(null);
  }

  function validateTimeOnBlur(field: TimeField, event: FocusEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    const formatted = /^\d{4}$/.test(value) ? formatTimeInput(value) : value;
    if (formatted !== value) {
      if (field === "startTime") setStartTime(formatted);
      else setEndTime(formatted);
    }
    const isValid = availabilityTimeSchema.safeParse(formatted).success;
    setClientErrors((errors) => ({ ...errors, [field]: isValid ? "" : timeFormatError }));
  }

  function submitInterval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !editor || editor.mode === "remove" || isPending || inFlight.current) return;
    const form = baseForm();
    const formattedStartTime = /^\d{4}$/.test(startTime) ? formatTimeInput(startTime) : startTime;
    const formattedEndTime = /^\d{4}$/.test(endTime) ? formatTimeInput(endTime) : endTime;
    if (formattedStartTime !== startTime) setStartTime(formattedStartTime);
    if (formattedEndTime !== endTime) setEndTime(formattedEndTime);
    form.set("startTime", formattedStartTime);
    form.set("endTime", formattedEndTime);
    if (editor.mode === "create") {
      form.set("weekday", String(editor.weekday));
    } else {
      form.set("availabilityId", editor.interval.id);
      form.set("expectedUpdatedAt", editor.interval.updatedAt);
    }
    const raw = Object.fromEntries(form.entries());
    const parsed =
      editor.mode === "create"
        ? createAvailabilitySchema.safeParse(raw)
        : updateAvailabilitySchema.safeParse(raw);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === "startTime" || field === "endTime") && !errors[field]) {
          errors[field] =
            issue.message === "Ingresá una hora HH:MM." ? timeFormatError : issue.message;
        }
      }
      if (Object.keys(errors).length > 0) {
        setClientErrors(errors);
        setModalFeedback(null);
        if (errors.startTime) firstTimeInput.current?.focus();
        else endTimeInput.current?.focus();
        return;
      }
    }
    if (editor.mode === "create") run(createAvailabilityAction, form, "create");
    else run(updateAvailabilityAction, form, "update");
  }

  function submitRemoval() {
    if (!canEdit || !editor || editor.mode !== "remove" || isPending || inFlight.current) return;
    const form = baseForm();
    form.set("availabilityId", editor.interval.id);
    form.set("expectedUpdatedAt", editor.interval.updatedAt);
    run(deactivateAvailabilityAction, form, "remove");
  }

  function submitDuration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !durationChanged || isPending || inFlight.current) return;
    const form = baseForm();
    form.set("expectedUpdatedAt", professional.updatedAt);
    form.set("minutes", duration);
    run(updateAppointmentDurationAction, form, "duration");
  }

  const day = editor
    ? weekdays[(editor.mode === "create" ? editor.weekday : editor.interval.weekday) - 1]
    : "";
  const startError = clientErrors.startTime || modalFeedback?.fieldErrors?.startTime;
  const endError = clientErrors.endTime || modalFeedback?.fieldErrors?.endTime;

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10 [&_a[href]]:cursor-pointer [&_button:enabled]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <ModuleHeader
          centerId={centerId}
          title="Disponibilidad"
          description={`Horarios semanales de ${professional.firstName} ${professional.lastName}.`}
          actions={
            (canEdit || canViewProfessionals) && (
              <Link
                className={moduleSecondaryActionClass}
                href={`/centers/${centerId}/availability`}
              >
                Volver a disponibilidad
              </Link>
            )
          }
        />

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
                  name="minutes"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  required
                  value={duration}
                  onChange={(event) => {
                    setDurationDraft({ snapshot: durationSnapshot, value: event.target.value });
                    setFeedback(null);
                  }}
                  disabled={isPending}
                  {...formFieldErrorProps(feedback?.fieldErrors?.minutes, durationErrorId)}
                  className="mt-1 block min-h-11 w-36 rounded-md border border-slate-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                />
                <FormFieldError id={durationErrorId} message={feedback?.fieldErrors?.minutes} />
              </label>
              <button
                type="submit"
                disabled={isPending || !durationChanged}
                className={primaryClass}
              >
                {isPending ? "Guardando…" : "Guardar duración"}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-slate-700">
              {professional.usualAppointmentDurationMinutes} minutos
            </p>
          )}
        </section>

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
                      onClick={(event) =>
                        openEditor({ mode: "create", weekday }, event.currentTarget)
                      }
                      className={buttonClass}
                    >
                      + Agregar horario
                    </button>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="mt-3 text-slate-600">Sin disponibilidad</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-200">
                    {rows.map((interval) => (
                      <li key={interval.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 h-5 w-5 shrink-0 text-slate-500"
                            >
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7v5l3 2" />
                            </svg>
                            <div>
                              <p className="whitespace-nowrap font-semibold text-slate-950">
                                {interval.startTime} – {interval.endTime}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-600">
                                {formatIntervalDuration(interval.startTime, interval.endTime)}
                              </p>
                            </div>
                          </div>
                          {canEdit && (
                            <div className="ml-auto flex shrink-0 gap-2">
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={(event) =>
                                  openEditor({ mode: "update", interval }, event.currentTarget)
                                }
                                className={intervalActionClass}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={(event) =>
                                  openEditor({ mode: "remove", interval }, event.currentTarget)
                                }
                                className={intervalActionClass}
                              >
                                Quitar
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        {editor && (
          <dialog
            ref={dialogRef}
            aria-label={discardRequested ? "Descartar cambios" : undefined}
            aria-labelledby={discardRequested ? undefined : "availability-dialog-title"}
            aria-modal="true"
            className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50"
            onCancel={(event) => {
              event.preventDefault();
              if (isPending || inFlight.current) return;
              if (discardRequested) setDiscardRequested(false);
              else requestClose();
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget || discardRequested) return;
              const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < left ||
                event.clientX >= right ||
                event.clientY < top ||
                event.clientY >= bottom
              )
                requestClose();
            }}
            onKeyDown={keepTabInDialog}
            tabIndex={-1}
          >
            <div className="p-5 sm:p-6">
              {discardRequested ? (
                <div role="alert">
                  <h2 className="text-lg font-semibold text-slate-950">¿Descartar cambios?</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Hay datos sin guardar. Si salís ahora, perderás los cambios realizados.
                  </p>
                  <div className={`${modalActionGroupClass} mt-6`}>
                    <button
                      type="button"
                      ref={continueEditingRef}
                      onClick={() => setDiscardRequested(false)}
                      className={buttonClass}
                    >
                      Seguir editando
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscardRequested(false);
                        setEditor(null);
                      }}
                      className="min-h-11 rounded-md bg-red-700 px-4 py-2 font-semibold text-white enabled:hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    >
                      Descartar cambios
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <h2
                      id="availability-dialog-title"
                      className="min-w-0 break-words text-lg font-semibold text-slate-950"
                    >
                      {editor.mode === "create"
                        ? "Agregar horario"
                        : editor.mode === "update"
                          ? "Editar horario"
                          : "Quitar horario"}{" "}
                      · {day}
                    </h2>
                    <button
                      type="button"
                      ref={closeButtonRef}
                      aria-label="Cerrar"
                      disabled={isPending}
                      onClick={requestClose}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 enabled:hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50"
                    >
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="2"
                        viewBox="0 0 20 20"
                      >
                        <path d="M5 5l10 10M15 5L5 15" />
                      </svg>
                    </button>
                  </div>
                  {modalFeedback?.status === "error" && (
                    <p
                      role="alert"
                      className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    >
                      {modalFeedback.message}
                    </p>
                  )}
                  {editor.mode === "remove" ? (
                    <div className="mt-5">
                      <p className="text-sm leading-6 text-slate-700">
                        ¿Querés quitar el horario del {day} de {editor.interval.startTime} a{" "}
                        {editor.interval.endTime}?
                      </p>
                      <div className={`${modalActionGroupClass} mt-6`}>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={requestClose}
                          className={buttonClass}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={submitRemoval}
                          className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-4 py-2 font-semibold text-white enabled:hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50"
                        >
                          {isPending ? "Quitando…" : "Confirmar retiro"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={submitInterval} noValidate className="mt-5 space-y-4">
                      <p id={timeHintId} className="text-xs text-slate-600">
                        Formato de 24 horas: escribí 0900 o 09:00.
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block space-y-1 text-sm font-medium text-slate-800">
                          Hora desde
                          <input
                            ref={firstTimeInput}
                            aria-label="Hora desde"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            placeholder="09:00"
                            required
                            value={startTime}
                            onChange={(event) => changeTime("startTime", event)}
                            onBlur={(event) => validateTimeOnBlur("startTime", event)}
                            disabled={isPending}
                            {...formFieldErrorProps(startError, startErrorId)}
                            aria-describedby={`${timeHintId}${startError ? ` ${startErrorId}` : ""}`}
                            className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                          />
                          <FormFieldError id={startErrorId} message={startError} />
                        </label>
                        <label className="block space-y-1 text-sm font-medium text-slate-800">
                          Hora hasta
                          <input
                            ref={endTimeInput}
                            aria-label="Hora hasta"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            placeholder="13:00"
                            required
                            value={endTime}
                            onChange={(event) => changeTime("endTime", event)}
                            onBlur={(event) => validateTimeOnBlur("endTime", event)}
                            disabled={isPending}
                            {...formFieldErrorProps(endError, endErrorId)}
                            aria-describedby={`${timeHintId}${endError ? ` ${endErrorId}` : ""}`}
                            className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                          />
                          <FormFieldError id={endErrorId} message={endError} />
                        </label>
                      </div>
                      <div className={`${modalActionGroupClass} pt-2`}>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={requestClose}
                          className={buttonClass}
                        >
                          Cancelar
                        </button>
                        <button type="submit" disabled={isPending} className={primaryClass}>
                          {isPending ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </dialog>
        )}
      </div>
    </main>
  );
}
