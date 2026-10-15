import { describe, expect, it } from "vitest";
import { mapPatientError, patientErrorMessages } from "./patient-errors";

describe("patient SQL error mapping", () => {
  it.each([
    ["42501", "PATIENT_ACCESS_DENIED", "denied"],
    ["22023", "INVALID_PATIENT_INPUT", "invalid"],
    ["P0001", "PATIENT_BIRTH_DATE_MISMATCH", "birth_mismatch"],
    ["P0001", "STALE_PATIENT_CENTER_STATE", "stale"],
    ["P0001", "PATIENT_IDENTITY_ALREADY_EXISTS", "identity_race"],
    ["P0001", "PATIENT_IDENTITY_MISMATCH", "identity_race"],
    ["P0001", "PATIENT_RELATIONSHIP_INACTIVE", "relationship_changed"],
    ["P0002", "PATIENT_CENTER_NOT_FOUND", "missing"],
  ] as const)("maps only the exact %s/%s pair", (code, message, expected) => {
    expect(mapPatientError({ code, message })).toBe(expected);
    expect(mapPatientError({ code, message: `prefix ${message}` })).toBe("unexpected");
    expect(mapPatientError({ code: "XX000", message })).toBe("unexpected");
  });
  it("does not expose SQL or constraint text to the user", () => {
    const code = mapPatientError({ code: "23505", message: "duplicate key", details: "secret" });
    expect(code).toBe("unexpected");
    expect(patientErrorMessages[code]).not.toMatch(/duplicate|secret|23505/);
  });
});
