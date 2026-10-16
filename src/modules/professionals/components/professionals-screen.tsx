"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import {
  createProfessionalAction,
  linkProfessionalAction,
  resolveProfessionalAction,
  setProfessionalCenterActiveAction,
  updateProfessionalCenterAction,
} from "../actions/professional-actions";
import type { ProfessionalActionState } from "../server/professional-actions";
import type { ProfessionalSpecialtyActionState } from "../server/professional-specialty-actions";
import type {
  ProfessionalListItem,
  ProfessionalSpecialtyAssociation,
  ProfessionalSpecialtyOption,
} from "../server/professionals";
import { ProfessionalSpecialtiesEditor } from "./professional-specialties-editor";

type Selection = { mode: "new" } | { mode: "edit" | "state"; professional: ProfessionalListItem };
type Resolution = NonNullable<ProfessionalActionState["resolution"]>;

export function ProfessionalsScreen({
  centerId,
  centerName,
  loadFailed,
  professionals,
  specialties = [],
  associations = [],
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
  const [licenseNumber, setLicenseNumber] = useState("");
  const [duration, setDuration] = useState("30");
  const [feedback, setFeedback] = useState<ProfessionalActionState | null>(null);
  const [specialtyRefreshBlock, setSpecialtyRefreshBlock] = useState<{
    professionalCenterId: string;
    snapshot: ProfessionalListItem[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function select(next: Selection | null) {
    setSelection(next);
    setResolution(null);
    setFeedback(null);
    setNationalityCode("");
    setDocumentNumber("");
    setLicenseNumber(next && next.mode !== "new" ? (next.professional.licenseNumber ?? "") : "");
    setDuration(
      next && next.mode !== "new"
        ? String(next.professional.usualAppointmentDurationMinutes)
        : "30",
    );
  }

  function run(
    action: (form: FormData) => Promise<ProfessionalActionState>,
    form: FormData,
    closeOnSuccess = true,
  ) {
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
        if ((result.status === "success" && closeOnSuccess) || result.status === "stale") {
          setSelection(null);
          setResolution(null);
          router.refresh();
        }
      } catch {
        setSelection(null);
        setResolution(null);
        setFeedback({
          status: "error",
          message:
            "No pudimos confirmar el resultado. Actualizá la página y revisá el estado antes de reintentar.",
        });
        router.refresh();
      }
    });
  }

  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("nationalityCode", nationalityCode);
    form.set("documentNumber", documentNumber);
    setResolution(null);
    run(resolveProfessionalAction, form, false);
  }

  function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !resolution || !selection || selection.mode !== "new") return;
    const form = new FormData(event.currentTarget);
    form.set("centerId", centerId);
    form.set("nationalityCode", nationalityCode);
    form.set("documentNumber", documentNumber);
    if (resolution.resolution_status === "NOT_FOUND") {
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
    if (isPending || !selection || selection.mode === "new") return;
    const form = new FormData();
    form.set("centerId", centerId);
    form.set("professionalCenterId", selection.professional.id);
    form.set("expectedUpdatedAt", selection.professional.updatedAt);
    if (selection.mode === "edit") {
      form.set("licenseNumber", licenseNumber);
      form.set("usualAppointmentDurationMinutes", duration);
      run(updateProfessionalCenterAction, form);
    } else {
      form.set("isActive", String(!selection.professional.isActive));
      form.set("confirmed", "true");
      run(setProfessionalCenterActiveAction, form);
    }
  }

  function specialtyResult(professionalCenterId: string, result: ProfessionalSpecialtyActionState) {
    setFeedback(result);
    if (result.status === "success" || result.status === "stale") {
      // Discard the rendered aggregate token; the refreshed page supplies the authoritative one.
      setSpecialtyRefreshBlock({ professionalCenterId, snapshot: professionals });
      setSelection(null);
      setResolution(null);
      router.refresh();
    }
  }

  const fieldError = (field: string) => feedback?.fieldErrors?.[field]?.[0];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-sky-700">Administración del centro</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Profesionales</h1>
              <p className="mt-1 text-slate-700">{centerName}</p>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
                Consultá y administrá los profesionales vinculados a este centro, sus datos y las
                especialidades asociadas.
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
            No pudimos cargar los profesionales. Actualizá la página para reintentar.
          </p>
        ) : (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={() => select({ mode: "new" })}
                className="rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Nuevo profesional
              </button>
            </div>
            {feedback && (
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
              <section
                aria-label="Administrar profesional"
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <h2 className="text-xl font-semibold text-slate-950">
                  {selection.mode === "new"
                    ? "Nuevo profesional"
                    : selection.mode === "edit"
                      ? `Configurar ${selection.professional.firstName} ${selection.professional.lastName}`
                      : `${selection.professional.isActive ? "Desactivar" : "Activar"} ${selection.professional.firstName} ${selection.professional.lastName}`}
                </h2>
                {selection.mode === "new" ? (
                  <>
                    <form onSubmit={resolve} className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="block space-y-1 text-sm font-medium">
                        Nacionalidad (ISO alpha-2)
                        <input
                          className="block w-36 rounded-md border border-slate-300 px-3 py-2 uppercase"
                          maxLength={2}
                          required
                          value={nationalityCode}
                          onChange={(event) => {
                            setNationalityCode(event.target.value);
                            setResolution(null);
                          }}
                          disabled={isPending}
                        />
                      </label>
                      <label className="block space-y-1 text-sm font-medium">
                        Documento
                        <input
                          className="block rounded-md border border-slate-300 px-3 py-2"
                          required
                          value={documentNumber}
                          onChange={(event) => {
                            setDocumentNumber(event.target.value);
                            setResolution(null);
                          }}
                          disabled={isPending}
                        />
                      </label>
                      <button
                        className="rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                        disabled={isPending}
                        type="submit"
                      >
                        {isPending ? "Buscando…" : "Resolver identidad"}
                      </button>
                    </form>
                    {resolution?.resolution_status === "NOT_FOUND" && (
                      <form onSubmit={submitNew} className="mt-5 space-y-3">
                        <p>No existe un profesional con ese documento. Completá el alta.</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-sm font-medium">
                            Nombre
                            <input
                              name="firstName"
                              required
                              className="block w-full rounded-md border px-3 py-2"
                            />
                            {fieldError("firstName")}
                          </label>
                          <label className="text-sm font-medium">
                            Apellido
                            <input
                              name="lastName"
                              required
                              className="block w-full rounded-md border px-3 py-2"
                            />
                            {fieldError("lastName")}
                          </label>
                          <label className="text-sm font-medium">
                            Email
                            <input
                              name="email"
                              type="email"
                              required
                              className="block w-full rounded-md border px-3 py-2"
                            />
                            {fieldError("email")}
                          </label>
                          <label className="text-sm font-medium">
                            Teléfono (opcional)
                            <input
                              name="phone"
                              className="block w-full rounded-md border px-3 py-2"
                            />
                          </label>
                          <label className="text-sm font-medium">
                            Matrícula (opcional)
                            <input
                              name="licenseNumber"
                              className="block w-full rounded-md border px-3 py-2"
                            />
                          </label>
                          <label className="text-sm font-medium">
                            Duración habitual (minutos)
                            <input
                              name="usualAppointmentDurationMinutes"
                              type="number"
                              min="5"
                              max="480"
                              step="5"
                              defaultValue="30"
                              required
                              className="block w-full rounded-md border px-3 py-2"
                            />
                            {fieldError("usualAppointmentDurationMinutes")}
                          </label>
                        </div>
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                        >
                          {isPending ? "Guardando…" : "Crear y vincular al centro"}
                        </button>
                      </form>
                    )}
                    {resolution && resolution.resolution_status !== "NOT_FOUND" && (
                      <form onSubmit={submitNew} className="mt-5 space-y-3">
                        <p className="font-medium">
                          {resolution.first_name} {resolution.last_name}
                        </p>
                        <p>
                          {resolution.resolution_status === "NOT_LINKED"
                            ? "Este profesional aún no está vinculado al centro."
                            : resolution.resolution_status === "LINKED_INACTIVE"
                              ? "Su vínculo con este centro está inactivo. La reactivación conserva su configuración."
                              : "Este profesional ya pertenece al centro y está activo."}
                        </p>
                        {resolution.resolution_status !== "LINKED_ACTIVE" && (
                          <button
                            type="submit"
                            disabled={isPending}
                            className="rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                          >
                            {isPending
                              ? "Guardando…"
                              : resolution.resolution_status === "NOT_LINKED"
                                ? "Vincular profesional al centro"
                                : "Confirmar reactivación"}
                          </button>
                        )}
                      </form>
                    )}
                  </>
                ) : (
                  <form onSubmit={submitCenter} className="mt-4 space-y-4">
                    {selection.mode === "edit" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-medium">
                          Matrícula (opcional)
                          <input
                            value={licenseNumber}
                            onChange={(event) => setLicenseNumber(event.target.value)}
                            className="block w-full rounded-md border px-3 py-2"
                            disabled={isPending}
                          />
                          {fieldError("licenseNumber")}
                        </label>
                        <label className="text-sm font-medium">
                          Duración habitual (minutos)
                          <input
                            value={duration}
                            onChange={(event) => setDuration(event.target.value)}
                            type="number"
                            min="5"
                            max="480"
                            step="5"
                            required
                            className="block w-full rounded-md border px-3 py-2"
                            disabled={isPending}
                          />
                          {fieldError("usualAppointmentDurationMinutes")}
                        </label>
                      </div>
                    ) : (
                      <p>
                        {selection.professional.isActive
                          ? "Confirmá la desactivación. La configuración y las asociaciones existentes se conservan."
                          : "Confirmá la activación. La configuración y las asociaciones existentes se conservan."}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-md bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    >
                      {isPending
                        ? "Guardando…"
                        : selection.mode === "edit"
                          ? "Guardar configuración"
                          : `Confirmar ${selection.professional.isActive ? "desactivación" : "activación"}`}
                    </button>
                  </form>
                )}
                {selection.mode === "edit" && (
                  <ProfessionalSpecialtiesEditor
                    key={`${selection.professional.id}:${selection.professional.updatedAt}`}
                    centerId={centerId}
                    professional={selection.professional}
                    specialties={specialties}
                    associations={associations.filter(
                      (row) => row.professionalCenterId === selection.professional.id,
                    )}
                    onResult={(result) => specialtyResult(selection.professional.id, result)}
                  />
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => select(null)}
                  className="mt-3 rounded-md border border-slate-300 px-4 py-2"
                >
                  Cancelar
                </button>
              </section>
            )}
            <section
              aria-label="Listado de profesionales"
              className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
            >
              {professionals.length === 0 ? (
                <p className="p-6 text-slate-600">
                  Todavía no hay profesionales vinculados a este centro.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-4">Profesional</th>
                      <th className="p-4">Matrícula</th>
                      <th className="p-4">Duración habitual</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {professionals.map((professional) => (
                      <tr key={professional.id} className="border-t border-slate-200">
                        <td className="p-4 font-medium">
                          {professional.firstName} {professional.lastName}
                        </td>
                        <td className="p-4">{professional.licenseNumber ?? "—"}</td>
                        <td className="p-4">{professional.usualAppointmentDurationMinutes} min</td>
                        <td className="p-4">{professional.isActive ? "Activo" : "Inactivo"}</td>
                        <td className="flex flex-wrap gap-2 p-4">
                          <button
                            type="button"
                            disabled={
                              isPending ||
                              (specialtyRefreshBlock?.professionalCenterId === professional.id &&
                                specialtyRefreshBlock.snapshot === professionals)
                            }
                            onClick={() => select({ mode: "edit", professional })}
                            className="rounded-md border px-3 py-2 text-sky-800 disabled:opacity-50"
                          >
                            Configurar
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => select({ mode: "state", professional })}
                            className="rounded-md border px-3 py-2 text-sky-800 disabled:opacity-50"
                          >
                            {professional.isActive ? "Desactivar" : "Activar"}
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
