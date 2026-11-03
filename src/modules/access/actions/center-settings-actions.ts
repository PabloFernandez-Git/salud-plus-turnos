"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { requireRole } from "../server/authorization";
import { assertPortfolioWriteAllowed } from "../server/portfolio-demo";
import { getCenterSettings } from "../server/center-settings";
import { performUpdateCenterSettingsAction } from "../server/center-settings-action";

export async function loadCenterSettingsAction(centerId: string) {
  const parsed = z.uuid().parse(centerId);
  const client = await createSupabaseServerClient();
  await requireRole(parsed, ["ADMIN"], client);
  return getCenterSettings(parsed, client);
}

export async function updateCenterSettingsAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performUpdateCenterSettingsAction(formData, {
    revalidate: (centerId) => {
      revalidatePath(`/centers/${centerId}/settings`);
      revalidatePath(`/centers/${centerId}`, "layout");
    },
  });
}
