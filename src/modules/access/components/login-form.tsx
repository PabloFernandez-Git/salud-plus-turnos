"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { PasswordInput } from "@/components/password-input";
import { loginAction, type AuthActionState } from "../actions/auth-actions";
import { ActionMessage } from "./action-message";
import { GuestAccessButton } from "./guest-access-button";
import { SubmitButton } from "./submit-button";
import { Turnstile, type TurnstileHandle } from "./turnstile";

type DemoTab = "login" | "guest";

function LoginFields({
  state,
  isPortfolioDemo = false,
}: {
  state: AuthActionState;
  isPortfolioDemo?: boolean;
}) {
  return (
    <>
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
        <PasswordInput
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="current-password"
          id="password"
          name="password"
          toggleCursorPointer={isPortfolioDemo}
        />
        {state.fieldErrors?.password ? (
          <p className="text-sm text-red-700" id="password-error">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function LoginForm({
  callbackError = false,
  isPortfolioDemo = false,
  guestAccessEnabled = false,
  turnstileSiteKey,
}: {
  callbackError?: boolean;
  isPortfolioDemo?: boolean;
  guestAccessEnabled?: boolean;
  turnstileSiteKey?: string;
}) {
  const [state, formAction] = useActionState(loginAction, {
    status: "idle",
  } satisfies AuthActionState);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DemoTab>("login");
  const turnstile = useRef<TurnstileHandle>(null);
  const loginTab = useRef<HTMLButtonElement>(null);
  const guestTab = useRef<HTMLButtonElement>(null);
  const captchaEnabled = isPortfolioDemo && Boolean(turnstileSiteKey);

  useEffect(() => {
    if (state.status === "error" && captchaEnabled) turnstile.current?.reset();
  }, [state, captchaEnabled]);

  const resetCaptcha = () => turnstile.current?.reset();

  function activateTab(nextTab: DemoTab, focusTab = false) {
    setActiveTab(nextTab);
    if (focusTab) (nextTab === "login" ? loginTab : guestTab).current?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab: DemoTab =
      event.key === "Home"
        ? "login"
        : event.key === "End"
          ? "guest"
          : activeTab === "login"
            ? "guest"
            : "login";
    activateTab(nextTab, true);
  }

  if (isPortfolioDemo) {
    return (
      <div>
        {guestAccessEnabled ? (
          <div
            aria-label="Opciones de acceso"
            className="mb-8 grid grid-cols-2 border-b border-slate-200"
            role="tablist"
          >
            <button
              aria-controls="demo-login-panel"
              aria-selected={activeTab === "login"}
              className={`min-h-11 cursor-pointer border-b-2 px-2 py-3 text-sm font-semibold transition focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:text-base ${activeTab === "login" ? "border-sky-700 text-sky-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              id="demo-login-tab"
              onClick={() => activateTab("login")}
              onKeyDown={onTabKeyDown}
              ref={loginTab}
              role="tab"
              tabIndex={activeTab === "login" ? 0 : -1}
              type="button"
            >
              Iniciar sesión
            </button>
            <button
              aria-controls="demo-login-panel"
              aria-selected={activeTab === "guest"}
              className={`min-h-11 cursor-pointer border-b-2 px-2 py-3 text-sm font-semibold transition focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:text-base ${activeTab === "guest" ? "border-sky-700 text-sky-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              id="demo-guest-tab"
              onClick={() => activateTab("guest")}
              onKeyDown={onTabKeyDown}
              ref={guestTab}
              role="tab"
              tabIndex={activeTab === "guest" ? 0 : -1}
              type="button"
            >
              Demo invitado
            </button>
          </div>
        ) : null}
        <div
          aria-labelledby={
            guestAccessEnabled
              ? activeTab === "login"
                ? "demo-login-tab"
                : "demo-guest-tab"
              : undefined
          }
          id="demo-login-panel"
          role={guestAccessEnabled ? "tabpanel" : undefined}
          tabIndex={guestAccessEnabled ? 0 : undefined}
        >
          <form action={formAction} className="space-y-5" noValidate>
            <div className="space-y-2 text-left">
              {activeTab === "login" ? (
                <>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                    Iniciar sesión
                  </h1>
                  <p className="text-sm leading-6 text-slate-600">
                    Ingresá con el usuario y contraseña que te asignó tu centro.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 lg:whitespace-nowrap">
                    Explorá Salud Plus como invitado
                  </h1>
                  <p className="text-sm leading-6 text-slate-600">
                    Conocé nuestro sistema de gestión de turnos médicos. Explorá sus funcionalidades
                    con datos ficticios y acceso de solo lectura.
                  </p>
                </>
              )}
            </div>
            {activeTab === "login" && callbackError ? (
              <p
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                No pudimos validar el enlace. Volvé a iniciar sesión.
              </p>
            ) : null}
            {activeTab === "login" ? <ActionMessage state={state} /> : null}
            <div className="space-y-5" hidden={activeTab !== "login"}>
              <LoginFields isPortfolioDemo state={state} />
            </div>
            {captchaEnabled && turnstileSiteKey ? (
              <>
                <Turnstile
                  onTokenChange={setCaptchaToken}
                  ref={turnstile}
                  siteKey={turnstileSiteKey}
                />
                <input name="captchaToken" type="hidden" value={captchaToken ?? ""} />
              </>
            ) : null}
            {activeTab === "login" ? (
              <SubmitButton
                cursorPointer
                disabled={captchaEnabled && !captchaToken}
                idleLabel="Ingresar"
                pendingLabel="Ingresando…"
              />
            ) : (
              <GuestAccessButton captchaToken={captchaToken} resetCaptcha={resetCaptcha} />
            )}
            {guestAccessEnabled ? (
              <div className="pt-2 text-center text-sm text-slate-600">
                <p>
                  {activeTab === "login" ? "¿Querés conocer el sistema?" : "¿Ya tenés una cuenta?"}
                </p>
                <button
                  className="mt-1 cursor-pointer font-semibold text-sky-700 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                  onClick={() => activateTab(activeTab === "login" ? "guest" : "login", true)}
                  type="button"
                >
                  {activeTab === "login" ? "Explorá la demo como invitado" : "Iniciá sesión"}
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {callbackError ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {isPortfolioDemo
            ? "No pudimos validar el enlace. Volvé a iniciar sesión."
            : "No pudimos validar el enlace. Solicitá uno nuevo si necesitás recuperar tu contraseña."}
        </p>
      ) : null}
      <ActionMessage state={state} />
      <LoginFields state={state} />
      <SubmitButton
        disabled={captchaEnabled && !captchaToken}
        idleLabel="Ingresar"
        pendingLabel="Ingresando…"
      />
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
