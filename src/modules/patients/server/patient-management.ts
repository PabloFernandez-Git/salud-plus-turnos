import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { requireRole } from "@/modules/access/server/authorization";
import { callPatientRpc } from "../api/patient-rpc-adapter";
import {
  createPatientWithCenterSchema,
  patientCenterDetailsSchema,
  patientIdentitySchema,
} from "../schemas/patient-input";

type Client = SupabaseClient<Database>;
const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const relation = z.strictObject({
  centerId: uuid,
  patientCenterId: uuid,
  expectedUpdatedAt: timestamp,
});
const link = patientIdentitySchema.safeExtend(patientCenterDetailsSchema.shape).safeExtend({
  personId: uuid,
  confirmed: z.literal(true),
});
const reactivate = relation
  .safeExtend(patientIdentitySchema.omit({ centerId: true }).shape)
  .safeExtend({
    confirmed: z.literal(true),
  });
const update = relation.safeExtend(patientCenterDetailsSchema.shape);
const deactivate = relation.safeExtend({ confirmed: z.literal(true) });

export const patientOperationSchemas = {
  resolve: patientIdentitySchema,
  create: createPatientWithCenterSchema,
  link,
  reactivate,
  update,
  deactivate,
} as const;
export type PatientOperation = keyof typeof patientOperationSchemas;

export async function getPatientCenter(centerId: string, patientCenterId: string, client: Client) {
  const ids = z
    .strictObject({ centerId: uuid, patientCenterId: uuid })
    .parse({ centerId, patientCenterId });
  await requireRole(ids.centerId, ["ADMIN", "RECEPTION"], client);
  const { data, error } = await client
    .from("patient_centers")
    .select(
      "id, person_id, phone, email, insurance_name, administrative_notes, is_active, updated_at, persons!patient_centers_person_fk(first_name, last_name, birth_date, nationality_code, document_number)",
    )
    .eq("center_id", ids.centerId)
    .eq("id", ids.patientCenterId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.persons) return null;
  return {
    patientCenterId: data.id,
    phone: data.phone,
    email: data.email,
    insuranceName: data.insurance_name,
    administrativeNotes: data.administrative_notes,
    isActive: data.is_active,
    updatedAt: data.updated_at,
    firstName: data.persons.first_name,
    lastName: data.persons.last_name,
    birthDate: data.persons.birth_date,
    nationalityCode: data.persons.nationality_code,
    documentNumber: data.persons.document_number,
  };
}

export type PatientDetail = NonNullable<Awaited<ReturnType<typeof getPatientCenter>>>;

export async function runPatientOperation(kind: PatientOperation, input: unknown, client: Client) {
  switch (kind) {
    case "resolve": {
      const p = patientOperationSchemas.resolve.parse(input);
      return (
        await callPatientRpc(client, "staff_resolve_patient_identity", {
          p_center_id: p.centerId,
          p_nationality_code: p.nationalityCode,
          p_document_number: p.documentNumber,
          p_birth_date: p.birthDate,
        })
      )[0];
    }
    case "create": {
      const p = patientOperationSchemas.create.parse(input);
      return (
        await callPatientRpc(client, "staff_create_patient_with_center", {
          p_center_id: p.centerId,
          p_nationality_code: p.nationalityCode,
          p_document_number: p.documentNumber,
          p_birth_date: p.birthDate,
          p_first_name: p.firstName,
          p_last_name: p.lastName,
          p_phone: p.phone,
          p_email: p.email,
          p_insurance_name: p.insuranceName,
          p_administrative_notes: p.administrativeNotes,
        })
      )[0];
    }
    case "link": {
      const p = patientOperationSchemas.link.parse(input);
      return (
        await callPatientRpc(client, "staff_link_person_to_center", {
          p_center_id: p.centerId,
          p_nationality_code: p.nationalityCode,
          p_document_number: p.documentNumber,
          p_birth_date: p.birthDate,
          p_person_id: p.personId,
          p_phone: p.phone,
          p_email: p.email,
          p_insurance_name: p.insuranceName,
          p_administrative_notes: p.administrativeNotes,
          p_confirmed: p.confirmed,
        })
      )[0];
    }
    case "reactivate": {
      const p = patientOperationSchemas.reactivate.parse(input);
      return (
        await callPatientRpc(client, "staff_reactivate_patient_center", {
          p_center_id: p.centerId,
          p_patient_center_id: p.patientCenterId,
          p_expected_updated_at: p.expectedUpdatedAt,
          p_nationality_code: p.nationalityCode,
          p_document_number: p.documentNumber,
          p_birth_date: p.birthDate,
          p_confirmed: p.confirmed,
        })
      )[0];
    }
    case "update": {
      const p = patientOperationSchemas.update.parse(input);
      return (
        await callPatientRpc(client, "staff_update_patient_center", {
          p_center_id: p.centerId,
          p_patient_center_id: p.patientCenterId,
          p_expected_updated_at: p.expectedUpdatedAt,
          p_phone: p.phone,
          p_email: p.email,
          p_insurance_name: p.insuranceName,
          p_administrative_notes: p.administrativeNotes,
        })
      )[0];
    }
    case "deactivate": {
      const p = patientOperationSchemas.deactivate.parse(input);
      return (
        await callPatientRpc(client, "staff_deactivate_patient_center", {
          p_center_id: p.centerId,
          p_patient_center_id: p.patientCenterId,
          p_expected_updated_at: p.expectedUpdatedAt,
          p_confirmed: p.confirmed,
        })
      )[0];
    }
  }
}
