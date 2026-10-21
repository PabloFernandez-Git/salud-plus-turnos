"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { modalActionGroupClass } from "@/components/modal-action-group";

import { updateCenterMembershipAction } from "../actions/center-user-actions";
import type { CenterMembershipActionState } from "../domain/center-user-action-state";
import type { CenterUserListItem, ManageableProfessionalCenter } from "../server/center-users";

const roleLabels = {
  ADMIN: "Administrador",
  RECEPTION: "Recepción",
  PROFESSIONAL: "Profesional",
} as const;

type Role = keyof typeof roleLabels;

function professionalLabel(professional: ManageableProfessionalCenter) {
  return `${professional.lastName}, ${professional.firstName}${
    professional.licenseNumber ? ` · ${professional.licenseNumber}` : ""
  }`;
}

export function ManageCenterMembershipPanel({
  activeAdminCount,
  centerId,
  professionalCenters,
  user,
}: {
  activeAdminCount: number;
  centerId: string;
  professionalCenters: ManageableProfessionalCenter[];
  user: CenterUserListItem;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [professionalCenterId, setProfessionalCenterId] = useState(user.professional?.id ?? "");
  const [clientError, setClientError] = useState<string>();
  const [result, setResult] = useState<CenterMembershipActionState>();
  const [discardRequested, setDiscardRequested] = useState(false);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const roleSelectRef = useRef<HTMLSelectElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const wasDiscardRequested = useRef(false);
  const wasConfirming = useRef(false);
  const dialogTitleId = useId();
  const confirmationTitleId = useId();
  const formId = useId();

  const eligibleProfessionalCenters = useMemo(
    () =>
      professionalCenters.filter(
        (professional) =>
          professional.occupiedMembershipId === null ||
          professional.occupiedMembershipId === user.id,
      ),
    [professionalCenters, user.id],
  );
  const currentProfessionalIsEligible = Boolean(
    user.professional &&
    eligibleProfessionalCenters.some((professional) => professional.id === user.professional?.id),
  );
  const hasProfessionalChoice =
    eligibleProfessionalCenters.length > 0 || user.role === "PROFESSIONAL";
  const userName = `${user.firstName} ${user.lastName}`;
  const isDirty =
    role !== user.role ||
    isActive !== user.isActive ||
    (professionalCenterId || null) !== (user.professional?.id ?? null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    const dialog = dialogRef.current;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    closeButtonRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (discardRequested) continueEditingRef.current?.focus();
    else if (wasDiscardRequested.current) roleSelectRef.current?.focus();
    else if (isConfirming) confirmButtonRef.current?.focus();
    else if (wasConfirming.current && !isPending) roleSelectRef.current?.focus();
    wasDiscardRequested.current = discardRequested;
    wasConfirming.current = isConfirming;
  }, [discardRequested, isConfirming, isPending]);

  useEffect(() => {
    if (isOpen && isPending) dialogRef.current?.focus();
  }, [isOpen, isPending]);

  function reset() {
    setRole(user.role);
    setIsActive(user.isActive);
    setProfessionalCenterId(user.professional?.id ?? "");
    setClientError(undefined);
    setResult(undefined);
    setIsConfirming(false);
    setDiscardRequested(false);
  }

  function closeModal(force = false) {
    if (isPending && !force) return;
    setIsOpen(false);
    reset();
  }

  function requestClose() {
    if (isPending) return;
    if (isDirty) {
      setDiscardRequested(true);
      return;
    }
    closeModal();
  }

  function keepTabInDialog(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      ) ?? [],
    );
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

  function handleRoleChange(nextRole: Role) {
    setRole(nextRole);
    setClientError(undefined);
    setIsConfirming(false);
    if (nextRole !== "PROFESSIONAL") {
      setProfessionalCenterId("");
      return;
    }
    if (user.role === "PROFESSIONAL" && user.professional) {
      setProfessionalCenterId(user.professional.id);
      return;
    }
    setProfessionalCenterId(eligibleProfessionalCenters[0]?.id ?? "");
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(undefined);

    if (role === "PROFESSIONAL" && !professionalCenterId) {
      setClientError(
        "No hay un ProfessionalCenter activo y disponible para asignar en este centro.",
      );
      return;
    }
    if (
      role === "PROFESSIONAL" &&
      isActive &&
      user.professional?.id === professionalCenterId &&
      !currentProfessionalIsEligible
    ) {
      setClientError(
        user.professional?.isActive
          ? "El vínculo profesional actual ya está ocupado por otra membership activa. Elegí otro vínculo disponible."
          : "El vínculo profesional actual está inactivo. Podés desactivar este acceso o elegir otro vínculo activo.",
      );
      return;
    }
    if (
      user.role === "ADMIN" &&
      user.isActive &&
      activeAdminCount === 1 &&
      (!isActive || role !== "ADMIN")
    ) {
      setClientError(
        "Este es el único Administrador activo. Prepará otro Administrador antes de quitarle ese acceso.",
      );
      return;
    }
    if (
      role === user.role &&
      isActive === user.isActive &&
      (professionalCenterId || null) === (user.professional?.id ?? null)
    ) {
      setClientError("No hay cambios para guardar.");
      return;
    }

    setClientError(undefined);
    setIsConfirming(true);
  }

  function confirm() {
    const formData = new FormData();
    formData.set("centerId", centerId);
    formData.set("membershipId", user.id);
    formData.set("expectedRole", user.role);
    formData.set("expectedProfessionalCenterId", user.professional?.id ?? "");
    formData.set("expectedIsActive", String(user.isActive));
    formData.set("role", role);
    formData.set("professionalCenterId", role === "PROFESSIONAL" ? professionalCenterId : "");
    formData.set("isActive", String(isActive));

    dialogRef.current?.focus();
    setIsConfirming(false);
    startTransition(async () => {
      try {
        const state = await updateCenterMembershipAction(formData);
        setResult(state);
        if (state.status !== "success") return;
        closeModal(true);
        if (state.navigation) {
          router.replace(state.navigation);
          return;
        }
        router.refresh();
      } catch {
        setResult({
          status: "error",
          message:
            "No pudimos confirmar el resultado. Actualizá la página para revisar el estado persistido antes de reintentar.",
        });
        router.refresh();
      }
    });
  }

  const confirmationParts = [
    role !== user.role ? `cambiar el rol a ${roleLabels[role]}` : null,
    isActive !== user.isActive ? (isActive ? "reactivar el acceso" : "desactivar el acceso") : null,
    role === "PROFESSIONAL" && professionalCenterId !== (user.professional?.id ?? "")
      ? "cambiar el profesional asociado"
      : null,
  ].filter(Boolean);
  const serverValidationError = result?.fieldErrors
    ? Object.values(result.fieldErrors).flat()[0]
    : undefined;

  return (
    <div className="min-w-44">
      <button
        className="min-h-10 rounded-md border border-sky-300 px-3 py-2 font-semibold text-sky-800 hover:bg-sky-50"
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Administrar acceso
      </button>

      {isOpen
        ? createPortal(
            <dialog
              aria-label={discardRequested ? "Descartar cambios" : undefined}
              aria-labelledby={discardRequested ? undefined : dialogTitleId}
              aria-modal="true"
              className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/50"
              onCancel={(event) => {
                event.preventDefault();
                if (discardRequested) setDiscardRequested(false);
                else requestClose();
              }}
              onClick={(event) => {
                if (event.target !== event.currentTarget) return;
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
              ref={dialogRef}
              tabIndex={-1}
            >
              <div className="p-5 sm:p-6">
                {discardRequested ? (
                  <div className="space-y-4" role="alert">
                    <h3 className="text-lg font-semibold text-slate-950">Descartar cambios</h3>
                    <p className="text-sm text-slate-700">
                      Hay cambios sin guardar en el acceso de {userName}. ¿Querés descartarlos?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="min-h-10 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
                        onClick={() => setDiscardRequested(false)}
                        ref={continueEditingRef}
                        type="button"
                      >
                        Seguir editando
                      </button>
                      <button
                        className="min-h-10 rounded-md bg-red-700 px-4 py-2 font-semibold text-white"
                        onClick={() => closeModal()}
                        type="button"
                      >
                        Descartar cambios
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex min-w-0 items-start justify-between gap-4 pb-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-950" id={dialogTitleId}>
                          Administrar acceso
                        </h3>
                        <p className="mt-1 break-words text-sm text-slate-700">{userName}</p>
                        <p className="break-all text-sm text-slate-600">{user.email}</p>
                      </div>
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

                    <form className="space-y-4" id={formId} onSubmit={review}>
                      <label className="block space-y-1 text-sm font-medium text-slate-800">
                        <span>Rol en este centro</span>
                        <select
                          className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                          disabled={isPending}
                          onChange={(event) => handleRoleChange(event.target.value as Role)}
                          ref={roleSelectRef}
                          value={role}
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="RECEPTION">Recepción</option>
                          <option disabled={!hasProfessionalChoice} value="PROFESSIONAL">
                            Profesional{!hasProfessionalChoice ? " (sin vínculo disponible)" : ""}
                          </option>
                        </select>
                      </label>

                      {role === "PROFESSIONAL" ? (
                        <label className="block space-y-1 text-sm font-medium text-slate-800">
                          <span>Profesional asociado</span>
                          <select
                            className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                            disabled={isPending}
                            onChange={(event) => {
                              setProfessionalCenterId(event.target.value);
                              setClientError(undefined);
                              setIsConfirming(false);
                            }}
                            value={professionalCenterId}
                          >
                            {user.professional && !currentProfessionalIsEligible ? (
                              <option value={user.professional.id}>
                                {user.professional.lastName}, {user.professional.firstName} (
                                {user.professional.isActive ? "no disponible" : "vínculo inactivo"})
                              </option>
                            ) : null}
                            {eligibleProfessionalCenters.map((professional) => (
                              <option key={professional.id} value={professional.id}>
                                {professionalLabel(professional)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <label className="block space-y-1 text-sm font-medium text-slate-800">
                        <span>Estado del acceso</span>
                        <select
                          className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                          disabled={isPending}
                          onChange={(event) => {
                            setIsActive(event.target.value === "active");
                            setClientError(undefined);
                            setIsConfirming(false);
                          }}
                          value={isActive ? "active" : "inactive"}
                        >
                          <option value="active">Activo</option>
                          <option value="inactive">Inactivo</option>
                        </select>
                      </label>

                      {role === "PROFESSIONAL" && eligibleProfessionalCenters.length === 0 ? (
                        <p className="text-sm text-amber-800">
                          No hay otro ProfessionalCenter activo y libre. El vínculo actual sólo
                          puede conservarse si sigue siendo válido; una desactivación pura continúa
                          permitida.
                        </p>
                      ) : null}

                      {clientError ? (
                        <p className="text-sm font-medium text-red-700" role="alert">
                          {clientError}
                        </p>
                      ) : null}
                      {result?.message || serverValidationError ? (
                        <p
                          className={`text-sm font-medium ${
                            result?.status === "success" ? "text-emerald-700" : "text-red-700"
                          }`}
                          role={result?.status === "success" ? "status" : "alert"}
                        >
                          {result?.message ?? serverValidationError}
                        </p>
                      ) : null}
                    </form>

                    {isConfirming ? (
                      <div
                        aria-labelledby={confirmationTitleId}
                        className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"
                        role="group"
                      >
                        <h4 className="font-semibold text-slate-950" id={confirmationTitleId}>
                          Confirmar cambio de acceso
                        </h4>
                        <p className="text-sm text-slate-800">
                          Vas a {confirmationParts.join(" y ")} para {userName}.
                        </p>
                        {role !== user.role ? (
                          <p className="text-sm font-medium text-slate-900">
                            Nuevo rol: {roleLabels[role]}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="min-h-10 rounded-md bg-amber-700 px-3 py-2 font-semibold text-white disabled:opacity-60"
                            disabled={isPending}
                            onClick={confirm}
                            ref={confirmButtonRef}
                            type="button"
                          >
                            Confirmar cambios
                          </button>
                          <button
                            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700"
                            disabled={isPending}
                            onClick={() => setIsConfirming(false)}
                            type="button"
                          >
                            Volver a editar
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className={`${modalActionGroupClass} pt-2`}>
                      <button
                        className="h-11 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-60"
                        disabled={isPending}
                        onClick={requestClose}
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        className="h-11 rounded-md bg-sky-700 px-4 font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isPending}
                        form={formId}
                        type="submit"
                      >
                        Revisar cambios
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </div>
  );
}
