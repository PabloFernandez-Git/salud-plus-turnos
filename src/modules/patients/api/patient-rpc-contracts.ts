import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import {
  patientAdministrativeNotesSchema,
  patientBirthDateSchema,
  patientDocumentSchema,
  patientEmailSchema,
  patientInsuranceSchema,
  patientNameSchema,
  patientNationalitySchema,
  patientPhoneSchema,
} from "@/modules/patients/schemas/patient-input";

// SQL is the database authority. database.types.ts is a generated transport approximation:
// Supabase's function introspection does not preserve nullable RETURNS TABLE columns or args.
const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const identityArgs = {
  p_center_id: uuid,
  p_nationality_code: patientNationalitySchema,
  p_document_number: patientDocumentSchema,
  p_birth_date: patientBirthDateSchema,
};
const optionalDetails = {
  p_email: z
    .string()
    .nullable()
    .transform((value) => patientEmailSchema.parse(value)),
  p_insurance_name: z
    .string()
    .nullable()
    .transform((value) => patientInsuranceSchema.parse(value)),
  p_administrative_notes: z
    .string()
    .nullable()
    .transform((value) => patientAdministrativeNotesSchema.parse(value)),
};
const centerDetails = { p_phone: patientPhoneSchema, ...optionalDetails };
const relationArgs = {
  p_center_id: uuid,
  p_patient_center_id: uuid,
  p_expected_updated_at: timestamp,
};

const resolveBase = {
  identity_status: z.literal("FOUND"),
  first_name: z.string(),
  last_name: z.string(),
};
const resolveMismatch = z.strictObject({
  ...resolveBase,
  birth_date_matches: z.literal(false),
  relationship_state: z.enum(["NOT_LINKED", "ACTIVE", "INACTIVE"]),
  person_id: z.null(),
  patient_center_id: z.null(),
  patient_center_updated_at: z.null(),
});
const resolveMatchedBase = {
  ...resolveBase,
  birth_date_matches: z.literal(true),
  person_id: uuid,
};
const resolveLinkedBase = {
  ...resolveMatchedBase,
  patient_center_id: uuid,
  patient_center_updated_at: timestamp,
};
export const patientResolveRowSchema = z.union([
  z.strictObject({
    identity_status: z.literal("NOT_FOUND"),
    first_name: z.null(),
    last_name: z.null(),
    birth_date_matches: z.null(),
    relationship_state: z.null(),
    person_id: z.null(),
    patient_center_id: z.null(),
    patient_center_updated_at: z.null(),
  }),
  resolveMismatch,
  z.strictObject({
    ...resolveMatchedBase,
    relationship_state: z.literal("NOT_LINKED"),
    patient_center_id: z.null(),
    patient_center_updated_at: z.null(),
  }),
  z.strictObject({ ...resolveLinkedBase, relationship_state: z.literal("ACTIVE") }),
  z.strictObject({ ...resolveLinkedBase, relationship_state: z.literal("INACTIVE") }),
]);
export type PatientResolveRow = z.infer<typeof patientResolveRowSchema>;

export const patientSearchRowSchema = z.strictObject({
  patient_center_id: uuid,
  person_id: uuid,
  first_name: z.string(),
  last_name: z.string(),
  nationality_code: z.string(),
  document_number: z.string(),
  birth_date: z.iso.date(),
  phone: z.string(),
  email: z.string().nullable(),
  insurance_name: z.string().nullable(),
  is_active: z.boolean(),
  updated_at: timestamp,
});
export type PatientSearchRow = z.infer<typeof patientSearchRowSchema>;

const createOrLinkResult = {
  person_id: uuid,
  patient_center_id: uuid,
  updated_at: timestamp,
};
const centerResult = (outcomes: [string, ...string[]]) =>
  z.strictObject({
    patient_center_id: uuid,
    updated_at: timestamp,
    outcome: z.enum(outcomes),
  });

export const patientRpcContracts = {
  staff_search_patient_centers: {
    args: z.strictObject({
      p_center_id: uuid,
      p_query: z.string().nullable().optional(),
      p_state: z.enum(["ACTIVE", "INACTIVE", "ALL"]).nullable().optional(),
      p_limit: z.number().int().min(1).max(50).optional(),
      p_offset: z.number().int().min(0).max(10000).optional(),
    }),
    returns: z.array(patientSearchRowSchema),
  },
  staff_resolve_patient_identity: {
    args: z.strictObject(identityArgs),
    returns: z.tuple([patientResolveRowSchema]),
  },
  staff_create_patient_with_center: {
    args: z.strictObject({
      ...identityArgs,
      p_first_name: patientNameSchema,
      p_last_name: patientNameSchema,
      ...centerDetails,
    }),
    returns: z.tuple([z.strictObject({ ...createOrLinkResult, outcome: z.literal("CREATED") })]),
  },
  staff_link_person_to_center: {
    args: z.strictObject({
      ...identityArgs,
      p_person_id: uuid,
      ...centerDetails,
      p_confirmed: z.literal(true),
    }),
    returns: z.tuple([
      z.strictObject({ ...createOrLinkResult, outcome: z.enum(["LINKED", "ALREADY_ACTIVE"]) }),
    ]),
  },
  staff_reactivate_patient_center: {
    args: z.strictObject({
      ...relationArgs,
      p_nationality_code: patientNationalitySchema,
      p_document_number: patientDocumentSchema,
      p_birth_date: patientBirthDateSchema,
      p_confirmed: z.literal(true),
    }),
    returns: z.tuple([centerResult(["ALREADY_ACTIVE", "REACTIVATED"])]),
  },
  staff_update_patient_center: {
    args: z.strictObject({ ...relationArgs, ...centerDetails }),
    returns: z.tuple([centerResult(["UNCHANGED", "UPDATED"])]),
  },
  staff_deactivate_patient_center: {
    args: z.strictObject({ ...relationArgs, p_confirmed: z.literal(true) }),
    returns: z.tuple([centerResult(["UNCHANGED", "DEACTIVATED"])]),
  },
} as const;

export type PatientRpcName = keyof typeof patientRpcContracts;
export type PatientRpcArgs<N extends PatientRpcName> = z.output<
  (typeof patientRpcContracts)[N]["args"]
>;
export type PatientRpcResult<N extends PatientRpcName> = z.output<
  (typeof patientRpcContracts)[N]["returns"]
>;

// Compile-time drift guard for all seven generated RPC names and argument keys.
type SameKeys<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [never, never]
  ? true
  : false;
type Assert<T extends true> = T;
type Generated = Database["public"]["Functions"];
export type PatientRpcSignatureGuard = [
  Assert<Exclude<PatientRpcName, keyof Generated> extends never ? true : false>,
  Assert<
    SameKeys<
      PatientRpcArgs<"staff_search_patient_centers">,
      Generated["staff_search_patient_centers"]["Args"]
    >
  >,
  Assert<
    SameKeys<
      PatientRpcArgs<"staff_resolve_patient_identity">,
      Generated["staff_resolve_patient_identity"]["Args"]
    >
  >,
  Assert<
    SameKeys<
      PatientRpcArgs<"staff_create_patient_with_center">,
      Generated["staff_create_patient_with_center"]["Args"]
    >
  >,
  Assert<
    SameKeys<
      PatientRpcArgs<"staff_link_person_to_center">,
      Generated["staff_link_person_to_center"]["Args"]
    >
  >,
  Assert<
    SameKeys<
      PatientRpcArgs<"staff_reactivate_patient_center">,
      Generated["staff_reactivate_patient_center"]["Args"]
    >
  >,
  Assert<
    SameKeys<
      PatientRpcArgs<"staff_update_patient_center">,
      Generated["staff_update_patient_center"]["Args"]
    >
  >,
  Assert<
    SameKeys<
      PatientRpcArgs<"staff_deactivate_patient_center">,
      Generated["staff_deactivate_patient_center"]["Args"]
    >
  >,
];
