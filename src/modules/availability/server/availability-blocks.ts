import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AvailabilityBlockReason } from "../schemas/availability-block";

type Client = SupabaseClient<Database>;

export type AvailabilityBlock = {
  id: string;
  professionalCenterId: string;
  startDate: string;
  endDate: string;
  reason: AvailabilityBlockReason;
  updatedAt: string;
};

export async function listAvailabilityBlocks(
  centerId: string,
  options: { professionalCenterId?: string; fromDate?: string; toDate?: string } = {},
  client?: Client,
): Promise<AvailabilityBlock[]> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("staff_list_availability_blocks", {
    p_center_id: centerId,
    ...(options.professionalCenterId
      ? { p_professional_center_id: options.professionalCenterId }
      : {}),
    ...(options.fromDate ? { p_from_date: options.fromDate } : {}),
    ...(options.toDate ? { p_to_date: options.toDate } : {}),
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.block_id,
    professionalCenterId: row.professional_center_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason as AvailabilityBlockReason,
    updatedAt: row.updated_at,
  }));
}
