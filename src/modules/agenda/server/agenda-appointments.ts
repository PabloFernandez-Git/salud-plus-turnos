import "server-only";

import type { AppointmentClient } from "@/modules/appointments/server/appointment-rpc";
import { listAppointments } from "@/modules/appointments/server/appointments";
import { agendaRange, type AgendaFilters } from "../agenda-search";

export type AgendaAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "PENDING" | "CONFIRMED" | "ATTENDED" | "NO_SHOW" | "CANCELLED";
  patientName: string;
  specialtyName: string;
  professionalCenterId: string;
  professionalName: string;
};

export async function listAgendaAppointments(
  centerId: string,
  filters: AgendaFilters,
  ownProfessionalCenterId: string | null,
  client: AppointmentClient,
  specialtyName?: string,
): Promise<AgendaAppointment[]> {
  const { fromDate, toDate } = agendaRange(filters);
  const rows: AgendaAppointment[] = [];
  let cursor: { startsAt: string; id: string } | undefined;
  // Explicit limit prevents an accidental unbounded render. Never return partial data.
  for (let page = 0; page < 100; page++) {
    const result = await listAppointments(
      {
        centerId,
        fromDate,
        toDate,
        limit: 50,
        ...(filters.status ? { status: filters.status } : {}),
        ...(ownProfessionalCenterId === null && filters.professionalCenterId
          ? { professionalCenterId: filters.professionalCenterId }
          : {}),
        ...(cursor ? { cursor } : {}),
      },
      client,
    );
    if (result.kind === "PROFESSIONAL" && !ownProfessionalCenterId)
      throw new Error("AGENDA_PROFESSIONAL_CONTEXT_MISSING");
    for (const row of result.rows) {
      if (!filters.status && row.status === "CANCELLED") continue;
      if (specialtyName && row.specialty_name !== specialtyName) continue;
      rows.push({
        id: row.appointment_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        patientName: `${row.patient_first_name} ${row.patient_last_name}`,
        specialtyName: row.specialty_name,
        professionalCenterId:
          "professional_center_id" in row ? row.professional_center_id : ownProfessionalCenterId!,
        professionalName:
          "professional_first_name" in row
            ? `${row.professional_first_name} ${row.professional_last_name}`
            : "Mi agenda",
      });
    }
    if (!result.hasMore) return rows;
    if (!result.nextCursor || (cursor && result.nextCursor.id === cursor.id))
      throw new Error("AGENDA_PAGINATION_INCOMPLETE");
    cursor = result.nextCursor;
  }
  throw new Error("AGENDA_PAGE_LIMIT");
}
