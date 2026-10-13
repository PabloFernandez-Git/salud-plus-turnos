import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { callPatientRpc } from "./patient-rpc-adapter";
import {
  patientResolveRowSchema,
  patientRpcContracts,
  patientSearchRowSchema,
  type PatientRpcArgs,
  type PatientRpcResult,
} from "./patient-rpc-contracts";

const personId = "11111111-1111-4111-8111-111111111111";
const centerId = "22222222-2222-4222-8222-222222222222";
const patientCenterId = "33333333-3333-4333-8333-333333333333";
const updatedAt = "2026-10-13T19:00:00+00:00";
const notFound = {
  identity_status: "NOT_FOUND",
  first_name: null,
  last_name: null,
  birth_date_matches: null,
  relationship_state: null,
  person_id: null,
  patient_center_id: null,
  patient_center_updated_at: null,
};
const mismatch = {
  identity_status: "FOUND",
  first_name: "Ana",
  last_name: "Pérez",
  birth_date_matches: false,
  relationship_state: "ACTIVE",
  person_id: null,
  patient_center_id: null,
  patient_center_updated_at: null,
};
const linked = {
  ...mismatch,
  birth_date_matches: true,
  person_id: personId,
  patient_center_id: patientCenterId,
  patient_center_updated_at: updatedAt,
};

describe("Patients SQL-derived RPC contracts", () => {
  it("accepts all real resolve branches and rejects unsafe substitutions", () => {
    expect(patientResolveRowSchema.parse(notFound).first_name).toBeNull();
    expect(patientResolveRowSchema.parse(mismatch).person_id).toBeNull();
    expect(
      patientResolveRowSchema.parse({
        ...linked,
        relationship_state: "NOT_LINKED",
        patient_center_id: null,
        patient_center_updated_at: null,
      }).patient_center_id,
    ).toBeNull();
    expect(patientResolveRowSchema.parse(linked).relationship_state).toBe("ACTIVE");
    expect(
      patientResolveRowSchema.parse({ ...linked, relationship_state: "INACTIVE" })
        .relationship_state,
    ).toBe("INACTIVE");
    expect(patientResolveRowSchema.safeParse({ ...notFound, first_name: "" }).success).toBe(false);
    expect(patientResolveRowSchema.safeParse({ ...mismatch, person_id: personId }).success).toBe(
      false,
    );
    expect(patientResolveRowSchema.safeParse({ ...linked, patient_center_id: null }).success).toBe(
      false,
    );
  });

  it("preserves nullable search columns and administrative arguments", () => {
    const row = {
      patient_center_id: patientCenterId,
      person_id: personId,
      first_name: "Ana",
      last_name: "Pérez",
      nationality_code: "AR",
      document_number: "12345",
      birth_date: "1990-01-01",
      phone: "123",
      email: null,
      insurance_name: null,
      is_active: true,
      updated_at: updatedAt,
    };
    expect(patientSearchRowSchema.parse(row).email).toBeNull();
    expect(patientSearchRowSchema.safeParse({ ...row, phone: null }).success).toBe(false);
    expect(
      patientRpcContracts.staff_search_patient_centers.args.parse({ p_center_id: centerId }),
    ).toEqual({
      p_center_id: centerId,
    });
    expect(
      patientRpcContracts.staff_search_patient_centers.args.safeParse({
        p_center_id: centerId,
        p_limit: null,
      }).success,
    ).toBe(false);
    for (const name of [
      "staff_create_patient_with_center",
      "staff_link_person_to_center",
      "staff_update_patient_center",
    ] as const) {
      const schema = patientRpcContracts[name].args;
      expect(schema.shape.p_email.safeParse(null).success).toBe(true);
      expect(schema.shape.p_insurance_name.safeParse(null).success).toBe(true);
      expect(schema.shape.p_administrative_notes.safeParse(null).success).toBe(true);
    }
    const normalized = patientRpcContracts.staff_update_patient_center.args.parse({
      p_center_id: centerId,
      p_patient_center_id: patientCenterId,
      p_expected_updated_at: updatedAt,
      p_phone: " 123 ",
      p_email: " \t ",
      p_insurance_name: null,
      p_administrative_notes: " \n ",
    });
    expect(normalized).toMatchObject({
      p_phone: "123",
      p_email: null,
      p_insurance_name: null,
      p_administrative_notes: null,
    });
    expect(
      patientRpcContracts.staff_update_patient_center.args.safeParse({
        ...normalized,
        p_phone: " \t ",
      }).success,
    ).toBe(false);
  });

  it("validates the Supabase boundary before returning a nullable result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [notFound], error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const args = {
      p_center_id: centerId,
      p_nationality_code: "AR",
      p_document_number: "12345",
      p_birth_date: "1990-01-01",
    };
    expect(
      (await callPatientRpc(client, "staff_resolve_patient_identity", args))[0].first_name,
    ).toBeNull();
    expect(rpc).toHaveBeenCalledWith("staff_resolve_patient_identity", args);
    rpc.mockResolvedValueOnce({ data: [{ ...notFound, first_name: "" }], error: null });
    await expect(callPatientRpc(client, "staff_resolve_patient_identity", args)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

// These assertions are compiled by `pnpm typecheck`; unsafe uses must remain errors.
const checkTypes = (
  resolved: PatientRpcResult<"staff_resolve_patient_identity">[number],
  searched: PatientRpcResult<"staff_search_patient_centers">[number],
) => {
  // @ts-expect-error NOT_FOUND has NULL first_name until narrowed.
  const firstName: string = resolved.first_name;
  // @ts-expect-error nullable PatientCenter fields require handling.
  const email: string = searched.email;
  // @ts-expect-error nullable PatientCenter fields require handling.
  const insurance: string = searched.insurance_name;
  void [firstName, email, insurance];
  if (resolved.identity_status === "NOT_FOUND") {
    const name: null = resolved.first_name;
    void name;
  }
};
void checkTypes;

const nullableDetails = {
  p_center_id: centerId,
  p_patient_center_id: patientCenterId,
  p_expected_updated_at: updatedAt,
  p_phone: "123",
  p_email: null,
  p_insurance_name: null,
  p_administrative_notes: null,
} satisfies PatientRpcArgs<"staff_update_patient_center">;
void nullableDetails;
// @ts-expect-error p_phone remains required.
const missingPhone: PatientRpcArgs<"staff_update_patient_center"> = {
  p_center_id: centerId,
  p_patient_center_id: patientCenterId,
  p_expected_updated_at: updatedAt,
  p_email: null,
  p_insurance_name: null,
  p_administrative_notes: null,
};
void missingPhone;
