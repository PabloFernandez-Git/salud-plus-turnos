import { z } from "zod";
import isoCodes from "./iso-3166-1-alpha-2.json";
import { isValidProfessionalEmail } from "@/modules/professionals/schemas/professional-email";

// PATIENT_EDGE_WHITESPACE: U+0009..U+000D and U+0020, at the edges only.
const patientEdgeWhitespace = /^[\u0009-\u000D\u0020]+|[\u0009-\u000D\u0020]+$/g;
const nationalityCodes = new Set<string>(isoCodes);

export function trimPatientInput(value: string): string {
  return value.replace(patientEdgeWhitespace, "");
}

export function patientCodePointLength(value: string): number {
  return Array.from(value).length;
}

export function normalizePatientDocumentForValidation(value: string): string {
  return trimPatientInput(value)
    .toUpperCase()
    .replace(/[\s.]/g, "")
    .replace(/[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, "");
}

export const patientNationalityCodes = Object.freeze([...isoCodes]);

export const patientNationalitySchema = z
  .string()
  .transform((value) => trimPatientInput(value).toUpperCase())
  .refine((value) => nationalityCodes.has(value), "Nacionalidad inválida.");

function requiredPatientText(maximum: number) {
  return z
    .string()
    .transform(trimPatientInput)
    .refine(
      (value) => patientCodePointLength(value) >= 1 && patientCodePointLength(value) <= maximum,
      "Valor inválido.",
    );
}

function optionalPatientText(maximum: number) {
  return z
    .string()
    .nullish()
    .transform((value) => (value == null ? null : trimPatientInput(value) || null))
    .refine(
      (value) => value === null || patientCodePointLength(value) <= maximum,
      "Valor demasiado largo.",
    );
}

export const patientNameSchema = requiredPatientText(100);
export const patientPhoneSchema = requiredPatientText(50);
export const patientInsuranceSchema = optionalPatientText(160);
export const patientAdministrativeNotesSchema = optionalPatientText(4000);

export const patientDocumentSchema = requiredPatientText(100).refine(
  (value) => normalizePatientDocumentForValidation(value).length > 0,
  "Documento inválido.",
);

export const patientEmailSchema = optionalPatientText(320)
  .transform((value) => value?.toLowerCase() ?? null)
  .refine((value) => value === null || isValidProfessionalEmail(value), "Email inválido.");

export const patientBirthDateSchema = z.iso.date();

export const patientIdentitySchema = z.object({
  centerId: z.uuid(),
  nationalityCode: patientNationalitySchema,
  documentNumber: patientDocumentSchema,
  birthDate: patientBirthDateSchema,
});

export const patientCenterDetailsSchema = z.object({
  phone: patientPhoneSchema,
  email: patientEmailSchema,
  insuranceName: patientInsuranceSchema,
  administrativeNotes: patientAdministrativeNotesSchema,
});

export const createPatientWithCenterSchema = patientIdentitySchema
  .extend({
    firstName: patientNameSchema,
    lastName: patientNameSchema,
  })
  .safeExtend(patientCenterDetailsSchema.shape);

export const tenantPatientSearchSchema = z.object({
  centerId: z.uuid(),
  query: z
    .string()
    .nullish()
    .transform((value) => {
      const canonical = value == null ? null : trimPatientInput(value);
      return canonical || null;
    })
    .refine((value) => value === null || patientCodePointLength(value) <= 100),
  state: z
    .enum(["ACTIVE", "INACTIVE", "ALL"])
    .nullish()
    .transform((value) => value ?? "ACTIVE"),
  limit: z.number().int().min(1).max(50).default(25),
  offset: z.number().int().min(0).max(10000).default(0),
});
