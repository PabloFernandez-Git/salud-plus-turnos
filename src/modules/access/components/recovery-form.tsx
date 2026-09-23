"use client";

import Link from "next/link";
import { useActionState } from "react";

import { recoveryAction, type AuthActionState } from "../actions/auth-actions";
import { ActionMessage } from "./action-message";
import { SubmitButton } from "./submit-button";

export function RecoveryForm() {
  const [state, formAction] = useActionState(recoveryAction, {
    status: "idle",
  } satisfies AuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <ActionMessage state={state} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="email">
          Email
        </label>
        <input
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoComplete="email"
          autoFocus
          className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          id="email"
          name="email"
          type="email"
        />
        {state.fieldErrors?.email ? (
          <p className="text-sm text-red-700" id="email-error">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>
      <SubmitButton idleLabel="Enviar instrucciones" pendingLabel="Enviando…" />
      <p className="text-center text-sm text-slate-600">
        <Link className="font-medium text-sky-700 underline-offset-4 hover:underline" href="/login">
          Volver al login
        </Link>
      </p>
    </form>
  );
}
