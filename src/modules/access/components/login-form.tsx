"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthActionState } from "../actions/auth-actions";
import { ActionMessage } from "./action-message";
import { SubmitButton } from "./submit-button";

export function LoginForm({ callbackError = false }: { callbackError?: boolean }) {
  const [state, formAction] = useActionState(loginAction, {
    status: "idle",
  } satisfies AuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {callbackError ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          No pudimos validar el enlace. Solicitá uno nuevo si necesitás recuperar tu contraseña.
        </p>
      ) : null}
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
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="password">
          Contraseña
        </label>
        <input
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="current-password"
          className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          id="password"
          name="password"
          type="password"
        />
        {state.fieldErrors?.password ? (
          <p className="text-sm text-red-700" id="password-error">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>
      <SubmitButton idleLabel="Ingresar" pendingLabel="Ingresando…" />
      <p className="text-center text-sm text-slate-600">
        <Link
          className="font-medium text-sky-700 underline-offset-4 hover:underline"
          href="/forgot-password"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </form>
  );
}
