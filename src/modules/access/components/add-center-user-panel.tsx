"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  provisionCenterUserAction,
  resolveCenterIdentityAction,
} from "../actions/center-user-actions";
import type {
  CenterUserActionState,
  CenterUserIdentityActionState,
} from "../domain/center-user-action-state";
import type { CenterUserIntentPayload } from "../schemas/center-user-provisioning";
import type { AvailableProfessionalCenter } from "../server/center-users";
import { ActionMessage } from "./action-message";
import { useCenterUserOperationIntent } from "./use-center-user-operation-intent";

const initialProvisionState: CenterUserActionState = { status: "idle" };

function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  if (!errors?.length) return null;
  return (
    <p className="text-sm text-red-700" id={id}>
      {errors[0]}
    </p>
  );
}

function ProvisionActions({
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
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Guardando…" : retry ? "Reintentar / verificar" : "Agregar al centro"}
      </button>
      {retry ? (
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={onNewIntent}
          type="button"
        >
          Abandonar e iniciar otra alta
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

function UserDetailsForm({
  centerId,
  email,
  firstName,
  identityExists,
  initialValues,
  isRecoveredIntent,
  lastName,
  onChangeEmail,
  onClearPendingIntent,
  onNewIntent,
  onPersistPendingIntent,
  operationId,
  professionalCenters,
}: {
  centerId: string;
  email: string;
  firstName: string;
  identityExists: boolean;
  initialValues?: CenterUserIntentPayload;
  isRecoveredIntent: boolean;
  lastName: string;
  onChangeEmail: () => void;
  onClearPendingIntent: () => void;
  onNewIntent: () => void;
  onPersistPendingIntent: (payload: CenterUserIntentPayload) => boolean;
  operationId: string;
  professionalCenters: AvailableProfessionalCenter[];
}) {
  const submitLatched = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(() => ({
    firstName: initialValues?.firstName ?? firstName,
    lastName: initialValues?.lastName ?? lastName,
    initialPassword: "",
    role: initialValues?.role ?? ("RECEPTION" as const),
    professionalCenterId: initialValues?.professionalCenterId ?? "",
  }));
  const provisionWithLatch = useCallback(
    async (previousState: CenterUserActionState, formData: FormData) => {
      try {
        return await provisionCenterUserAction(previousState, formData);
      } catch {
        return {
          status: "error" as const,
          retryMode: "same-operation" as const,
          message: "No pudimos confirmar el resultado. Reintentá esta misma operación.",
        };
      } finally {
        formData.delete("initialPassword");
        if (passwordInput.current) passwordInput.current.value = "";
        setValues((current) =>
          current.initialPassword === "" ? current : { ...current, initialPassword: "" },
        );
        submitLatched.current = false;
      }
    },
    [],
  );
  const [state, formAction] = useActionState(provisionWithLatch, initialProvisionState);
  const lockedPayload = useRef<CenterUserIntentPayload | null>(initialValues ?? null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const locksIntent = isRecoveredIntent || state.retryMode === "same-operation";
  const isComplete = state.status === "success" || state.status === "confirmed";
  const recoveredProfessionalCenterMissing = Boolean(
    locksIntent &&
    values.professionalCenterId &&
    !professionalCenters.some((option) => option.id === values.professionalCenterId),
  );

  useEffect(() => {
    if (state.status === "idle" || state.retryMode === "same-operation") return;
    onClearPendingIntent();
    if (state.status === "error") lockedPayload.current = null;
  }, [onClearPendingIntent, state]);

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
        email,
        identityExists,
        firstName: identityExists ? firstName : values.firstName,
        lastName: identityExists ? lastName : values.lastName,
        role: values.role,
        professionalCenterId:
          values.role === "PROFESSIONAL" ? values.professionalCenterId || null : null,
      } satisfies CenterUserIntentPayload);

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
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={onNewIntent}
          type="button"
        >
          Agregar otro usuario
        </button>
      </div>
    );
  }

  if (state.retryMode === "new-operation") {
    return (
      <div className="space-y-4">
        <ActionMessage state={state} />
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={onNewIntent}
          type="button"
        >
          Iniciar una nueva alta
        </button>
      </div>
    );
  }

  const inputClass =
    "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 read-only:bg-slate-100 disabled:bg-slate-100";

  return (
    <form action={formAction} className="space-y-6" noValidate onSubmit={persistIntentBeforeSubmit}>
      <input name="operationId" type="hidden" value={operationId} />
      <input name="isRetryingOperation" type="hidden" value={String(locksIntent)} />
      <input name="centerId" type="hidden" value={centerId} />
      <input name="email" type="hidden" value={email} />
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
          Hay un alta pendiente de confirmar. Recuperamos el mismo identificador y fijamos sus datos
          no secretos. Reintentá para verificar el resultado o abandoná esta intención.
        </p>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        <p className="font-medium">{email}</p>
        <p className="mt-1">
          {identityExists
            ? `${firstName} ${lastName}. Reutilizaremos esta cuenta sin cambiar sus datos ni credenciales.`
            : "Identidad nueva: se creará confirmada con los datos y la contraseña inicial indicados."}
        </p>
      </div>

      {!identityExists ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Nombre</span>
            <input
              aria-describedby={
                state.fieldErrors?.firstName ? "center-user-first-name-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.firstName)}
              autoComplete="given-name"
              className={inputClass}
              name="firstName"
              onChange={(event) => updateValue("firstName", event.target.value)}
              readOnly={locksIntent}
              required
              value={values.firstName}
            />
            <FieldError errors={state.fieldErrors?.firstName} id="center-user-first-name-error" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Apellido</span>
            <input
              aria-describedby={
                state.fieldErrors?.lastName ? "center-user-last-name-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.lastName)}
              autoComplete="family-name"
              className={inputClass}
              name="lastName"
              onChange={(event) => updateValue("lastName", event.target.value)}
              readOnly={locksIntent}
              required
              value={values.lastName}
            />
            <FieldError errors={state.fieldErrors?.lastName} id="center-user-last-name-error" />
          </label>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-800">Contraseña inicial</span>
            <input
              aria-label="Contraseña inicial"
              aria-describedby={
                state.fieldErrors?.initialPassword ? "center-user-password-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.initialPassword)}
              autoComplete="new-password"
              className={inputClass}
              minLength={10}
              name="initialPassword"
              onChange={(event) => updateValue("initialPassword", event.target.value)}
              ref={passwordInput}
              required={!locksIntent || Boolean(state.fieldErrors?.initialPassword)}
              type="password"
              value={values.initialPassword}
            />
            <p className="text-xs text-slate-500">
              {locksIntent
                ? "La contraseña no se guardó. Si Auth todavía la necesita, volvé a ingresarla."
                : "Mínimo 10 caracteres."}
            </p>
            <FieldError
              errors={state.fieldErrors?.initialPassword}
              id="center-user-password-error"
            />
          </label>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-800">Rol</span>
          <select
            aria-label="Rol"
            aria-describedby={state.fieldErrors?.role ? "center-user-role-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors?.role)}
            className={inputClass}
            disabled={locksIntent}
            name="role"
            onChange={(event) => {
              const role = event.target.value as typeof values.role;
              setValues((current) => ({
                ...current,
                role,
                professionalCenterId: role === "PROFESSIONAL" ? current.professionalCenterId : "",
              }));
            }}
            value={values.role}
          >
            <option value="ADMIN">Administrador</option>
            <option value="RECEPTION">Recepción</option>
            <option disabled={professionalCenters.length === 0} value="PROFESSIONAL">
              Profesional{professionalCenters.length === 0 ? " (sin vínculos disponibles)" : ""}
            </option>
          </select>
          {locksIntent ? <input name="role" type="hidden" value={values.role} /> : null}
          <FieldError errors={state.fieldErrors?.role} id="center-user-role-error" />
          {professionalCenters.length === 0 ? (
            <p className="text-xs text-amber-700">
              El rol Profesional no está disponible porque este centro no tiene un vínculo
              profesional activo y libre.
            </p>
          ) : null}
        </label>

        {values.role === "PROFESSIONAL" ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Profesional asociado</span>
            <select
              aria-label="Profesional asociado"
              aria-describedby={
                state.fieldErrors?.professionalCenterId
                  ? "center-user-professional-center-error"
                  : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.professionalCenterId)}
              className={inputClass}
              disabled={locksIntent}
              name="professionalCenterId"
              onChange={(event) => updateValue("professionalCenterId", event.target.value)}
              required
              value={values.professionalCenterId}
            >
              <option value="">Seleccioná un profesional</option>
              {recoveredProfessionalCenterMissing ? (
                <option value={values.professionalCenterId}>
                  Profesional fijado en la intención
                </option>
              ) : null}
              {professionalCenters.map((professionalCenter) => (
                <option key={professionalCenter.id} value={professionalCenter.id}>
                  {professionalCenter.lastName}, {professionalCenter.firstName}
                  {professionalCenter.licenseNumber ? ` · ${professionalCenter.licenseNumber}` : ""}
                </option>
              ))}
            </select>
            {locksIntent ? (
              <input
                name="professionalCenterId"
                type="hidden"
                value={values.professionalCenterId}
              />
            ) : null}
            <FieldError
              errors={state.fieldErrors?.professionalCenterId}
              id="center-user-professional-center-error"
            />
          </label>
        ) : (
          <input name="professionalCenterId" type="hidden" value="" />
        )}
      </div>

      <ProvisionActions
        onChangeEmail={onChangeEmail}
        onNewIntent={onNewIntent}
        retry={locksIntent}
      />
    </form>
  );
}

export function AddCenterUserPanel({
  actorUserId,
  centerId,
  professionalCenters,
}: {
  actorUserId: string;
  centerId: string;
  professionalCenters: AvailableProfessionalCenter[];
}) {
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
  } = useCenterUserOperationIntent(actorUserId, centerId);
  const [isOpen, setIsOpen] = useState(Boolean(pendingIntent) || recoveryStatus === "invalid");
  const [email, setEmail] = useState("");
  const [resolution, setResolution] = useState<CenterUserIdentityActionState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function resetForNewIntent() {
    startNewIntent();
    setEmail("");
    setResolution({ status: "idle" });
    setIsOpen(true);
  }

  function resolveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setResolution(await resolveCenterIdentityAction(centerId, email));
    });
  }

  const recoveredIntent = wasRecovered ? pendingIntent : null;
  const resolvedEmail = recoveredIntent?.payload.email ?? resolution.email;
  const resolvedIdentityExists =
    recoveredIntent?.payload.identityExists ?? resolution.identityExists;
  const resolvedFirstName = recoveredIntent?.payload.firstName ?? resolution.firstName ?? "";
  const resolvedLastName = recoveredIntent?.payload.lastName ?? resolution.lastName ?? "";
  const resolved =
    Boolean(recoveredIntent) ||
    (resolution.status === "success" &&
      resolvedEmail &&
      typeof resolvedIdentityExists === "boolean");

  return (
    <section
      className="scroll-mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      id="agregar-usuario"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-950">Agregar usuario</h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Resolvé un email exacto y agregá únicamente su acceso a este centro. Si la cuenta ya
            existe, sus datos y credenciales se conservan.
          </p>
        </div>
        {!isOpen ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            Agregar usuario
          </button>
        ) : null}
      </div>

      {!isOpen ? null : !isHydrated ? (
        <p className="text-sm text-slate-600" role="status">
          Recuperando la intención de alta…
        </p>
      ) : recoveryStatus === "invalid" ? (
        <div className="max-w-2xl space-y-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="space-y-2" role="alert">
            <p className="font-semibold text-amber-950">
              Hay un alta pendiente que no puede recuperarse de forma segura.
            </p>
            <p className="text-sm leading-6 text-amber-900">
              No se iniciará otra operación automáticamente. Podés abandonar deliberadamente esa
              intención para comenzar una nueva.
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
            Abandonar intención pendiente e iniciar otra alta
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
          <input name="centerId" type="hidden" value={centerId} />
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Email</span>
            <input
              aria-describedby={
                resolution.fieldErrors?.email ? "center-user-email-error" : undefined
              }
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
          <FieldError errors={resolution.fieldErrors?.email} id="center-user-email-error" />
          <ActionMessage state={resolution} />
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Verificando…" : "Continuar"}
          </button>
        </form>
      ) : resolution.membershipExists ? (
        <div className="max-w-2xl space-y-4">
          <ActionMessage state={resolution} />
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setEmail("");
              setResolution({ status: "idle" });
            }}
            type="button"
          >
            Buscar otro email
          </button>
        </div>
      ) : (
        <UserDetailsForm
          centerId={centerId}
          email={resolvedEmail!}
          firstName={resolvedFirstName}
          identityExists={resolvedIdentityExists!}
          initialValues={recoveredIntent?.payload}
          isRecoveredIntent={Boolean(recoveredIntent)}
          key={`${operationId}:${resolvedEmail}`}
          lastName={resolvedLastName}
          onChangeEmail={() => setResolution({ status: "idle" })}
          onClearPendingIntent={clearPendingIntent}
          onNewIntent={resetForNewIntent}
          onPersistPendingIntent={persistPendingIntent}
          operationId={operationId}
          professionalCenters={professionalCenters}
        />
      )}
    </section>
  );
}
