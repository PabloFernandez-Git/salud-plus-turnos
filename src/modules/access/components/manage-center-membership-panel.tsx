"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();

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

  function reset() {
    setRole(user.role);
    setIsActive(user.isActive);
    setProfessionalCenterId(user.professional?.id ?? "");
    setClientError(undefined);
    setResult(undefined);
    setIsConfirming(false);
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

    setIsConfirming(false);
    startTransition(async () => {
      try {
        const state = await updateCenterMembershipAction(formData);
        setResult(state);
        if (state.status !== "success") return;
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
    <div className="min-w-44 space-y-3">
      <button
        className="min-h-10 rounded-md border border-sky-300 px-3 py-2 font-semibold text-sky-800 hover:bg-sky-50"
        onClick={() => {
          if (isOpen) reset();
          setIsOpen((current) => !current);
        }}
        type="button"
      >
        {isOpen ? "Cerrar" : "Administrar"}
      </button>

      {isOpen ? (
        <div className="w-[min(32rem,80vw)] space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <h3 className="font-semibold text-slate-950">Administrar acceso</h3>
            <p className="mt-1 text-sm text-slate-700">{userName}</p>
            <p className="text-sm text-slate-600">{user.email}</p>
          </div>

          <form className="space-y-4" onSubmit={review}>
            <label className="block space-y-1 text-sm font-medium text-slate-800">
              <span>Rol en este centro</span>
              <select
                className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                disabled={isPending}
                onChange={(event) => handleRoleChange(event.target.value as Role)}
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
                No hay otro ProfessionalCenter activo y libre. El vínculo actual sólo puede
                conservarse si sigue siendo válido; una desactivación pura continúa permitida.
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

            <button
              className="min-h-11 rounded-md bg-sky-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              Revisar cambios
            </button>
          </form>

          {isConfirming ? (
            <div
              aria-modal="true"
              className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"
              role="dialog"
            >
              <h4 className="font-semibold text-slate-950">Confirmar cambio de acceso</h4>
              <p className="text-sm text-slate-800">
                Vas a {confirmationParts.join(" y ")} para {userName}.
              </p>
              {role !== user.role ? (
                <p className="text-sm font-medium text-slate-900">Nuevo rol: {roleLabels[role]}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-10 rounded-md bg-amber-700 px-3 py-2 font-semibold text-white disabled:opacity-60"
                  disabled={isPending}
                  onClick={confirm}
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
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
