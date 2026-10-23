"use client";

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
import { FormFieldError, formFieldErrorProps } from "@/components/form-field-error";
import { ModuleHeader, modulePrimaryActionClass } from "@/components/module-header";
import { modalActionGroupClass } from "@/components/modal-action-group";

import {
  createSpecialtyAction,
  setSpecialtyActiveAction,
  updateSpecialtyAction,
} from "../actions/specialty-actions";
import type { SpecialtyActionState } from "../server/specialty-actions";
import type { SpecialtyListItem } from "../server/specialties";

type Selection = { mode: "create" } | { mode: "edit" | "state"; specialty: SpecialtyListItem };

const specialtyFieldClass = (error?: string) =>
  `w-full rounded-md border-2 px-3 py-2 focus:outline-none ${error ? "border-red-700 focus:border-red-700" : "border-slate-300 focus:border-sky-700"}`;

export function SpecialtiesScreen({
  centerId,
  loadFailed,
  specialties,
}: {
  centerId: string;
  centerName: string;
  loadFailed: boolean;
  specialties: SpecialtyListItem[];
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<SpecialtyActionState | null>(null);
  const [nameClientError, setNameClientError] = useState<string | null>(null);
  const [discardRequested, setDiscardRequested] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);
  const wasDiscardRequested = useRef(false);
  const hadSelectionRef = useRef(false);
  const nameErrorId = useId();
  const descriptionErrorId = useId();

  useEffect(() => {
    if (!selection) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [selection]);

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
    if (isPending) dialogRef.current?.focus();
  }, [isPending]);

  function select(next: Selection | null, trigger?: HTMLButtonElement) {
    if (trigger) triggerRef.current = trigger;
    setSelection(next);
    setName(next?.mode === "edit" ? next.specialty.name : "");
    setDescription(next?.mode === "edit" ? (next.specialty.description ?? "") : "");
    setFeedback(null);
    setNameClientError(null);
    setDiscardRequested(false);
  }

  function changeName(value: string) {
    setName(value);
    if (nameClientError) setNameClientError(value.trim().length === 0 ? nameClientError : null);
    setFeedback((current) => {
      if (!current?.fieldErrors?.name) return current;
      const fieldErrors = { ...current.fieldErrors };
      delete fieldErrors.name;
      return Object.keys(fieldErrors).length > 0 ? { ...current, fieldErrors } : null;
    });
  }

  const hasUnsavedChanges =
    selection?.mode === "create"
      ? name !== "" || description !== ""
      : selection?.mode === "edit"
        ? name !== selection.specialty.name ||
          description !== (selection.specialty.description ?? "")
        : false;

  function requestClose() {
    if (isPending || submittingRef.current) return;
    if (hasUnsavedChanges) setDiscardRequested(true);
    else select(null);
  }

  function keepTabInDialog(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled])",
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || isPending || submittingRef.current) return;
    if (selection.mode !== "state" && name.trim().length === 0) {
      setNameClientError("Ingresá el nombre de la especialidad.");
      nameInputRef.current?.focus();
      return;
    }
    submittingRef.current = true;
    const formData = new FormData();
    formData.set("centerId", centerId);
    if (selection.mode !== "create") {
      formData.set("specialtyId", selection.specialty.id);
      formData.set("expectedUpdatedAt", selection.specialty.updated_at);
    }
    if (selection.mode === "state") {
      formData.set("isActive", String(!selection.specialty.is_active));
      formData.set("confirmed", "true");
    } else {
      formData.set("name", name);
      formData.set("description", description);
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const result =
          selection.mode === "create"
            ? await createSpecialtyAction(formData)
            : selection.mode === "edit"
              ? await updateSpecialtyAction(formData)
              : await setSpecialtyActiveAction(formData);
        setFeedback(result);
        if (result.status === "success" || result.status === "stale") {
          setSelection(null);
          setName("");
          setDescription("");
          router.refresh();
        }
      } catch {
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

  const fieldError = nameClientError ?? feedback?.fieldErrors?.name?.[0];
  const descriptionError = feedback?.fieldErrors?.description?.[0];

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <ModuleHeader
          centerId={centerId}
          title="Especialidades"
          description="Administrá las especialidades del centro"
          actions={
            !loadFailed && (
              <button
                type="button"
                disabled={isPending}
                onClick={(event) => select({ mode: "create" }, event.currentTarget)}
                className={modulePrimaryActionClass}
              >
                Nueva especialidad
              </button>
            )
          }
        />

        {loadFailed ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            No pudimos cargar las especialidades. Actualizá la página para reintentar.
          </p>
        ) : (
          <>
            {feedback && !selection && (
              <p
                role="alert"
                className={`rounded-lg border p-4 ${feedback.status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}
              >
                {feedback.message}
              </p>
            )}

            {selection && (
              <dialog
                ref={dialogRef}
                aria-label={discardRequested ? "Descartar cambios" : undefined}
                aria-labelledby={discardRequested ? undefined : "specialty-dialog-title"}
                aria-modal="true"
                className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50 ${discardRequested || selection.mode === "state" ? "max-w-[28rem]" : "max-w-lg"}`}
                onCancel={(event) => {
                  event.preventDefault();
                  if (isPending || submittingRef.current) return;
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
                  {discardRequested ? (
                    <div role="alert">
                      <h2 className="text-lg font-semibold text-slate-950">¿Descartar cambios?</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
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
                          onClick={() => select(null)}
                          type="button"
                        >
                          Descartar cambios
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex min-w-0 items-start justify-between gap-4">
                        <h2
                          className="min-w-0 break-words text-lg font-semibold text-slate-950"
                          id="specialty-dialog-title"
                        >
                          {selection.mode === "create"
                            ? "Nueva especialidad"
                            : selection.mode === "edit"
                              ? `Editar ${selection.specialty.name}`
                              : `${selection.specialty.is_active ? "Desactivar" : "Activar"} ${selection.specialty.name}`}
                        </h2>
                        <button
                          aria-label="Cerrar"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
                          disabled={isPending}
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
                      {selection.mode === "state" && (
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {selection.specialty.is_active
                            ? "La especialidad dejará de estar disponible operativamente. Las asociaciones existentes se conservan."
                            : "La especialidad volverá a estar disponible operativamente. Las asociaciones existentes se conservan."}
                        </p>
                      )}
                      <form onSubmit={submit} className="mt-5 space-y-4">
                        {feedback?.status === "error" && (
                          <p
                            role="alert"
                            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                          >
                            {feedback.message}
                          </p>
                        )}
                        {selection.mode !== "state" && (
                          <div className="space-y-4">
                            <label className="block space-y-1 text-sm font-medium text-slate-800">
                              <span>Nombre</span>
                              <input
                                ref={nameInputRef}
                                value={name}
                                onChange={(event) => changeName(event.target.value)}
                                onInvalid={(event) => {
                                  event.preventDefault();
                                  setNameClientError(
                                    event.currentTarget.validity.tooLong
                                      ? "El nombre debe tener como máximo 120 caracteres."
                                      : "Ingresá el nombre de la especialidad.",
                                  );
                                  event.currentTarget.focus();
                                }}
                                maxLength={120}
                                required
                                disabled={isPending}
                                {...formFieldErrorProps(fieldError, nameErrorId)}
                                className={specialtyFieldClass(fieldError)}
                              />
                              <FormFieldError id={nameErrorId} message={fieldError} />
                            </label>
                            <label className="block space-y-1 text-sm font-medium text-slate-800">
                              <span>Descripción (opcional)</span>
                              <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                disabled={isPending}
                                rows={3}
                                {...formFieldErrorProps(descriptionError, descriptionErrorId)}
                                className={specialtyFieldClass(descriptionError)}
                              />
                              <FormFieldError id={descriptionErrorId} message={descriptionError} />
                            </label>
                          </div>
                        )}
                        <div className={`${modalActionGroupClass} pt-2`}>
                          <button
                            disabled={isPending}
                            type="button"
                            onClick={requestClose}
                            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
                          >
                            Cancelar
                          </button>
                          <button
                            disabled={isPending}
                            type="submit"
                            className={`min-h-11 rounded-md px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${selection.mode === "state" && selection.specialty.is_active ? "bg-red-700 hover:bg-red-800 focus-visible:outline-red-700" : "bg-sky-700 hover:bg-sky-800 focus-visible:outline-sky-700"}`}
                          >
                            {isPending
                              ? "Guardando…"
                              : selection.mode === "state"
                                ? `Confirmar ${selection.specialty.is_active ? "desactivación" : "activación"}`
                                : "Guardar"}
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </dialog>
            )}

            <section
              className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
              aria-label="Listado de especialidades"
            >
              {specialties.length === 0 ? (
                <p className="p-6 text-slate-600">Todavía no hay especialidades en este centro.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Descripción</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specialties.map((specialty) => (
                      <tr key={specialty.id} className="border-t border-slate-200">
                        <td className="p-4 font-medium text-slate-900">{specialty.name}</td>
                        <td className="max-w-md p-4 text-slate-700">
                          {specialty.description ?? "Sin descripción"}
                        </td>
                        <td className="p-4">{specialty.is_active ? "Activa" : "Inactiva"}</td>
                        <td className="flex flex-wrap gap-2 p-4">
                          <button
                            disabled={isPending}
                            onClick={(event) =>
                              select({ mode: "edit", specialty }, event.currentTarget)
                            }
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sky-800 disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            disabled={isPending}
                            onClick={(event) =>
                              select({ mode: "state", specialty }, event.currentTarget)
                            }
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sky-800 disabled:opacity-50"
                          >
                            {specialty.is_active ? "Desactivar" : "Activar"}
                          </button>
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
