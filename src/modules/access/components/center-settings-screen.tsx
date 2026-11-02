"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { FormFieldError, formFieldErrorProps } from "@/components/form-field-error";
import {
  ModuleHeader,
  modulePrimaryActionClass,
  moduleSecondaryActionClass,
} from "@/components/module-header";

import {
  loadCenterSettingsAction,
  updateCenterSettingsAction,
} from "../actions/center-settings-actions";
import { timezoneLabel } from "../domain/timezone-label";
import { centerInstitutionalFieldsSchema } from "../schemas/center-institutional";
import type { CenterSettings } from "../server/center-settings";
import type { CenterSettingsActionResult } from "../server/center-settings-action";

type Draft = {
  centerName: string;
  centerPhone: string;
  centerEmail: string;
  centerAddress: string;
};

function draftFrom(settings: CenterSettings): Draft {
  return {
    centerName: settings.name,
    centerPhone: settings.phone ?? "",
    centerEmail: settings.email ?? "",
    centerAddress: settings.address ?? "",
  };
}

function normalized(draft: Draft) {
  return {
    centerName: draft.centerName.trim(),
    centerPhone: draft.centerPhone.trim(),
    centerEmail: draft.centerEmail.trim(),
    centerAddress: draft.centerAddress.trim(),
  };
}

export function CenterSettingsScreen({ settings }: { settings: CenterSettings }) {
  const router = useRouter();
  const [base, setBase] = useState(settings);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const [result, setResult] = useState<CenterSettingsActionResult | null>(null);
  const [mustReloadBeforeSave, setMustReloadBeforeSave] = useState(false);
  const [discardAction, setDiscardAction] = useState<"cancel" | "reload" | null>(null);
  const [isPending, startTransition] = useTransition();
  const discardDialogRef = useRef<HTMLDivElement>(null);
  const parsed = centerInstitutionalFieldsSchema.safeParse(draft);
  const current = normalized(draft);
  const original = normalized(draftFrom(base));
  const isDirty = (Object.keys(current) as (keyof Draft)[]).some(
    (key) => current[key] !== original[key],
  );
  const canSave = isDirty && parsed.success && !isPending && !mustReloadBeforeSave;

  useEffect(() => {
    if (!isDirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [isDirty]);

  useEffect(() => {
    if (!discardAction) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const buttons = discardDialogRef.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[0]?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDiscardAction(null);
      }
      if (event.key !== "Tab" || !buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocus);
    return () => {
      document.removeEventListener("keydown", keepFocus);
      previousFocus?.focus();
    };
  }, [discardAction]);

  function update(key: keyof Draft, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (result?.status !== "uncertain") setResult(null);
  }

  function cancel() {
    if (isPending) return;
    if (isDirty) setDiscardAction("cancel");
    else router.push(`/centers/${settings.id}`);
  }

  function requestReload() {
    if (isDirty) setDiscardAction("reload");
    else reload();
  }

  function reload() {
    startTransition(async () => {
      let currentSettings: CenterSettings;
      try {
        currentSettings = await loadCenterSettingsAction(settings.id);
      } catch {
        setMustReloadBeforeSave(true);
        setResult({
          status: "uncertain",
          message:
            "No pudimos recargar los datos del centro. Tu borrador sigue disponible. Verificá los datos antes de volver a guardar.",
        });
        return;
      }
      setBase(currentSettings);
      setDraft(draftFrom(currentSettings));
      setResult(null);
      setMustReloadBeforeSave(false);
      try {
        router.refresh();
      } catch {
        setResult({
          status: "error",
          message:
            "Datos del centro cargados. El encabezado puede estar desactualizado; recargá la página.",
        });
      }
    });
  }

  function confirmDiscard() {
    if (discardAction === "cancel") router.push(`/centers/${settings.id}`);
    if (discardAction === "reload") reload();
    setDiscardAction(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || !parsed.success) return;
    const formData = new FormData();
    formData.set("centerId", base.id);
    formData.set("expectedUpdatedAt", base.updatedAt);
    for (const [key, value] of Object.entries(parsed.data)) formData.set(key, value);
    startTransition(async () => {
      let next: CenterSettingsActionResult;
      try {
        next = await updateCenterSettingsAction(formData);
      } catch {
        setMustReloadBeforeSave(true);
        setResult({
          status: "uncertain",
          message:
            "No pudimos confirmar si se guardaron los cambios. Recargá los datos antes de volver a guardar.",
        });
        return;
      }
      setResult(next);
      if (next.status === "uncertain") setMustReloadBeforeSave(true);
      if (next.status !== "success") return;
      setMustReloadBeforeSave(false);
      const persisted = { ...base, ...next.settings, updatedAt: next.settings.updatedAt };
      setBase(persisted);
      setDraft(draftFrom(persisted));
      try {
        router.refresh();
      } catch {
        setResult({ ...next, refreshPending: true });
      }
    });
  }

  const fieldErrors = result?.status === "invalid" ? result.fieldErrors : {};
  const fields: { key: keyof Draft; label: string; type: string; autocomplete?: string }[] = [
    { key: "centerName", label: "Nombre del centro", type: "text", autocomplete: "organization" },
    { key: "centerPhone", label: "Teléfono de contacto", type: "tel", autocomplete: "tel" },
    { key: "centerEmail", label: "Email institucional", type: "email", autocomplete: "email" },
    { key: "centerAddress", label: "Dirección", type: "text", autocomplete: "street-address" },
  ];

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-10 [&_a[href]]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_button:enabled]:cursor-pointer">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <ModuleHeader
          centerId={settings.id}
          description="Actualizá los datos institucionales del centro activo."
          title="Configuración del centro"
        />

        <form
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
          noValidate
          onSubmit={save}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map(({ key, label, type, autocomplete }) => {
              const fieldError = fieldErrors[key]?.[0];
              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-800" htmlFor={key}>
                    {label}
                  </label>
                  <input
                    {...formFieldErrorProps(fieldError, `${key}-error`)}
                    autoComplete={autocomplete}
                    className={`mt-1 block min-h-11 w-full rounded-md border-2 bg-white px-3 py-2 text-base text-slate-950 focus:outline-none ${fieldError ? "border-red-700 focus:border-red-700" : "border-slate-300 focus:border-sky-700"}`}
                    disabled={isPending}
                    id={key}
                    onChange={(event) => update(key, event.target.value)}
                    type={type}
                    value={draft[key]}
                  />
                  <FormFieldError id={`${key}-error`} message={fieldError} />
                </div>
              );
            })}
          </div>

          {result?.status === "success" ? (
            <p
              className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
              role="status"
            >
              {result.refreshPending
                ? "Configuración guardada. La vista puede estar desactualizada; recargá la página para verificar el encabezado."
                : "Configuración guardada."}
            </p>
          ) : result?.status === "conflict" || result?.status === "uncertain" ? (
            <div
              className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"
              role="alert"
            >
              <p className="text-sm text-amber-900">{result.message}</p>
              <button className={moduleSecondaryActionClass} onClick={requestReload} type="button">
                Recargar datos del centro
              </button>
            </div>
          ) : result?.status === "error" || result?.status === "forbidden" ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
              role="alert"
            >
              {result.message}
            </p>
          ) : null}

          <div className="grid gap-5 border-t border-slate-200 pt-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">Zona horaria</p>
              <p className="mt-1 text-sm text-slate-700">{timezoneLabel(base.timezone)}</p>
              <p className="mt-1 text-xs text-slate-600">Solo lectura</p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className={moduleSecondaryActionClass}
                disabled={isPending}
                onClick={cancel}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={`${modulePrimaryActionClass} disabled:cursor-not-allowed`}
                disabled={!canSave}
                type="submit"
              >
                {isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {discardAction
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
              role="presentation"
            >
              <div
                aria-labelledby="discard-settings-title"
                aria-modal="true"
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl [&_button:enabled]:cursor-pointer"
                ref={discardDialogRef}
                role="dialog"
              >
                <h2 className="text-lg font-semibold text-slate-950" id="discard-settings-title">
                  ¿Descartar cambios?
                </h2>
                <p className="mt-2 text-sm text-slate-700">
                  Hay cambios sin guardar en la configuración del centro.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                  <button
                    className={moduleSecondaryActionClass}
                    onClick={() => setDiscardAction(null)}
                    type="button"
                  >
                    Seguir editando
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={confirmDiscard}
                    type="button"
                  >
                    Descartar cambios
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}
