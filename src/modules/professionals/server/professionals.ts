import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/modules/access/server/authorization";
import { createProfessionalWithCenterSchema } from "../schemas/create-professional-with-center";
import {
  linkProfessionalSchema,
  professionalCenterIdSchema,
  resolveProfessionalSchema,
  setProfessionalCenterActiveSchema,
  updateProfessionalCenterSchema,
} from "../schemas/professional-center";

type ServerClient = SupabaseClient<Database>;

export type ProfessionalListItem = {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string | null;
  usualAppointmentDurationMinutes: number;
  isActive: boolean;
  updatedAt: string;
};

export type ProfessionalSpecialtyOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ProfessionalSpecialtyAssociation = {
  professionalCenterId: string;
  specialtyId: string;
  isActive: boolean;
};

export async function listProfessionalSpecialtyConfiguration(
  centerId: string,
  client?: ServerClient,
) {
  const parsedCenterId = professionalCenterIdSchema.parse(centerId);
  const supabase = await authorizedClient(parsedCenterId, client);
  const [specialtiesResult, associationsResult] = await Promise.all([
    supabase.from("specialties").select("id, name, is_active").eq("center_id", parsedCenterId),
    supabase
      .from("professional_center_specialties")
      .select("professional_center_id, specialty_id, is_active")
      .eq("center_id", parsedCenterId),
  ]);
  if (specialtiesResult.error) throw specialtiesResult.error;
  if (associationsResult.error) throw associationsResult.error;
  const specialties: ProfessionalSpecialtyOption[] = (specialtiesResult.data ?? [])
    .map((row) => ({ id: row.id, name: row.name, isActive: row.is_active }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const visibleIds = new Set(specialties.map((specialty) => specialty.id));
  const associations: ProfessionalSpecialtyAssociation[] = (associationsResult.data ?? []).map(
    (row) => {
      if (!visibleIds.has(row.specialty_id)) throw new Error("SPECIALTY_NOT_VISIBLE");
      return {
        professionalCenterId: row.professional_center_id,
        specialtyId: row.specialty_id,
        isActive: row.is_active,
      };
    },
  );
  return { specialties, associations };
}

async function authorizedClient(centerId: string, client?: ServerClient) {
  const supabase = client ?? (await createSupabaseServerClient());
  await requireRole(centerId, ["ADMIN"], supabase);
  return supabase;
}

export async function listProfessionals(centerId: string, client?: ServerClient) {
  const parsedCenterId = professionalCenterIdSchema.parse(centerId);
  const supabase = await authorizedClient(parsedCenterId, client);
  const { data: centers, error: centersError } = await supabase
    .from("professional_centers")
    .select(
      "id, professional_id, license_number, usual_appointment_duration_minutes, is_active, updated_at",
    )
    .eq("center_id", parsedCenterId);
  if (centersError) throw centersError;
  if (!centers?.length) return [];

  const ids = centers.map((center) => center.professional_id);
  const { data: professionals, error: professionalsError } = await supabase
    .from("professionals")
    .select("id, first_name, last_name")
    .in("id", ids);
  if (professionalsError) throw professionalsError;
  // Fail closed if an expected identity is not visible under RLS.
  if (professionals?.length !== new Set(ids).size)
    throw new Error("PROFESSIONAL_IDENTITY_NOT_VISIBLE");
  const names = new Map(professionals.map((professional) => [professional.id, professional]));
  return centers
    .map((center): ProfessionalListItem => {
      const professional = names.get(center.professional_id);
      if (!professional) throw new Error("PROFESSIONAL_IDENTITY_NOT_VISIBLE");
      return {
        id: center.id,
        firstName: professional.first_name,
        lastName: professional.last_name,
        licenseNumber: center.license_number,
        usualAppointmentDurationMinutes: center.usual_appointment_duration_minutes,
        isActive: center.is_active,
        updatedAt: center.updated_at,
      };
    })
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"),
    );
}

export async function resolveProfessional(
  input: z.input<typeof resolveProfessionalSchema>,
  client?: ServerClient,
) {
  const parsed = resolveProfessionalSchema.parse(input);
  const supabase = await authorizedClient(parsed.centerId, client);
  const { data, error } = await supabase
    .rpc("admin_resolve_professional_by_document", {
      p_center_id: parsed.centerId,
      p_nationality_code: parsed.nationalityCode,
      p_document_number: parsed.documentNumber,
    })
    .single();
  if (error) throw error;
  return data;
}

export async function createProfessional(
  input: z.input<typeof createProfessionalWithCenterSchema>,
  client?: ServerClient,
) {
  const parsed = createProfessionalWithCenterSchema.parse(input);
  const supabase = await authorizedClient(parsed.centerId, client);
  const { data, error } = await supabase
    .rpc("admin_create_professional_with_center", {
      p_center_id: parsed.centerId,
      p_first_name: parsed.firstName,
      p_last_name: parsed.lastName,
      p_nationality_code: parsed.nationalityCode,
      p_document_number: parsed.documentNumber,
      p_email: parsed.email,
      p_phone: parsed.phone ?? "",
      p_license_number: parsed.licenseNumber ?? "",
      p_usual_appointment_duration_minutes: parsed.usualAppointmentDurationMinutes,
    })
    .single();
  if (error) throw error;
  return data;
}

export async function linkProfessional(
  input: z.input<typeof linkProfessionalSchema>,
  client?: ServerClient,
) {
  const parsed = linkProfessionalSchema.parse(input);
  const supabase = await authorizedClient(parsed.centerId, client);
  const { data, error } = await supabase
    .rpc("admin_link_professional_to_center", {
      p_center_id: parsed.centerId,
      p_professional_id: parsed.professionalId,
      p_nationality_code: parsed.nationalityCode,
      p_document_number: parsed.documentNumber,
      p_expected_professional_center_updated_at: parsed.expectedProfessionalCenterUpdatedAt!,
    })
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfessionalCenter(
  input: z.input<typeof updateProfessionalCenterSchema>,
  client?: ServerClient,
) {
  const parsed = updateProfessionalCenterSchema.parse(input);
  const supabase = await authorizedClient(parsed.centerId, client);
  const { data, error } = await supabase
    .rpc("admin_update_professional_center", {
      p_center_id: parsed.centerId,
      p_professional_center_id: parsed.professionalCenterId,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_license_number: parsed.licenseNumber ?? "",
      p_usual_appointment_duration_minutes: parsed.usualAppointmentDurationMinutes,
    })
    .single();
  if (error) throw error;
  return data;
}

export async function setProfessionalCenterActive(
  input: z.input<typeof setProfessionalCenterActiveSchema>,
  client?: ServerClient,
) {
  const parsed = setProfessionalCenterActiveSchema.parse(input);
  const supabase = await authorizedClient(parsed.centerId, client);
  const { data, error } = await supabase
    .rpc("admin_set_professional_center_active", {
      p_center_id: parsed.centerId,
      p_professional_center_id: parsed.professionalCenterId,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_is_active: parsed.isActive,
    })
    .single();
  if (error) throw error;
  return data;
}
