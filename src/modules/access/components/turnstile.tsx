"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": () => boolean;
    },
  ): string;
  remove(id: string): void;
  reset(id: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = { reset(): void };

const scriptId = "portfolio-turnstile-script";
let scriptLoad: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptLoad) return scriptLoad;

  scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
    }
    const currentScript = script;
    const loaded = () => {
      currentScript.removeEventListener("error", failed);
      if (window.turnstile) resolve(window.turnstile);
      else {
        currentScript.remove();
        reject(new Error("TURNSTILE_SCRIPT_UNAVAILABLE"));
      }
    };
    const failed = () => {
      currentScript.removeEventListener("load", loaded);
      currentScript.remove();
      reject(new Error("TURNSTILE_SCRIPT_FAILED"));
    };
    currentScript.addEventListener("load", loaded, { once: true });
    currentScript.addEventListener("error", failed, { once: true });
    if (!currentScript.isConnected) document.head.appendChild(currentScript);
  }).catch((error: unknown) => {
    scriptLoad = null;
    throw error;
  });
  return scriptLoad;
}

export const Turnstile = forwardRef<
  TurnstileHandle,
  { siteKey: string; onTokenChange: (token: string | null) => void }
>(function Turnstile({ siteKey, onTokenChange }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [status, setStatus] = useState<"loading" | "ready" | "expired" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  onTokenChangeRef.current = onTokenChange;

  const reset = useCallback(() => {
    onTokenChangeRef.current(null);
    setStatus("loading");
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    else setAttempt((current) => current + 1);
  }, []);
  useImperativeHandle(ref, () => ({ reset }), [reset]);

  useEffect(() => {
    let active = true;
    void loadTurnstile()
      .then((api) => {
        if (!active || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          callback: (token) => {
            if (!active) return;
            onTokenChangeRef.current(token);
            setStatus("ready");
          },
          "expired-callback": () => {
            if (!active) return;
            onTokenChangeRef.current(null);
            setStatus("expired");
          },
          "timeout-callback": () => {
            if (!active) return;
            onTokenChangeRef.current(null);
            setStatus("expired");
          },
          "error-callback": () => {
            if (active) {
              onTokenChangeRef.current(null);
              setStatus("error");
            }
            return true;
          },
        });
      })
      .catch(() => {
        if (!active) return;
        onTokenChangeRef.current(null);
        setStatus("error");
      });
    return () => {
      active = false;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      onTokenChangeRef.current(null);
    };
  }, [siteKey, attempt]);

  return (
    <div className="space-y-2">
      <div aria-label="Verificación de seguridad" ref={container} />
      {status === "loading" ? (
        <p className="text-sm text-slate-600" role="status">
          Cargando verificación…
        </p>
      ) : null}
      {status === "ready" ? (
        <p className="text-sm text-emerald-700" role="status">
          Verificación completada.
        </p>
      ) : null}
      {status === "expired" || status === "error" ? (
        <div className="space-y-2 text-sm text-red-700" role="alert">
          <p>
            {status === "expired"
              ? "La verificación venció. Intentá nuevamente."
              : "No pudimos completar la verificación. Intentá nuevamente."}
          </p>
          <button
            className="cursor-pointer font-medium underline hover:text-red-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={reset}
            type="button"
          >
            Reintentar verificación
          </button>
        </div>
      ) : null}
    </div>
  );
});
