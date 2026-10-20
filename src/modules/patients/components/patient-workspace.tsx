"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
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
const emptyIdentity: Identity = {
  firstName: "",
  lastName: "",
  nationalityCode: "AR",
  documentNumber: "",
  birthDate: "",
};
const emptyDetails: Details = { phone: "", email: "", insuranceName: "", administrativeNotes: "" };

function PatientDialog({
  children,
  onClose,
  canClose,
  closeOnBackdrop = false,
  iconClose = false,
  title,
  description,
}: {
  children: React.ReactNode;
  onClose: () => void;
  canClose?: () => boolean;
  closeOnBackdrop?: boolean;
  iconClose?: boolean;
  title: string;
  description: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("h2")?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      aria-describedby="patient-dialog-description"
      onClose={onClose}
      onCancel={(event) => {
        if (canClose && !canClose()) event.preventDefault();
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
        if (!canClose || canClose()) event.currentTarget.close();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-screen max-w-none overflow-y-auto border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/50 md:w-[min(100%,38rem)]"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-bold text-slate-950" tabIndex={-1}>
            {title}
          </h2>
          <p id="patient-dialog-description" className="text-sm text-slate-600">
            {description}
          </p>
        </div>
        <button
          type="button"
          aria-label={iconClose ? "Cerrar" : undefined}
          onClick={() => {
            if (!canClose || canClose()) ref.current?.close();
          }}
          className={
            iconClose
              ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
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
      <div className="space-y-5 p-4 pb-8 sm:p-6">{children}</div>
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
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const id = `patient-${name}`;
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
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-28 w-full rounded border border-slate-300 p-3"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-11 w-full rounded border border-slate-300 px-3"
        />
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-rose-700">
          {error}
        </p>
      )}
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
  filters,
  onClose,
  returnToAppointments,
}: {
  centerId: string;
  filters: PatientFilters;
  onClose: () => void;
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
  const [pending, startTransition] = useTransition();
  const errors = feedback?.status === "error" ? feedback.fields : undefined;
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
      router.push(
        patientRegistrationDestination(
          centerId,
          data.patient_center_id,
          filters,
          returnToAppointments,
        ),
      );
      router.refresh();
    }
  }
  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
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
        const result = await resolvePatientAction({ centerId, ...snapshot });
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
    const common = {
      centerId,
      nationalityCode: identity.nationalityCode,
      documentNumber: identity.documentNumber,
      birthDate: identity.birthDate,
    };
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
          firstName: identity.firstName,
          lastName: identity.lastName,
          ...details,
        });
      } else if (resolution.relationship_state === "NOT_LINKED") {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        result = await linkPatientAction({
          ...common,
          personId: resolution.person_id,
          ...details,
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
  return (
    <PatientDialog
      title="Registrar paciente"
      description="Comprobá la identidad antes de crear o vincular un registro en este centro."
      onClose={onClose}
      closeOnBackdrop
      iconClose
      canClose={() =>
        (!identity.documentNumber &&
          !identity.birthDate &&
          !identity.firstName &&
          !identity.lastName &&
          !details.phone) ||
        window.confirm("Hay datos sin guardar. ¿Querés salir del registro?")
      }
    >
      <form className="space-y-4" onSubmit={resolve}>
        <h3 className="font-semibold">1. Identidad</h3>
        <Field
          name="nationalityCode"
          label="Nacionalidad (código ISO de dos letras)"
          value={identity.nationalityCode}
          onChange={(v) => changeIdentity("nationalityCode", v)}
          error={errors?.nationalityCode}
          required
        />
        <Field
          name="documentNumber"
          label="Documento"
          value={identity.documentNumber}
          onChange={(v) => changeIdentity("documentNumber", v)}
          error={errors?.documentNumber}
          required
        />
        <Field
          name="birthDate"
          label="Fecha de nacimiento"
          type="date"
          value={identity.birthDate}
          onChange={(v) => changeIdentity("birthDate", v)}
          error={errors?.birthDate}
          required
        />
        <button
          disabled={pending}
          className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white disabled:opacity-50"
          type="submit"
        >
          Comprobar identidad
        </button>
      </form>
      <Feedback result={feedback} />
      {resolution?.identity_status === "FOUND" && !resolution.birth_date_matches && (
        <p role="alert" className="rounded bg-amber-50 p-3">
          Los datos ingresados no coinciden con la identidad registrada.
        </p>
      )}
      {resolution && (resolution.identity_status === "NOT_FOUND" || matched) && (
        <form className="space-y-4 border-t pt-4" onSubmit={submit}>
          <h3 className="font-semibold">
            2.{" "}
            {resolution.identity_status === "NOT_FOUND" ? "Datos del nuevo paciente" : "Resultado"}
          </h3>
          {resolution.identity_status === "NOT_FOUND" ? (
            <>
              <Field
                name="firstName"
                label="Nombre"
                value={identity.firstName}
                onChange={(v) => changeIdentity("firstName", v)}
                error={errors?.firstName}
                required
              />
              <Field
                name="lastName"
                label="Apellido"
                value={identity.lastName}
                onChange={(v) => changeIdentity("lastName", v)}
                error={errors?.lastName}
                required
              />
            </>
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
            <>
              <Field
                name="phone"
                label="Teléfono"
                value={details.phone}
                onChange={(v) => changeDetails("phone", v)}
                error={errors?.phone}
                required
              />
              <Field
                name="email"
                label="Email (opcional)"
                type="email"
                value={details.email}
                onChange={(v) => changeDetails("email", v)}
                error={errors?.email}
              />
              <Field
                name="insuranceName"
                label="Obra social / prepaga (opcional)"
                value={details.insuranceName}
                onChange={(v) => changeDetails("insuranceName", v)}
                error={errors?.insuranceName}
              />
              <Field
                name="administrativeNotes"
                label="Notas administrativas (opcional)"
                value={details.administrativeNotes}
                onChange={(v) => changeDetails("administrativeNotes", v)}
                error={errors?.administrativeNotes}
                multiline
              />
              <p className="text-sm text-slate-600">
                Uso administrativo. No registrar información clínica.
              </p>
            </>
          )}
          {confirm && (
            <p role="alert" className="rounded bg-sky-50 p-3">
              {resolution.identity_status === "NOT_FOUND"
                ? "Confirmá la creación del paciente."
                : resolution.relationship_state === "NOT_LINKED"
                  ? "Confirmá el vínculo con este centro."
                  : "Confirmá la reactivación en este centro."}
            </p>
          )}
          <button
            disabled={pending}
            type="submit"
            className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white disabled:opacity-50"
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
        </form>
      )}
    </PatientDialog>
  );
}

function Administration({
  centerId,
  filters,
  detail,
  detailFailed,
  onClose,
  onNotice,
  returnToAppointments,
}: {
  centerId: string;
  filters: PatientFilters;
  detail: PatientDetail | null;
  detailFailed: boolean;
  onClose: () => void;
  onNotice: (message: string) => void;
  returnToAppointments: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<PatientActionResult | null>(null);
  const [stale, setStale] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [reactivationBirthDate, setReactivationBirthDate] = useState("");
  const [reactivation, setReactivation] = useState<PatientResolveRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Details>({
    phone: detail?.phone ?? "",
    email: detail?.email ?? "",
    insuranceName: detail?.insuranceName ?? "",
    administrativeNotes: detail?.administrativeNotes ?? "",
  });
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
    onNotice(
      deactivate
        ? outcome === "UNCHANGED"
          ? "El paciente ya estaba inactivo."
          : "Paciente desactivado."
        : outcome === "REACTIVATED"
          ? "Paciente reactivado. Se conservaron sus datos administrativos."
          : outcome === "UNCHANGED"
            ? "No había cambios para guardar."
            : "Datos administrativos guardados.",
    );
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
    if (!detail || pending || stale) return;
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
    >
      {detailFailed || !detail ? (
        <p role="alert">No pudimos abrir este registro. Volvé al listado y reintentá.</p>
      ) : (
        <>
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
          <form className="space-y-4 border-t pt-4" onSubmit={save}>
            <h3 className="font-semibold">Datos administrativos</h3>
            <Field
              name="phone"
              label="Teléfono"
              value={form.phone}
              onChange={(v) => change("phone", v)}
              error={errors?.phone}
              required
            />
            <Field
              name="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => change("email", v)}
              error={errors?.email}
            />
            <Field
              name="insuranceName"
              label="Obra social / prepaga"
              value={form.insuranceName}
              onChange={(v) => change("insuranceName", v)}
              error={errors?.insuranceName}
            />
            <Field
              name="administrativeNotes"
              label="Notas administrativas"
              value={form.administrativeNotes}
              onChange={(v) => change("administrativeNotes", v)}
              error={errors?.administrativeNotes}
              multiline
            />
            <p className="text-sm text-slate-600">
              Uso administrativo. No registrar información clínica.
            </p>
            <button
              disabled={pending || stale || !detail.isActive}
              type="submit"
              className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white disabled:opacity-50"
            >
              Guardar cambios
            </button>
          </form>
          {detail.isActive && (
            <div className="space-y-3 border-t pt-4">
              <button
                type="button"
                disabled={pending || stale}
                onClick={() => setConfirmDeactivate(true)}
                className="min-h-11 font-semibold text-rose-700 disabled:opacity-50"
              >
                Desactivar
              </button>
              {confirmDeactivate && (
                <div
                  role="group"
                  aria-label="Confirmar desactivación"
                  className="rounded border border-rose-300 p-4"
                >
                  <p>
                    ¿Desactivar a {detail.firstName} {detail.lastName}? Dejará de aparecer en el
                    filtro Activos. El registro no se elimina.
                  </p>
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
            <form className="space-y-3 border-t pt-4" onSubmit={verifyReactivation}>
              <h3 className="font-semibold">Reactivar en este centro</h3>
              <p className="text-sm text-slate-600">
                Ingresá la fecha de nacimiento para comprobar la identidad. La reactivación conserva
                teléfono, email, cobertura y notas.
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
          <a
            className="font-semibold text-sky-700 underline"
            href={patientSearchUrl(
              centerId,
              {
                query: detail.documentNumber,
                state: detail.isActive ? "ACTIVE" : "INACTIVE",
                page: 1,
              },
              undefined,
              returnToAppointments,
            )}
          >
            Ver en listado
          </a>
        </>
      )}
    </PatientDialog>
  );
}

export function PatientWorkspace({
  centerId,
  filters,
  detail,
  detailFailed,
  returnToAppointments = false,
}: {
  centerId: string;
  filters: PatientFilters;
  detail: PatientDetail | null;
  detailFailed: boolean;
  returnToAppointments?: boolean;
}) {
  const router = useRouter();
  const selected = detail || detailFailed;
  const [registerOpen, setRegisterOpen] = useState(returnToAppointments && !selected);
  const [notice, setNotice] = useState("");
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
          setNotice("");
          setRegisterOpen(true);
        }}
        className="min-h-11 rounded bg-sky-700 px-4 font-semibold text-white"
      >
        Registrar paciente
      </button>
      {notice && (
        <p
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}
      {registerOpen && (
        <Registration
          centerId={centerId}
          filters={filters}
          onClose={closeRegister}
          returnToAppointments={returnToAppointments}
        />
      )}
      {selected && (
        <Administration
          key={detail?.updatedAt ?? "failed"}
          centerId={centerId}
          filters={filters}
          detail={detail}
          detailFailed={detailFailed}
          onClose={closeDetail}
          onNotice={setNotice}
          returnToAppointments={returnToAppointments}
        />
      )}
    </>
  );
}
