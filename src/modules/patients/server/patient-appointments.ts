import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  callPatientAppointmentRpc,
  type PatientAppointmentCursor,
  type PatientAppointmentRow,
  type PatientAppointmentSection,
} from "../api/patient-appointment-rpc";

const timestamp = z.iso.datetime({ offset: true });
const identitySchema = z.strictObject({ centerId: z.uuid(), patientCenterId: z.uuid() });
const pageSchema = identitySchema.extend({
  section: z.enum(["UPCOMING", "HISTORY"]),
  asOf: timestamp,
  cursor: z.strictObject({ startsAt: timestamp, id: z.uuid() }).nullable(),
});
const pageSize = 20;
type Client = SupabaseClient<Database>;

export type PatientAppointmentPage = {
  rows: PatientAppointmentRow[];
  hasMore: boolean;
  nextCursor: PatientAppointmentCursor | null;
};

function pageFromRows(rows: PatientAppointmentRow[]): PatientAppointmentPage {
  const last = rows.at(-1);
  return {
    rows,
    hasMore: rows[0]?.has_more ?? false,
    nextCursor: last ? { startsAt: last.starts_at, id: last.appointment_id } : null,
  };
}

async function queryPage(
  client: Client,
  input: {
    centerId: string;
    patientCenterId: string;
    section: PatientAppointmentSection;
    asOf: string;
    cursor: PatientAppointmentCursor | null;
  },
) {
  try {
    const rows = await callPatientAppointmentRpc(client, {
      p_center_id: input.centerId,
      p_patient_center_id: input.patientCenterId,
      p_section: input.section,
      p_as_of: input.asOf,
      p_cursor_starts_at: input.cursor?.startsAt ?? null,
      p_cursor_id: input.cursor?.id ?? null,
      p_limit: pageSize,
    });
    return pageFromRows(rows);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42501") {
      throw new AuthorizationError("CENTER_ACCESS_DENIED");
    }
    throw error;
  }
}

export async function loadPatientAppointmentSections(input: unknown, client: Client) {
  const ids = identitySchema.parse(input);
  await requireRole(ids.centerId, ["ADMIN", "RECEPTION"], client);
  const asOf = new Date().toISOString();
  const [upcoming, history] = await Promise.allSettled([
    queryPage(client, { ...ids, section: "UPCOMING", asOf, cursor: null }),
    queryPage(client, { ...ids, section: "HISTORY", asOf, cursor: null }),
  ]);
  for (const outcome of [upcoming, history]) {
    if (outcome.status === "rejected" && outcome.reason instanceof AuthorizationError)
      throw outcome.reason;
  }
  return {
    asOf,
    upcoming: upcoming.status === "fulfilled" ? upcoming.value : null,
    history: history.status === "fulfilled" ? history.value : null,
  };
}

export async function loadPatientAppointmentPage(input: unknown, client: Client) {
  const value = pageSchema.parse(input);
  await requireRole(value.centerId, ["ADMIN", "RECEPTION"], client);
  return queryPage(client, value);
}
