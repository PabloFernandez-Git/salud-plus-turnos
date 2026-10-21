import { patientCodePointLength, trimPatientInput } from "../schemas/patient-input";
import { z } from "zod";

export type PatientState = "ACTIVE" | "INACTIVE" | "ALL";
export type PatientFilters = { query: string; state: PatientState; page: number };
export type PatientSearchParams = Record<string, string | readonly string[] | undefined>;

export const PATIENT_PAGE_SIZE = 25;
export const PATIENT_RPC_LIMIT = 26;
export const PATIENT_MAX_PAGE = 401;

export function patientSearchUrl(
  centerId: string,
  filters: PatientFilters,
  patientId?: string,
  returnToAppointments = false,
): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.state !== "ACTIVE") params.set("state", filters.state);
  if (filters.page !== 1) params.set("page", String(filters.page));
  if (patientId) params.set("patient", patientId);
  if (returnToAppointments) params.set("from", "appointment");
  const search = params.toString();
  const path = `/centers/${centerId}/patients`;
  return search ? `${path}?${search}` : path;
}

export function patientRegistrationDestination(
  centerId: string,
  patientCenterId: string,
  filters: PatientFilters,
  returnToAppointments: boolean,
): string {
  if (returnToAppointments) {
    return `/centers/${centerId}/appointments/new?patientCenterId=${encodeURIComponent(patientCenterId)}`;
  }
  return patientSearchUrl(centerId, filters, patientCenterId);
}

function parsePatientFilters(input: PatientSearchParams): PatientFilters {
  const q = input.q;
  const state = input.state;
  const page = input.page;
  let resetPage = Array.isArray(q) || Array.isArray(state) || Array.isArray(page);

  let query = typeof q === "string" ? trimPatientInput(q) : "";
  if (patientCodePointLength(query) > 100) {
    query = "";
    resetPage = true;
  }

  let parsedState: PatientState = "ACTIVE";
  if (typeof state === "string") {
    if (state === "ACTIVE" || state === "INACTIVE" || state === "ALL") parsedState = state;
    else resetPage = true;
  }

  let parsedPage = 1;
  if (!resetPage && typeof page === "string") {
    if (/^[1-9]\d*$/.test(page) && page.length <= 3 && Number(page) <= PATIENT_MAX_PAGE) {
      parsedPage = Number(page);
    } else {
      resetPage = true;
    }
  }
  if (resetPage) parsedPage = 1;

  return { query, state: parsedState, page: parsedPage };
}

export function parsePatientSearchParams(
  centerId: string,
  input: PatientSearchParams,
  originalSearch: string,
) {
  const filters = parsePatientFilters(input);
  const patientId =
    typeof input.patient === "string" && z.uuid().safeParse(input.patient).success
      ? input.patient
      : undefined;
  const returnToAppointments = input.from === "appointment";
  const canonicalUrl = patientSearchUrl(centerId, filters, patientId, returnToAppointments);
  const actualUrl = `/centers/${centerId}/patients${originalSearch}`;
  return {
    ...filters,
    ...(patientId ? { patientId } : {}),
    ...(returnToAppointments ? { returnToAppointments: true } : {}),
    canonicalUrl,
    needsRedirect: actualUrl !== canonicalUrl,
  };
}
