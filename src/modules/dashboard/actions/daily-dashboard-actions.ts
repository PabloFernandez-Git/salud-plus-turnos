"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { getDailyDashboard } from "../server/daily-dashboard";

export async function refreshDailyDashboardAction(centerId: string) {
  try {
    const client = await createSupabaseServerClient();
    return { status: "success" as const, data: await getDailyDashboard(centerId, client) };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        status: "denied" as const,
        message: "Tu acceso a este centro cambió. Actualizá la página.",
      };
    }
    return {
      status: "error" as const,
      message: "No pudimos cargar la actividad. Intentá de nuevo.",
    };
  }
}
