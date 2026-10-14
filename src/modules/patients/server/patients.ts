import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { callPatientRpc } from "../api/patient-rpc-adapter";
import type { PatientSearchRow } from "../api/patient-rpc-contracts";
import {
  PATIENT_MAX_PAGE,
  PATIENT_PAGE_SIZE,
  PATIENT_RPC_LIMIT,
  type PatientFilters,
} from "../search/patient-search-params";
import { tenantPatientSearchSchema } from "../schemas/patient-input";

export type PatientPage = {
  rows: PatientSearchRow[];
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  atOffsetCeiling: boolean;
};

export async function listPatientCenters(
  centerId: string,
  filters: PatientFilters,
  client: SupabaseClient<Database>,
): Promise<PatientPage> {
  const parsed = tenantPatientSearchSchema.parse({
    centerId,
    query: filters.query,
    state: filters.state,
    limit: PATIENT_RPC_LIMIT,
    offset: (filters.page - 1) * PATIENT_PAGE_SIZE,
  });
  let results: PatientSearchRow[];
  try {
    results = await callPatientRpc(client, "staff_search_patient_centers", {
      p_center_id: parsed.centerId,
      p_query: parsed.query,
      p_state: parsed.state,
      p_limit: parsed.limit,
      p_offset: parsed.offset,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "42501" &&
      "message" in error &&
      error.message === "PATIENT_ACCESS_DENIED"
    ) {
      throw new AuthorizationError("CENTER_ACCESS_DENIED");
    }
    throw error;
  }
  return {
    rows: results.slice(0, PATIENT_PAGE_SIZE),
    page: filters.page,
    hasPrevious: filters.page > 1,
    hasNext: results.length === PATIENT_RPC_LIMIT && filters.page < PATIENT_MAX_PAGE,
    atOffsetCeiling: results.length === PATIENT_RPC_LIMIT && filters.page === PATIENT_MAX_PAGE,
  };
}
