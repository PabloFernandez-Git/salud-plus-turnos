export type PatientErrorCode =
  | "denied"
  | "invalid"
  | "birth_mismatch"
  | "stale"
  | "identity_race"
  | "relationship_changed"
  | "missing"
  | "unexpected";

export const patientErrorMessages: Record<PatientErrorCode, string> = {
  denied: "Ya no tenés acceso a los pacientes de este centro.",
  invalid: "Revisá los datos ingresados.",
  birth_mismatch: "Los datos ingresados no coinciden con la identidad registrada.",
  stale:
    "Los datos cambiaron desde que abriste este formulario. Recargá los datos antes de intentar de nuevo.",
  identity_race: "La identidad cambió. Comprobá nuevamente los datos antes de continuar.",
  relationship_changed: "El registro cambió. Comprobá nuevamente la identidad antes de continuar.",
  missing: "El registro ya no está disponible. Recargá los datos.",
  unexpected:
    "No pudimos confirmar el resultado. Actualizá la página y revisá el estado antes de reintentar.",
};

const known = new Map<string, PatientErrorCode>([
  ["42501:PATIENT_ACCESS_DENIED", "denied"],
  ["22023:INVALID_PATIENT_INPUT", "invalid"],
  ["P0001:PATIENT_BIRTH_DATE_MISMATCH", "birth_mismatch"],
  ["P0001:STALE_PATIENT_CENTER_STATE", "stale"],
  ["P0001:PATIENT_IDENTITY_ALREADY_EXISTS", "identity_race"],
  ["P0001:PATIENT_IDENTITY_MISMATCH", "identity_race"],
  ["P0001:PATIENT_RELATIONSHIP_INACTIVE", "relationship_changed"],
  ["P0002:PATIENT_CENTER_NOT_FOUND", "missing"],
]);

export function mapPatientError(error: unknown): PatientErrorCode {
  if (!error || typeof error !== "object" || !("code" in error) || !("message" in error)) {
    return "unexpected";
  }
  const { code, message } = error;
  if (typeof code !== "string" || typeof message !== "string") return "unexpected";
  // Constraint names in PostgREST's free text are not trusted ownership evidence.
  return known.get(`${code}:${message}`) ?? "unexpected";
}
