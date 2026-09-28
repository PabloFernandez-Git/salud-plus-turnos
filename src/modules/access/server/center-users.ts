import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const centerIdSchema = z.uuid();

function relationNotVisible(): never {
  throw new Error("No se pudo completar la lectura de usuarios del centro.");
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
