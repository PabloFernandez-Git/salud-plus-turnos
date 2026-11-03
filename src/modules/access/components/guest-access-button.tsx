"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { enterPortfolioDemoAsGuest } from "../domain/guest-auth";

type TurnstileWidget = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  remove(id: string): void;
  reset(id: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

export function GuestAccessButton({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const router = useRouter();
  const challenge = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    let mounted = true;
    let script: HTMLScriptElement | null = null;
    const renderWidget = () => {
      if (!mounted || !challenge.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(challenge.current, {
        sitekey: turnstileSiteKey,
        callback: setCaptchaToken,
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
      });
    };

    if (window.turnstile) renderWidget();
    else {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    }

    return () => {
      mounted = false;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      script?.remove();
    };
  }, [turnstileSiteKey]);

  async function enter() {
    if (pending || (turnstileSiteKey && !captchaToken)) return;
    setPending(true);
    setError(false);
    try {
      await enterPortfolioDemoAsGuest(
        createSupabaseBrowserClient().auth,
        captchaToken ?? undefined,
      );
      router.replace("/");
      router.refresh();
    } catch {
      setError(true);
      setCaptchaToken(null);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-200 pt-5">
      {turnstileSiteKey ? <div ref={challenge} aria-label="Verificación de seguridad" /> : null}
      <button
        className="min-h-11 w-full rounded-md border border-sky-600 bg-white px-4 py-2.5 font-semibold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending || Boolean(turnstileSiteKey && !captchaToken)}
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
