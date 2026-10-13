import { describe, expect, it } from "vitest";
import { createProfessionalWithCenterSchema } from "./create-professional-with-center";
import {
  normalizeDocumentForValidation,
  professionalDocumentSchema,
} from "./professional-document";
import { resolveProfessionalSchema } from "./professional-center";

const centerId = "11111111-1111-4111-8111-111111111111";
const createInput = {
  centerId,
  firstName: "Ana",
  lastName: "Pérez",
  nationalityCode: "AR",
  documentNumber: "123",
  email: "ana@example.com",
  phone: null,
  licenseNumber: null,
  usualAppointmentDurationMinutes: 30,
};

describe("professional document validation", () => {
  it.each(["---", " . - ", "—‐−", " \t.\n— ", "", "   "])(
    "rejects separator-only document %j in resolve and create",
    (documentNumber) => {
      expect(professionalDocumentSchema.safeParse(documentNumber).success).toBe(false);
      expect(
        resolveProfessionalSchema.safeParse({ centerId, nationalityCode: "AR", documentNumber })
          .success,
      ).toBe(false);
      expect(
        createProfessionalWithCenterSchema.safeParse({ ...createInput, documentNumber }).success,
      ).toBe(false);
    },
  );

  it.each([
    ["00123", "00123"],
    [" 00.123-AB ", "00123AB"],
    ["‐−0012—", "0012"],
    [" a.b-0 ", "AB0"],
    ["000", "000"],
  ])("preserves meaningful content of %j", (documentNumber, canonical) => {
    expect(normalizeDocumentForValidation(documentNumber)).toBe(canonical);
    expect(professionalDocumentSchema.safeParse(documentNumber).success).toBe(true);
    expect(
      resolveProfessionalSchema.safeParse({ centerId, nationalityCode: "AR", documentNumber })
        .success,
    ).toBe(true);
    expect(
      createProfessionalWithCenterSchema.safeParse({ ...createInput, documentNumber }).success,
    ).toBe(true);
  });

  it("does not remove a character outside PostgreSQL's separator set", () => {
    expect(normalizeDocumentForValidation("．")).toBe("．");
    expect(professionalDocumentSchema.safeParse("．").success).toBe(true);
  });
});
