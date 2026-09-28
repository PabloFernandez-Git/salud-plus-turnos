"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  createPlatformCenterAction,
  resolvePlatformIdentityAction,
} from "../actions/platform-actions";
import type {
  PlatformActionState,
  PlatformIdentityActionState,
} from "../domain/platform-action-state";
import { DEFAULT_PLATFORM_TIMEZONE, type PlatformCenterIntentPayload } from "../schemas/platform";
import { ActionMessage } from "./action-message";
import { usePlatformOperationIntent } from "./use-platform-operation-intent";

const initialCreateState: PlatformActionState = { status: "idle" };

function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  if (!errors?.length) return null;
  return (
    <p className="text-sm text-red-700" id={id}>
      {errors[0]}
    </p>
  );
}

function CenterFormActions({
  onChangeEmail,
  onNewIntent,
  retry,
}: {
  onChangeEmail: () => void;
  onNewIntent: () => void;
  retry: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Guardando…" : retry ? "Reintentar / verificar" : "Crear centro"}
      </button>
      {retry ? (
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={onNewIntent}
          type="button"
        >
          Abandonar e iniciar nueva alta
        </button>
      ) : (
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={onChangeEmail}
          type="button"
        >
          Cambiar email
        </button>
      )}
    </div>
  );
}

function CenterDetailsForm({
  email,
  identityExists,
  initialValues,
  isRecoveredIntent,
  onChangeEmail,
  onClearPendingIntent,
  onNewIntent,
  onPersistPendingIntent,
  operationId,
}: {
  email: string;
  identityExists: boolean;
  initialValues?: PlatformCenterIntentPayload;
  isRecoveredIntent: boolean;
  onChangeEmail: () => void;
  onClearPendingIntent: () => void;
  onNewIntent: () => void;
  onPersistPendingIntent: (payload: PlatformCenterIntentPayload) => boolean;
  operationId: string;
}) {
  const submitLatched = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(() => ({
    centerName: initialValues?.centerName ?? "",
    centerAddress: initialValues?.centerAddress ?? "",
    centerPhone: initialValues?.centerPhone ?? "",
    centerEmail: initialValues?.centerEmail ?? "",
    centerTimezone: initialValues?.centerTimezone ?? DEFAULT_PLATFORM_TIMEZONE,
    adminFirstName: initialValues?.adminFirstName ?? "",
    adminLastName: initialValues?.adminLastName ?? "",
    adminInitialPassword: "",
  }));
  const createCenterWithLatch = useCallback(
    async (previousState: PlatformActionState, formData: FormData) => {
      try {
        return await createPlatformCenterAction(previousState, formData);
      } catch {
        return {
          status: "error" as const,
          retryMode: "same-operation" as const,
          message: "No pudimos confirmar el resultado. Reintentá esta misma operación.",
        };
      } finally {
        formData.delete("adminInitialPassword");
        if (passwordInput.current) passwordInput.current.value = "";
        setValues((current) =>
          current.adminInitialPassword === "" ? current : { ...current, adminInitialPassword: "" },
        );
        submitLatched.current = false;
      }
    },
    [],
  );
  const [state, formAction] = useActionState(createCenterWithLatch, initialCreateState);
  const lockedPayload = useRef<PlatformCenterIntentPayload | null>(initialValues ?? null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const locksIntent = isRecoveredIntent || state.retryMode === "same-operation";
  const isComplete = state.status === "success" || state.status === "confirmed";

  useEffect(() => {
    if (state.status === "idle" || state.retryMode === "same-operation") return;
    onClearPendingIntent();
    if (state.status === "error") lockedPayload.current = null;
  }, [onClearPendingIntent, state.retryMode, state.status]);

  function updateValue(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function persistIntentBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (submitLatched.current) {
      event.preventDefault();
      return;
    }

    const payload =
      lockedPayload.current ??
      ({
        centerName: values.centerName,
        centerAddress: values.centerAddress,
        centerPhone: values.centerPhone,
        centerEmail: values.centerEmail,
        centerTimezone: values.centerTimezone,
        adminEmail: email,
        adminFirstName: values.adminFirstName,
        adminLastName: values.adminLastName,
        identityExists,
      } satisfies PlatformCenterIntentPayload);

    if (!onPersistPendingIntent(payload)) {
      event.preventDefault();
      setStorageError(
        "No pudimos preservar esta intención en la sesión del navegador. No se envió el alta.",
      );
      return;
    }

    lockedPayload.current = payload;
    submitLatched.current = true;
    setStorageError(null);
  }

  if (isComplete) {
    return (
      <div className="space-y-4">
        <ActionMessage state={state} />
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          onClick={onNewIntent}
          type="button"
        >
          Crear otro centro
        </button>
      </div>
    );
  }

  if (state.retryMode === "new-operation") {
    return (
      <div className="space-y-4">
        <ActionMessage state={state} />
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          onClick={onNewIntent}
          type="button"
        >
          Iniciar una nueva alta
        </button>
      </div>
    );
  }

  const inputClass =
    "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 read-only:bg-slate-100";

  return (
    <form action={formAction} className="space-y-6" noValidate onSubmit={persistIntentBeforeSubmit}>
      <input name="operationId" type="hidden" value={operationId} />
      <input name="isRetryingOperation" type="hidden" value={String(locksIntent)} />
      <input name="adminEmail" type="hidden" value={email} />
      <ActionMessage state={state} />

      {storageError ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {storageError}
        </p>
      ) : null}

      {locksIntent ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Hay una creación de centro pendiente de confirmar. Recuperamos el mismo identificador y
          fijamos sus datos no secretos. Reintentá para verificar el resultado o abandoná esta
          intención explícitamente para iniciar otra.
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-950">Datos del centro</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-800">Nombre</span>
            <input
              aria-describedby={state.fieldErrors?.centerName ? "center-name-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors?.centerName)}
              className={inputClass}
              name="centerName"
              onChange={(event) => updateValue("centerName", event.target.value)}
              readOnly={locksIntent}
              required
              value={values.centerName}
            />
            <FieldError errors={state.fieldErrors?.centerName} id="center-name-error" />
          </label>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-800">Dirección</span>
            <input
              className={inputClass}
              name="centerAddress"
              onChange={(event) => updateValue("centerAddress", event.target.value)}
              readOnly={locksIntent}
              value={values.centerAddress}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Teléfono</span>
            <input
              className={inputClass}
              name="centerPhone"
              onChange={(event) => updateValue("centerPhone", event.target.value)}
              readOnly={locksIntent}
              type="tel"
              value={values.centerPhone}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Email del centro</span>
            <input
              aria-describedby={state.fieldErrors?.centerEmail ? "center-email-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors?.centerEmail)}
              className={inputClass}
              name="centerEmail"
              onChange={(event) => updateValue("centerEmail", event.target.value)}
              readOnly={locksIntent}
              type="email"
              value={values.centerEmail}
            />
            <FieldError errors={state.fieldErrors?.centerEmail} id="center-email-error" />
          </label>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-800">Timezone</span>
            <input
              aria-describedby={
                state.fieldErrors?.centerTimezone ? "center-timezone-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.centerTimezone)}
              className={inputClass}
              name="centerTimezone"
              onChange={(event) => updateValue("centerTimezone", event.target.value)}
              readOnly={locksIntent}
              required
              value={values.centerTimezone}
            />
            <FieldError errors={state.fieldErrors?.centerTimezone} id="center-timezone-error" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-950">Primer ADMIN</legend>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <span className="font-medium">{email}</span>
          <span className="mt-1 block">
            {identityExists
              ? "Identidad existente: no cambiaremos email, nombre, apellido ni contraseña."
              : "Identidad nueva: se creará confirmada con la contraseña inicial indicada."}
          </span>
        </div>

        {!identityExists ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Nombre</span>
              <input
                aria-describedby={
                  state.fieldErrors?.adminFirstName ? "admin-first-name-error" : undefined
                }
                aria-invalid={Boolean(state.fieldErrors?.adminFirstName)}
                autoComplete="given-name"
                className={inputClass}
                name="adminFirstName"
                onChange={(event) => updateValue("adminFirstName", event.target.value)}
                readOnly={locksIntent}
                required
                value={values.adminFirstName}
              />
              <FieldError errors={state.fieldErrors?.adminFirstName} id="admin-first-name-error" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Apellido</span>
              <input
                aria-describedby={
                  state.fieldErrors?.adminLastName ? "admin-last-name-error" : undefined
                }
                aria-invalid={Boolean(state.fieldErrors?.adminLastName)}
                autoComplete="family-name"
                className={inputClass}
                name="adminLastName"
                onChange={(event) => updateValue("adminLastName", event.target.value)}
                readOnly={locksIntent}
                required
                value={values.adminLastName}
              />
              <FieldError errors={state.fieldErrors?.adminLastName} id="admin-last-name-error" />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-800">Contraseña inicial</span>
              <input
                aria-describedby={
                  state.fieldErrors?.adminInitialPassword ? "admin-password-error" : undefined
                }
                aria-invalid={Boolean(state.fieldErrors?.adminInitialPassword)}
                autoComplete="new-password"
                className={inputClass}
                minLength={10}
                name="adminInitialPassword"
                onChange={(event) => updateValue("adminInitialPassword", event.target.value)}
                ref={passwordInput}
                required={!locksIntent || Boolean(state.fieldErrors?.adminInitialPassword)}
                type="password"
                value={values.adminInitialPassword}
              />
              <p className="text-xs text-slate-500">
                {locksIntent
                  ? "La contraseña no se guardó. Si Auth todavía la necesita, volvé a ingresarla."
                  : "Mínimo 10 caracteres."}
              </p>
              <FieldError
                errors={state.fieldErrors?.adminInitialPassword}
                id="admin-password-error"
              />
            </label>
          </div>
        ) : null}
      </fieldset>

      <CenterFormActions
        onChangeEmail={onChangeEmail}
        onNewIntent={onNewIntent}
        retry={locksIntent}
      />
    </form>
  );
}

export function CreateCenterPanel({ actorUserId }: { actorUserId: string }) {
  const {
    abandonError,
    clearPendingIntent,
    isHydrated,
    operationId,
    pendingIntent,
    persistPendingIntent,
    recoveryStatus,
    startNewIntent,
    wasRecovered,
  } = usePlatformOperationIntent(actorUserId);
  const [email, setEmail] = useState("");
  const [resolution, setResolution] = useState<PlatformIdentityActionState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function resetForNewIntent() {
    startNewIntent();
    setEmail("");
    setResolution({ status: "idle" });
  }

  function resolveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setResolution(await resolvePlatformIdentityAction(email));
    });
  }

  const recoveredIntent = wasRecovered ? pendingIntent : null;
  const resolvedEmail = recoveredIntent?.payload.adminEmail ?? resolution.email;
  const resolvedIdentityExists =
    recoveredIntent?.payload.identityExists ?? resolution.identityExists;
  const resolved =
    Boolean(recoveredIntent) ||
    (resolution.status === "success" &&
      resolvedEmail &&
      typeof resolvedIdentityExists === "boolean");

  return (
    <section
      className="scroll-mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      id="crear-centro"
    >
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-950">Crear centro</h2>
        <p className="text-sm leading-6 text-slate-600">
          Primero resolvemos el email exacto del primer ADMIN. La misma intención conserva su ID en
          cada reintento; “Crear otro centro” inicia una nueva.
        </p>
      </div>

      {!isHydrated ? (
        <p className="text-sm text-slate-600" role="status">
          Recuperando la intención de alta…
        </p>
      ) : recoveryStatus === "invalid" ? (
        <div className="max-w-2xl space-y-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="space-y-2" role="alert">
            <p className="font-semibold text-amber-950">
              Hay una creación de centro pendiente que no puede recuperarse de forma segura.
            </p>
            <p className="text-sm leading-6 text-amber-900">
              No se iniciará una nueva operación automáticamente. Podés conservar este estado o
              abandonar deliberadamente la intención pendiente para comenzar otra.
            </p>
            {abandonError ? (
              <p className="text-sm font-medium text-red-800">{abandonError}</p>
            ) : null}
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-amber-400 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            onClick={startNewIntent}
            type="button"
          >
            Abandonar intención pendiente e iniciar una nueva alta
          </button>
        </div>
      ) : !operationId ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          No pudimos preparar una intención segura. No se habilitó el alta.
        </p>
      ) : !resolved ? (
        <form className="max-w-xl space-y-3" onSubmit={resolveEmail}>
          <input name="operationId" type="hidden" value={operationId} />
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Email del primer ADMIN</span>
            <input
              aria-describedby={resolution.fieldErrors?.email ? "identity-email-error" : undefined}
              aria-invalid={Boolean(resolution.fieldErrors?.email)}
              autoComplete="email"
              className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <FieldError errors={resolution.fieldErrors?.email} id="identity-email-error" />
          <ActionMessage state={resolution} />
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Verificando…" : "Continuar"}
          </button>
        </form>
      ) : (
        <CenterDetailsForm
          email={resolvedEmail!}
          identityExists={resolvedIdentityExists!}
          initialValues={recoveredIntent?.payload}
          isRecoveredIntent={Boolean(recoveredIntent)}
          key={`${operationId}:${resolvedEmail}`}
          onChangeEmail={() => setResolution({ status: "idle" })}
          onClearPendingIntent={clearPendingIntent}
          onNewIntent={resetForNewIntent}
          onPersistPendingIntent={persistPendingIntent}
          operationId={operationId}
        />
      )}
    </section>
  );
}
