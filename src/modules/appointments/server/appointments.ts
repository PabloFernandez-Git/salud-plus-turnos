import "server-only";

import { z } from "zod";
import { requireProfessionalContext, requireRole } from "@/modules/access/server/authorization";
import { listPatientCenters } from "@/modules/patients/server/patients";
import {
  appointmentDetailSchema,
  bookableProfessionalsSchema,
  bookableSpecialtiesSchema,
  canTransitionStatus,
  createAppointmentSchema,
  noteUpdateSchema,
  professionalListSchema,
  rescheduleAppointmentSchema,
  searchSlotsSchema,
  staffListSchema,
  statusTransitionSchema,
} from "../schemas/appointment-input";
import {
  createAppointment,
  getProfessionalAppointment,
  getStaffAppointment,
  listBookableProfessionals,
  listBookableSpecialties,
  listProfessionalAppointments,
  listStaffAppointments,
  rescheduleAppointment,
  searchAppointmentSlots,
  transitionAppointmentStatus,
  updateAppointmentNote,
  type AppointmentClient,
} from "./appointment-rpc";

export const appointmentOperationSchemas = {
  list: staffListSchema,
  detail: appointmentDetailSchema,
  specialties: bookableSpecialtiesSchema,
  professionals: bookableProfessionalsSchema,
  slots: searchSlotsSchema,
  create: createAppointmentSchema,
  reschedule: rescheduleAppointmentSchema,
  status: statusTransitionSchema,
  note: noteUpdateSchema,
  patientSearch: z.strictObject({
    centerId: z.uuid(),
    query: z.string().max(100),
    page: z.number().int().min(1).max(401).default(1),
  }),
  patientSelection: z.strictObject({ centerId: z.uuid(), patientCenterId: z.uuid() }),
  reconcileCreate: createAppointmentSchema
    .pick({
      centerId: true,
      patientCenterId: true,
      professionalCenterId: true,
      specialtyId: true,
      localDate: true,
    })
    .extend({
      startsAt: z.iso.datetime({ offset: true }),
      endsAt: z.iso.datetime({ offset: true }),
    }),
} as const;
export type AppointmentOperation = keyof typeof appointmentOperationSchemas;
const staffRoles = ["ADMIN", "RECEPTION"] as const;
const allRoles = ["ADMIN", "RECEPTION", "PROFESSIONAL"] as const;

export async function listAppointments(input: unknown, client: AppointmentClient) {
  const centerId = z.uuid().parse((input as { centerId?: unknown })?.centerId);
  const context = await requireRole(centerId, allRoles, client);
  if (context.membership.role === "PROFESSIONAL") {
    await requireProfessionalContext(centerId, client);
    const value = professionalListSchema.parse(input);
    const rows = await listProfessionalAppointments(client, {
      p_center_id: value.centerId,
      p_from_date: value.fromDate,
      p_to_date: value.toDate,
      p_status: value.status,
      p_limit: value.limit,
      p_cursor_id: value.cursor?.id,
      p_cursor_starts_at: value.cursor?.startsAt,
    });
    return {
      kind: "PROFESSIONAL" as const,
      rows,
      hasMore: rows[0]?.has_more ?? false,
      nextCursor: rows.length
        ? { id: rows.at(-1)!.appointment_id, startsAt: rows.at(-1)!.starts_at }
        : null,
    };
  }
  const value = staffListSchema.parse(input);
  const rows = await listStaffAppointments(client, {
    p_center_id: value.centerId,
    p_from_date: value.fromDate,
    p_to_date: value.toDate,
    p_status: value.status,
    p_professional_center_id: value.professionalCenterId,
    p_limit: value.limit,
    p_cursor_id: value.cursor?.id,
    p_cursor_starts_at: value.cursor?.startsAt,
  });
  return {
    kind: "STAFF" as const,
    rows,
    hasMore: rows[0]?.has_more ?? false,
    nextCursor: rows.length
      ? { id: rows.at(-1)!.appointment_id, startsAt: rows.at(-1)!.starts_at }
      : null,
  };
}

export async function getAppointment(input: unknown, client: AppointmentClient) {
  const value = appointmentDetailSchema.parse(input);
  const context = await requireRole(value.centerId, allRoles, client);
  if (context.membership.role === "PROFESSIONAL") {
    await requireProfessionalContext(value.centerId, client);
    return {
      kind: "PROFESSIONAL" as const,
      appointment: await getProfessionalAppointment(client, {
        p_center_id: value.centerId,
        p_appointment_id: value.appointmentId,
      }),
    };
  }
  return {
    kind: "STAFF" as const,
    appointment: await getStaffAppointment(client, {
      p_center_id: value.centerId,
      p_appointment_id: value.appointmentId,
    }),
  };
}

export async function getBookableSpecialties(input: unknown, client: AppointmentClient) {
  const value = bookableSpecialtiesSchema.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  return listBookableSpecialties(client, { p_center_id: value.centerId });
}
export async function getBookableProfessionals(input: unknown, client: AppointmentClient) {
  const value = bookableProfessionalsSchema.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  return listBookableProfessionals(client, {
    p_center_id: value.centerId,
    p_specialty_id: value.specialtyId,
  });
}
export async function getAppointmentSlots(input: unknown, client: AppointmentClient) {
  const value = searchSlotsSchema.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  return searchAppointmentSlots(client, {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_specialty_id: value.specialtyId,
    p_local_date: value.localDate,
  });
}

export async function addAppointment(input: unknown, client: AppointmentClient) {
  const value = createAppointmentSchema.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  return createAppointment(client, {
    p_center_id: value.centerId,
    p_patient_center_id: value.patientCenterId,
    p_professional_center_id: value.professionalCenterId,
    p_specialty_id: value.specialtyId,
    p_local_date: value.localDate,
    p_local_start_time: value.localStartTime,
    p_administrative_note: value.administrativeNote ?? undefined,
  });
}

// A bounded, read-only search can identify a matching committed row. Absence is
// never proof that CREATE rolled back, so this operation never authorizes retry.
export async function reconcileAppointmentCreate(input: unknown, client: AppointmentClient) {
  const value = appointmentOperationSchemas.reconcileCreate.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  let cursor: { startsAt: string; id: string } | undefined;
  let matchId: string | null = null;
  for (let page = 0; page < 3; page++) {
    const rows = await listStaffAppointments(client, {
      p_center_id: value.centerId,
      p_from_date: value.localDate,
      p_to_date: value.localDate,
      p_status: undefined,
      p_professional_center_id: value.professionalCenterId,
      p_limit: 50,
      p_cursor_id: cursor?.id,
      p_cursor_starts_at: cursor?.startsAt,
    });
    for (const row of rows) {
      if (row.starts_at !== value.startsAt) continue;
      const detail = await getStaffAppointment(client, {
        p_center_id: value.centerId,
        p_appointment_id: row.appointment_id,
      });
      if (
        detail &&
        detail.status !== "CANCELLED" &&
        detail.patient_center_id === value.patientCenterId &&
        detail.professional_center_id === value.professionalCenterId &&
        detail.specialty_id === value.specialtyId &&
        detail.starts_at === value.startsAt &&
        detail.ends_at === value.endsAt
      ) {
        if (matchId) return { kind: "INCONCLUSIVE" as const };
        matchId = detail.appointment_id;
      }
    }
    if (!rows[0]?.has_more || rows.length === 0)
      return matchId
        ? { kind: "MATCH" as const, appointmentId: matchId }
        : { kind: "INCONCLUSIVE" as const };
    cursor = { startsAt: rows.at(-1)!.starts_at, id: rows.at(-1)!.appointment_id };
  }
  return { kind: "INCONCLUSIVE" as const };
}
export async function moveAppointment(input: unknown, client: AppointmentClient) {
  const value = rescheduleAppointmentSchema.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  return rescheduleAppointment(client, {
    p_center_id: value.centerId,
    p_appointment_id: value.appointmentId,
    p_expected_updated_at: value.expectedUpdatedAt,
    p_professional_center_id: value.professionalCenterId,
    p_specialty_id: value.specialtyId,
    p_local_date: value.localDate,
    p_local_start_time: value.localStartTime,
  });
}
export async function changeAppointmentStatus(input: unknown, client: AppointmentClient) {
  const value = statusTransitionSchema.parse(input);
  const context = await requireRole(value.centerId, allRoles, client);
  const role = context.membership.role;
  if (role === "PROFESSIONAL") await requireProfessionalContext(value.centerId, client);
  const current =
    role === "PROFESSIONAL"
      ? await getProfessionalAppointment(client, {
          p_center_id: value.centerId,
          p_appointment_id: value.appointmentId,
        })
      : await getStaffAppointment(client, {
          p_center_id: value.centerId,
          p_appointment_id: value.appointmentId,
        });
  if (!current) return { kind: "NOT_FOUND" as const };
  if (current.updated_at !== value.expectedUpdatedAt) return { kind: "STALE" as const };
  if (!canTransitionStatus(current.status, value.requestedStatus, role))
    return { kind: "INVALID_TRANSITION" as const };
  const result = await transitionAppointmentStatus(client, {
    p_center_id: value.centerId,
    p_appointment_id: value.appointmentId,
    p_expected_updated_at: value.expectedUpdatedAt,
    p_requested_status: value.requestedStatus,
  });
  return { kind: "CHANGED" as const, result };
}
export async function editAppointmentNote(input: unknown, client: AppointmentClient) {
  const value = noteUpdateSchema.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  return updateAppointmentNote(client, {
    p_center_id: value.centerId,
    p_appointment_id: value.appointmentId,
    p_expected_updated_at: value.expectedUpdatedAt,
    p_administrative_note: value.administrativeNote,
  });
}

// TASK-007 owns identity, registration and tenant search. Appointments only exposes
// a minimal selectable projection; PostgreSQL revalidates the ID during CREATE.
export async function searchAppointmentPatients(input: unknown, client: AppointmentClient) {
  const value = appointmentOperationSchemas.patientSearch.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  const page = await listPatientCenters(
    value.centerId,
    { query: value.query, state: "ACTIVE", page: value.page },
    client,
  );
  return {
    rows: page.rows.map((row) => ({
      patientCenterId: row.patient_center_id,
      firstName: row.first_name,
      lastName: row.last_name,
    })),
    page: page.page,
    hasNext: page.hasNext,
  };
}
export async function resolveAppointmentPatientSelection(
  input: unknown,
  client: AppointmentClient,
) {
  const value = appointmentOperationSchemas.patientSelection.parse(input);
  await requireRole(value.centerId, staffRoles, client);
  const { data, error } = await client
    .from("patient_centers")
    .select("id")
    .eq("id", value.patientCenterId)
    .eq("center_id", value.centerId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data ? { patientCenterId: data.id } : null;
}
