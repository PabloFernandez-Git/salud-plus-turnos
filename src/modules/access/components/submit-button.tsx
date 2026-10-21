"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  idleLabel,
  pendingLabel,
  variant = "primary",
}: {
  idleLabel: string;
  pendingLabel: string;
  variant?: "primary" | "quiet";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60 ${variant === "quiet" ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-sky-700 text-white hover:bg-sky-800"}`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
