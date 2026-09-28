import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthorizationErrorCode =
  | "UNAUTHENTICATED"
  | "PROFILE_NOT_PROVISIONED"
  | "PLATFORM_FORBIDDEN"
  | "CENTER_ACCESS_DENIED"
  | "ROLE_FORBIDDEN"
  | "PROFESSIONAL_CONTEXT_MISSING";

const errorRedirects: Record<AuthorizationErrorCode, string> = {
  UNAUTHENTICATED: "/login",
  PROFILE_NOT_PROVISIONED: "/no-access",
  PLATFORM_FORBIDDEN: "/no-access",
  CENTER_ACCESS_DENIED: "/no-access",
  ROLE_FORBIDDEN: "/no-access",
  PROFESSIONAL_CONTEXT_MISSING: "/no-access",
};

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;
  readonly redirectTo: string;

  constructor(code: AuthorizationErrorCode) {
    super(code);
    this.name = "AuthorizationError";
    this.code = code;
    this.redirectTo = errorRedirects[code];
  }
}

type ServerClient = SupabaseClient<Database>;
type MembershipRole = Database["public"]["Enums"]["membership_role"];

export type UserContext = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AuthenticatedIdentity = {
  id: string;
  email: string | null;
};

export type CenterMembershipContext = {
  center: {
    id: string;
    name: string;
    timezone: string;
  };
  membership: {
    id: string;
    professionalCenterId: string | null;
    role: MembershipRole;
  };
  user: UserContext;
};

async function serverClient(client?: ServerClient) {
  return client ?? createSupabaseServerClient();
}

export async function requireUser(client?: ServerClient): Promise<UserContext> {
  const supabase = await serverClient(client);
  const identity = await requireAuthenticatedIdentity(supabase);

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, email, first_name, last_name")
    .eq("id", identity.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new AuthorizationError("PROFILE_NOT_PROVISIONED");
  }

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
  };
}

export async function requireAuthenticatedIdentity(
  client?: ServerClient,
): Promise<AuthenticatedIdentity> {
  const supabase = await serverClient(client);
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (claimsError || typeof userId !== "string" || !userId) {
    throw new AuthorizationError("UNAUTHENTICATED");
  }

  const claimedEmail = claimsData.claims.email;

  return {
    id: userId,
    email: typeof claimedEmail === "string" ? claimedEmail : null,
  };
}

export async function requirePlatformAdmin(client?: ServerClient): Promise<UserContext> {
  const supabase = await serverClient(client);
  const user = await requireUser(supabase);
  const { data: platformAdmin, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !platformAdmin) {
    throw new AuthorizationError("PLATFORM_FORBIDDEN");
  }

  return user;
}

export async function requireCenterMembership(
  centerId: string,
  client?: ServerClient,
): Promise<CenterMembershipContext> {
  const supabase = await serverClient(client);
  const user = await requireUser(supabase);

  const { data: membership, error: membershipError } = await supabase
    .from("center_memberships")
    .select("id, center_id, role, professional_center_id")
    .eq("center_id", centerId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new AuthorizationError("CENTER_ACCESS_DENIED");
  }

  const { data: center, error: centerError } = await supabase
    .from("centers")
    .select("id, name, timezone")
    .eq("id", centerId)
    .eq("is_active", true)
    .maybeSingle();

  if (centerError || !center) {
    throw new AuthorizationError("CENTER_ACCESS_DENIED");
  }

  return {
    center,
    membership: {
      id: membership.id,
      professionalCenterId: membership.professional_center_id,
      role: membership.role,
    },
    user,
  };
}

export async function requireRole(
  centerId: string,
  allowedRoles: readonly MembershipRole[],
  client?: ServerClient,
): Promise<CenterMembershipContext> {
  const context = await requireCenterMembership(centerId, client);

  if (!allowedRoles.includes(context.membership.role)) {
    throw new AuthorizationError("ROLE_FORBIDDEN");
  }

  return context;
}

export async function requireProfessionalContext(centerId: string, client?: ServerClient) {
  const supabase = await serverClient(client);
  const context = await requireRole(centerId, ["PROFESSIONAL"], supabase);
  const professionalCenterId = context.membership.professionalCenterId;

  if (!professionalCenterId) {
    throw new AuthorizationError("PROFESSIONAL_CONTEXT_MISSING");
  }

  const { data: professionalCenter, error } = await supabase
    .from("professional_centers")
    .select("id, professional_id")
    .eq("id", professionalCenterId)
    .eq("center_id", centerId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !professionalCenter) {
    throw new AuthorizationError("PROFESSIONAL_CONTEXT_MISSING");
  }

  return {
    ...context,
    professional: {
      id: professionalCenter.professional_id,
      professionalCenterId: professionalCenter.id,
    },
  };
}
