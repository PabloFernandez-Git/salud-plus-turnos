import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { requirePlatformAdmin, requireRole } from "./authorization";

type ServerClient = SupabaseClient<Database>;

export type PlatformCenterSummary =
  Database["public"]["Functions"]["platform_list_centers"]["Returns"][number];

export type PlatformIdentityResolution =
  Database["public"]["Functions"]["platform_resolve_user_by_email"]["Returns"][number];

const centerStatusSchema = z.object({ centerId: z.uuid(), isActive: z.boolean() });
const membershipUpdateSchema = z
  .object({
    centerId: z.uuid(),
    membershipId: z.uuid(),
    expectedRole: z.enum(["ADMIN", "RECEPTION", "PROFESSIONAL"]),
    expectedProfessionalCenterId: z.uuid().nullable(),
    expectedIsActive: z.boolean(),
    role: z.enum(["ADMIN", "RECEPTION", "PROFESSIONAL"]),
    professionalCenterId: z.uuid().nullable(),
    isActive: z.boolean(),
  })
  .superRefine((value, context) => {
    const shouldHaveProfessional = value.role === "PROFESSIONAL";
    if (shouldHaveProfessional !== (value.professionalCenterId !== null)) {
      context.addIssue({
        code: "custom",
        message: "El vínculo profesional no coincide con el rol.",
        path: ["professionalCenterId"],
      });
    }
  });

export class CenterMembershipMutationError extends Error {
  readonly code: "NOT_FOUND" | "STALE";

  constructor(code: "NOT_FOUND" | "STALE") {
    super(code);
    this.name = "CenterMembershipMutationError";
    this.code = code;
  }
}

export async function listPlatformCenters(client?: ServerClient) {
  const supabase = client ?? (await createSupabaseServerClient());
  await requirePlatformAdmin(supabase);
  const { data, error } = await supabase.rpc("platform_list_centers");
  if (error) throw error;
  return data;
}

export async function resolvePlatformIdentityByEmail(email: string, client?: ServerClient) {
  const supabase = client ?? (await createSupabaseServerClient());
  await requirePlatformAdmin(supabase);
  const { data, error } = await supabase
    .rpc("platform_resolve_user_by_email", { p_email: email })
    .single();
  if (error) throw error;
  return data as PlatformIdentityResolution;
}

export async function setCenterActive(
  input: z.input<typeof centerStatusSchema>,
  client?: ServerClient,
) {
  const parsed = centerStatusSchema.parse(input);
  const supabase = client ?? (await createSupabaseServerClient());
  await requirePlatformAdmin(supabase);
  const { data, error } = await supabase
    .rpc("platform_set_center_active", {
      p_center_id: parsed.centerId,
      p_is_active: parsed.isActive,
    })
    .single();
  if (error) throw error;
  return data;
}

export async function setCenterMembership(
  input: z.input<typeof membershipUpdateSchema>,
  client?: ServerClient,
) {
  const parsed = membershipUpdateSchema.parse(input);
  const supabase = client ?? (await createSupabaseServerClient());
  const context = await requireRole(parsed.centerId, ["ADMIN"], supabase);
  const { data: target, error: targetError } = await supabase
    .from("center_memberships")
    .select("id, user_id, role, professional_center_id, is_active")
    .eq("id", parsed.membershipId)
    .eq("center_id", parsed.centerId)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) throw new CenterMembershipMutationError("NOT_FOUND");
  if (
    target.role !== parsed.expectedRole ||
    target.professional_center_id !== parsed.expectedProfessionalCenterId ||
    target.is_active !== parsed.expectedIsActive
  ) {
    throw new CenterMembershipMutationError("STALE");
  }

  const { data, error } = await supabase
    .rpc("admin_set_center_membership", {
      p_center_id: parsed.centerId,
      p_expected_is_active: parsed.expectedIsActive,
      p_expected_professional_center_id: parsed.expectedProfessionalCenterId as string,
      p_expected_role: parsed.expectedRole,
      p_is_active: parsed.isActive,
      p_membership_id: parsed.membershipId,
      p_professional_center_id: parsed.professionalCenterId as string,
      p_role: parsed.role,
    })
    .single();
  if (error?.code === "P0001" && error.message === "STALE_MEMBERSHIP_STATE") {
    throw new CenterMembershipMutationError("STALE");
  }
  if (error) throw error;
  return {
    actorUserId: context.user.id,
    membership: data,
    targetUserId: target.user_id,
  };
}
