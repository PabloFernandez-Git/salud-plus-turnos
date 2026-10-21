"use client";

import { useEffect, useRef } from "react";
import type { AppointmentFailure } from "../server/appointment-errors";

const messages: Record<string, string> = {
  SLOT_ALREADY_TAKEN: "Ese horario dejó de estar disponible. Elegí otro.",
  STALE_APPOINTMENT_STATE: "El turno cambió. Recargá el detalle antes de continuar.",
  INVALID_LOCAL_TIME: "Ese horario local no existe. Elegí otro.",
  AMBIGUOUS_LOCAL_TIME: "Ese horario local es ambiguo. Elegí otro.",
  ACCESS_DENIED: "No tenés permiso para esta operación.",
  PATIENT_NOT_AVAILABLE: "El paciente ya no está activo en este centro.",
  PROFESSIONAL_NOT_AVAILABLE: "El profesional ya no está disponible.",
  SPECIALTY_NOT_AVAILABLE: "La especialidad ya no está disponible.",
  SPECIALTY_NOT_ASSIGNED: "La especialidad ya no está asignada a ese profesional.",
  OUTSIDE_AVAILABILITY: "El horario quedó fuera de la disponibilidad vigente.",
  APPOINTMENT_IN_PAST: "No se puede crear o reprogramar un turno en el pasado.",
  INVALID_STATUS_TRANSITION: "El estado actual ya no permite esa acción.",
  APPOINTMENT_NOT_FOUND: "El turno ya no está disponible.",
  INVALID_TIMEZONE: "La zona horaria del centro no es válida. Contactá a administración.",
  INVALID_INPUT: "Revisá los datos y volvé a elegir un horario.",
};

export function appointmentFailureMessage(result: AppointmentFailure): string {
  if (result.status === "BUSINESS_ERROR")
    return messages[result.code] ?? "No pudimos completar la operación.";
  if (result.status === "AUTH_ERROR") return messages.ACCESS_DENIED;
  if (result.status === "VALIDATION_ERROR") return "Revisá los datos ingresados.";
  if (result.status === "UNKNOWN_RESULT")
    return "No pudimos confirmar el resultado. La operación pudo haberse completado. Verificá el turno antes de cualquier nuevo intento.";
  return "Ocurrió un error. Recargá y verificá el estado antes de intentar de nuevo.";
}

export function AppointmentFeedback({ result }: { result: AppointmentFailure | null }) {
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) alert.current?.focus();
  }, [result]);
  if (!result) return null;
  return (
    <div
      ref={alert}
      role="alert"
      tabIndex={-1}
      className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
    >
      <p>{appointmentFailureMessage(result)}</p>
      {result.status === "VALIDATION_ERROR" && (
        <ul className="mt-2 list-inside list-disc">
          {Object.entries(result.fields).map(([field, message]) => (
            <li key={field}>
              {field}: {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
