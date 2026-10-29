"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { PasswordInput } from "@/components/password-input";
import {
  createPlatformCenterAction,
  resolvePlatformIdentityAction,
} from "../actions/platform-actions";
import type {
  PlatformActionState,
  PlatformIdentityActionState,
} from "../domain/platform-action-state";
import {
  DEFAULT_PLATFORM_TIMEZONE,
  isValidIanaTimezone,
  platformIdentityEmailSchema,
  type PlatformCenterIntentPayload,
} from "../schemas/platform";
import { timezoneLabel, timezoneMatchesQuery } from "../domain/timezone-label";
import { ActionMessage } from "./action-message";
import { usePlatformOperationIntent } from "./use-platform-operation-intent";

const initialCreateState: PlatformActionState = { status: "idle" };
const initialTimezoneNames = [DEFAULT_PLATFORM_TIMEZONE, "UTC"];
let browserTimezoneNames: string[] | null = null;
const subscribeToTimezoneNames = () => () => {};

function getBrowserTimezoneNames() {
  if (!browserTimezoneNames) {
    browserTimezoneNames = Array.from(
      new Set([
        ...initialTimezoneNames,
        ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []),
      ]),
    );
  }
  return browserTimezoneNames;
}

const getServerTimezoneNames = () => initialTimezoneNames;
function TimezoneInput({
  describedBy,
  invalid,
  onChange,
  readOnly,
  value,
}: {
  describedBy: string;
  invalid: boolean;
  onChange: (value: string) => void;
  readOnly: boolean;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const timezoneNames = useSyncExternalStore(
    subscribeToTimezoneNames,
    getBrowserTimezoneNames,
    getServerTimezoneNames,
  );
  const timezoneOptions = useMemo(
    () => timezoneNames.map((zone) => ({ zone, label: timezoneLabel(zone) })),
    [timezoneNames],
  );
  const query = showAll ? "" : (draft ?? "");
  const suggestions = timezoneOptions.filter(({ zone, label }) =>
    timezoneMatchesQuery(zone, query, label),
  );

  useLayoutEffect(() => {
    if (!open) return;
    const input = inputRef.current;
    const modal = input?.closest("dialog");
    if (!input || !modal) return;
    const updatePosition = () => {
      const inputRect = input.getBoundingClientRect();
      const modalRect = modal.getBoundingClientRect();
      const headerBottom = modal.firstElementChild?.getBoundingClientRect().bottom ?? modalRect.top;
      const footerTop =
        modal.querySelector("[data-center-modal-footer]")?.getBoundingClientRect().top ??
        modalRect.bottom;
      const below = footerTop - inputRect.bottom - 8;
      const above = inputRect.top - headerBottom - 8;
      const placeAbove = below < 160 && above > below;
      const height = Math.max(0, Math.min(240, placeAbove ? above : below));
      setPosition({
        top: placeAbove
          ? inputRect.top - modalRect.top - height - 4
          : inputRect.bottom - modalRect.top + 4,
        left: inputRect.left - modalRect.left,
        width: inputRect.width,
        height,
      });
    };
    updatePosition();
    const scroller = input.closest("[data-center-modal-scroll]");
    scroller?.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);
    return () => {
      scroller?.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !inputRef.current?.parentElement?.contains(target) &&
        !document.getElementById(listId)?.contains(target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [listId, open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const list = document.getElementById(listId);
    const option = document.getElementById(`${listId}-${activeIndex}`);
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [activeIndex, listId, open, query]);

  function choose(timezone: string) {
    onChange(timezone);
    setDraft(null);
    setShowAll(false);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <>
      <span className="relative block">
        <input
          aria-activedescendant={
            open && activeIndex >= 0 && suggestions.length ? `${listId}-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-expanded={open}
          aria-label="Zona horaria"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-11 text-base text-slate-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 read-only:bg-slate-100"
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(event.target.value);
            setShowAll(false);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => {
            if (readOnly) return;
            inputRef.current?.select();
            setDialog(inputRef.current?.closest("dialog") ?? null);
            setOpen(true);
          }}
          onBlur={() => {
            if (isValidIanaTimezone(value)) setDraft(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) setOpen(true);
              else
                setActiveIndex((index) =>
                  index < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : suggestions.length - 1
                    : (index + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) %
                      Math.max(1, suggestions.length),
                );
            } else if (event.key === "Enter" && open && suggestions.length) {
              event.preventDefault();
              choose((suggestions[activeIndex] ?? suggestions[0]).zone);
            } else if (event.key === "Enter" && isValidIanaTimezone(value)) {
              setDraft(null);
              setOpen(false);
            } else if (event.key === "Tab") setOpen(false);
          }}
          readOnly={readOnly}
          ref={inputRef}
          role="combobox"
          value={draft ?? timezoneLabel(value)}
        />
        <input name="centerTimezone" type="hidden" value={value} />
        {!readOnly ? (
          <button
            aria-label="Mostrar zonas horarias"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-600 hover:bg-slate-50"
            onClick={() => {
              setDialog(inputRef.current?.closest("dialog") ?? null);
              setShowAll(true);
              setActiveIndex(-1);
              setOpen(true);
              inputRef.current?.focus();
            }}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        ) : null}
      </span>
      {open && dialog && position && position.height >= 60
        ? createPortal(
            <div
              className="absolute z-50 overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white py-1 shadow-xl"
              id={listId}
              role="listbox"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.height,
              }}
            >
              {suggestions.length ? (
                suggestions.map(({ zone, label }, index) => (
                  <button
                    aria-selected={zone === value}
                    className={`block w-full px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-sky-50 text-sky-900" : "text-slate-800 hover:bg-slate-50"}`}
                    id={`${listId}-${index}`}
                    key={zone}
                    onClick={() => choose(zone)}
                    onMouseDown={(event) => event.preventDefault()}
                    role="option"
                    type="button"
                  >
                    <span className="block font-medium">
                      {label}
                      {zone === value ? " · Seleccionada" : ""}
                    </span>
                    <span className="block text-xs text-slate-500">{zone}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-slate-600">
                  No hay sugerencias. Podés ingresar otra zona IANA válida.
                </p>
              )}
            </div>,
            dialog,
          )
        : null}
    </>
  );
}

function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  if (!errors?.length) return null;
  return (
    <p className="text-sm text-red-700" id={id}>
      {errors[0]}
    </p>
  );
}

function CenterFormActions({
  confirmLabel,
  formId,
  onChangeEmail,
  pending,
  retry,
}: {
  confirmLabel: string;
  formId: string;
  onChangeEmail: () => void;
  pending: boolean;
  retry: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        form={formId}
        type="submit"
      >
        {pending ? "Creando centro…" : confirmLabel}
      </button>
      {!retry ? (
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={onChangeEmail}
          type="button"
        >
          Cambiar email
        </button>
      ) : null}
    </div>
  );
}

function CenterDetailsForm({
  email,
  footerElement,
  formId,
  identityExists,
  initialValues,
  isCreatePending,
  isRecoveredIntent,
  onChangeEmail,
  onClose,
  onComplete,
  onClearPendingIntent,
  onNewIntent,
  onPendingChange,
  onPersistPendingIntent,
  onStageChange,
  onTerminalNewOperation,
  operationId,
  suppressActions,
}: {
  email: string;
  footerElement: HTMLDivElement | null;
  formId: string;
  identityExists: boolean;
  initialValues?: PlatformCenterIntentPayload;
  isCreatePending: boolean;
  isRecoveredIntent: boolean;
  onChangeEmail: () => void;
  onClose: () => void;
  onComplete: (status: "success" | "confirmed") => void;
  onClearPendingIntent: () => void;
  onNewIntent: () => void;
  onPendingChange: (pending: boolean) => void;
  onPersistPendingIntent: (payload: PlatformCenterIntentPayload) => boolean;
  onStageChange: (stage: "details" | "review") => void;
  onTerminalNewOperation: (message: string) => void;
  operationId: string;
  suppressActions: boolean;
}) {
  const submitLatched = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const timezoneHintId = useId();
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const successCloseButton = useRef<HTMLButtonElement>(null);
  const [values, setValues] = useState(() => ({
    centerName: initialValues?.centerName ?? "",
    centerAddress: initialValues?.centerAddress ?? "",
    centerPhone: initialValues?.centerPhone ?? "",
    centerEmail: initialValues?.centerEmail ?? "",
    centerTimezone: initialValues?.centerTimezone ?? DEFAULT_PLATFORM_TIMEZONE,
    adminFirstName: initialValues?.adminFirstName ?? "",
    adminLastName: initialValues?.adminLastName ?? "",
    adminInitialPassword: "",
    confirmPassword: "",
  }));
  const [isReviewing, setIsReviewing] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});

  const createCenterWithLatch = useCallback(
    async (previousState: PlatformActionState, formData: FormData) => {
      try {
        const result = await createPlatformCenterAction(previousState, formData);
        if (result.status === "error" && result.fieldErrors) {
          setIsReviewing(false);
          onStageChange("details");
        }
        if (result.status === "success" || result.status === "confirmed") onComplete(result.status);
        return result;
      } catch {
        return {
          status: "error" as const,
          retryMode: "same-operation" as const,
          message: "No pudimos confirmar el resultado. Reintentá esta misma operación.",
        };
      } finally {
        formData.delete("adminInitialPassword");
        formData.delete("confirmPassword");
        if (passwordInput.current) passwordInput.current.value = "";
        if (confirmationInput.current) confirmationInput.current.value = "";
        setValues((current) =>
          current.adminInitialPassword === "" && current.confirmPassword === ""
            ? current
            : { ...current, adminInitialPassword: "", confirmPassword: "" },
        );
        submitLatched.current = false;
        onPendingChange(false);
      }
    },
    [onComplete, onPendingChange, onStageChange],
  );
  const [state, formAction, isActionPending] = useActionState(
    createCenterWithLatch,
    initialCreateState,
  );
  const lockedPayload = useRef<PlatformCenterIntentPayload | null>(initialValues ?? null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const locksIntent = isRecoveredIntent || state.retryMode === "same-operation";
  const isComplete = state.status === "success" || state.status === "confirmed";
  const visibleErrors = {
    centerName: localErrors.centerName ?? state.fieldErrors?.centerName,
    centerEmail: localErrors.centerEmail ?? state.fieldErrors?.centerEmail,
    centerTimezone: localErrors.centerTimezone ?? state.fieldErrors?.centerTimezone,
    adminFirstName: localErrors.adminFirstName ?? state.fieldErrors?.adminFirstName,
    adminLastName: localErrors.adminLastName ?? state.fieldErrors?.adminLastName,
    adminInitialPassword:
      localErrors.adminInitialPassword ?? state.fieldErrors?.adminInitialPassword,
    confirmPassword: localErrors.confirmPassword,
  };

  useEffect(() => {
    if (isComplete) successCloseButton.current?.focus();
  }, [isComplete]);

  function focusFirstInvalidField(errors: Record<string, string[] | undefined>) {
    const firstName = [
      "centerName",
      "centerEmail",
      "centerTimezone",
      "adminFirstName",
      "adminLastName",
      "adminInitialPassword",
      "confirmPassword",
    ].find((name) => errors[name]?.length);
    if (!firstName) return;
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLInputElement>(
        firstName === "confirmPassword"
          ? 'input[aria-label="Confirmar contraseña"]'
          : firstName === "centerTimezone"
            ? 'input[role="combobox"][aria-label="Zona horaria"]'
            : `input[name="${firstName}"]`,
      );
      const scroll = field?.closest<HTMLElement>("[data-center-modal-scroll]");
      if (!field || !scroll) return;
      field.focus({ preventScroll: true });
      const region = field.closest("label") ?? field;
      const regionBounds = region.getBoundingClientRect();
      const scrollBounds = scroll.getBoundingClientRect();
      if (regionBounds.top < scrollBounds.top + 12) {
        scroll.scrollBy({ top: regionBounds.top - scrollBounds.top - 12, behavior: "smooth" });
      } else if (regionBounds.bottom > scrollBounds.bottom - 12) {
        scroll.scrollBy({
          top: regionBounds.bottom - scrollBounds.bottom + 12,
          behavior: "smooth",
        });
      }
    });
  }

  useEffect(() => {
    if (state.fieldErrors && state.status === "error") focusFirstInvalidField(state.fieldErrors);
  }, [state.fieldErrors, state.status]);

  useEffect(() => {
    if (state.status === "idle" || state.retryMode === "same-operation") return;
    if (state.retryMode === "new-operation") {
      onTerminalNewOperation(
        state.message ?? "Esta alta no pudo completarse. Iniciá una nueva operación.",
      );
    }
    onClearPendingIntent();
    if (state.status === "error") lockedPayload.current = null;
  }, [onClearPendingIntent, onTerminalNewOperation, state.message, state.retryMode, state.status]);

  function updateValue(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setLocalErrors((current) => ({ ...current, [name]: [] }));
  }

  function persistIntentBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!isReviewing) {
      event.preventDefault();
      const errors: Record<string, string[]> = {};
      if (!values.centerName.trim()) errors.centerName = ["Ingresá el nombre del centro."];
      if (values.centerEmail.trim() && !z.email().safeParse(values.centerEmail.trim()).success)
        errors.centerEmail = ["Ingresá un email válido o dejá el campo vacío."];
      if (!values.centerTimezone.trim() || !isValidIanaTimezone(values.centerTimezone.trim()))
        errors.centerTimezone = ["Ingresá una zona horaria IANA válida."];
      if (!identityExists) {
        if (!values.adminFirstName.trim())
          errors.adminFirstName = ["Ingresá el nombre del primer administrador."];
        if (!values.adminLastName.trim())
          errors.adminLastName = ["Ingresá el apellido del primer administrador."];
        if (
          (!locksIntent ||
            values.adminInitialPassword ||
            state.fieldErrors?.adminInitialPassword) &&
          values.adminInitialPassword.length < 10
        )
          errors.adminInitialPassword = ["La contraseña debe tener al menos 10 caracteres."];
        if (
          !locksIntent ||
          values.adminInitialPassword ||
          state.fieldErrors?.adminInitialPassword
        ) {
          if (!values.confirmPassword) errors.confirmPassword = ["Confirmá la contraseña inicial."];
          else if (values.adminInitialPassword !== values.confirmPassword)
            errors.confirmPassword = ["Las contraseñas no coinciden."];
        }
      }
      setLocalErrors(errors);
      if (Object.keys(errors).length === 0) {
        setIsReviewing(true);
        onStageChange("review");
      } else {
        focusFirstInvalidField(errors);
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
              : "El centro se creó correctamente y ya está disponible para su administración."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800"
            onClick={onClose}
            ref={successCloseButton}
            type="button"
          >
            Cerrar
          </button>
          <button
            className="min-h-11 rounded-md bg-sky-700 px-4 text-sm font-semibold text-white"
            onClick={onNewIntent}
            type="button"
          >
            Crear otro centro
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
    <>
      <form
        action={formAction}
        className="space-y-6"
        id={formId}
        noValidate
        onSubmit={persistIntentBeforeSubmit}
        ref={formRef}
      >
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

        {isCreatePending ? (
          <p className="text-sm text-slate-600" role="status">
            Creando centro…
          </p>
        ) : null}

        {locksIntent && !isCreatePending ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Hay una creación pendiente de confirmar. Conservamos los datos necesarios para verificar
            esta misma operación sin duplicarla. La contraseña no se guardó. Hasta conocer el
            resultado, sólo podés reintentar o verificar esta operación.
          </p>
        ) : null}

        {isReviewing ? (
          <section
            aria-label="Revisar centro"
            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <h3 className="text-lg font-semibold text-slate-950">
              Revisá los datos antes de continuar
            </h3>
            <dl className="grid gap-x-5 gap-y-3 text-sm text-slate-800 sm:grid-cols-2">
              {[
                ["Centro", values.centerName.trim()],
                ...(values.centerAddress.trim()
                  ? [["Dirección", values.centerAddress.trim()]]
                  : []),
                ...(values.centerPhone.trim() ? [["Teléfono", values.centerPhone.trim()]] : []),
                ...(values.centerEmail.trim()
                  ? [["Email del centro", values.centerEmail.trim()]]
                  : []),
                ["Zona horaria", values.centerTimezone.trim()],
                ["Administrador inicial", email],
                ["Cuenta", identityExists ? "Cuenta existente" : "Cuenta nueva"],
                ...(!identityExists
                  ? [
                      [
                        "Nombre y apellido",
                        `${values.adminFirstName.trim()} ${values.adminLastName.trim()}`,
                      ],
                      [
                        "Contraseña inicial",
                        values.adminInitialPassword
                          ? "Contraseña inicial configurada"
                          : "Se solicitará si hace falta para reintentar",
                      ],
                    ]
                  : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-medium">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <button
              className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreatePending || isActionPending}
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
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-slate-950">Datos del centro</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-800">Nombre</span>
                <input
                  aria-describedby={
                    visibleErrors.centerName?.length ? "center-name-error" : undefined
                  }
                  aria-invalid={Boolean(visibleErrors.centerName?.length)}
                  className={inputClass}
                  name="centerName"
                  onChange={(event) => updateValue("centerName", event.target.value)}
                  readOnly={locksIntent}
                  required
                  value={values.centerName}
                />
                <FieldError errors={visibleErrors.centerName} id="center-name-error" />
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
                  aria-describedby={
                    visibleErrors.centerEmail?.length ? "center-email-error" : undefined
                  }
                  aria-invalid={Boolean(visibleErrors.centerEmail?.length)}
                  className={inputClass}
                  name="centerEmail"
                  onChange={(event) => updateValue("centerEmail", event.target.value)}
                  readOnly={locksIntent}
                  type="email"
                  value={values.centerEmail}
                />
                <FieldError errors={visibleErrors.centerEmail} id="center-email-error" />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-800">Zona horaria</span>
                <TimezoneInput
                  describedBy={`${timezoneHintId}${visibleErrors.centerTimezone?.length ? " center-timezone-error" : ""}`}
                  invalid={Boolean(visibleErrors.centerTimezone?.length)}
                  onChange={(timezone) => updateValue("centerTimezone", timezone)}
                  readOnly={locksIntent}
                  value={values.centerTimezone}
                />
                <p className="text-xs text-slate-500" id={timezoneHintId}>
                  Buscá una ciudad o ingresá otra zona IANA válida.
                </p>
                <FieldError errors={visibleErrors.centerTimezone} id="center-timezone-error" />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-base font-semibold text-slate-950">Primer administrador</legend>
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
                      visibleErrors.adminFirstName?.length ? "admin-first-name-error" : undefined
                    }
                    aria-invalid={Boolean(visibleErrors.adminFirstName?.length)}
                    autoComplete="given-name"
                    className={inputClass}
                    name="adminFirstName"
                    onChange={(event) => updateValue("adminFirstName", event.target.value)}
                    readOnly={locksIntent}
                    required
                    value={values.adminFirstName}
                  />
                  <FieldError errors={visibleErrors.adminFirstName} id="admin-first-name-error" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-800">Apellido</span>
                  <input
                    aria-describedby={
                      visibleErrors.adminLastName?.length ? "admin-last-name-error" : undefined
                    }
                    aria-invalid={Boolean(visibleErrors.adminLastName?.length)}
                    autoComplete="family-name"
                    className={inputClass}
                    name="adminLastName"
                    onChange={(event) => updateValue("adminLastName", event.target.value)}
                    readOnly={locksIntent}
                    required
                    value={values.adminLastName}
                  />
                  <FieldError errors={visibleErrors.adminLastName} id="admin-last-name-error" />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-800">Contraseña inicial</span>
                  <PasswordInput
                    aria-describedby={
                      visibleErrors.adminInitialPassword?.length
                        ? "admin-password-error"
                        : undefined
                    }
                    aria-invalid={Boolean(visibleErrors.adminInitialPassword?.length)}
                    autoComplete="new-password"
                    className={inputClass}
                    minLength={10}
                    name="adminInitialPassword"
                    onChange={(event) => updateValue("adminInitialPassword", event.target.value)}
                    ref={passwordInput}
                    required={!locksIntent || Boolean(state.fieldErrors?.adminInitialPassword)}
                    value={values.adminInitialPassword}
                  />
                  <p className="text-xs text-slate-500">
                    {locksIntent
                      ? "La contraseña no se guardó. Si Auth todavía la necesita, volvé a ingresarla."
                      : "Mínimo 10 caracteres."}
                  </p>
                  <FieldError
                    errors={visibleErrors.adminInitialPassword}
                    id="admin-password-error"
                  />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-800">Confirmar contraseña</span>
                  <PasswordInput
                    aria-label="Confirmar contraseña"
                    aria-describedby={
                      localErrors.confirmPassword?.length
                        ? "center-confirm-password-error"
                        : undefined
                    }
                    aria-invalid={Boolean(localErrors.confirmPassword?.length)}
                    autoComplete="new-password"
                    className={inputClass}
                    onChange={(event) => updateValue("confirmPassword", event.target.value)}
                    ref={confirmationInput}
                    required={!locksIntent || Boolean(values.adminInitialPassword)}
                    value={values.confirmPassword}
                  />
                  <FieldError
                    errors={localErrors.confirmPassword}
                    id="center-confirm-password-error"
                  />
                </label>
              </div>
            ) : null}
          </fieldset>
        </div>
      </form>
      {footerElement && !suppressActions
        ? createPortal(
            isReviewing ? (
              <CenterFormActions
                confirmLabel={locksIntent ? "Reintentar / verificar" : "Confirmar creación"}
                formId={formId}
                onChangeEmail={onChangeEmail}
                pending={isActionPending}
                retry={locksIntent}
              />
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  className="min-h-11 rounded-md bg-sky-700 px-5 text-sm font-semibold text-white"
                  form={formId}
                  type="submit"
                >
                  Revisar centro
                </button>
                {!locksIntent ? (
                  <button
                    className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700"
                    onClick={onChangeEmail}
                    type="button"
                  >
                    Cambiar email
                  </button>
                ) : null}
              </div>
            ),
            footerElement,
          )
        : null}
    </>
  );
}

export function CreateCenterPanel({ actorUserId }: { actorUserId: string }) {
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
  } = usePlatformOperationIntent(actorUserId);
  const [isOpen, setIsOpen] = useState(Boolean(pendingIntent) || recoveryStatus === "invalid");
  const [email, setEmail] = useState("");
  const [resolution, setResolution] = useState<PlatformIdentityActionState>({ status: "idle" });
  const [stage, setStage] = useState<"email" | "details" | "review">(
    pendingIntent ? "details" : "email",
  );
  const [discardRequested, setDiscardRequested] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<"close" | "email">("close");
  const [isCreatePending, setIsCreatePending] = useState(false);
  const [completion, setCompletion] = useState<"success" | "confirmed" | null>(null);
  const [terminalNewOperation, setTerminalNewOperation] = useState<string | null>(null);
  const [footerElement, setFooterElement] = useState<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const successCloseButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const emailFormId = useId();
  const detailsFormId = useId();

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
    else if (isOpen) closeButtonRef.current?.focus();
  }, [discardRequested, isOpen]);

  useEffect(() => {
    if (completion) successCloseButtonRef.current?.focus();
  }, [completion]);

  function resetForNewIntent() {
    if (!startNewIntent()) return;
    setEmail("");
    setResolution({ status: "idle" });
    setStage("email");
    setCompletion(null);
    setTerminalNewOperation(null);
    setDiscardRequested(false);
    setIsOpen(true);
  }

  function closeModal() {
    if (completion || terminalNewOperation) {
      if (!startNewIntent()) return;
      router.refresh();
    }
    setIsOpen(false);
    setDiscardRequested(false);
    setEmail("");
    setResolution({ status: "idle" });
    setStage(completion || terminalNewOperation ? "email" : pendingIntent ? "details" : "email");
    setCompletion(null);
    setTerminalNewOperation(null);
  }

  function requestClose() {
    if (isPending || isCreatePending) return;
    if (
      completion ||
      terminalNewOperation ||
      (!email.trim() && !pendingIntent && recoveryStatus !== "invalid")
    ) {
      closeModal();
      return;
    }
    setDiscardTarget("close");
    setDiscardRequested(true);
  }

  function requestChangeEmail() {
    if (pendingIntent) return;
    setDiscardTarget("email");
    setDiscardRequested(true);
  }

  function confirmDiscard() {
    if (discardTarget === "email") {
      setResolution({ status: "idle" });
      setStage("email");
      setDiscardRequested(false);
    } else closeModal();
  }

  function resolveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailField = event.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
    const parsed = platformIdentityEmailSchema.safeParse({ email });
    if (!parsed.success) {
      setResolution({
        status: "error",
        fieldErrors: { email: ["Ingresá un email válido."] },
      });
      emailField?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const next = await resolvePlatformIdentityAction(parsed.data.email);
        setResolution(next);
        if (next.fieldErrors?.email?.length) emailField?.focus();
        if (next.status === "success") setStage("details");
      } catch {
        setResolution({
          status: "error",
          message: "No pudimos verificar el email. Volvé a intentarlo.",
        });
      }
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
  const resolvedEmail = recoveredIntent?.payload.adminEmail ?? resolution.email;
  const resolvedIdentityExists =
    recoveredIntent?.payload.identityExists ?? resolution.identityExists;
  const resolved =
    Boolean(recoveredIntent) ||
    (resolution.status === "success" &&
      resolvedEmail &&
      typeof resolvedIdentityExists === "boolean");
  const isEmailStep =
    stage === "email" && !discardRequested && !completion && !terminalNewOperation;

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Crear centro
      </button>
      {isOpen
        ? createPortal(
            <dialog
              aria-label={discardRequested ? "Cerrar alta de centro" : undefined}
              aria-labelledby={discardRequested ? undefined : titleId}
              aria-modal="true"
              className="relative m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-[46rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50 [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed sm:w-[calc(100%-2rem)]"
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
              <div
                className={`flex min-w-0 shrink-0 items-start justify-between gap-4 px-5 py-4 sm:px-6 ${isEmailStep ? "" : "border-b border-slate-200"}`}
              >
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-950" id={titleId}>
                    {terminalNewOperation
                      ? "Alta no completada"
                      : completion === "success"
                        ? "Centro creado"
                        : completion === "confirmed"
                          ? "Operación confirmada"
                          : "Crear centro"}
                  </h2>
                  {!discardRequested ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {terminalNewOperation
                        ? "Iniciá una nueva alta"
                        : completion
                          ? "Operación completada"
                          : stage === "email"
                            ? "Paso 1 de 3 · Administrador inicial"
                            : stage === "details"
                              ? "Paso 2 de 3 · Datos del centro"
                              : "Paso 3 de 3 · Revisión"}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Cerrar"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
                  disabled={isPending || isCreatePending}
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
              <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 ${isEmailStep ? "py-6 sm:py-7" : "py-5 sm:py-6"}`}
                data-center-modal-scroll
              >
                {discardRequested ? (
                  <div className="space-y-4" role="alert">
                    <h3 className="text-lg font-semibold text-slate-950">
                      {pendingIntent || recoveryStatus === "invalid"
                        ? "Cerrar alta pendiente"
                        : "¿Descartar alta?"}
                    </h3>
                    <p className="text-sm leading-6 text-slate-700">
                      {pendingIntent || recoveryStatus === "invalid"
                        ? "El resultado puede estar pendiente. Al cerrar conservaremos esta misma operación para verificarla después. La contraseña no se guardará."
                        : "Si cerrás ahora, se perderán los datos ingresados, incluida la contraseña inicial."}
                    </p>
                    {footerElement
                      ? createPortal(
                          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <button
                              className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold"
                              onClick={() => setDiscardRequested(false)}
                              ref={continueEditingRef}
                              type="button"
                            >
                              Seguir editando
                            </button>
                            <button
                              className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white"
                              onClick={confirmDiscard}
                              type="button"
                            >
                              {pendingIntent || recoveryStatus === "invalid"
                                ? "Cerrar y conservar alta"
                                : "Descartar alta"}
                            </button>
                          </div>,
                          footerElement,
                        )
                      : null}
                  </div>
                ) : null}
                <div hidden={discardRequested}>
                  {abandonError && recoveryStatus !== "invalid" ? (
                    <p className="mb-4 text-sm text-red-800" role="alert">
                      {abandonError}
                    </p>
                  ) : null}

                  {!isHydrated ? (
                    <p className="text-sm text-slate-600" role="status">
                      Recuperando la intención de alta…
                    </p>
                  ) : recoveryStatus === "invalid" ? (
                    <div className="max-w-2xl space-y-4 rounded-md border border-amber-300 bg-amber-50 p-4">
                      <div className="space-y-2" role="alert">
                        <p className="font-semibold text-amber-950">
                          Hay una creación de centro pendiente que no puede recuperarse de forma
                          segura.
                        </p>
                        <p className="text-sm leading-6 text-amber-900">
                          No es seguro iniciar otra alta. Conservá esta sesión y verificá en
                          «Centros registrados» si el centro aparece. Si no podés confirmar el
                          resultado, solicitá una revisión administrativa de la operación antes de
                          volver a intentar.
                        </p>
                        {abandonError ? (
                          <p className="text-sm font-medium text-red-800">{abandonError}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : !operationId ? (
                    <p
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                      role="alert"
                    >
                      No pudimos preparar una intención segura. No se habilitó el alta.
                    </p>
                  ) : terminalNewOperation ? (
                    <div className="space-y-4">
                      <p className="text-sm text-red-800" role="alert">
                        {terminalNewOperation}
                      </p>
                      <button
                        className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800"
                        onClick={resetForNewIntent}
                        type="button"
                      >
                        Iniciar una nueva alta
                      </button>
                    </div>
                  ) : completion ? (
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
                          {completion === "confirmed"
                            ? "La operación anterior quedó confirmada sin crear un centro duplicado."
                            : "El centro se creó correctamente y ya está disponible para su administración."}
                        </p>
                      </div>
                      {footerElement
                        ? createPortal(
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                              <button
                                className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800"
                                onClick={closeModal}
                                ref={successCloseButtonRef}
                                type="button"
                              >
                                Cerrar
                              </button>
                              <button
                                className="min-h-11 rounded-md bg-sky-700 px-4 text-sm font-semibold text-white"
                                onClick={resetForNewIntent}
                                type="button"
                              >
                                Crear otro centro
                              </button>
                            </div>,
                            footerElement,
                          )
                        : null}
                    </div>
                  ) : !resolved ? (
                    <>
                      <form
                        className="max-w-xl space-y-4"
                        id={emailFormId}
                        noValidate
                        onSubmit={resolveEmail}
                      >
                        <input name="operationId" type="hidden" value={operationId} />
                        <p className="text-sm leading-6 text-slate-700">
                          Ingresá el email de la persona que administrará inicialmente este centro.
                        </p>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-800">
                            Email del primer administrador
                          </span>
                          <input
                            aria-describedby={
                              resolution.fieldErrors?.email ? "identity-email-error" : undefined
                            }
                            aria-invalid={Boolean(resolution.fieldErrors?.email)}
                            autoComplete="email"
                            className={`min-h-11 w-full rounded-md border px-3 py-2 text-base text-slate-950 outline-none transition focus:ring-2 ${resolution.fieldErrors?.email ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-slate-300 focus:border-sky-600 focus:ring-sky-100"}`}
                            name="email"
                            onChange={(event) => {
                              setEmail(event.target.value);
                              if (resolution.fieldErrors?.email) setResolution({ status: "idle" });
                            }}
                            required
                            type="email"
                            value={email}
                          />
                        </label>
                        <FieldError
                          errors={resolution.fieldErrors?.email}
                          id="identity-email-error"
                        />
                        <ActionMessage state={resolution} />
                      </form>
                      {footerElement && !discardRequested
                        ? createPortal(
                            <div className="flex justify-center">
                              <button
                                className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isPending}
                                form={emailFormId}
                                type="submit"
                              >
                                {isPending ? "Verificando…" : "Continuar"}
                              </button>
                            </div>,
                            footerElement,
                          )
                        : null}
                    </>
                  ) : (
                    <CenterDetailsForm
                      email={resolvedEmail!}
                      footerElement={footerElement}
                      formId={detailsFormId}
                      identityExists={resolvedIdentityExists!}
                      initialValues={recoveredIntent?.payload}
                      isCreatePending={isCreatePending}
                      isRecoveredIntent={Boolean(recoveredIntent)}
                      key={`${operationId}:${resolvedEmail}`}
                      onChangeEmail={requestChangeEmail}
                      onClearPendingIntent={clearPendingIntent}
                      onClose={closeModal}
                      onComplete={(status) => {
                        clearPendingIntent();
                        setCompletion(status);
                      }}
                      onNewIntent={resetForNewIntent}
                      onPendingChange={setIsCreatePending}
                      onPersistPendingIntent={persistPendingIntent}
                      onStageChange={setStage}
                      onTerminalNewOperation={setTerminalNewOperation}
                      operationId={operationId}
                      suppressActions={discardRequested}
                    />
                  )}
                </div>
              </div>
              <div
                className={`shrink-0 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] empty:hidden sm:px-6 ${isEmailStep ? "" : "border-t border-slate-200"}`}
                data-center-modal-footer
                ref={setFooterElement}
              />
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
