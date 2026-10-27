"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/components/password-input";
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
  confirmLabel,
  onChangeEmail,
  onNewIntent,
  retry,
}: {
  confirmLabel: string;
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
        {pending ? "Guardando…" : confirmLabel}
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
  onClose,
  onComplete,
  onPendingChange,
  onNewIntent,
  onPersistPendingIntent,
  onStageChange,
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
  onClose: () => void;
  onComplete: (result: CenterUserActionState, identityCreated: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onNewIntent: () => void;
  onPersistPendingIntent: (payload: CenterUserIntentPayload) => boolean;
  onStageChange: (stage: "details" | "review") => void;
  operationId: string;
  professionalCenters: AvailableProfessionalCenter[];
}) {
  const submitLatched = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const successCloseButton = useRef<HTMLButtonElement>(null);
  const [values, setValues] = useState(() => ({
    firstName: initialValues?.firstName ?? firstName,
    lastName: initialValues?.lastName ?? lastName,
    initialPassword: "",
    confirmPassword: "",
    role: initialValues?.role ?? ("RECEPTION" as const),
    professionalCenterId: initialValues?.professionalCenterId ?? "",
  }));
  const [isReviewing, setIsReviewing] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  const provisionWithLatch = useCallback(
    async (previousState: CenterUserActionState, formData: FormData) => {
      try {
        const result = await provisionCenterUserAction(previousState, formData);
        if (result.status === "error" && result.fieldErrors) {
          setLocalErrors({});
          setIsReviewing(false);
          onStageChange("details");
        }
        if (result.status === "success" || result.status === "confirmed")
          onComplete(result, result.identityCreated ?? !identityExists);
        return result;
      } catch {
        return {
          status: "error" as const,
          retryMode: "same-operation" as const,
          message: "No pudimos confirmar el resultado. Reintentá esta misma operación.",
        };
      } finally {
        formData.delete("initialPassword");
        formData.delete("confirmPassword");
        if (passwordInput.current) passwordInput.current.value = "";
        if (confirmationInput.current) confirmationInput.current.value = "";
        setValues((current) =>
          current.initialPassword === "" && current.confirmPassword === ""
            ? current
            : { ...current, initialPassword: "", confirmPassword: "" },
        );
        submitLatched.current = false;
        onPendingChange(false);
      }
    },
    [identityExists, onComplete, onPendingChange, onStageChange],
  );
  const [state, formAction] = useActionState(provisionWithLatch, initialProvisionState);
  const lockedPayload = useRef<CenterUserIntentPayload | null>(initialValues ?? null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [discardRequested, setDiscardRequested] = useState(false);
  const visibleFieldErrors = {
    firstName: localErrors.firstName ?? state.fieldErrors?.firstName,
    lastName: localErrors.lastName ?? state.fieldErrors?.lastName,
    initialPassword: localErrors.initialPassword ?? state.fieldErrors?.initialPassword,
    confirmPassword: localErrors.confirmPassword,
    professionalCenterId:
      localErrors.professionalCenterId ?? state.fieldErrors?.professionalCenterId,
  };
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

  useEffect(() => {
    if (isComplete) successCloseButton.current?.focus();
  }, [isComplete]);

  function updateValue(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setLocalErrors((current) => ({
      ...current,
      [name]: [],
      ...(name === "initialPassword" ? { confirmPassword: [] } : {}),
    }));
  }

  function requestChangeEmail() {
    const changed = Boolean(
      values.initialPassword ||
      values.confirmPassword ||
      values.firstName !== firstName ||
      values.lastName !== lastName ||
      values.role !== "RECEPTION" ||
      values.professionalCenterId,
    );
    if (changed) setDiscardRequested(true);
    else onChangeEmail();
  }

  function discardAndChangeEmail() {
    setValues((current) => ({ ...current, initialPassword: "", confirmPassword: "" }));
    onChangeEmail();
  }

  function persistIntentBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!isReviewing) {
      event.preventDefault();
      const errors: Record<string, string[]> = {};
      if (!identityExists && !values.firstName.trim())
        errors.firstName = ["Ingresá el nombre del usuario."];
      if (!identityExists && !values.lastName.trim())
        errors.lastName = ["Ingresá el apellido del usuario."];
      if (
        !identityExists &&
        (!locksIntent || values.initialPassword || state.fieldErrors?.initialPassword) &&
        values.initialPassword.length < 10
      ) {
        errors.initialPassword = ["La contraseña debe tener al menos 10 caracteres."];
      }
      if (
        !identityExists &&
        (!locksIntent || values.initialPassword || state.fieldErrors?.initialPassword)
      ) {
        if (!values.confirmPassword) {
          errors.confirmPassword = ["Confirmá la contraseña inicial."];
        } else if (values.initialPassword !== values.confirmPassword) {
          errors.confirmPassword = ["Las contraseñas no coinciden."];
        }
      }
      if (values.role === "PROFESSIONAL" && !values.professionalCenterId) {
        errors.professionalCenterId = ["Seleccioná un profesional disponible."];
      }
      if (
        values.role === "PROFESSIONAL" &&
        !locksIntent &&
        !professionalCenters.some((item) => item.id === values.professionalCenterId)
      ) {
        errors.professionalCenterId = ["Seleccioná un profesional disponible."];
      }
      setLocalErrors(errors);
      if (Object.keys(errors).length === 0) {
        setIsReviewing(true);
        onStageChange("review");
      }
      return;
    }
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
        "No pudimos guardar los datos necesarios para reintentar de forma segura. No se envió el alta. Verificá que este navegador permita guardar datos de sesión y volvé a confirmar.",
      );
      return;
    }

    lockedPayload.current = payload;
    submitLatched.current = true;
    onPendingChange(true);
    setStorageError(null);
  }

  if (isComplete) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3" role="status">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"
            aria-hidden="true"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <p className="pt-2 text-sm leading-6 text-slate-700">
            {state.status === "confirmed"
              ? state.message
              : (state.identityCreated ?? !identityExists)
                ? "El usuario se creó correctamente y ya tiene acceso al centro."
                : "El usuario se agregó correctamente al centro."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={onClose}
            ref={successCloseButton}
            type="button"
          >
            Cerrar
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            onClick={onNewIntent}
            type="button"
          >
            Agregar otro usuario
          </button>
        </div>
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
          Hay un alta pendiente de confirmar. Recuperamos los datos necesarios para reintentar sin
          duplicarla. Podés verificar el resultado o iniciar otra alta.
        </p>
      ) : null}

      {isReviewing ? (
        <section
          aria-label="Revisar alta"
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <h3 className="text-lg font-semibold text-slate-950">
            Revisá los datos antes de continuar
          </h3>
          <dl className="grid gap-x-5 gap-y-3 text-sm text-slate-800 sm:grid-cols-2">
            <div>
              <dt className="font-medium">Email</dt>
              <dd className="break-all">{email}</dd>
            </div>
            <div>
              <dt className="font-medium">Nombre y apellido</dt>
              <dd>
                {identityExists
                  ? `${firstName} ${lastName}`
                  : `${values.firstName.trim()} ${values.lastName.trim()}`}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Rol</dt>
              <dd>
                {values.role === "ADMIN"
                  ? "Administrador"
                  : values.role === "RECEPTION"
                    ? "Recepción"
                    : "Profesional"}
              </dd>
            </div>
            {values.role === "PROFESSIONAL" ? (
              <div>
                <dt className="font-medium">Profesional asociado</dt>
                <dd>
                  {professionalCenters.find((item) => item.id === values.professionalCenterId)
                    ? `${professionalCenters.find((item) => item.id === values.professionalCenterId)?.firstName} ${professionalCenters.find((item) => item.id === values.professionalCenterId)?.lastName}`
                    : "Vínculo seleccionado"}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium">Estado inicial</dt>
              <dd>Activo</dd>
            </div>
            {!identityExists ? (
              <div>
                <dt className="font-medium">Contraseña inicial</dt>
                <dd>
                  {values.initialPassword
                    ? "Contraseña inicial configurada"
                    : "Se solicitará si es necesaria para reintentar"}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="text-sm text-slate-700">
            {identityExists
              ? "Se conservarán los datos y credenciales de la cuenta existente."
              : "La cuenta se creará al confirmar."}
          </p>
          <button
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            onClick={() => {
              setIsReviewing(false);
              onStageChange("details");
            }}
            type="button"
          >
            Volver a editar
          </button>
        </section>
      ) : null}
      <div className={isReviewing ? "hidden" : "space-y-6"}>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p className="font-medium">{email}</p>
          <p className="mt-1">
            {identityExists
              ? `${firstName} ${lastName}. Reutilizaremos esta cuenta sin cambiar sus datos ni credenciales.`
              : "Se creará una cuenta con los datos y la contraseña inicial indicados."}
          </p>
        </div>

        {!identityExists ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Nombre</span>
              <input
                aria-describedby={
                  visibleFieldErrors.firstName?.length ? "center-user-first-name-error" : undefined
                }
                aria-invalid={Boolean(visibleFieldErrors.firstName?.length)}
                autoComplete="given-name"
                className={inputClass}
                name="firstName"
                onChange={(event) => updateValue("firstName", event.target.value)}
                readOnly={locksIntent}
                required
                value={values.firstName}
              />
              <FieldError errors={visibleFieldErrors.firstName} id="center-user-first-name-error" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Apellido</span>
              <input
                aria-describedby={
                  visibleFieldErrors.lastName?.length ? "center-user-last-name-error" : undefined
                }
                aria-invalid={Boolean(visibleFieldErrors.lastName?.length)}
                autoComplete="family-name"
                className={inputClass}
                name="lastName"
                onChange={(event) => updateValue("lastName", event.target.value)}
                readOnly={locksIntent}
                required
                value={values.lastName}
              />
              <FieldError errors={visibleFieldErrors.lastName} id="center-user-last-name-error" />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-800">Contraseña inicial</span>
              <PasswordInput
                aria-label="Contraseña inicial"
                aria-describedby={
                  visibleFieldErrors.initialPassword?.length
                    ? "center-user-password-error"
                    : undefined
                }
                aria-invalid={Boolean(visibleFieldErrors.initialPassword?.length)}
                autoComplete="new-password"
                className={inputClass}
                minLength={10}
                name="initialPassword"
                onChange={(event) => updateValue("initialPassword", event.target.value)}
                ref={passwordInput}
                required={!locksIntent || Boolean(state.fieldErrors?.initialPassword)}
                value={values.initialPassword}
              />
              <p className="text-xs text-slate-500">
                {locksIntent
                  ? "La contraseña no se guardó. Si todavía hace falta, volvé a ingresarla."
                  : "Mínimo 10 caracteres."}
              </p>
              <FieldError
                errors={visibleFieldErrors.initialPassword}
                id="center-user-password-error"
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-800">Confirmar contraseña</span>
              <PasswordInput
                aria-label="Confirmar contraseña"
                aria-describedby={`center-user-confirm-password-help${visibleFieldErrors.confirmPassword?.length ? " center-user-confirm-password-error" : ""}`}
                aria-invalid={Boolean(visibleFieldErrors.confirmPassword?.length)}
                autoComplete="new-password"
                className={inputClass}
                onChange={(event) => updateValue("confirmPassword", event.target.value)}
                ref={confirmationInput}
                required={!locksIntent || Boolean(values.initialPassword)}
                value={values.confirmPassword}
              />
              <p className="text-xs text-slate-500" id="center-user-confirm-password-help">
                Ingresá nuevamente la misma contraseña.
              </p>
              <FieldError
                errors={visibleFieldErrors.confirmPassword}
                id="center-user-confirm-password-error"
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
                  visibleFieldErrors.professionalCenterId?.length
                    ? "center-user-professional-center-error"
                    : undefined
                }
                aria-invalid={Boolean(visibleFieldErrors.professionalCenterId?.length)}
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
                    Profesional seleccionado para esta alta
                  </option>
                ) : null}
                {professionalCenters.map((professionalCenter) => (
                  <option key={professionalCenter.id} value={professionalCenter.id}>
                    {professionalCenter.lastName}, {professionalCenter.firstName}
                    {professionalCenter.licenseNumber
                      ? ` · ${professionalCenter.licenseNumber}`
                      : ""}
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
                errors={visibleFieldErrors.professionalCenterId}
                id="center-user-professional-center-error"
              />
            </label>
          ) : (
            <input name="professionalCenterId" type="hidden" value="" />
          )}
        </div>
      </div>

      {isReviewing ? (
        <ProvisionActions
          confirmLabel={
            locksIntent
              ? "Reintentar / verificar"
              : identityExists
                ? "Confirmar incorporación"
                : "Confirmar creación"
          }
          onChangeEmail={requestChangeEmail}
          onNewIntent={onNewIntent}
          retry={locksIntent}
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="min-h-11 rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            type="submit"
          >
            Revisar alta
          </button>
          {!locksIntent ? (
            <button
              className="min-h-11 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              onClick={requestChangeEmail}
              type="button"
            >
              Cambiar email
            </button>
          ) : null}
        </div>
      )}
      {discardRequested ? (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4" role="alert">
          <p className="text-sm text-amber-950">
            Hay datos sin guardar. Si cambiás el email, se descartarán también la contraseña inicial
            y la revisión.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-md border border-slate-300 bg-white px-4"
              onClick={() => setDiscardRequested(false)}
              type="button"
            >
              Seguir editando
            </button>
            <button
              className="min-h-11 rounded-md bg-amber-700 px-4 text-white"
              onClick={discardAndChangeEmail}
              type="button"
            >
              Descartar y cambiar email
            </button>
          </div>
        </div>
      ) : null}
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
  const router = useRouter();
  const {
    abandonError,
    clearPendingIntent,
    isHydrated,
    operationId,
    pendingIntent,
    persistPendingIntent,
    recoveryStatus,
    startNewIntent,
  } = useCenterUserOperationIntent(actorUserId, centerId);
  const [isOpen, setIsOpen] = useState(Boolean(pendingIntent) || recoveryStatus === "invalid");
  const [email, setEmail] = useState("");
  const [resolution, setResolution] = useState<CenterUserIdentityActionState>({ status: "idle" });
  const [stage, setStage] = useState<"email" | "details" | "review">(
    pendingIntent ? "details" : "email",
  );
  const [discardRequested, setDiscardRequested] = useState(false);
  const [isProvisionPending, setIsProvisionPending] = useState(false);
  const [completion, setCompletion] = useState<{
    status: "success" | "confirmed";
    identityCreated: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const wasDiscardRequested = useRef(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (discardRequested) continueEditingRef.current?.focus();
    else if (wasDiscardRequested.current) closeButtonRef.current?.focus();
    wasDiscardRequested.current = discardRequested;
  }, [discardRequested]);

  function closeModal() {
    if (completion && !startNewIntent()) return;
    setIsOpen(false);
    setDiscardRequested(false);
    setEmail("");
    setResolution({ status: "idle" });
    setStage(pendingIntent ? "details" : "email");
    setCompletion(null);
  }

  function requestClose() {
    if (isPending || isProvisionPending) return;
    if (completion || resolution.membershipExists || (!email.trim() && !pendingIntent)) {
      closeModal();
      return;
    }
    setDiscardRequested(true);
  }

  function resetForNewIntent() {
    if (!startNewIntent()) return;
    setEmail("");
    setResolution({ status: "idle" });
    setStage("email");
    setCompletion(null);
    setDiscardRequested(false);
    setIsOpen(true);
  }

  function resolveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const nextResolution = await resolveCenterIdentityAction(centerId, email);
      setResolution(nextResolution);
      if (nextResolution.status === "success") setStage("details");
    });
  }

  function keepFocusInDialog(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled])",
      ) ?? [],
    ).filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      dialogRef.current?.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  const recoveredIntent = pendingIntent;
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
    <>
      <section
        className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        id="agregar-usuario"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-950">Agregar usuario</h2>
            <p className="text-sm leading-6 text-slate-600">
              Ingresá un email para agregar un usuario a este centro.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
            onClick={() => setIsOpen(true)}
            ref={triggerRef}
            type="button"
          >
            Agregar usuario
          </button>
        </div>
      </section>

      {isOpen
        ? createPortal(
            <dialog
              aria-label={discardRequested ? "Cerrar alta" : undefined}
              aria-labelledby={discardRequested ? undefined : titleId}
              aria-modal="true"
              className="m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-[46rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50 sm:w-[calc(100%-2rem)]"
              onCancel={(event) => {
                event.preventDefault();
                if (discardRequested) setDiscardRequested(false);
                else requestClose();
              }}
              onClick={(event) => {
                if (event.target !== event.currentTarget || discardRequested) return;
                const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
                if (
                  event.clientX < left ||
                  event.clientX >= right ||
                  event.clientY < top ||
                  event.clientY >= bottom
                )
                  requestClose();
              }}
              onKeyDown={keepFocusInDialog}
              ref={dialogRef}
              tabIndex={-1}
            >
              <div className="flex min-w-0 shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-950" id={titleId}>
                    {completion
                      ? completion.status === "confirmed"
                        ? "Operación confirmada"
                        : completion.identityCreated
                          ? "Usuario creado"
                          : "Usuario agregado"
                      : "Agregar usuario"}
                  </h2>
                  {!discardRequested ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {completion
                        ? "Operación completada"
                        : stage === "email"
                          ? "Paso 1 de 3 · Email"
                          : stage === "details"
                            ? "Paso 2 de 3 · Datos y acceso"
                            : "Paso 3 de 3 · Revisión"}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label={completion ? "Cerrar ventana" : "Cerrar"}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
                  disabled={isPending || isProvisionPending}
                  onClick={requestClose}
                  ref={closeButtonRef}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
                {discardRequested ? (
                  <div className="space-y-4" role="alert">
                    <h3 className="text-lg font-semibold text-slate-950">
                      {pendingIntent ? "Cerrar alta pendiente" : "¿Descartar alta?"}
                    </h3>
                    <p className="text-sm leading-6 text-slate-700">
                      {pendingIntent
                        ? "El resultado puede estar pendiente. Al cerrar conservaremos los datos necesarios para verificar esta misma alta después. La contraseña no se guardará."
                        : "Si cerrás ahora, se perderán los datos ingresados, incluida la contraseña inicial."}
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
                        onClick={() => setDiscardRequested(false)}
                        ref={continueEditingRef}
                        type="button"
                      >
                        Seguir editando
                      </button>
                      <button
                        className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white"
                        onClick={closeModal}
                        type="button"
                      >
                        {pendingIntent ? "Cerrar y conservar alta" : "Descartar alta"}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div hidden={discardRequested}>
                  {abandonError && recoveryStatus !== "invalid" ? (
                    <p
                      className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                      role="alert"
                    >
                      {abandonError}
                    </p>
                  ) : null}
                  {!isHydrated ? (
                    <p className="text-sm text-slate-600" role="status">
                      Recuperando el alta pendiente…
                    </p>
                  ) : recoveryStatus === "invalid" ? (
                    <div className="max-w-2xl space-y-4 rounded-md border border-amber-300 bg-amber-50 p-4">
                      <div className="space-y-2" role="alert">
                        <p className="font-semibold text-amber-950">
                          Hay un alta pendiente que no puede recuperarse de forma segura.
                        </p>
                        <p className="text-sm leading-6 text-amber-900">
                          No se iniciará otra alta automáticamente. Podés descartar el intento
                          pendiente para comenzar de nuevo.
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
                        Descartar alta pendiente e iniciar otra
                      </button>
                    </div>
                  ) : !operationId ? (
                    <p
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                      role="alert"
                    >
                      No pudimos preparar el alta de forma segura. Volvé a intentarlo.
                    </p>
                  ) : !resolved ? (
                    <form className="max-w-xl" onSubmit={resolveEmail}>
                      <input name="operationId" type="hidden" value={operationId} />
                      <input name="centerId" type="hidden" value={centerId} />
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <label className="block min-w-0 flex-1 space-y-2">
                          <span className="text-sm font-medium text-slate-800">Email</span>
                          <input
                            aria-describedby={
                              resolution.fieldErrors?.email ? "center-user-email-error" : undefined
                            }
                            aria-invalid={Boolean(resolution.fieldErrors?.email)}
                            autoComplete="email"
                            className="h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                            name="email"
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            type="email"
                            value={email}
                          />
                        </label>
                        <button
                          className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-md bg-sky-700 px-5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          disabled={isPending}
                          type="submit"
                        >
                          {isPending ? "Verificando…" : "Continuar"}
                        </button>
                      </div>
                      <div className="mt-3 space-y-3">
                        <FieldError
                          errors={resolution.fieldErrors?.email}
                          id="center-user-email-error"
                        />
                        <ActionMessage state={resolution} />
                      </div>
                    </form>
                  ) : resolution.membershipExists ? (
                    <div className="max-w-2xl space-y-4">
                      <ActionMessage state={resolution} />
                      {resolution.membershipIsActive === false ? (
                        <p className="text-sm text-slate-700">
                          Para reactivar este acceso, usá «Administrar acceso» en el listado.
                        </p>
                      ) : null}
                      <button
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        onClick={() => {
                          setEmail("");
                          setResolution({ status: "idle" });
                          setStage("email");
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
                      onChangeEmail={() => {
                        setResolution({ status: "idle" });
                        setStage("email");
                      }}
                      onClearPendingIntent={clearPendingIntent}
                      onClose={closeModal}
                      onComplete={(result, identityCreated) => {
                        setResolution({
                          status: "success",
                          email: resolvedEmail,
                          identityExists: resolvedIdentityExists,
                          firstName: resolvedFirstName,
                          lastName: resolvedLastName,
                          membershipExists: false,
                        });
                        setCompletion({
                          status: result.status as "success" | "confirmed",
                          identityCreated,
                        });
                        router.refresh();
                      }}
                      onPendingChange={setIsProvisionPending}
                      onNewIntent={resetForNewIntent}
                      onPersistPendingIntent={persistPendingIntent}
                      onStageChange={setStage}
                      operationId={operationId}
                      professionalCenters={professionalCenters}
                    />
                  )}
                </div>
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
