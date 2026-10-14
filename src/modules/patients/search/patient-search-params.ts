import { patientCodePointLength, trimPatientInput } from "../schemas/patient-input";

export type PatientState = "ACTIVE" | "INACTIVE" | "ALL";
export type PatientFilters = { query: string; state: PatientState; page: number };
export type PatientSearchParams = Record<string, string | readonly string[] | undefined>;

export const PATIENT_PAGE_SIZE = 25;
export const PATIENT_RPC_LIMIT = 26;
export const PATIENT_MAX_PAGE = 401;

export function patientSearchUrl(centerId: string, filters: PatientFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.state !== "ACTIVE") params.set("state", filters.state);
  if (filters.page !== 1) params.set("page", String(filters.page));
  const search = params.toString();
  const path = `/centers/${centerId}/patients`;
  return search ? `${path}?${search}` : path;
}

export function parsePatientSearchParams(centerId: string, input: PatientSearchParams) {
  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") raw.append(key, value);
    else if (Array.isArray(value)) for (const item of value) raw.append(key, item);
  }

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

  const filters: PatientFilters = { query, state: parsedState, page: parsedPage };
  const canonicalUrl = patientSearchUrl(centerId, filters);
  const actualUrl = raw.size
    ? `/centers/${centerId}/patients?${raw}`
    : `/centers/${centerId}/patients`;
  return { ...filters, canonicalUrl, needsRedirect: actualUrl !== canonicalUrl };
}
