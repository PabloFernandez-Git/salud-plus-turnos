"use client";

import { LogOut } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { modalActionGroupClass } from "@/components/modal-action-group";

import { logoutAction, type AuthActionState } from "../actions/auth-actions";
import { ActionMessage } from "./action-message";
import { SubmitButton } from "./submit-button";

function ImmediateLogoutButton({
  variant,
  iconOnly,
}: {
  variant: "primary" | "quiet";
  iconOnly: boolean;
}) {
  const [state, formAction, isPending] = useActionState(logoutAction, {
    status: "idle",
  } satisfies AuthActionState);

  return (
    <form action={formAction} className={iconOnly ? "relative" : "space-y-2"}>
      {iconOnly ? (
        state.message && (
          <div className="absolute top-full left-0 z-50 mt-2 w-[min(20rem,calc(100vw-2.5rem))] sm:right-0 sm:left-auto">
            <ActionMessage state={state} />
          </div>
        )
      ) : (
        <ActionMessage state={state} />
      )}
      {iconOnly ? (
        <button
          aria-label={isPending ? "Cerrando sesión…" : "Cerrar sesión"}
          className="group relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-full z-50 mt-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-0 sm:left-auto"
          >
            {isPending ? "Cerrando sesión…" : "Cerrar sesión"}
          </span>
        </button>
      ) : (
        <SubmitButton idleLabel="Cerrar sesión" pendingLabel="Cerrando sesión…" variant={variant} />
      )}
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
  iconOnly = false,
}: {
  variant?: "primary" | "quiet";
  confirm?: boolean;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!confirm) return <ImmediateLogoutButton iconOnly={iconOnly} variant={variant} />;

  return (
    <>
      <button
        aria-label="Cerrar sesión"
        className="group relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <LogOut aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-full z-50 mt-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-0 sm:left-auto"
        >
          Cerrar sesión
        </span>
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
