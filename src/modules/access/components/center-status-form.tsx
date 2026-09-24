"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { setPlatformCenterActiveAction } from "../actions/platform-actions";
import type { PlatformActionState } from "../domain/platform-action-state";

function StatusButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`inline-flex min-h-9 items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isActive
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
      }`}
      disabled={pending}
      type="submit"
    >
      {pending ? "Guardando…" : isActive ? "Desactivar" : "Reactivar"}
    </button>
  );
}

export function CenterStatusForm({
  centerId,
  centerName,
  isActive,
}: {
  centerId: string;
  centerName: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState(setPlatformCenterActiveAction, {
    status: "idle",
  } satisfies PlatformActionState);

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        const verb = isActive ? "desactivar" : "reactivar";
        if (!window.confirm(`¿Querés ${verb} ${centerName}?`)) event.preventDefault();
      }}
    >
      <input name="centerId" type="hidden" value={centerId} />
      <input name="isActive" type="hidden" value={String(!isActive)} />
      <StatusButton isActive={isActive} />
      {state.message ? (
        <p
          className={state.status === "error" ? "text-xs text-red-700" : "text-xs text-emerald-700"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
