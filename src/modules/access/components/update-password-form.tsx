"use client";

import { useActionState } from "react";

import { updatePasswordAction, type AuthActionState } from "../actions/auth-actions";
import { ActionMessage } from "./action-message";
import { SubmitButton } from "./submit-button";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, {
    status: "idle",
  } satisfies AuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <ActionMessage state={state} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="password">
          Nueva contraseña
        </label>
        <input
          aria-describedby="password-help password-error"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="new-password"
          autoFocus
          className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          id="password"
          minLength={10}
          name="password"
          type="password"
        />
        <p className="text-xs text-slate-500" id="password-help">
          Usá al menos 10 caracteres.
        </p>
        {state.fieldErrors?.password ? (
          <p className="text-sm text-red-700" id="password-error">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="passwordConfirmation">
          Confirmar contraseña
        </label>
        <input
          aria-describedby={
            state.fieldErrors?.passwordConfirmation ? "password-confirmation-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.passwordConfirmation)}
          autoComplete="new-password"
          className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          id="passwordConfirmation"
          minLength={10}
          name="passwordConfirmation"
          type="password"
        />
        {state.fieldErrors?.passwordConfirmation ? (
          <p className="text-sm text-red-700" id="password-confirmation-error">
            {state.fieldErrors.passwordConfirmation[0]}
          </p>
        ) : null}
      </div>
      <SubmitButton idleLabel="Actualizar contraseña" pendingLabel="Actualizando…" />
    </form>
  );
}
