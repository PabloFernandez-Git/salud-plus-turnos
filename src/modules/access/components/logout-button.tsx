"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { modalActionGroupClass } from "@/components/modal-action-group";

import { logoutAction, type AuthActionState } from "../actions/auth-actions";
import { ActionMessage } from "./action-message";
import { SubmitButton } from "./submit-button";

function ImmediateLogoutButton({ variant }: { variant: "primary" | "quiet" }) {
  const [state, formAction] = useActionState(logoutAction, {
    status: "idle",
  } satisfies AuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <ActionMessage state={state} />
      <SubmitButton idleLabel="Cerrar sesión" pendingLabel="Cerrando sesión…" variant={variant} />
    </form>
  );
}

function LogoutConfirmation({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(logoutAction, {
    status: "idle",
  } satisfies AuthActionState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
  }, []);
  useEffect(() => {
    if (state.status === "error") submittingRef.current = false;
  }, [state]);
  useEffect(() => {
    if (isPending) dialogRef.current?.focus();
  }, [isPending]);

  function requestClose() {
    if (!isPending && !submittingRef.current) dialogRef.current?.close();
  }

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50"
      onCancel={(event) => {
        if (isPending || submittingRef.current) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < left ||
          event.clientX >= right ||
          event.clientY < top ||
          event.clientY >= bottom
        )
          requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        if (isPending) {
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
      onClose={onClose}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-950" id={titleId}>
          ¿Querés cerrar sesión?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-700" id={descriptionId}>
          Podés volver a ingresar a Salud Plus cuando quieras.
        </p>
        <form
          action={formAction}
          onSubmit={(event) => {
            if (isPending || submittingRef.current) event.preventDefault();
            else submittingRef.current = true;
          }}
        >
          {state.message && (
            <div className="mt-4">
              <ActionMessage state={state} />
            </div>
          )}
          <div className={`${modalActionGroupClass} mt-6`}>
            <button
              className="h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
              disabled={isPending}
              onClick={requestClose}
              ref={cancelRef}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="h-11 rounded-md bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              ref={confirmRef}
              type="submit"
            >
              {isPending ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export function LogoutButton({
  variant = "primary",
  confirm = false,
}: {
  variant?: "primary" | "quiet";
  confirm?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!confirm) return <ImmediateLogoutButton variant={variant} />;

  return (
    <>
      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Cerrar sesión
      </button>
      {open && (
        <LogoutConfirmation
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        />
      )}
    </>
  );
}
