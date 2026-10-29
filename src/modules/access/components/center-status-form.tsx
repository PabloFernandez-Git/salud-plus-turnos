"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { setPlatformCenterActiveAction } from "../actions/platform-actions";
import type { PlatformActionState } from "../domain/platform-action-state";

export function CenterStatusForm({
  centerId,
  centerName,
  isActive,
}: {
  centerId: string;
  centerName: string;
  isActive: boolean;
}) {
  const [state, formAction, isPending] = useActionState(setPlatformCenterActiveAction, {
    status: "idle",
  } satisfies PlatformActionState);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      if (dialog?.open) dialog.close();
      requestAnimationFrame(() => trigger?.focus());
    };
  }, [open]);

  useEffect(() => {
    if (state.status === "error") submittingRef.current = false;
    if (state.status === "success" && submittingRef.current) {
      submittingRef.current = false;
      setOpen(false);
    }
  }, [state]);

  function requestClose() {
    if (isPending || submittingRef.current) return;
    setOpen(false);
  }

  return (
    <>
      <button
        className={`inline-flex min-h-9 items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isActive
            ? "border-red-200 text-red-700 hover:bg-red-50"
            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }`}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        {isActive ? "Desactivar" : "Reactivar"}
      </button>
      {state.status === "success" && state.message ? (
        <p className="mt-2 text-xs text-emerald-700" role="status">
          {state.message}
        </p>
      ) : null}
      {open
        ? createPortal(
            <dialog
              aria-describedby={descriptionId}
              aria-labelledby={titleId}
              className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50 [&_button:not(:disabled)]:cursor-pointer"
              onCancel={(event) => {
                event.preventDefault();
                requestClose();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                if (isPending || submittingRef.current) {
                  event.preventDefault();
                  dialogRef.current?.focus();
                } else if (event.shiftKey && document.activeElement === cancelRef.current) {
                  event.preventDefault();
                  confirmRef.current?.focus();
                } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
                  event.preventDefault();
                  cancelRef.current?.focus();
                }
              }}
              ref={dialogRef}
              tabIndex={-1}
            >
              <div className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-slate-950" id={titleId}>
                  {isActive ? "Desactivar centro" : "Reactivar centro"}
                </h2>
                <p className="mt-2 break-words text-sm font-semibold text-slate-900">
                  {centerName}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700" id={descriptionId}>
                  {isActive
                    ? "El centro dejará de estar disponible para operar. Sus datos permanecerán guardados y podrá reactivarse después."
                    : "El centro volverá a estar disponible para operar si conserva al menos un administrador activo."}
                </p>
                <form
                  action={formAction}
                  onSubmit={(event) => {
                    if (isPending || submittingRef.current) event.preventDefault();
                    else submittingRef.current = true;
                  }}
                >
                  <input name="centerId" type="hidden" value={centerId} />
                  <input name="isActive" type="hidden" value={String(!isActive)} />
                  {state.status === "error" && state.message ? (
                    <p className="mt-4 text-sm text-red-700" role="alert">
                      {state.message}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isPending}
                      onClick={requestClose}
                      ref={cancelRef}
                      type="button"
                    >
                      Volver
                    </button>
                    <button
                      className={`min-h-11 rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? "bg-red-700 hover:bg-red-800"
                          : "bg-emerald-700 hover:bg-emerald-800"
                      }`}
                      disabled={isPending}
                      ref={confirmRef}
                      type="submit"
                    >
                      {isPending
                        ? "Guardando…"
                        : isActive
                          ? "Desactivar centro"
                          : "Reactivar centro"}
                    </button>
                  </div>
                </form>
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
