export type AvailabilityErrorCode =
  "denied" | "invalid" | "overlap" | "missing" | "stale" | "unexpected";

export const availabilityErrorMessages: Record<AvailabilityErrorCode, string> = {
  denied: "Ya no tenés permiso para administrar la disponibilidad de este centro.",
  invalid: "Revisá los horarios o la duración ingresada.",
  overlap: "Ese horario se superpone con otra franja activa del mismo día.",
  missing: "El vínculo o la franja ya no está disponible. Actualizá la página.",
  stale: "Los datos cambiaron en otra sesión. Actualizá la página antes de reintentar.",
  unexpected:
    "No pudimos confirmar el resultado. Actualizá la página y revisá el estado antes de reintentar.",
};

const known = new Map<string, AvailabilityErrorCode>([
  ["42501:AVAILABILITY_MUTATION_DENIED", "denied"],
  ["42501:AVAILABILITY_ACCESS_DENIED", "denied"],
  ["22023:INVALID_AVAILABILITY_INTERVAL", "invalid"],
  ["22023:INVALID_AVAILABILITY_INPUT", "invalid"],
  ["22023:INVALID_APPOINTMENT_DURATION", "invalid"],
  ["P0002:RESOURCE_NOT_FOUND", "missing"],
  ["P0001:STALE_AVAILABILITY_STATE", "stale"],
  ["P0001:STALE_PROFESSIONAL_CENTER_STATE", "stale"],
]);

export function mapAvailabilityError(error: unknown): AvailabilityErrorCode {
  if (!error || typeof error !== "object") return "unexpected";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  if (
    code === "23P01" &&
    (("constraint" in error && error.constraint === "availabilities_no_active_overlap") ||
      message ===
        'conflicting key value violates exclusion constraint "availabilities_no_active_overlap"')
  )
    return "overlap";
  return known.get(`${code}:${message}`) ?? "unexpected";
}
