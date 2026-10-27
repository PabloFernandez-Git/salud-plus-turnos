"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { updateProfessionalSpecialtiesAction } from "../actions/professional-specialty-action";
import type { ProfessionalSpecialtyActionState } from "../server/professional-specialty-actions";
import type {
  ProfessionalListItem,
  ProfessionalSpecialtyAssociation,
  ProfessionalSpecialtyOption,
} from "../server/professionals";

export function ProfessionalSpecialtiesEditor({
  centerId,
  professional,
  specialties,
  associations,
  onResult,
  onSubmitStart,
  onDirtyChange,
  onPendingChange,
}: {
  centerId: string;
  professional: ProfessionalListItem;
  specialties: ProfessionalSpecialtyOption[];
  associations: ProfessionalSpecialtyAssociation[];
  onResult: (
    result: ProfessionalSpecialtyActionState,
    changes: { activateIds: string[]; deactivateIds: string[] },
  ) => void;
  onSubmitStart?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const current = new Set(associations.filter((row) => row.isActive).map((row) => row.specialtyId));
  const [selectedIds, setSelectedIds] = useState(() => new Set(current));
  const [removeRetainedIds, setRemoveRetainedIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const activeOptions = specialties.filter((specialty) => specialty.isActive);
  const retained = specialties.filter(
    (specialty) => current.has(specialty.id) && (!specialty.isActive || !professional.isActive),
  );
  const activateIds = professional.isActive
    ? activeOptions
        .filter((item) => selectedIds.has(item.id) && !current.has(item.id))
        .map((item) => item.id)
    : [];
  const deactivateIds = professional.isActive
    ? activeOptions
        .filter((item) => !selectedIds.has(item.id) && current.has(item.id))
        .map((item) => item.id)
    : [];
  deactivateIds.push(...removeRetainedIds);
  const hasChanges = activateIds.length > 0 || deactivateIds.length > 0;

  useEffect(() => onDirtyChange?.(hasChanges), [hasChanges, onDirtyChange]);
  useEffect(() => onPendingChange?.(isPending), [isPending, onPendingChange]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !hasChanges) return;
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("professionalCenterId", professional.id);
    form.set("expectedUpdatedAt", professional.updatedAt);
    for (const id of activateIds) form.append("activateSpecialtyIds", id);
    for (const id of deactivateIds) form.append("deactivateSpecialtyIds", id);
    onSubmitStart?.();
    startTransition(async () => {
      try {
        onResult(await updateProfessionalSpecialtiesAction(form), { activateIds, deactivateIds });
      } catch {
        onResult(
          {
            status: "stale",
            message: "No pudimos confirmar el guardado. Revisá el listado actualizado.",
          },
          { activateIds, deactivateIds },
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-slate-200 pt-5">
      <h3 className="text-lg font-semibold text-slate-950">Especialidades</h3>
      {!professional.isActive && (
        <p className="text-sm text-amber-800">
          Este profesional está inactivo en el centro. Podés desasociar especialidades retenidas;
          reactivá el vínculo para agregar nuevas.
        </p>
      )}
      {professional.isActive && (
        <fieldset disabled={isPending} className="space-y-2">
          <legend className="font-medium text-slate-800">Especialidades activas del centro</legend>
          {activeOptions.length === 0 ? (
            <p className="text-sm text-slate-600">No hay especialidades activas disponibles.</p>
          ) : (
            activeOptions.map((specialty) => (
              <label key={specialty.id} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={selectedIds.has(specialty.id)}
                  onChange={(event) => {
                    const next = new Set(selectedIds);
                    if (event.target.checked) next.add(specialty.id);
                    else next.delete(specialty.id);
                    setSelectedIds(next);
                  }}
                />
                {specialty.name}
              </label>
            ))
          )}
        </fieldset>
      )}
      {retained.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-slate-800">Asociaciones retenidas, no operativas</p>
          <ul className="space-y-2">
            {retained.map((specialty) => (
              <li key={specialty.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  {specialty.name} — {specialty.isActive ? "Profesional inactivo" : "Inactiva"}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const next = new Set(removeRetainedIds);
                    if (next.has(specialty.id)) next.delete(specialty.id);
                    else next.add(specialty.id);
                    setRemoveRetainedIds(next);
                  }}
                  className="rounded-md border border-slate-300 px-2 py-1 text-slate-800 disabled:opacity-50"
                >
                  {removeRetainedIds.has(specialty.id) ? "Conservar asociación" : "Desasociar"}
                </button>
                {removeRetainedIds.has(specialty.id) && <span>Se quitará al guardar.</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="submit"
        disabled={isPending || !hasChanges}
        className="min-h-11 rounded-md bg-sky-700 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50"
      >
        {isPending ? "Guardando…" : "Guardar especialidades"}
      </button>
    </form>
  );
}
