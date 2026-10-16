"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import {
  createSpecialtyAction,
  setSpecialtyActiveAction,
  updateSpecialtyAction,
} from "../actions/specialty-actions";
import type { SpecialtyActionState } from "../server/specialty-actions";
import type { SpecialtyListItem } from "../server/specialties";

type Selection = { mode: "create" } | { mode: "edit" | "state"; specialty: SpecialtyListItem };

export function SpecialtiesScreen({
  centerId,
  centerName,
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
  const [isPending, startTransition] = useTransition();

  function select(next: Selection | null) {
    setSelection(next);
    setName(next?.mode === "edit" ? next.specialty.name : "");
    setDescription(next?.mode === "edit" ? (next.specialty.description ?? "") : "");
    setFeedback(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || isPending) return;
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
      }
    });
  }

  const fieldError = feedback?.fieldErrors?.name?.[0];
  const descriptionError = feedback?.fieldErrors?.description?.[0];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-sky-700">Administración del centro</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Especialidades</h1>
              <p className="mt-1 text-slate-700">{centerName}</p>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
                Consultá y administrá las especialidades de este centro, y definí cuáles están
                disponibles para asociar a sus profesionales.
              </p>
            </div>
            <Link
              className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-800"
              href={`/centers/${centerId}`}
            >
              Volver al centro
            </Link>
          </div>
        </header>

        {loadFailed ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            No pudimos cargar las especialidades. Actualizá la página para reintentar.
          </p>
        ) : (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={() => select({ mode: "create" })}
                className="rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Nueva especialidad
              </button>
            </div>

            {feedback && (
              <p
                role="alert"
                className={`rounded-lg border p-4 ${feedback.status === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}
              >
                {feedback.message}
              </p>
            )}

            {selection && (
              <section
                className="rounded-xl border border-slate-200 bg-white p-5"
                aria-label={
                  selection.mode === "create"
                    ? "Nueva especialidad"
                    : selection.mode === "edit"
                      ? "Editar especialidad"
                      : "Cambiar estado de especialidad"
                }
              >
                <h2 className="text-xl font-semibold text-slate-950">
                  {selection.mode === "create"
                    ? "Nueva especialidad"
                    : selection.mode === "edit"
                      ? `Editar ${selection.specialty.name}`
                      : `${selection.specialty.is_active ? "Desactivar" : "Activar"} ${selection.specialty.name}`}
                </h2>
                {selection.mode === "state" && (
                  <p className="mt-2 text-sm text-slate-700">
                    {selection.specialty.is_active
                      ? "La especialidad dejará de estar disponible operativamente. Las asociaciones existentes se conservan."
                      : "La especialidad volverá a estar disponible operativamente. Las asociaciones existentes se conservan."}
                  </p>
                )}
                <form onSubmit={submit} className="mt-4 space-y-4">
                  {selection.mode !== "state" && (
                    <div className="max-w-lg space-y-4">
                      <label className="block space-y-1 text-sm font-medium text-slate-800">
                        <span>Nombre</span>
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          maxLength={120}
                          required
                          disabled={isPending}
                          className="w-full rounded-md border border-slate-300 px-3 py-2"
                        />
                        {fieldError && <span className="text-red-700">{fieldError}</span>}
                      </label>
                      <label className="block space-y-1 text-sm font-medium text-slate-800">
                        <span>Descripción (opcional)</span>
                        <textarea
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          disabled={isPending}
                          rows={3}
                          className="w-full rounded-md border border-slate-300 px-3 py-2"
                        />
                        {descriptionError && (
                          <span className="text-red-700">{descriptionError}</span>
                        )}
                      </label>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      disabled={isPending}
                      type="submit"
                      className="rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    >
                      {isPending
                        ? "Guardando…"
                        : selection.mode === "state"
                          ? `Confirmar ${selection.specialty.is_active ? "desactivación" : "activación"}`
                          : "Guardar"}
                    </button>
                    <button
                      disabled={isPending}
                      type="button"
                      onClick={() => select(null)}
                      className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-800 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </section>
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
                            onClick={() => select({ mode: "edit", specialty })}
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sky-800 disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            disabled={isPending}
                            onClick={() => select({ mode: "state", specialty })}
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
