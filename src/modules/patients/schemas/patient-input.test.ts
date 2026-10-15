import { describe, expect, it } from "vitest";
import {
  createPatientWithCenterSchema,
  patientAdministrativeNotesSchema,
  patientDocumentSchema,
  patientEmailSchema,
  patientInsuranceSchema,
  patientNationalityCodes,
  patientNationalitySchema,
  patientPhoneSchema,
  tenantPatientSearchSchema,
  trimPatientInput,
} from "./patient-input";

const centerId = "d73fd2e9-0f7f-4ef1-bc71-14e6da27e105";

describe("patient input contract", () => {
  it.each([
    ["", ""],
    [" ", ""],
    ["\t", ""],
    ["\n", ""],
    ["\r\n", ""],
    [" \t\r\n ", ""],
    [" abc ", "abc"],
    ["\tabc\t", "abc"],
    ["\nabc\r", "abc"],
    ["a\tb", "a\tb"],
  ])("trims only canonical edge whitespace in %j", (input, expected) => {
    expect(trimPatientInput(input)).toBe(expected);
  });

  it("uses the same 249-code ISO snapshot and rejects reserved codes", () => {
    expect(patientNationalityCodes).toHaveLength(249);
    expect(new Set(patientNationalityCodes).size).toBe(249);
    expect(patientNationalitySchema.parse(" ar ")).toBe("AR");
    expect(patientNationalitySchema.parse("US")).toBe("US");
    expect(patientNationalitySchema.safeParse("ZZ").success).toBe(false);
    expect(patientNationalitySchema.safeParse("X1").success).toBe(false);
  });

  it("normalizes optional whitespace and validates required fields", () => {
    expect(patientPhoneSchema.safeParse("\t").success).toBe(false);
    expect(patientEmailSchema.parse("\t")).toBeNull();
    expect(patientInsuranceSchema.parse("\t")).toBeNull();
    expect(patientAdministrativeNotesSchema.parse("\t")).toBeNull();
    expect(patientEmailSchema.parse(" A.B+tag@Example.COM ")).toBe("a.b+tag@example.com");
    expect(patientEmailSchema.safeParse("bad@@example.com").success).toBe(false);
    expect(patientDocumentSchema.safeParse("---").success).toBe(false);
  });

  it("enforces code point limits without truncation", () => {
    expect(patientPhoneSchema.parse("😀".repeat(50))).toHaveLength(100);
    expect(patientPhoneSchema.safeParse("😀".repeat(51)).success).toBe(false);
    expect(patientInsuranceSchema.safeParse("a".repeat(161)).success).toBe(false);
    expect(patientAdministrativeNotesSchema.safeParse("a".repeat(4001)).success).toBe(false);
    expect(patientDocumentSchema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("makes tabs-only search a tenant list and rejects invalid paging", () => {
    expect(tenantPatientSearchSchema.parse({ centerId, query: "\t" })).toMatchObject({
      query: null,
      state: "ACTIVE",
      limit: 25,
      offset: 0,
    });
    expect(tenantPatientSearchSchema.safeParse({ centerId, limit: null }).success).toBe(false);
    expect(tenantPatientSearchSchema.safeParse({ centerId, limit: 51 }).success).toBe(false);
    expect(tenantPatientSearchSchema.safeParse({ centerId, offset: 10001 }).success).toBe(false);
    expect(tenantPatientSearchSchema.safeParse({ centerId, query: "a".repeat(101) }).success).toBe(
      false,
    );
  });

  it("parses create input with canonical administrative fields", () => {
    expect(
      createPatientWithCenterSchema.parse({
        centerId,
        firstName: " Ada ",
        lastName: " Lovelace ",
        birthDate: "1990-01-01",
        nationalityCode: " ar ",
        documentNumber: " 12.345 ",
        phone: " 123 ",
        email: "\t",
        insuranceName: "\n",
        administrativeNotes: "\r\n",
      }),
    ).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      nationalityCode: "AR",
      documentNumber: "12.345",
      phone: "123",
      email: null,
      insuranceName: null,
      administrativeNotes: null,
    });
  });
});
