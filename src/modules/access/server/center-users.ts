import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centerUserIdentityEmailSchema } from "@/modules/access/schemas/center-user-provisioning";

import { requireRole } from "./authorization";

type ServerClient = SupabaseClient<Database>;
type MembershipRole = Database["public"]["Enums"]["membership_role"];

export type CenterUserListItem = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: MembershipRole;
  isActive: boolean;
  professional: {
    firstName: string;
    lastName: string;
    licenseNumber: string | null;
    isActive: boolean;
  } | null;
};

export type CenterIdentityResolution = {
  center_membership_exists: boolean;
  center_membership_is_active: boolean | null;
  email: string | null;
  first_name: string | null;
  identity_exists: boolean;
  last_name: string | null;
  user_id: string | null;
};

export type AvailableProfessionalCenter = {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string | null;
};

const centerIdSchema = z.uuid();

function relationNotVisible(): never {
  throw new Error("No se pudo completar la lectura de usuarios del centro.");
}

export async function resolveCenterIdentityByEmail(
  centerId: string,
  email: string,
  client?: ServerClient,
) {
  const parsed = centerUserIdentityEmailSchema.parse({ centerId, email });
  const supabase = client ?? (await createSupabaseServerClient());

  await requireRole(parsed.centerId, ["ADMIN"], supabase);

  const { data, error } = await supabase
    .rpc("admin_resolve_user_by_email", {
      p_center_id: parsed.centerId,
      p_email: parsed.email,
    })
    .single();

  if (error) throw error;
  return data as CenterIdentityResolution;
}

export async function listAvailableProfessionalCenters(centerId: string, client?: ServerClient) {
  const parsedCenterId = centerIdSchema.parse(centerId);
  const supabase = client ?? (await createSupabaseServerClient());

  await requireRole(parsedCenterId, ["ADMIN"], supabase);

  const { data: professionalCenters, error: professionalCentersError } = await supabase
    .from("professional_centers")
    .select("id, center_id, professional_id, license_number")
    .eq("center_id", parsedCenterId)
    .eq("is_active", true);

  if (professionalCentersError) throw professionalCentersError;
  if (!professionalCenters || professionalCenters.length === 0) return [];

  const professionalCenterIds = professionalCenters.map(
    (professionalCenter) => professionalCenter.id,
  );
  const { data: activeMemberships, error: membershipsError } = await supabase
    .from("center_memberships")
    .select("professional_center_id")
    .eq("center_id", parsedCenterId)
    .eq("role", "PROFESSIONAL")
    .eq("is_active", true)
    .in("professional_center_id", professionalCenterIds);

  if (membershipsError) throw membershipsError;

  const occupiedIds = new Set(
    (activeMemberships ?? []).flatMap((membership) =>
      membership.professional_center_id ? [membership.professional_center_id] : [],
    ),
  );
  const available = professionalCenters.filter(
    (professionalCenter) => !occupiedIds.has(professionalCenter.id),
  );
  if (available.length === 0) return [];

  const professionalIds = [
    ...new Set(available.map((professionalCenter) => professionalCenter.professional_id)),
  ];
  const { data: professionals, error: professionalsError } = await supabase
    .from("professionals")
    .select("id, first_name, last_name")
    .in("id", professionalIds);

  if (professionalsError) throw professionalsError;

  const professionalsById = new Map(
    (professionals ?? []).map((professional) => [professional.id, professional]),
  );

  return available
    .map<AvailableProfessionalCenter>((professionalCenter) => {
      const professional =
        professionalsById.get(professionalCenter.professional_id) ?? relationNotVisible();
      return {
        id: professionalCenter.id,
        firstName: professional.first_name,
        lastName: professional.last_name,
        licenseNumber: professionalCenter.license_number,
      };
    })
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
        "es",
      ),
    );
}

export async function listCenterUsers(centerId: string, client?: ServerClient) {
  const parsedCenterId = centerIdSchema.parse(centerId);
  const supabase = client ?? (await createSupabaseServerClient());

  await requireRole(parsedCenterId, ["ADMIN"], supabase);

  const { data: memberships, error: membershipsError } = await supabase
    .from("center_memberships")
    .select("id, center_id, user_id, role, is_active, professional_center_id")
    .eq("center_id", parsedCenterId);

  if (membershipsError) throw membershipsError;
  if (!memberships || memberships.length === 0) return [];

  const userIds = [...new Set(memberships.map((membership) => membership.user_id))];
  const professionalCenterIds = [
    ...new Set(
      memberships.flatMap((membership) =>
        membership.professional_center_id ? [membership.professional_center_id] : [],
      ),
    ),
  ];

  const usersPromise = supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .in("id", userIds);
  const professionalCentersPromise =
    professionalCenterIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("professional_centers")
          .select("id, center_id, professional_id, license_number, is_active")
          .eq("center_id", parsedCenterId)
          .in("id", professionalCenterIds);

  const [usersResult, professionalCentersResult] = await Promise.all([
    usersPromise,
    professionalCentersPromise,
  ]);

  if (usersResult.error) throw usersResult.error;
  if (professionalCentersResult.error) throw professionalCentersResult.error;

  const usersById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));
  const professionalCentersById = new Map(
    (professionalCentersResult.data ?? []).map((professionalCenter) => [
      professionalCenter.id,
      professionalCenter,
    ]),
  );
  const professionalIds = [
    ...new Set(
      (professionalCentersResult.data ?? []).map(
        (professionalCenter) => professionalCenter.professional_id,
      ),
    ),
  ];

  const professionalsById = new Map<
    string,
    { id: string; first_name: string; last_name: string }
  >();

  if (professionalIds.length > 0) {
    const { data: professionals, error: professionalsError } = await supabase
      .from("professionals")
      .select("id, first_name, last_name")
      .in("id", professionalIds);

    if (professionalsError) throw professionalsError;
    for (const professional of professionals ?? []) {
      professionalsById.set(professional.id, professional);
    }
  }

  return memberships
    .map<CenterUserListItem>((membership) => {
      const user = usersById.get(membership.user_id) ?? relationNotVisible();
      const professionalCenterId = membership.professional_center_id;

      if (!professionalCenterId) {
        return {
          id: membership.id,
          userId: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: membership.role,
          isActive: membership.is_active,
          professional: null,
        };
      }

      const professionalCenter =
        professionalCentersById.get(professionalCenterId) ?? relationNotVisible();
      const professional =
        professionalsById.get(professionalCenter.professional_id) ?? relationNotVisible();

      return {
        id: membership.id,
        userId: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: membership.role,
        isActive: membership.is_active,
        professional: {
          firstName: professional.first_name,
          lastName: professional.last_name,
          licenseNumber: professionalCenter.license_number,
          isActive: professionalCenter.is_active,
        },
      };
    })
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
        "es",
      ),
    );
}
