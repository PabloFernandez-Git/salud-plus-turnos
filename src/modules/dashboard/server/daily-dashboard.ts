import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import {
  AuthorizationError,
  requireCenterMembership,
  requireProfessionalContext,
} from "@/modules/access/server/authorization";
import { callDailyDashboardRpc } from "../api/daily-dashboard-rpc";

export async function getDailyDashboard(centerId: unknown, client: SupabaseClient<Database>) {
  const id = z.uuid().parse(centerId);
  const context = await requireCenterMembership(id, client);
  const role = context.membership.role;
  if (role !== "ADMIN" && role !== "RECEPTION" && role !== "PROFESSIONAL")
    throw new AuthorizationError("ROLE_FORBIDDEN");
  if (role === "PROFESSIONAL") await requireProfessionalContext(id, client);
  try {
    const result = await callDailyDashboardRpc(
      client,
      role === "PROFESSIONAL" ? "professional" : "staff",
      id,
    );
    // The RPC reads the authorized center in its own snapshot. A changed timezone or membership
    // during the guard is handled by PostgreSQL; this check detects a stale center context.
    if (result.row.timezone !== context.center.timezone)
      throw new Error("Dashboard center changed");
    return { ...result, membershipId: context.membership.id, role };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42501")
      throw new AuthorizationError("CENTER_ACCESS_DENIED");
    throw error;
  }
}
