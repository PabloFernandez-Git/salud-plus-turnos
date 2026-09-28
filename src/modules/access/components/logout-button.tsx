"use client";

import { useActionState } from "react";

import { logoutAction, type AuthActionState } from "../actions/auth-actions";
import { ActionMessage } from "./action-message";
import { SubmitButton } from "./submit-button";

export function LogoutButton() {
  const [state, formAction] = useActionState(logoutAction, {
    status: "idle",
  } satisfies AuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <ActionMessage state={state} />
      <SubmitButton idleLabel="Cerrar sesión" pendingLabel="Cerrando sesión…" />
    </form>
  );
}
