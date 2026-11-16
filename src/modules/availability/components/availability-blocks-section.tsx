"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { modalActionGroupClass } from "@/components/modal-action-group";
import { addCivilDays, readableCivilDate } from "@/modules/appointments/search/appointment-search";
import { appointmentSearchUrl } from "@/modules/appointments/search/appointment-search";
import {
  createAvailabilityBlockAction,
  deactivateAvailabilityBlockAction,
  previewAvailabilityBlockAction,
} from "../actions/availability-block-actions";
import type { AvailabilityBlock } from "../server/availability-blocks";
import type { BlockActionResult } from "../server/availability-block-actions";
import {
  blockPeriodSchema,
  blockReasonLabels,
  type AvailabilityBlockReason,
} from "../schemas/availability-block";

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-800 enabled:hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-4 py-2 font-semibold text-white enabled:hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50";

type Editor = { mode: "create" } | { mode: "remove"; block: AvailabilityBlock };

export function AvailabilityBlocksSection({
  centerId,
  professionalCenterId,
  today,
  blocks,
  canEdit,
}: {
  centerId: string;
  professionalCenterId: string;
  today: string;
  blocks: AvailabilityBlock[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState<AvailabilityBlockReason>("VACATION");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<BlockActionResult | null>(null);
  const [modalFeedback, setModalFeedback] = useState<BlockActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<"preview" | "create" | "remove" | null>(null);
  const [resultUnknown, setResultUnknown] = useState(false);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editor) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (element && !element.open) element.showModal();
    closeButton.current?.focus();
    return () => {
      if (element?.open) element.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => trigger.current?.focus());
    };
  }, [editor]);

  function baseForm() {
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("professionalCenterId", professionalCenterId);
    return form;
  }

  function open(next: Editor, button: HTMLButtonElement) {
    if (!canEdit || inFlight.current || resultUnknown) return;
    trigger.current = button;
    setModalFeedback(null);
    setPreviewCount(null);
    setConfirmed(false);
    if (next.mode === "create") {
      setStartDate(today);
      setEndDate(today);
      setReason("VACATION");
    }
    setEditor(next);
  }

  function close() {
    if (isPending || inFlight.current) return;
    if (resultUnknown) {
      window.location.reload();
      return;
    }
    setEditor(null);
  }

  function changePeriod(value: string, field: "start" | "end") {
    if (field === "start") setStartDate(value);
    else setEndDate(value);
    setPreviewCount(null);
    setConfirmed(false);
    setModalFeedback(null);
  }

  function review() {
    if (!canEdit || isPending || inFlight.current) return;
    const parsed = blockPeriodSchema.safeParse({
      centerId,
      professionalCenterId,
      startDate,
      endDate,
    });
    if (!parsed.success) {
      setModalFeedback({ status: "error", message: parsed.error.issues[0].message });
      return;
    }
    const form = baseForm();
    form.set("startDate", startDate);
    form.set("endDate", endDate);
    inFlight.current = true;
    setPendingKind("preview");
    startTransition(async () => {
      try {
        const result = await previewAvailabilityBlockAction(form);
        if (result.status === "success") setPreviewCount(result.affectedCount ?? 0);
        else setModalFeedback(result);
      } catch {
        setModalFeedback({
          status: "error",
          message: "No pudimos revisar los turnos. Actualizá la página antes de reintentar.",
        });
      } finally {
        inFlight.current = false;
        setPendingKind(null);
      }
    });
  }

  function create() {
    if (!canEdit || isPending || inFlight.current || resultUnknown || previewCount === null) return;
    if (previewCount > 0 && !confirmed) return;
    const form = baseForm();
    form.set("startDate", startDate);
    form.set("endDate", endDate);
    form.set("reason", reason);
    form.set("expectedAffectedCount", String(previewCount));
    form.set("confirmAffected", String(confirmed));
    inFlight.current = true;
    setPendingKind("create");
    startTransition(async () => {
      try {
        const result = await createAvailabilityBlockAction(form);
        if (result.status === "success") {
          setEditor(null);
          setFeedback(result);
          router.refresh();
        } else {
          setModalFeedback(result);
          if (result.status === "unknown") setResultUnknown(true);
          if (result.status === "stale") {
            setPreviewCount(null);
            setConfirmed(false);
          }
        }
      } catch {
        setResultUnknown(true);
        setModalFeedback({
          status: "unknown",
          message: "No pudimos confirmar el resultado. Actualizá la página antes de reintentar.",
        });
      } finally {
        inFlight.current = false;
        setPendingKind(null);
      }
    });
  }

  function remove(block: AvailabilityBlock) {
    if (!canEdit || isPending || inFlight.current || resultUnknown) return;
    const form = baseForm();
    form.set("blockId", block.id);
    form.set("expectedUpdatedAt", block.updatedAt);
    inFlight.current = true;
    setPendingKind("remove");
    startTransition(async () => {
      try {
        const result = await deactivateAvailabilityBlockAction(form);
        if (result.status === "success") {
          setEditor(null);
          setFeedback(result);
          router.refresh();
        } else {
          setModalFeedback(result);
          if (result.status === "unknown") setResultUnknown(true);
        }
      } catch {
        setResultUnknown(true);
        setModalFeedback({
          status: "unknown",
          message: "No pudimos confirmar el resultado. Actualizá la página antes de reintentar.",
        });
      } finally {
        inFlight.current = false;
        setPendingKind(null);
      }
    });
  }

  const previewToDate =
    endDate <= addCivilDays(startDate, 30) ? endDate : addCivilDays(startDate, 30);
  const appointmentsUrl = appointmentSearchUrl(centerId, {
    fromDate: startDate,
    toDate: previewToDate,
    professionalCenterId,
  });

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      aria-labelledby="blocks-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="blocks-title" className="text-xl font-semibold text-slate-950">
            Bloqueos excepcionales
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Días completos no disponibles; el horario semanal permanece igual.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className={`${primaryButton} shrink-0`}
            onClick={(event) => open({ mode: "create" }, event.currentTarget)}
          >
            Agregar bloqueo
          </button>
        )}
      </div>
      {feedback && (
        <p
          role={feedback.status === "success" ? "status" : "alert"}
          className={`mt-4 rounded-md border p-3 text-sm ${feedback.status === "success" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}
        >
          {feedback.message}
        </p>
      )}
      {blocks.length === 0 ? (
        <p className="mt-5 text-slate-600">No hay bloqueos excepcionales activos.</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-950">
                  {readableCivilDate(block.startDate)}
                  {block.startDate !== block.endDate && ` – ${readableCivilDate(block.endDate)}`}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Motivo: {blockReasonLabels[block.reason]}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className={`${secondaryButton} shrink-0`}
                  onClick={(event) => open({ mode: "remove", block }, event.currentTarget)}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editor && (
        <dialog
          ref={dialog}
          aria-labelledby="block-dialog-title"
          aria-modal="true"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50"
        >
          <div className="p-5 sm:p-6">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3
                id="block-dialog-title"
                className="min-w-0 pt-2 text-lg font-semibold text-slate-950"
              >
                {editor.mode === "create" ? "Agregar bloqueo" : "Quitar bloqueo"}
              </h3>
              <button
                ref={closeButton}
                type="button"
                aria-label="Cerrar"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 enabled:hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50"
                disabled={isPending}
                onClick={close}
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
            {modalFeedback && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {modalFeedback.message}
              </p>
            )}
            {editor.mode === "create" ? (
              <div className="mt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
                    Desde
                    <input
                      type="date"
                      required
                      value={startDate}
                      disabled={isPending}
                      onChange={(event) => changePeriod(event.target.value, "start")}
                      className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
                    Hasta, inclusive
                    <input
                      type="date"
                      required
                      value={endDate}
                      disabled={isPending}
                      onChange={(event) => changePeriod(event.target.value, "end")}
                      className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                    />
                  </label>
                </div>
                <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium text-slate-800">
                  Motivo
                  <select
                    value={reason}
                    disabled={isPending}
                    onChange={(event) => setReason(event.target.value as AvailabilityBlockReason)}
                    className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                  >
                    {Object.entries(blockReasonLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={isPending}
                    onClick={review}
                  >
                    {pendingKind === "preview" ? "Revisando…" : "Revisar turnos afectados"}
                  </button>
                </div>
                {previewCount !== null && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-900">
                    <p className="font-semibold">
                      {previewCount === 0
                        ? "No hay turnos reservados en estas fechas."
                        : `${previewCount} ${previewCount === 1 ? "turno reservado afectado" : "turnos reservados afectados"}.`}
                    </p>
                    {previewCount > 0 && (
                      <>
                        <p className="mt-2">
                          El bloqueo no cancela ni modifica estos turnos. Resolvelos manualmente.
                        </p>
                        <Link
                          href={appointmentsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block font-semibold text-sky-800 underline"
                        >
                          Consultar turnos afectados
                        </Link>
                        {endDate > previewToDate && (
                          <p className="mt-2">
                            La lista abre los primeros 31 días. Avanzá el rango para consultar el
                            resto.
                          </p>
                        )}
                        <label className="mt-3 flex items-start gap-2 font-medium">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                            className="mt-1"
                          />
                          Confirmo el bloqueo y revisaré los turnos existentes.
                        </label>
                      </>
                    )}
                  </div>
                )}
                <div className={`${modalActionGroupClass} mt-6 border-t border-slate-200 pt-5`}>
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={isPending}
                    onClick={close}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={
                      isPending ||
                      resultUnknown ||
                      previewCount === null ||
                      (previewCount > 0 && !confirmed)
                    }
                    onClick={create}
                  >
                    {pendingKind === "create" ? "Guardando…" : "Confirmar bloqueo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <p className="text-sm leading-6 text-slate-700">
                  ¿Querés quitar el bloqueo del{" "}
                  <strong className="font-semibold text-slate-950">
                    {readableCivilDate(editor.block.startDate)}
                    {editor.block.startDate !== editor.block.endDate &&
                      ` – ${readableCivilDate(editor.block.endDate)}`}
                  </strong>
                  ?
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esas fechas volverán a regirse por la disponibilidad semanal y los turnos
                  existentes.
                </p>
                <div className={`${modalActionGroupClass} mt-6 border-t border-slate-200 pt-5`}>
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={isPending}
                    onClick={close}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-4 py-2 font-semibold text-white enabled:hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50"
                    disabled={isPending || resultUnknown}
                    onClick={() => remove(editor.block)}
                  >
                    {pendingKind === "remove" ? "Quitando…" : "Confirmar retiro"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </dialog>
      )}
    </section>
  );
}
