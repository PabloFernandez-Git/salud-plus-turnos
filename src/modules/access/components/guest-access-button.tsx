"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { enterPortfolioDemoAsGuest } from "../domain/guest-auth";

export function GuestAccessButton({
  captchaToken,
  resetCaptcha,
}: {
  captchaToken: string | null;
  resetCaptcha: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function enter() {
    if (pending || !captchaToken) return;
    setPending(true);
    setError(false);
    try {
      await enterPortfolioDemoAsGuest(createSupabaseBrowserClient().auth, captchaToken);
      router.replace("/");
      router.refresh();
    } catch {
      setError(true);
      resetCaptcha();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        className="min-h-11 w-full cursor-pointer rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || !captchaToken}
        onClick={enter}
        type="button"
      >
        {pending ? "Ingresando a la demo…" : "Explorar demo como invitado"}
      </button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          No pudimos abrir la demo. Intentá nuevamente.
        </p>
      ) : null}
    </div>
  );
}
