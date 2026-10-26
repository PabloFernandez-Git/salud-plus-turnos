"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { flushSync } from "react-dom";
import { FormFieldError, formFieldErrorProps } from "@/components/form-field-error";
import { ModuleHeader, modulePrimaryActionClass } from "@/components/module-header";
import { modalActionGroupClass } from "@/components/modal-action-group";
import {
  createProfessionalAction,
  linkProfessionalAction,
  resolveProfessionalAction,
  setProfessionalCenterActiveAction,
  updateProfessionalCenterAction,
} from "../actions/professional-actions";
import { normalizeDocumentForValidation } from "../schemas/professional-document";
import { isValidProfessionalEmail } from "../schemas/professional-email";
import type { ProfessionalActionState } from "../server/professional-actions";
import type { ProfessionalSpecialtyActionState } from "../server/professional-specialty-actions";
import type {
  ProfessionalListItem,
  ProfessionalSpecialtyAssociation,
  ProfessionalSpecialtyOption,
} from "../server/professionals";
import countries from "./country-options.json";
import { ProfessionalSpecialtiesEditor } from "./professional-specialties-editor";

type Selection = { mode: "new" } | { mode: "edit" | "state"; professional: ProfessionalListItem };
type Resolution = NonNullable<ProfessionalActionState["resolution"]>;
type NewDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  duration: string;
};
type FieldName = keyof NewDetails | "nationalityCode" | "documentNumber";
const emptyDetails: NewDetails = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  licenseNumber: "",
  duration: "30",
};
const emptyAssociations: ProfessionalSpecialtyAssociation[] = [];
const fieldClass = (error?: string) =>
  `block w-full rounded-md border-2 px-3 py-2 focus:outline-none ${error ? "border-red-700 focus:border-red-700" : "border-slate-300 focus:border-sky-700"}`;
const secondaryButtonClass =
  "min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60";
const primaryButtonClass =
  "min-h-11 rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60";
const tableActionClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-sm leading-5 font-normal text-sky-800";

export function ProfessionalsScreen({
  centerId,
  loadFailed,
  professionals,
  specialties = [],
  associations = emptyAssociations,
}: {
  centerId: string;
  centerName: string;
  loadFailed: boolean;
  professionals: ProfessionalListItem[];
  specialties?: ProfessionalSpecialtyOption[];
  associations?: ProfessionalSpecialtyAssociation[];
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [nationalityCode, setNationalityCode] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [newDetails, setNewDetails] = useState<NewDetails>(emptyDetails);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [duration, setDuration] = useState("30");
  const [feedback, setFeedback] = useState<ProfessionalActionState | null>(null);
  const [clientErrors, setClientErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [localAssociations, setLocalAssociations] = useState<ProfessionalSpecialtyAssociation[]>(
    [],
  );
  const [savedAssociations, setSavedAssociations] = useState({
    source: associations,
    rows: associations,
  });
  const [specialtiesDirty, setSpecialtiesDirty] = useState(false);
  const [specialtiesPending, setSpecialtiesPending] = useState(false);
  const [discardRequested, setDiscardRequested] = useState(false);
  const [hasTableOverflow, setHasTableOverflow] = useState(false);
  const [refreshBlock, setRefreshBlock] = useState<{
    professionalCenterId: string;
    snapshot: ProfessionalListItem[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tableScrollRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);
  const hadSelectionRef = useRef(false);
  const wasDiscardRequested = useRef(false);
  const errorIds = {
    nationalityCode: useId(),
    documentNumber: useId(),
    firstName: useId(),
    lastName: useId(),
    email: useId(),
    phone: useId(),
    licenseNumber: useId(),
    duration: useId(),
  };
  const isOpen = Boolean(selection);
  const pending = isPending || specialtiesPending;
  const tableAssociations =
    savedAssociations.source === associations ? savedAssociations.rows : associations;
  const activeSpecialtyById = new Map(
    specialties
      .filter((specialty) => specialty.isActive)
      .map((specialty) => [specialty.id, specialty]),
  );
  const specialtiesByProfessional = new Map<string, ProfessionalSpecialtyOption[]>();
  for (const association of tableAssociations) {
    if (!association.isActive) continue;
    const specialty = activeSpecialtyById.get(association.specialtyId);
    if (!specialty) continue;
    const assigned = specialtiesByProfessional.get(association.professionalCenterId) ?? [];
    assigned.push(specialty);
    specialtiesByProfessional.set(association.professionalCenterId, assigned);
  }
  for (const assigned of specialtiesByProfessional.values())
    assigned.sort((a, b) => a.name.localeCompare(b.name, "es"));

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (selection) hadSelectionRef.current = true;
    else if (hadSelectionRef.current) {
      hadSelectionRef.current = false;
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [selection]);

  useEffect(() => {
    if (discardRequested) continueEditingRef.current?.focus();
    else if (wasDiscardRequested.current) closeButtonRef.current?.focus();
    wasDiscardRequested.current = discardRequested;
  }, [discardRequested]);

  useEffect(() => {
    if (pending) dialogRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    const container = tableScrollRef.current;
    if (!container || professionals.length === 0) return;
    const syncOverflow = () =>
      setHasTableOverflow(container.scrollWidth > container.clientWidth + 1);
    syncOverflow();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncOverflow);
    observer?.observe(container);
    const table = container.querySelector("table");
    if (table) observer?.observe(table);
    window.addEventListener("resize", syncOverflow);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncOverflow);
    };
  }, [loadFailed, professionals.length]);

  function select(next: Selection | null, trigger?: HTMLButtonElement) {
    if (trigger) triggerRef.current = trigger;
    setSelection(next);
    setResolution(null);
    setFeedback(null);
    setClientErrors({});
    setDiscardRequested(false);
    setNationalityCode("");
    setDocumentNumber("");
    setNewDetails(emptyDetails);
    setLicenseNumber(next && next.mode !== "new" ? (next.professional.licenseNumber ?? "") : "");
    setDuration(
      next && next.mode !== "new"
        ? String(next.professional.usualAppointmentDurationMinutes)
        : "30",
    );
    setLocalAssociations(
      next && next.mode === "edit"
        ? associations.filter((row) => row.professionalCenterId === next.professional.id)
        : [],
    );
    setSpecialtiesDirty(false);
  }

  const hasConfigurationChanges =
    selection?.mode === "edit" &&
    (licenseNumber.trim() !== (selection.professional.licenseNumber ?? "") ||
      (validDuration(duration)
        ? Number(duration) !== selection.professional.usualAppointmentDurationMinutes
        : duration !== String(selection.professional.usualAppointmentDurationMinutes)));

  const hasUnsavedChanges =
    selection?.mode === "new"
      ? nationalityCode !== "" ||
        documentNumber !== "" ||
        Object.entries(newDetails).some(
          ([key, value]) => value !== emptyDetails[key as keyof NewDetails],
        )
      : selection?.mode === "edit"
        ? hasConfigurationChanges || specialtiesDirty
        : false;

  function requestClose() {
    if (pending || submittingRef.current) return;
    if (hasUnsavedChanges) setDiscardRequested(true);
    else select(null);
  }

  function keepTabInDialog(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]",
      ) ?? [],
    ).filter((element) => !element.closest("[hidden]") && element.tabIndex >= 0);
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
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearError(field: FieldName) {
    setClientErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback((current) => {
      const serverField = field === "duration" ? "usualAppointmentDurationMinutes" : field;
      if (!current?.fieldErrors?.[serverField]) return current;
      const fieldErrors = { ...current.fieldErrors };
      delete fieldErrors[serverField];
      return { ...current, fieldErrors };
    });
  }

  function changeDetails(field: keyof NewDetails, value: string) {
    setNewDetails((current) => ({ ...current, [field]: value }));
    clearError(field);
  }

  function run(
    action: (form: FormData) => Promise<ProfessionalActionState>,
    form: FormData,
    closeOnSuccess = true,
  ) {
    submittingRef.current = true;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await action(form);
        if (result.status === "resolved") {
          setResolution(result.resolution ?? null);
          setFeedback(null);
          return;
        }
        setFeedback(result);
        if (result.status === "stale") {
          select(null);
          setFeedback(result);
          router.refresh();
        } else if (result.status === "success") {
          if (selection?.mode === "edit" && !closeOnSuccess && result.updatedAt) {
            setSelection({
              mode: "edit",
              professional: {
                ...selection.professional,
                licenseNumber: licenseNumber.trim() || null,
                usualAppointmentDurationMinutes: Number(duration),
                updatedAt: result.updatedAt,
              },
            });
            setRefreshBlock({
              professionalCenterId: selection.professional.id,
              snapshot: professionals,
            });
          } else if (closeOnSuccess || !result.updatedAt) {
            select(null);
            setFeedback(result);
          }
          router.refresh();
        }
      } catch {
        select(null);
        setFeedback({
          status: "error",
          message:
            "No pudimos confirmar el resultado. Actualizá la página y revisá el estado antes de reintentar.",
        });
        router.refresh();
      } finally {
        submittingRef.current = false;
      }
    });
  }

  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submittingRef.current) return;
    const errors: Partial<Record<FieldName, string>> = {};
    if (!nationalityCode) errors.nationalityCode = "Seleccioná un país.";
    if (!normalizeDocumentForValidation(documentNumber))
      errors.documentNumber = "Ingresá un documento válido.";
    if (Object.keys(errors).length) {
      setClientErrors(errors);
      dialogRef.current
        ?.querySelector<HTMLElement>(
          errors.nationalityCode ? "#professional-country" : "#professional-document",
        )
        ?.focus();
      return;
    }
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("nationalityCode", nationalityCode);
    form.set("documentNumber", documentNumber);
    setResolution(null);
    run(resolveProfessionalAction, form, false);
  }

  function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submittingRef.current || !resolution || selection?.mode !== "new") return;
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("nationalityCode", nationalityCode);
    form.set("documentNumber", documentNumber);
    if (resolution.resolution_status === "NOT_FOUND") {
      const errors: Partial<Record<FieldName, string>> = {};
      if (!newDetails.firstName.trim()) errors.firstName = "Ingresá el nombre.";
      if (!newDetails.lastName.trim()) errors.lastName = "Ingresá el apellido.";
      if (!isValidProfessionalEmail(newDetails.email)) errors.email = "Ingresá un email válido.";
      if (!validDuration(newDetails.duration))
        errors.duration = "Ingresá una duración entre 5 y 480 minutos, en múltiplos de 5.";
      if (Object.keys(errors).length) {
        setClientErrors(errors);
        dialogRef.current
          ?.querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)
          ?.focus();
        return;
      }
      for (const [key, value] of Object.entries(newDetails)) {
        form.set(key === "duration" ? "usualAppointmentDurationMinutes" : key, value);
      }
      run(createProfessionalAction, form);
    } else if (
      resolution.resolution_status === "NOT_LINKED" ||
      resolution.resolution_status === "LINKED_INACTIVE"
    ) {
      form.set("professionalId", resolution.professional_id!);
      form.set(
        "expectedProfessionalCenterUpdatedAt",
        resolution.professional_center_updated_at ?? "",
      );
      form.set("confirmed", "true");
      run(linkProfessionalAction, form);
    }
  }

  function submitCenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submittingRef.current || !selection || selection.mode === "new") return;
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("professionalCenterId", selection.professional.id);
    form.set("expectedUpdatedAt", selection.professional.updatedAt);
    if (selection.mode === "edit") {
      if (!hasConfigurationChanges) return;
      if (!validDuration(duration)) {
        setClientErrors({
          duration: "Ingresá una duración entre 5 y 480 minutos, en múltiplos de 5.",
        });
        dialogRef.current?.querySelector<HTMLInputElement>("#professional-duration")?.focus();
        return;
      }
      form.set("licenseNumber", licenseNumber);
      form.set("usualAppointmentDurationMinutes", duration);
      run(updateProfessionalCenterAction, form, false);
    } else {
      form.set("isActive", String(!selection.professional.isActive));
      form.set("confirmed", "true");
      run(setProfessionalCenterActiveAction, form);
    }
  }

  function specialtyResult(
    professionalCenterId: string,
    result: ProfessionalSpecialtyActionState,
    changes: { activateIds: string[]; deactivateIds: string[] },
  ) {
    setFeedback(result);
    if (result.status === "stale") {
      select(null);
      setFeedback(result);
      setRefreshBlock({ professionalCenterId, snapshot: professionals });
      router.refresh();
    } else if (result.status === "success") {
      if (result.updatedAt && selection?.mode === "edit") {
        setLocalAssociations((current) =>
          applySpecialtyChanges(current, professionalCenterId, changes),
        );
        setSavedAssociations((current) => ({
          source: associations,
          rows: applySpecialtyChanges(
            current.source === associations ? current.rows : associations,
            professionalCenterId,
            changes,
          ),
        }));
        setSelection({
          mode: "edit",
          professional: { ...selection.professional, updatedAt: result.updatedAt },
        });
      } else {
        select(null);
        setFeedback(result);
      }
      setRefreshBlock({ professionalCenterId, snapshot: professionals });
      router.refresh();
    }
  }

  const fieldError = (field: FieldName) =>
    clientErrors[field] ??
    feedback?.fieldErrors?.[field === "duration" ? "usualAppointmentDurationMinutes" : field]?.[0];

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10 [&_button:enabled]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_a[href]]:cursor-pointer">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <ModuleHeader
          centerId={centerId}
          title="Profesionales"
          description="Administrá los profesionales del centro"
          actions={
            !loadFailed && (
              <button
                type="button"
                disabled={pending}
                onClick={(event) => select({ mode: "new" }, event.currentTarget)}
                className={modulePrimaryActionClass}
              >
                Nuevo profesional
              </button>
            )
          }
        />
        {loadFailed ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            No pudimos cargar los profesionales. Actualizá la página para reintentar.
          </p>
        ) : (
          <>
            {feedback && !selection && (
              <p
                role="alert"
                className={`rounded-lg border p-4 ${feedback.status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}
              >
                {feedback.message}
                {feedback.message.includes("Usuarios") && (
                  <>
                    {" "}
                    <Link className="underline" href={`/centers/${centerId}/users`}>
                      Ir a Usuarios
                    </Link>
                  </>
                )}
              </p>
            )}
            {selection && (
              <dialog
                ref={dialogRef}
                aria-label={discardRequested ? "Descartar cambios" : undefined}
                aria-labelledby={discardRequested ? undefined : "professional-dialog-title"}
                aria-modal="true"
                className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50 ${discardRequested || selection.mode === "state" ? "max-w-[28rem]" : "max-w-3xl"}`}
                onCancel={(event) => {
                  event.preventDefault();
                  if (pending || submittingRef.current) return;
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
                onKeyDown={keepTabInDialog}
                tabIndex={-1}
              >
                <div className="p-5 sm:p-6">
                  {discardRequested && (
                    <div role="alert">
                      <h2 className="text-lg font-semibold text-slate-950">¿Descartar cambios?</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        Hay datos sin guardar. Si salís ahora, perderás los cambios realizados.
                      </p>
                      <div className={`${modalActionGroupClass} mt-6`}>
                        <button
                          type="button"
                          ref={continueEditingRef}
                          onClick={() => setDiscardRequested(false)}
                          className={secondaryButtonClass}
                        >
                          Seguir editando
                        </button>
                        <button
                          type="button"
                          onClick={() => select(null)}
                          className="min-h-11 rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                        >
                          Descartar cambios
                        </button>
                      </div>
                    </div>
                  )}
                  <div hidden={discardRequested}>
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <h2
                        id="professional-dialog-title"
                        className="min-w-0 break-words text-xl font-semibold text-slate-950"
                      >
                        {selection.mode === "new"
                          ? "Nuevo profesional"
                          : selection.mode === "edit"
                            ? `Configurar ${selection.professional.firstName} ${selection.professional.lastName}`
                            : `${selection.professional.isActive ? "Desactivar" : "Activar"} ${selection.professional.firstName} ${selection.professional.lastName}`}
                      </h2>
                      <button
                        ref={closeButtonRef}
                        type="button"
                        aria-label="Cerrar"
                        disabled={pending}
                        onClick={requestClose}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
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
                    {feedback?.status === "error" && (
                      <p
                        role="alert"
                        className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                      >
                        {feedback.message}
                        {feedback.message.includes("Usuarios") && (
                          <>
                            {" "}
                            <Link className="underline" href={`/centers/${centerId}/users`}>
                              Ir a Usuarios
                            </Link>
                          </>
                        )}
                      </p>
                    )}
                    {feedback?.status === "success" && selection.mode === "edit" && (
                      <p
                        role="status"
                        className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                      >
                        {feedback.message}
                      </p>
                    )}
                    {selection.mode === "new" ? (
                      <>
                        <form noValidate onSubmit={resolve} className="mt-5 space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block space-y-1 text-sm font-medium text-slate-800">
                              <span>Nacionalidad</span>
                              <select
                                id="professional-country"
                                aria-label="Nacionalidad"
                                value={nationalityCode}
                                disabled={pending}
                                onChange={(event) => {
                                  setNationalityCode(event.target.value);
                                  setResolution(null);
                                  setNewDetails(emptyDetails);
                                  clearError("nationalityCode");
                                }}
                                {...formFieldErrorProps(
                                  fieldError("nationalityCode"),
                                  errorIds.nationalityCode,
                                )}
                                className={fieldClass(fieldError("nationalityCode"))}
                              >
                                <option value="">Seleccioná un país</option>
                                {countries.map((country) => (
                                  <option key={country.code} value={country.code}>
                                    {country.name}
                                  </option>
                                ))}
                              </select>
                              <FormFieldError
                                id={errorIds.nationalityCode}
                                message={fieldError("nationalityCode")}
                              />
                            </label>
                            <label className="block space-y-1 text-sm font-medium text-slate-800">
                              <span>Documento</span>
                              <input
                                id="professional-document"
                                aria-label="Documento"
                                value={documentNumber}
                                disabled={pending}
                                onChange={(event) => {
                                  setDocumentNumber(event.target.value);
                                  setResolution(null);
                                  setNewDetails(emptyDetails);
                                  clearError("documentNumber");
                                }}
                                {...formFieldErrorProps(
                                  fieldError("documentNumber"),
                                  errorIds.documentNumber,
                                )}
                                className={fieldClass(fieldError("documentNumber"))}
                              />
                              <FormFieldError
                                id={errorIds.documentNumber}
                                message={fieldError("documentNumber")}
                              />
                            </label>
                          </div>
                          <div className={modalActionGroupClass}>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={requestClose}
                              className={secondaryButtonClass}
                            >
                              Cancelar
                            </button>
                            <button type="submit" disabled={pending} className={primaryButtonClass}>
                              {pending ? "Buscando…" : "Verificar documento"}
                            </button>
                          </div>
                        </form>
                        {resolution?.resolution_status === "NOT_FOUND" && (
                          <form
                            noValidate
                            onSubmit={submitNew}
                            className="mt-6 space-y-4 border-t border-slate-200 pt-5"
                          >
                            <p className="text-sm text-slate-700">
                              No existe un profesional con ese documento. Completá el alta.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {(
                                [
                                  "firstName",
                                  "lastName",
                                  "email",
                                  "phone",
                                  "licenseNumber",
                                  "duration",
                                ] as const
                              ).map((field) => (
                                <label
                                  key={field}
                                  className="block space-y-1 text-sm font-medium text-slate-800"
                                >
                                  <span>
                                    {
                                      {
                                        firstName: "Nombre",
                                        lastName: "Apellido",
                                        email: "Email",
                                        phone: "Teléfono (opcional)",
                                        licenseNumber: "Matrícula (opcional)",
                                        duration: "Duración habitual (minutos)",
                                      }[field]
                                    }
                                  </span>
                                  <input
                                    name={field}
                                    aria-label={
                                      {
                                        firstName: "Nombre",
                                        lastName: "Apellido",
                                        email: "Email",
                                        phone: "Teléfono (opcional)",
                                        licenseNumber: "Matrícula (opcional)",
                                        duration: "Duración habitual (minutos)",
                                      }[field]
                                    }
                                    type={
                                      field === "duration"
                                        ? "number"
                                        : field === "email"
                                          ? "email"
                                          : "text"
                                    }
                                    min={field === "duration" ? 5 : undefined}
                                    max={field === "duration" ? 480 : undefined}
                                    step={field === "duration" ? 5 : undefined}
                                    value={newDetails[field]}
                                    disabled={pending}
                                    onChange={(event) => changeDetails(field, event.target.value)}
                                    {...formFieldErrorProps(fieldError(field), errorIds[field])}
                                    className={fieldClass(fieldError(field))}
                                  />
                                  <FormFieldError
                                    id={errorIds[field]}
                                    message={fieldError(field)}
                                  />
                                </label>
                              ))}
                            </div>
                            <div className={modalActionGroupClass}>
                              <button
                                type="submit"
                                disabled={pending}
                                className={primaryButtonClass}
                              >
                                {pending ? "Guardando…" : "Crear y vincular al centro"}
                              </button>
                            </div>
                          </form>
                        )}
                        {resolution && resolution.resolution_status !== "NOT_FOUND" && (
                          <form
                            onSubmit={submitNew}
                            className="mt-6 space-y-3 border-t border-slate-200 pt-5"
                          >
                            <p className="font-medium">
                              {resolution.first_name} {resolution.last_name}
                            </p>
                            <p className="text-sm text-slate-700">
                              {resolution.resolution_status === "NOT_LINKED"
                                ? "Este profesional aún no está vinculado al centro."
                                : resolution.resolution_status === "LINKED_INACTIVE"
                                  ? "Su vínculo con este centro está inactivo. La reactivación conserva su configuración."
                                  : "Este profesional ya pertenece al centro y está activo."}
                            </p>
                            {resolution.resolution_status !== "LINKED_ACTIVE" && (
                              <div className={modalActionGroupClass}>
                                <button
                                  type="submit"
                                  disabled={pending}
                                  className={primaryButtonClass}
                                >
                                  {pending
                                    ? "Guardando…"
                                    : resolution.resolution_status === "NOT_LINKED"
                                      ? "Vincular profesional al centro"
                                      : "Confirmar reactivación"}
                                </button>
                              </div>
                            )}
                          </form>
                        )}
                      </>
                    ) : selection.mode === "edit" ? (
                      <>
                        <form noValidate onSubmit={submitCenter} className="mt-5 space-y-4">
                          <h3 className="text-lg font-semibold text-slate-950">Configuración</h3>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block space-y-1 text-sm font-medium text-slate-800">
                              <span>Matrícula (opcional)</span>
                              <input
                                aria-label="Matrícula (opcional)"
                                value={licenseNumber}
                                disabled={pending}
                                onChange={(event) => {
                                  setLicenseNumber(event.target.value);
                                  clearError("licenseNumber");
                                }}
                                {...formFieldErrorProps(
                                  fieldError("licenseNumber"),
                                  errorIds.licenseNumber,
                                )}
                                className={fieldClass(fieldError("licenseNumber"))}
                              />
                              <FormFieldError
                                id={errorIds.licenseNumber}
                                message={fieldError("licenseNumber")}
                              />
                            </label>
                            <label className="block space-y-1 text-sm font-medium text-slate-800">
                              <span>Duración habitual (minutos)</span>
                              <input
                                id="professional-duration"
                                aria-label="Duración habitual (minutos)"
                                value={duration}
                                type="number"
                                min="5"
                                max="480"
                                step="5"
                                disabled={pending}
                                onChange={(event) => {
                                  setDuration(event.target.value);
                                  clearError("duration");
                                }}
                                {...formFieldErrorProps(fieldError("duration"), errorIds.duration)}
                                className={fieldClass(fieldError("duration"))}
                              />
                              <FormFieldError
                                id={errorIds.duration}
                                message={fieldError("duration")}
                              />
                            </label>
                          </div>
                          <div className={modalActionGroupClass}>
                            <button
                              type="submit"
                              disabled={pending || !hasConfigurationChanges}
                              className={primaryButtonClass}
                            >
                              {pending ? "Guardando…" : "Guardar configuración"}
                            </button>
                          </div>
                        </form>
                        <ProfessionalSpecialtiesEditor
                          key={selection.professional.id}
                          centerId={centerId}
                          professional={selection.professional}
                          specialties={specialties}
                          associations={localAssociations}
                          onDirtyChange={setSpecialtiesDirty}
                          onPendingChange={setSpecialtiesPending}
                          onSubmitStart={() => flushSync(() => setFeedback(null))}
                          onResult={(result, changes) =>
                            specialtyResult(selection.professional.id, result, changes)
                          }
                        />
                        <div className={`${modalActionGroupClass} mt-6`}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={requestClose}
                            className={secondaryButtonClass}
                          >
                            Cerrar
                          </button>
                        </div>
                      </>
                    ) : (
                      <form onSubmit={submitCenter} className="mt-5 space-y-5">
                        <p className="text-sm leading-6 text-slate-700">
                          {selection.professional.isActive
                            ? "Confirmá la desactivación. La configuración y las asociaciones existentes se conservan."
                            : "Confirmá la activación. La configuración y las asociaciones existentes se conservan."}
                        </p>
                        <div className={modalActionGroupClass}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={requestClose}
                            className={secondaryButtonClass}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={pending}
                            className={`min-h-11 rounded-md px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${selection.professional.isActive ? "bg-red-700 hover:bg-red-800 focus-visible:outline-red-700" : "bg-sky-700 hover:bg-sky-800 focus-visible:outline-sky-700"}`}
                          >
                            {pending
                              ? "Guardando…"
                              : `Confirmar ${selection.professional.isActive ? "desactivación" : "activación"}`}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </dialog>
            )}
            {professionals.length > 0 && hasTableOverflow && (
              <p className="text-xs leading-5 text-slate-500">
                Deslizá horizontalmente para ver todas las columnas
              </p>
            )}
            <section
              ref={tableScrollRef}
              aria-label="Listado de profesionales"
              className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
            >
              {professionals.length === 0 ? (
                <p className="p-6 text-slate-600">
                  Todavía no hay profesionales vinculados a este centro.
                </p>
              ) : (
                <table className="w-full min-w-[64rem] text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-4">Profesional</th>
                      <th className="p-4">Especialidades</th>
                      <th className="p-4">Matrícula</th>
                      <th className="p-4">Duración habitual</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {professionals.map((professional) => (
                      <tr key={professional.id} className="border-t border-slate-200">
                        <td className="min-w-40 p-4 font-medium">
                          {professional.firstName} {professional.lastName}
                        </td>
                        <td className="min-w-56 p-4">
                          {specialtiesByProfessional.has(professional.id) ? (
                            <ul className="space-y-1">
                              {specialtiesByProfessional.get(professional.id)?.map((specialty) => (
                                <li key={specialty.id}>{specialty.name}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-500">Sin especialidades</span>
                          )}
                        </td>
                        <td className="p-4">{professional.licenseNumber ?? "—"}</td>
                        <td className="p-4">{professional.usualAppointmentDurationMinutes} min</td>
                        <td className="p-4">{professional.isActive ? "Activo" : "Inactivo"}</td>
                        <td className="min-w-max p-4 whitespace-nowrap">
                          <div className="flex w-max flex-nowrap items-center gap-2">
                            {professional.isActive && (
                              <Link
                                href={`/centers/${centerId}/professionals/${professional.id}/availability`}
                                className={`${tableActionClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700`}
                              >
                                Disponibilidad
                              </Link>
                            )}
                            <button
                              type="button"
                              disabled={
                                pending ||
                                (refreshBlock?.professionalCenterId === professional.id &&
                                  refreshBlock.snapshot === professionals)
                              }
                              onClick={(event) =>
                                select({ mode: "edit", professional }, event.currentTarget)
                              }
                              className={`${tableActionClass} disabled:opacity-50`}
                            >
                              Configurar
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={(event) =>
                                select({ mode: "state", professional }, event.currentTarget)
                              }
                              className={`${tableActionClass} disabled:opacity-50`}
                            >
                              {professional.isActive ? "Desactivar" : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function applySpecialtyChanges(
  rows: ProfessionalSpecialtyAssociation[],
  professionalCenterId: string,
  changes: { activateIds: string[]; deactivateIds: string[] },
) {
  const active = new Set(changes.activateIds);
  const inactive = new Set(changes.deactivateIds);
  return [
    ...rows
      .filter(
        (row) => row.professionalCenterId !== professionalCenterId || !active.has(row.specialtyId),
      )
      .map((row) =>
        row.professionalCenterId === professionalCenterId && inactive.has(row.specialtyId)
          ? { ...row, isActive: false }
          : row,
      ),
    ...changes.activateIds.map((specialtyId) => ({
      professionalCenterId,
      specialtyId,
      isActive: true,
    })),
  ];
}

function validDuration(value: string) {
  const duration = Number(value);
  return /^\d+$/.test(value) && duration >= 5 && duration <= 480 && duration % 5 === 0;
}
