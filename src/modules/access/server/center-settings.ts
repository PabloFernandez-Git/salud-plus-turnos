import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CenterInstitutionalFields } from "../schemas/center-institutional";

type ServerClient = SupabaseClient<Database>;

export type CenterSettings = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  updatedAt: string;
};

export type PersistedCenterSettings = Omit<CenterSettings, "timezone">;

export class CenterSettingsConflictError extends Error {
  constructor() {
    super("STALE_CENTER_SETTINGS");
    this.name = "CenterSettingsConflictError";
  }
}

export async function getCenterSettings(centerId: string, client?: ServerClient) {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("centers")
    .select("id, name, phone, email, address, timezone, updated_at")
    .eq("id", centerId)
    .eq("is_active", true)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    timezone: data.timezone,
    updatedAt: data.updated_at,
  } satisfies CenterSettings;
}

export async function updateCenterSettings(
  input: CenterInstitutionalFields & { centerId: string; expectedUpdatedAt: string },
  client?: ServerClient,
): Promise<PersistedCenterSettings> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .rpc("admin_update_center_settings", {
      p_center_id: input.centerId,
      p_name: input.centerName,
      p_phone: input.centerPhone || null,
      p_email: input.centerEmail || null,
      p_address: input.centerAddress || null,
      p_expected_updated_at: input.expectedUpdatedAt,
    })
    .single();
  if (error?.code === "P0001" && error.message === "STALE_CENTER_SETTINGS") {
    throw new CenterSettingsConflictError();
  }
  if (error) throw error;
  return {
    id: data.center_id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    updatedAt: data.updated_at,
  };
}
