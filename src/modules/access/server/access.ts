import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  buildAccessibleCenters,
  determineAccessDestination,
  type AccessibleCenter,
} from "../domain/access-routing";
import { requireUser, type UserContext } from "./authorization";

type ServerClient = SupabaseClient<Database>;

export type AccessOverview = {
  centers: AccessibleCenter[];
  isPlatformAdmin: boolean | null;
  user: UserContext;
};

async function serverClient(client?: ServerClient) {
  return client ?? createSupabaseServerClient();
}

export async function listAccessibleCentersForUser(
  userId: string,
  supabase: ServerClient,
): Promise<AccessibleCenter[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("center_memberships")
    .select("id, center_id, role, professional_center_id, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (membershipError) throw membershipError;
  if (!memberships || memberships.length === 0) return [];

  const centerIds = memberships.map((membership) => membership.center_id);
  const { data: centers, error: centersError } = await supabase
    .from("centers")
    .select("id, name, timezone, is_active")
    .in("id", centerIds)
    .eq("is_active", true);

  if (centersError) throw centersError;

  return buildAccessibleCenters(
    memberships.map((membership) => ({
      centerId: membership.center_id,
      id: membership.id,
      isActive: membership.is_active,
      professionalCenterId: membership.professional_center_id,
      role: membership.role,
    })),
    (centers ?? []).map((center) => ({
      id: center.id,
      isActive: center.is_active,
      name: center.name,
      timezone: center.timezone,
    })),
  );
}

export async function hasPlatformAdminRole(
  userId: string,
  client?: ServerClient,
): Promise<boolean> {
  const supabase = await serverClient(client);
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function hasOptionalPlatformNavigation(
  userId: string,
  client?: ServerClient,
): Promise<boolean> {
  try {
    return await hasPlatformAdminRole(userId, client);
  } catch {
    return false;
  }
}

export async function getAccessOverview(client?: ServerClient): Promise<AccessOverview> {
  const supabase = await serverClient(client);
  const user = await requireUser(supabase);
  const [centersResult, platformAdminResult] = await Promise.allSettled([
    listAccessibleCentersForUser(user.id, supabase),
    hasPlatformAdminRole(user.id, supabase),
  ]);

  if (centersResult.status === "rejected") throw centersResult.reason;
  const centers = centersResult.value;
  if (platformAdminResult.status === "rejected" && centers.length === 0) {
    throw platformAdminResult.reason;
  }

  const isPlatformAdmin =
    platformAdminResult.status === "fulfilled" ? platformAdminResult.value : null;

  return { centers, isPlatformAdmin, user };
}

export async function getPostLoginDestination(client?: ServerClient): Promise<string> {
  const overview = await getAccessOverview(client);
  return determineAccessDestination(overview);
}
