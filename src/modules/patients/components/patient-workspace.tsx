"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { modulePrimaryActionClass } from "@/components/module-header";
import { modalActionGroupClass } from "@/components/modal-action-group";
import { FormFieldError, formFieldErrorProps } from "@/components/form-field-error";
import countries from "@/modules/professionals/components/country-options.json";
import {
  createPatientAction,
  deactivatePatientAction,
  linkPatientAction,
  reactivatePatientAction,
  resolvePatientAction,
  updatePatientAction,
  type PatientActionResult,
} from "../actions/patient-actions";
import type { PatientResolveRow } from "../api/patient-rpc-contracts";
import {
  patientRegistrationDestination,
  patientSearchUrl,
  type PatientFilters,
} from "../search/patient-search-params";
import type { PatientDetail } from "../server/patient-management";
import {
  patientCenterDetailsSchema,
  patientDocumentSchema,
  patientEmailSchema,
  patientIdentitySchema,
  patientInsuranceSchema,
  patientAdministrativeNotesSchema,
  patientNameSchema,
  patientNationalitySchema,
  patientPhoneSchema,
  trimPatientInput,
} from "../schemas/patient-input";
import { PatientAppointments } from "./patient-appointments";
import {
  birthDateFormatError,
  birthDateToIso,
  formatBirthDateInput,
  isFutureBirthDate,
} from "./patient-birth-date";
const formatPatientBirthDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

type Identity = {
  firstName: string;
  lastName: string;
  nationalityCode: string;
  documentNumber: string;
  birthDate: string;
};
type ResolveIdentity = Pick<Identity, "nationalityCode" | "documentNumber" | "birthDate">;
const sameResolveIdentity = (left: ResolveIdentity, right: ResolveIdentity) =>
  left.nationalityCode === right.nationalityCode &&
  left.documentNumber === right.documentNumber &&
  left.birthDate === right.birthDate;
type Details = { phone: string; email: string; insuranceName: string; administrativeNotes: string };
type RegistrationField = keyof Identity | keyof Details;
const emptyIdentity: Identity = {
  firstName: "",
  lastName: "",
  nationalityCode: "AR",
  documentNumber: "",
  birthDate: "",
};
const emptyDetails: Details = { phone: "", email: "", insuranceName: "", administrativeNotes: "" };

function registrationFieldError(field: RegistrationField, value: string, timezone: string): string {
  switch (field) {
    case "nationalityCode":
      return patientNationalitySchema.safeParse(value).success ? "" : "Seleccioná un país.";
    case "documentNumber":
      return patientDocumentSchema.safeParse(value).success
        ? ""
        : trimPatientInput(value)
          ? "Ingresá un documento válido."
          : "Ingresá el documento.";
    case "birthDate": {
      const iso = birthDateToIso(value);
      if (!iso) return birthDateFormatError;
      return isFutureBirthDate(iso, timezone) ? "La fecha de nacimiento no puede ser futura." : "";
    }
    case "firstName":
    case "lastName":
      return patientNameSchema.safeParse(value).success
        ? ""
        : trimPatientInput(value)
          ? `Revisá el ${field === "firstName" ? "nombre" : "apellido"}.`
          : `Ingresá el ${field === "firstName" ? "nombre" : "apellido"}.`;
    case "phone":
      return patientPhoneSchema.safeParse(value).success
        ? ""
        : trimPatientInput(value)
          ? "Revisá el teléfono."
          : "Ingresá el teléfono.";
    case "email":
      return patientEmailSchema.safeParse(value).success ? "" : "Ingresá un email válido.";
    case "insuranceName":
      return patientInsuranceSchema.safeParse(value).success ? "" : "Revisá la cobertura.";
    case "administrativeNotes":
      return patientAdministrativeNotesSchema.safeParse(value).success
        ? ""
        : "Revisá las notas administrativas.";
  }
}

function PatientDialog({
  children,
  onClose,
  closeOnBackdrop = false,
  iconClose = false,
  centered = false,
  hasUnsavedChanges = false,
  isPending = false,
  title,
  description,
}: {
  children: React.ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  iconClose?: boolean;
  centered?: boolean;
  hasUnsavedChanges?: boolean;
  isPending?: boolean;
  title: string;
  description: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const wasDiscardRequested = useRef(false);
  const didClose = useRef(false);
  const [discardRequested, setDiscardRequested] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (centered) closeButtonRef.current?.focus();
    else dialog?.querySelector<HTMLElement>("h2")?.focus();
    if (!centered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [centered]);
  useEffect(() => {
    if (discardRequested) continueEditingRef.current?.focus();
    else if (wasDiscardRequested.current) closeButtonRef.current?.focus();
    wasDiscardRequested.current = discardRequested;
  }, [discardRequested]);
  useEffect(() => {
    if (centered && isPending) ref.current?.focus();
  }, [centered, isPending]);

  function finishClose() {
    if (didClose.current) return;
    didClose.current = true;
    if (ref.current?.open) ref.current.close();
    onClose();
  }

  function requestClose() {
    if (centered && isPending) return;
    if (centered && hasUnsavedChanges) {
      setDiscardRequested(true);
      return;
    }
    finishClose();
  }

  function keepTabInDialog(event: KeyboardEvent<HTMLDialogElement>) {
    if (!centered || event.key !== "Tab") return;
    const focusable = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      ) ?? [],
    ).filter((element) => !element.closest("[hidden]") && element.tabIndex >= 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      ref.current?.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === ref.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return (
    <dialog
      ref={ref}
      aria-label={discardRequested ? "Descartar cambios" : title}
      aria-modal={centered ? "true" : undefined}
      aria-describedby={
        discardRequested ? "patient-discard-description" : "patient-dialog-description"
      }
      onClose={finishClose}
      onCancel={(event) => {
        if (!centered) return;
        event.preventDefault();
        if (discardRequested) setDiscardRequested(false);
        else requestClose();
      }}
      onClick={(event) => {
        if (!closeOnBackdrop || event.target !== event.currentTarget) return;
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX >= left &&
          event.clientX < right &&
          event.clientY >= top &&
          event.clientY < bottom
        )
          return;
        requestClose();
      }}
      onKeyDown={keepTabInDialog}
      tabIndex={centered ? -1 : undefined}
      className={
        centered
          ? `m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50 ${discardRequested ? "max-w-[28rem]" : "max-w-2xl"}`
          : "m-0 ml-auto h-dvh max-h-dvh w-screen max-w-none overflow-y-auto border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/50 md:w-[min(100%,38rem)]"
      }
    >
      {centered && discardRequested ? (
        <div className="p-5 sm:p-6" role="alert">
          <h2 className="text-lg font-semibold text-slate-950">¿Descartar cambios?</h2>
          <p id="patient-discard-description" className="mt-2 text-sm leading-6 text-slate-700">
            Hay datos sin guardar. Si salís ahora, perderás los cambios realizados.
          </p>
          <div className={`${modalActionGroupClass} mt-6`}>
            <button
              className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              onClick={() => setDiscardRequested(false)}
              ref={continueEditingRef}
              type="button"
            >
              Seguir editando
            </button>
            <button
              className="min-h-11 rounded-md border border-red-700 bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={finishClose}
              type="button"
            >
              Descartar cambios
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={
              centered
                ? "sticky top-0 z-10 flex min-w-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6"
                : "sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white p-4 sm:p-6"
            }
          >
            <div className={centered ? "min-w-0" : undefined}>
              <h2
                className={
                  centered
                    ? "text-lg font-semibold text-slate-950"
                    : "text-xl font-bold text-slate-950"
                }
                tabIndex={-1}
              >
                {title}
              </h2>
              <p
                id="patient-dialog-description"
                className={
                  centered ? "mt-1 break-words text-sm text-slate-600" : "text-sm text-slate-600"
                }
              >
                {description}
              </p>
            </div>
            <button
              type="button"
              aria-label={iconClose ? "Cerrar" : undefined}
              disabled={centered && isPending}
              onClick={requestClose}
              ref={closeButtonRef}
              className={
                iconClose
                  ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
                  : "min-h-11 rounded px-3 font-semibold text-sky-700"
              }
            >
              {iconClose ? (
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
              ) : (
                "Cerrar"
              )}
            </button>
          </div>
          <div
            className={
              centered ? "space-y-5 px-5 pt-4 pb-5 sm:px-6 sm:pb-6" : "space-y-5 p-4 pb-8 sm:p-6"
            }
          >
            {children}
          </div>
        </>
      )}
    </dialog>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  multiline = false,
  disabled = false,
  onBlur,
  inputMode,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string, isDeleting: boolean, input: HTMLInputElement | null) => void;
  error?: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  onBlur?: (value: string) => void;
  inputMode?: "numeric";
  placeholder?: string;
  hint?: string;
}) {
  const id = `patient-${name}`;
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;
  const fieldClass = `w-full rounded border-2 bg-white focus:outline-none ${error ? "border-red-700 focus:border-red-700" : "border-slate-300 focus:border-sky-700"}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value, false, null)}
          onBlur={(e) => onBlur?.(e.target.value)}
          {...formFieldErrorProps(error, `${id}-error`)}
          aria-describedby={describedBy}
          className={`min-h-28 p-3 ${fieldClass}`}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(
              e.target.value,
              (e.nativeEvent as InputEvent).inputType?.startsWith("delete") ?? false,
              e.target,
            )
          }
          onBlur={(e) => onBlur?.(e.target.value)}
          required={required}
          {...formFieldErrorProps(error, `${id}-error`)}
          aria-describedby={describedBy}
          className={`min-h-11 px-3 ${fieldClass}`}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      )}
      <FormFieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function Feedback({ result }: { result: PatientActionResult | null }) {
  return result?.status === "error" ? (
    <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      {result.message}
    </p>
  ) : null;
}

function Registration({
  centerId,
  timezone,
  filters,
  onClose,
  onNotice,
  returnToAppointments,
}: {
  centerId: string;
  timezone: string;
  filters: PatientFilters;
  onClose: () => void;
  onNotice: (message: string, tone?: "success" | "info") => void;
  returnToAppointments: boolean;
}) {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity>(emptyIdentity);
  const identityRef = useRef(identity);
  const resolveGeneration = useRef(0);
  const resolvedIdentity = useRef<ResolveIdentity | null>(null);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [resolution, setResolution] = useState<PatientResolveRow | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [feedback, setFeedback] = useState<PatientActionResult | null>(null);
  const [clientErrors, setClientErrors] = useState<Partial<Record<RegistrationField, string>>>({});
  const identityFormRef = useRef<HTMLFormElement>(null);
  const detailsFormRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const serverErrors = feedback?.status === "error" ? feedback.fields : undefined;
  const fieldError = (field: RegistrationField) => clientErrors[field] || serverErrors?.[field];
  function validateFields(fields: RegistrationField[], form: HTMLFormElement | null): boolean {
    const next: Partial<Record<RegistrationField, string>> = {};
    for (const field of fields) {
      const value =
        field in identityRef.current
          ? identityRef.current[field as keyof Identity]
          : details[field as keyof Details];
      next[field] = registrationFieldError(field, value, timezone);
    }
    setClientErrors((previous) => ({ ...previous, ...next }));
    const invalid = fields.find((field) => next[field]);
    if (invalid) form?.querySelector<HTMLElement>(`[name="${invalid}"]`)?.focus();
    return !invalid;
  }
  function validateOnBlur(field: RegistrationField, value: string) {
    const formatted = field === "birthDate" ? formatBirthDateInput(value) : value;
    if (field === "birthDate" && formatted !== value) changeIdentity("birthDate", formatted);
    setClientErrors((previous) => ({
      ...previous,
      [field]: registrationFieldError(field, formatted, timezone),
    }));
  }
  function runSafely(work: () => Promise<void>) {
    startTransition(async () => {
      try {
        await work();
      } catch {
        setResolution(null);
        setConfirm(false);
        setFeedback({
          status: "error",
          code: "unexpected",
          message:
            "No pudimos confirmar el resultado. Actualizá la página y revisá el estado antes de reintentar.",
        });
      }
    });
  }
  function changeIdentity(field: keyof Identity, value: string) {
    const next = { ...identityRef.current, [field]: value };
    identityRef.current = next;
    setIdentity(next);
    setClientErrors((previous) => ({ ...previous, [field]: "" }));
    setFeedback(null);
    setConfirm(false);
    if (field === "nationalityCode" || field === "documentNumber" || field === "birthDate") {
      resolveGeneration.current += 1;
      resolvedIdentity.current = null;
      setResolution(null);
      setConfirm(false);
    }
  }
  function changeDetails(field: keyof Details, value: string) {
    setDetails((previous) => ({ ...previous, [field]: value }));
    setClientErrors((previous) => ({ ...previous, [field]: "" }));
    setFeedback(null);
    setConfirm(false);
  }
  function acceptResult(result: PatientActionResult) {
    setFeedback(result);
    if (result.status === "error") {
      if (
        result.code === "identity_race" ||
        result.code === "relationship_changed" ||
        result.code === "stale"
      ) {
        setResolution(null);
        setConfirm(false);
      }
      return;
    }
    const data = result.data;
    if (
      data &&
      typeof data === "object" &&
      "patient_center_id" in data &&
      typeof data.patient_center_id === "string"
    ) {
      onClose();
      if (returnToAppointments || ("outcome" in data && data.outcome === "REACTIVATED")) {
        router.push(
          patientRegistrationDestination(
            centerId,
            data.patient_center_id,
            filters,
            returnToAppointments,
          ),
        );
      } else {
        const outcome = "outcome" in data ? data.outcome : "";
        onNotice(
          outcome === "CREATED"
            ? "Paciente registrado correctamente"
            : outcome === "LINKED"
              ? "Paciente vinculado correctamente"
              : "El paciente ya estaba vinculado a este centro.",
          outcome === "ALREADY_ACTIVE" ? "info" : "success",
        );
      }
      router.refresh();
    }
  }
  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (
      !validateFields(["nationalityCode", "documentNumber", "birthDate"], identityFormRef.current)
    )
      return;
    const birthDate = birthDateToIso(identityRef.current.birthDate);
    if (!birthDate) return;
    const requestGeneration = ++resolveGeneration.current;
    const snapshot: ResolveIdentity = {
      nationalityCode: identityRef.current.nationalityCode,
      documentNumber: identityRef.current.documentNumber,
      birthDate: identityRef.current.birthDate,
    };
    const isCurrent = () =>
      requestGeneration === resolveGeneration.current &&
      sameResolveIdentity(identityRef.current, snapshot);
    setFeedback(null);
    setResolution(null);
    resolvedIdentity.current = null;
    startTransition(async () => {
      try {
        const result = await resolvePatientAction({ centerId, ...snapshot, birthDate });
        if (!isCurrent()) return;
        if (
          result.status === "success" &&
          result.data &&
          typeof result.data === "object" &&
          "identity_status" in result.data
        ) {
          resolvedIdentity.current = snapshot;
          setResolution(result.data as PatientResolveRow);
          setConfirm(false);
        } else setFeedback(result);
      } catch {
        if (!isCurrent()) return;
        setResolution(null);
        setConfirm(false);
        setFeedback({
          status: "error",
          code: "unexpected",
          message:
            "No pudimos confirmar el resultado. Actualizá la página y revisá el estado antes de reintentar.",
        });
      }
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      pending ||
      !resolution ||
      !resolvedIdentity.current ||
      !sameResolveIdentity(identityRef.current, resolvedIdentity.current) ||
      (resolution.identity_status === "FOUND" && !resolution.birth_date_matches)
    )
      return;
    if (showDetails) {
      const fields: RegistrationField[] = [
        ...(resolution.identity_status === "NOT_FOUND" ? (["firstName", "lastName"] as const) : []),
        "phone",
        "email",
        "insuranceName",
        "administrativeNotes",
      ];
      if (!validateFields(fields, detailsFormRef.current)) {
        setConfirm(false);
        return;
      }
    }
    const birthDate = birthDateToIso(identity.birthDate);
    if (!birthDate) return;
    if (!normalizedIdentity.success) return;
    const common = normalizedIdentity.data;
    const actionDetails = review
      ? {
          phone: review.phone,
          email: review.email,
          insuranceName: review.insuranceName,
          administrativeNotes: review.administrativeNotes,
        }
      : details;
    setFeedback(null);
    runSafely(async () => {
      let result: PatientActionResult;
      if (resolution.identity_status === "NOT_FOUND") {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        result = await createPatientAction({
          ...common,
          firstName: review?.firstName ?? identity.firstName,
          lastName: review?.lastName ?? identity.lastName,
          ...actionDetails,
        });
      } else if (resolution.relationship_state === "NOT_LINKED") {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        result = await linkPatientAction({
          ...common,
          personId: resolution.person_id,
          ...actionDetails,
          confirmed: true,
        });
      } else if (resolution.relationship_state === "INACTIVE") {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        result = await reactivatePatientAction({
          ...common,
          patientCenterId: resolution.patient_center_id,
          expectedUpdatedAt: resolution.patient_center_updated_at,
          confirmed: true,
        });
      } else {
        onClose();
        router.push(
          patientRegistrationDestination(
            centerId,
            resolution.patient_center_id,
            filters,
            returnToAppointments,
          ),
        );
        return;
      }
      acceptResult(result);
    });
  }
  const matched = resolution?.identity_status === "FOUND" && resolution.birth_date_matches;
  const showDetails =
    resolution?.identity_status === "NOT_FOUND" ||
    (matched && resolution.relationship_state === "NOT_LINKED");
  const normalizedIdentity = patientIdentitySchema.safeParse({
    centerId,
    nationalityCode: identity.nationalityCode,
    documentNumber: identity.documentNumber,
    birthDate: birthDateToIso(identity.birthDate) ?? "",
  });
  const normalizedDetails = patientCenterDetailsSchema.safeParse(details);
  const normalizedFirstName = patientNameSchema.safeParse(identity.firstName);
  const normalizedLastName = patientNameSchema.safeParse(identity.lastName);
  const review =
    confirm &&
    normalizedIdentity.success &&
    normalizedDetails.success &&
    (resolution?.identity_status !== "NOT_FOUND" ||
      (normalizedFirstName.success && normalizedLastName.success))
      ? {
          ...normalizedIdentity.data,
          ...normalizedDetails.data,
          firstName:
            resolution?.identity_status === "NOT_FOUND" && normalizedFirstName.success
              ? normalizedFirstName.data
              : (resolution?.first_name ?? ""),
          lastName:
            resolution?.identity_status === "NOT_FOUND" && normalizedLastName.success
              ? normalizedLastName.data
              : (resolution?.last_name ?? ""),
        }
      : null;
  const hasUnsavedChanges =
    identity.nationalityCode !== emptyIdentity.nationalityCode ||
    identity.documentNumber !== "" ||
    identity.birthDate !== "" ||
    identity.firstName !== "" ||
    identity.lastName !== "" ||
    details.phone !== "" ||
    details.email !== "" ||
    details.insuranceName !== "" ||
    details.administrativeNotes !== "";
  return (
    <PatientDialog
      title="Registrar paciente"
      description="Comprobá la identidad antes de crear o vincular un registro en este centro."
      onClose={onClose}
      closeOnBackdrop
      iconClose
      centered
      hasUnsavedChanges={hasUnsavedChanges}
      isPending={pending}
    >
      <form ref={identityFormRef} noValidate className="space-y-4" onSubmit={resolve}>
        <h3 className="font-semibold text-slate-950">1. Identidad</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="patient-nationalityCode"
              className="block text-sm font-semibold text-slate-800"
            >
              Nacionalidad
            </label>
            <select
              id="patient-nationalityCode"
              name="nationalityCode"
              value={identity.nationalityCode}
              onChange={(event) => changeIdentity("nationalityCode", event.target.value)}
              onBlur={(event) => validateOnBlur("nationalityCode", event.target.value)}
              {...formFieldErrorProps(
                fieldError("nationalityCode"),
                "patient-nationalityCode-error",
              )}
              className={`min-h-11 w-full cursor-pointer rounded border-2 bg-white px-3 focus:outline-none ${fieldError("nationalityCode") ? "border-red-700 focus:border-red-700" : "border-slate-300 focus:border-sky-700"}`}
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <FormFieldError
              id="patient-nationalityCode-error"
              message={fieldError("nationalityCode")}
            />
          </div>
          <Field
            name="documentNumber"
            label="Documento"
            value={identity.documentNumber}
            onChange={(v) => changeIdentity("documentNumber", v)}
            error={fieldError("documentNumber")}
            onBlur={(value) => validateOnBlur("documentNumber", value)}
            required
          />
        </div>
        <Field
          name="birthDate"
          label="Fecha de nacimiento"
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          hint="Formato DD/MM/AAAA"
          value={identity.birthDate}
          onChange={(value, isDeleting, input) => {
            const formatted = formatBirthDateInput(value, isDeleting);
            const caret = input?.selectionStart;
            changeIdentity("birthDate", formatted);
            if (input && caret !== null && caret !== undefined && formatted !== value) {
              const nextCaret = formatBirthDateInput(value.slice(0, caret), isDeleting).length;
              requestAnimationFrame(() => {
                if (document.activeElement === input) input.setSelectionRange(nextCaret, nextCaret);
              });
            }
          }}
          onBlur={(value) => validateOnBlur("birthDate", value)}
          error={fieldError("birthDate")}
          required
        />
        <div className={`${modalActionGroupClass} border-t border-slate-200 pt-4`}>
          <button
            disabled={pending}
            className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50"
            type="submit"
          >
            Comprobar identidad
          </button>
        </div>
      </form>
      <Feedback result={feedback} />
      {resolution?.identity_status === "FOUND" && !resolution.birth_date_matches && (
        <p role="alert" className="rounded bg-amber-50 p-3">
          No pudimos comprobar la identidad con los datos ingresados. Revisá el documento y la fecha
          de nacimiento.
        </p>
      )}
      {resolution && (resolution.identity_status === "NOT_FOUND" || matched) && (
        <form
          ref={detailsFormRef}
          noValidate
          className="space-y-4 border-t border-slate-200 pt-4"
          onSubmit={submit}
        >
          <h3 className="font-semibold">
            2.{" "}
            {resolution.identity_status === "NOT_FOUND" ? "Datos del nuevo paciente" : "Resultado"}
          </h3>
          {resolution.identity_status === "NOT_FOUND" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="firstName"
                label="Nombre"
                value={identity.firstName}
                onChange={(v) => changeIdentity("firstName", v)}
                error={fieldError("firstName")}
                onBlur={(value) => validateOnBlur("firstName", value)}
                required
              />
              <Field
                name="lastName"
                label="Apellido"
                value={identity.lastName}
                onChange={(v) => changeIdentity("lastName", v)}
                error={fieldError("lastName")}
                onBlur={(value) => validateOnBlur("lastName", value)}
                required
              />
            </div>
          ) : (
            <p>
              Identidad encontrada:{" "}
              <strong>
                {resolution.first_name} {resolution.last_name}
              </strong>
              .
            </p>
          )}
          {matched && resolution.relationship_state === "ACTIVE" && (
            <p>Este paciente ya pertenece al centro. Podés abrir su panel administrativo.</p>
          )}
          {matched && resolution.relationship_state === "INACTIVE" && (
            <p>
              El registro está inactivo. Reactivarlo conservará sus datos administrativos actuales.
            </p>
          )}
          {showDetails && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="phone"
                label="Teléfono"
                value={details.phone}
                onChange={(v) => changeDetails("phone", v)}
                error={fieldError("phone")}
                onBlur={(value) => validateOnBlur("phone", value)}
                required
              />
              <Field
                name="email"
                label="Email (opcional)"
                type="email"
                value={details.email}
                onChange={(v) => changeDetails("email", v)}
                error={fieldError("email")}
                onBlur={(value) => validateOnBlur("email", value)}
              />
              <Field
                name="insuranceName"
                label="Obra social / prepaga (opcional)"
                value={details.insuranceName}
                onChange={(v) => changeDetails("insuranceName", v)}
                error={fieldError("insuranceName")}
                onBlur={(value) => validateOnBlur("insuranceName", value)}
              />
              <div className="sm:col-span-2">
                <Field
                  name="administrativeNotes"
                  label="Notas administrativas (opcional)"
                  value={details.administrativeNotes}
                  onChange={(v) => changeDetails("administrativeNotes", v)}
                  error={fieldError("administrativeNotes")}
                  onBlur={(value) => validateOnBlur("administrativeNotes", value)}
                  multiline
                />
              </div>
              <p className="text-sm text-slate-600">
                Uso administrativo. No registrar información clínica.
              </p>
            </div>
          )}
          {confirm && (
            <section
              aria-label="Revisión y confirmación"
              className="space-y-3 rounded border border-sky-200 bg-sky-50 p-3 text-sm"
            >
              <h3 className="font-semibold">3. Revisión y confirmación</h3>
              <p>
                {resolution.identity_status === "NOT_FOUND"
                  ? "Revisá los datos antes de crear el paciente."
                  : resolution.relationship_state === "NOT_LINKED"
                    ? "Revisá los datos antes de vincular el paciente con este centro."
                    : "Confirmá la reactivación en este centro."}
              </p>
              {showDetails && review && (
                <>
                  <div>
                    <h4 className="font-semibold text-slate-900">Identidad</h4>
                    <dl className="mt-1 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-600">Nombre y apellido</dt>
                        <dd className="break-words font-medium">
                          {review.firstName} {review.lastName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">Nacionalidad</dt>
                        <dd className="break-words font-medium">
                          {countries.find((country) => country.code === review.nationalityCode)
                            ?.name ?? review.nationalityCode}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">Documento</dt>
                        <dd className="break-words font-medium">{review.documentNumber}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">Fecha de nacimiento</dt>
                        <dd className="font-medium">{formatPatientBirthDate(review.birthDate)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Datos administrativos</h4>
                    <dl className="mt-1 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-600">Teléfono</dt>
                        <dd className="break-words font-medium">{review.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">Email</dt>
                        <dd className="break-words font-medium">{review.email ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">Obra social / prepaga</dt>
                        <dd className="break-words font-medium">{review.insuranceName ?? "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-slate-600">Notas administrativas</dt>
                        <dd className="whitespace-pre-wrap break-words font-medium">
                          {review.administrativeNotes ?? "Sin notas"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded px-2 font-semibold text-sky-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                    onClick={() => {
                      setConfirm(false);
                      requestAnimationFrame(() =>
                        detailsFormRef.current
                          ?.querySelector<HTMLElement>('[name="phone"]')
                          ?.focus(),
                      );
                    }}
                  >
                    Corregir datos
                  </button>
                </>
              )}
            </section>
          )}
          <div className={`${modalActionGroupClass} border-t border-slate-200 pt-4`}>
            <button
              disabled={pending}
              type="submit"
              className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50"
            >
              {pending
                ? "Procesando…"
                : matched && resolution.relationship_state === "ACTIVE"
                  ? "Abrir panel"
                  : confirm
                    ? "Confirmar"
                    : resolution.identity_status === "NOT_FOUND"
                      ? "Revisar alta"
                      : matched && resolution.relationship_state === "NOT_LINKED"
                        ? "Vincular a este centro"
                        : "Reactivar en este centro"}
            </button>
          </div>
        </form>
      )}
    </PatientDialog>
  );
}

function Administration({
  centerId,
  timezone,
  filters,
  detail,
  detailFailed,
  onClose,
  onNotice,
  notice,
  noticeTone,
  returnToAppointments,
}: {
  centerId: string;
  timezone: string;
  filters: PatientFilters;
  detail: PatientDetail | null;
  detailFailed: boolean;
  onClose: () => void;
  onNotice: (message: string, tone?: "success" | "info") => void;
  notice: string;
  noticeTone: "success" | "info";
  returnToAppointments: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<PatientActionResult | null>(null);
  const [stale, setStale] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [reactivationBirthDate, setReactivationBirthDate] = useState("");
  const [reactivation, setReactivation] = useState<PatientResolveRow | null>(null);
  const [activeTab, setActiveTab] = useState<"data" | "appointments">("data");
  const dataTabRef = useRef<HTMLButtonElement>(null);
  const appointmentsTabRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Details>({
    phone: detail?.phone ?? "",
    email: detail?.email ?? "",
    insuranceName: detail?.insuranceName ?? "",
    administrativeNotes: detail?.administrativeNotes ?? "",
  });
  const [savedForm, setSavedForm] = useState(form);
  const parsedForm = patientCenterDetailsSchema.safeParse(form);
  const parsedSavedForm = patientCenterDetailsSchema.safeParse(savedForm);
  const hasUnsavedChanges =
    parsedForm.success && parsedSavedForm.success
      ? JSON.stringify(parsedForm.data) !== JSON.stringify(parsedSavedForm.data)
      : Object.keys(form).some(
          (key) => form[key as keyof Details] !== savedForm[key as keyof Details],
        );
  const canSave = hasUnsavedChanges && parsedForm.success;
  function selectTab(tab: "data" | "appointments") {
    if (pending) return;
    setActiveTab(tab);
    (tab === "data" ? dataTabRef : appointmentsTabRef).current?.focus();
  }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(activeTab === "data" ? "appointments" : "data");
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      selectTab(event.key === "Home" ? "data" : "appointments");
    }
  }
  function runSafely(work: () => Promise<void>) {
    startTransition(async () => {
      try {
        await work();
      } catch {
        setStale(true);
        setReactivation(null);
        setFeedback({
          status: "error",
          code: "unexpected",
          message:
            "No pudimos confirmar el resultado. Recargá los datos antes de intentar de nuevo.",
        });
      }
    });
  }
  function change(field: keyof Details, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    onNotice("");
  }
  function complete(result: PatientActionResult, deactivate = false) {
    setFeedback(result);
    if (result.status === "error") {
      if (result.code === "stale" || result.code === "missing") setStale(true);
      return;
    }
    const outcome =
      result.data && typeof result.data === "object" && "outcome" in result.data
        ? result.data.outcome
        : "";
    if (!deactivate && outcome === "UPDATED") setSavedForm(form);
    if (outcome === "UPDATED") onNotice("Datos administrativos guardados.");
    if (
      returnToAppointments &&
      (outcome === "REACTIVATED" || outcome === "UNCHANGED") &&
      !deactivate &&
      detail &&
      !detail.isActive
    ) {
      router.push(patientRegistrationDestination(centerId, detail.patientCenterId, filters, true));
      return;
    }
    if (deactivate)
      onNotice(
        outcome === "UNCHANGED" ? "El paciente ya estaba inactivo." : "Paciente desactivado.",
        outcome === "UNCHANGED" ? "info" : "success",
      );
    else if (outcome === "REACTIVATED")
      onNotice("Paciente reactivado. Se conservaron sus datos administrativos.");
    if (deactivate && filters.state === "ACTIVE") {
      onClose();
      router.refresh();
      return;
    }
    setConfirmDeactivate(false);
    router.refresh();
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || pending || stale || !canSave || !detail.isActive) return;
    setFeedback(null);
    onNotice("");
    runSafely(async () =>
      complete(
        await updatePatientAction({
          centerId,
          patientCenterId: detail.patientCenterId,
          expectedUpdatedAt: detail.updatedAt,
          ...form,
        }),
      ),
    );
  }
  function deactivate() {
    if (!detail || pending || stale) return;
    setFeedback(null);
    onNotice("");
    runSafely(async () =>
      complete(
        await deactivatePatientAction({
          centerId,
          patientCenterId: detail.patientCenterId,
          expectedUpdatedAt: detail.updatedAt,
          confirmed: true,
        }),
        true,
      ),
    );
  }
  function verifyReactivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || pending || stale) return;
    setReactivation(null);
    setFeedback(null);
    onNotice("");
    runSafely(async () => {
      const result = await resolvePatientAction({
        centerId,
        nationalityCode: detail.nationalityCode,
        documentNumber: detail.documentNumber,
        birthDate: reactivationBirthDate,
      });
      if (
        result.status === "success" &&
        result.data &&
        typeof result.data === "object" &&
        "identity_status" in result.data
      ) {
        const found = result.data as PatientResolveRow;
        if (
          found.identity_status === "FOUND" &&
          found.birth_date_matches &&
          found.relationship_state === "INACTIVE" &&
          found.patient_center_id === detail.patientCenterId
        )
          setReactivation(found);
        else if (found.identity_status === "FOUND" && !found.birth_date_matches)
          setFeedback({
            status: "error",
            code: "birth_mismatch",
            message: "Los datos ingresados no coinciden con la identidad registrada.",
          });
        else
          setFeedback({
            status: "error",
            code: "relationship_changed",
            message: "El registro cambió. Comprobá nuevamente la identidad antes de continuar.",
          });
      } else setFeedback(result);
    });
  }
  function reactivate() {
    if (
      !detail ||
      !reactivation ||
      reactivation.identity_status !== "FOUND" ||
      !reactivation.birth_date_matches ||
      reactivation.relationship_state !== "INACTIVE" ||
      pending ||
      stale
    )
      return;
    setFeedback(null);
    onNotice("");
    runSafely(async () =>
      complete(
        await reactivatePatientAction({
          centerId,
          patientCenterId: detail.patientCenterId,
          expectedUpdatedAt: reactivation.patient_center_updated_at,
          nationalityCode: detail.nationalityCode,
          documentNumber: detail.documentNumber,
          birthDate: reactivationBirthDate,
          confirmed: true,
        }),
      ),
    );
  }
  const errors = feedback?.status === "error" ? feedback.fields : undefined;
  return (
    <PatientDialog
      title="Administrar paciente"
      description="Datos de este centro. La identidad compartida es de solo lectura."
      onClose={onClose}
      closeOnBackdrop
      iconClose
      centered
      hasUnsavedChanges={hasUnsavedChanges}
      isPending={pending}
    >
      {detailFailed || !detail ? (
        <p role="alert">No pudimos abrir este registro. Volvé al listado y reintentá.</p>
      ) : (
        <>
          <div
            aria-label="Secciones de la ficha"
            className="flex gap-2 border-b border-slate-200"
            role="tablist"
          >
            <button
              aria-controls="patient-data-panel"
              aria-selected={activeTab === "data"}
              className={`min-h-11 rounded-t-md px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${activeTab === "data" ? "border-b-2 border-sky-700 text-sky-800" : "text-slate-600 hover:bg-slate-50"}`}
              disabled={pending}
              id="patient-data-tab"
              onClick={() => selectTab("data")}
              onKeyDown={handleTabKey}
              ref={dataTabRef}
              role="tab"
              tabIndex={activeTab === "data" ? 0 : -1}
              type="button"
            >
              Datos del paciente
            </button>
            <button
              aria-controls="patient-appointments-panel"
              aria-selected={activeTab === "appointments"}
              className={`min-h-11 rounded-t-md px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${activeTab === "appointments" ? "border-b-2 border-sky-700 text-sky-800" : "text-slate-600 hover:bg-slate-50"}`}
              disabled={pending}
              id="patient-appointments-tab"
              onClick={() => selectTab("appointments")}
              onKeyDown={handleTabKey}
              ref={appointmentsTabRef}
              role="tab"
              tabIndex={activeTab === "appointments" ? 0 : -1}
              type="button"
            >
              Turnos
            </button>
          </div>
          <div
            aria-labelledby="patient-data-tab"
            hidden={activeTab !== "data"}
            id="patient-data-panel"
            role="tabpanel"
            className="space-y-5"
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt>Nombre</dt>
              <dd>
                {detail.firstName} {detail.lastName}
              </dd>
              <dt>Nacionalidad</dt>
              <dd>{detail.nationalityCode}</dd>
              <dt>Documento</dt>
              <dd>{detail.documentNumber}</dd>
              <dt>Nacimiento</dt>
              <dd>{formatPatientBirthDate(detail.birthDate)}</dd>
              <dt>Estado</dt>
              <dd>{detail.isActive ? "Activo" : "Inactivo"}</dd>
            </dl>
            <Feedback result={feedback} />
            {notice && (
              <p
                role="status"
                className={`rounded border p-3 text-sm ${noticeTone === "info" ? "border-slate-200 bg-slate-50 text-slate-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
              >
                {notice}
              </p>
            )}
            {stale && (
              <button
                type="button"
                className="min-h-11 font-semibold text-sky-700 underline"
                onClick={() => {
                  setFeedback(null);
                  router.refresh();
                }}
              >
                Recargar datos
              </button>
            )}
            <form className="space-y-4" onSubmit={save}>
              <h3 className="font-semibold">Datos administrativos</h3>
              <Field
                name="phone"
                label="Teléfono"
                value={form.phone}
                onChange={(v) => change("phone", v)}
                error={errors?.phone}
                disabled={pending}
                required
              />
              <Field
                name="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => change("email", v)}
                error={errors?.email}
                disabled={pending}
              />
              <Field
                name="insuranceName"
                label="Obra social / prepaga"
                value={form.insuranceName}
                onChange={(v) => change("insuranceName", v)}
                error={errors?.insuranceName}
                disabled={pending}
              />
              <Field
                name="administrativeNotes"
                label="Notas administrativas"
                value={form.administrativeNotes}
                onChange={(v) => change("administrativeNotes", v)}
                error={errors?.administrativeNotes}
                disabled={pending}
                multiline
              />
              <p className="text-sm text-slate-600">
                Uso administrativo. No registrar información clínica.
              </p>
              <button
                disabled={pending || stale || !detail.isActive || !canSave}
                type="submit"
                className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white disabled:opacity-50"
              >
                Guardar cambios
              </button>
            </form>
            {detail.isActive && (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={pending || stale}
                  onClick={() => setConfirmDeactivate(true)}
                  className="min-h-11 rounded-md border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-50"
                >
                  Desactivar paciente
                </button>
                {confirmDeactivate && (
                  <div
                    role="group"
                    aria-label="Confirmar desactivación"
                    className="rounded border border-rose-300 p-4"
                  >
                    <div className="space-y-1.5">
                      <p>
                        ¿Estás seguro que querés desactivar a {detail.firstName} {detail.lastName}?
                      </p>
                      <p>Dejará de aparecer como paciente activo.</p>
                      <p>El registro no se elimina.</p>
                    </div>
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        disabled={pending || stale}
                        onClick={deactivate}
                        className="min-h-11 rounded bg-rose-700 px-4 font-semibold text-white"
                      >
                        Confirmar desactivación
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeactivate(false)}
                        className="min-h-11 px-3"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!detail.isActive && (
              <form className="space-y-3" onSubmit={verifyReactivation}>
                <h3 className="font-semibold">Reactivar en este centro</h3>
                <p className="text-sm text-slate-600">
                  Ingresá la fecha de nacimiento para comprobar la identidad. La reactivación
                  conserva teléfono, email, cobertura y notas.
                </p>
                <Field
                  name="reactivationBirthDate"
                  label="Confirmar fecha de nacimiento"
                  type="date"
                  value={reactivationBirthDate}
                  onChange={(v) => {
                    setReactivationBirthDate(v);
                    setReactivation(null);
                  }}
                  required
                />
                <button
                  type="submit"
                  disabled={pending || stale}
                  className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white disabled:opacity-50"
                >
                  Comprobar para reactivar
                </button>
                {reactivation && (
                  <div className="rounded border border-sky-200 p-3">
                    <p>
                      Identidad comprobada. Confirmá la reactivación de {detail.firstName}{" "}
                      {detail.lastName}.
                    </p>
                    <button
                      type="button"
                      disabled={pending || stale}
                      onClick={reactivate}
                      className="mt-2 min-h-11 rounded bg-sky-700 px-4 font-semibold text-white disabled:opacity-50"
                    >
                      Confirmar reactivación
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
          <div
            aria-labelledby="patient-appointments-tab"
            hidden={activeTab !== "appointments"}
            id="patient-appointments-panel"
            role="tabpanel"
          >
            <PatientAppointments
              centerId={centerId}
              patientCenterId={detail.patientCenterId}
              timezone={timezone}
            />
          </div>
        </>
      )}
    </PatientDialog>
  );
}

export function PatientWorkspace({
  centerId,
  timezone = "UTC",
  filters,
  detail,
  selectedPatientCenterId = detail?.patientCenterId ?? null,
  detailFailed,
  returnToAppointments = false,
}: {
  centerId: string;
  timezone?: string;
  selectedPatientCenterId?: string | null;
  filters: PatientFilters;
  detail: PatientDetail | null;
  detailFailed: boolean;
  returnToAppointments?: boolean;
}) {
  const router = useRouter();
  const selected = detail || detailFailed;
  const [registerOpen, setRegisterOpen] = useState(returnToAppointments && !selected);
  const [notice, setNotice] = useState<{
    message: string;
    source: "registration" | "administration";
    tone: "success" | "info";
  } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  function closeRegister() {
    setRegisterOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function closeDetail() {
    router.push(patientSearchUrl(centerId, filters, undefined, returnToAppointments));
    requestAnimationFrame(() => {
      const link = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href*='patient=']"),
      ).find((item) => item.href.includes(`patient=${detail?.patientCenterId}`));
      link?.focus();
    });
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setNotice(null);
          setRegisterOpen(true);
        }}
        className={modulePrimaryActionClass}
      >
        Registrar paciente
      </button>
      {notice && !selected && (
        <p
          role="status"
          className={`rounded border p-3 text-sm ${notice.tone === "info" ? "border-slate-200 bg-slate-50 text-slate-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
        >
          {notice.message}
        </p>
      )}
      {registerOpen && (
        <Registration
          centerId={centerId}
          timezone={timezone}
          filters={filters}
          onClose={closeRegister}
          onNotice={(message, tone = "success") =>
            setNotice({ message, source: "registration", tone })
          }
          returnToAppointments={returnToAppointments}
        />
      )}
      {selected && (
        <Administration
          key={`${centerId}:${selectedPatientCenterId ?? "none"}:${detail?.updatedAt ?? "failed"}`}
          centerId={centerId}
          timezone={timezone}
          filters={filters}
          detail={detail}
          detailFailed={detailFailed}
          onClose={closeDetail}
          onNotice={(message, tone = "success") =>
            setNotice(message ? { message, source: "administration", tone } : null)
          }
          notice={notice?.source === "administration" ? notice.message : ""}
          noticeTone={notice?.tone ?? "success"}
          returnToAppointments={returnToAppointments}
        />
      )}
    </>
  );
}
