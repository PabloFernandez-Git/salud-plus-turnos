import { describe, expect, it } from "vitest";
import { createProfessionalWithCenterSchema } from "./create-professional-with-center";
import emailContractCases from "./professional-email-contract-cases.json";

const validInput = {
  centerId: "76dcbe41-38be-475d-a590-f4ae6619c1e8",
  firstName: " Ada ",
  lastName: " Lovelace ",
  nationalityCode: " ar ",
  documentNumber: " 12.345.678 ",
  email: " ADA@EXAMPLE.TEST ",
  phone: " ",
  licenseNumber: " MN 123 ",
  usualAppointmentDurationMinutes: 30,
};

describe("createProfessionalWithCenterSchema", () => {
  it("normalizes the server-side create contract", () => {
    expect(createProfessionalWithCenterSchema.parse(validInput)).toEqual({
      centerId: validInput.centerId,
      firstName: "Ada",
      lastName: "Lovelace",
      nationalityCode: "AR",
      documentNumber: "12.345.678",
      email: "ada@example.test",
      phone: null,
      licenseNumber: "MN 123",
      usualAppointmentDurationMinutes: 30,
    });
  });

  it.each(emailContractCases.valid)(
    "accepts and normalizes project email $input",
    ({ input, normalized }) => {
      const result = createProfessionalWithCenterSchema.parse({ ...validInput, email: input });
      expect(result.email).toBe(normalized);
    },
  );

  it.each(emailContractCases.invalid)("rejects project email %s", (email) => {
    expect(createProfessionalWithCenterSchema.safeParse({ ...validInput, email }).success).toBe(
      false,
    );
  });

  it.each([4, 31, 485])("rejects unsupported duration %s", (duration) => {
    expect(
      createProfessionalWithCenterSchema.safeParse({
        ...validInput,
        usualAppointmentDurationMinutes: duration,
      }).success,
    ).toBe(false);
  });
});
