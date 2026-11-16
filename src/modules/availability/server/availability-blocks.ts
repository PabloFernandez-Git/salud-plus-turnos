import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  blockPeriodSchema,
  createBlockSchema,
  deactivateBlockSchema,
  type AvailabilityBlockReason,
} from "../schemas/availability-block";

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

export async function previewAvailabilityBlock(
  input: z.input<typeof blockPeriodSchema>,
  client: Client,
): Promise<number> {
  const value = blockPeriodSchema.parse(input);
  const { data, error } = await client.rpc("staff_preview_availability_block", {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_start_date: value.startDate,
    p_end_date: value.endDate,
  });
  if (error) throw error;
  if (data === null) throw new Error("BLOCK_PREVIEW_UNKNOWN");
  return data;
}

export async function createAvailabilityBlock(
  input: z.input<typeof createBlockSchema>,
  client: Client,
) {
  const value = createBlockSchema.parse(input);
  const { data, error } = await client.rpc("staff_create_availability_block", {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_start_date: value.startDate,
    p_end_date: value.endDate,
    p_reason: value.reason,
    p_expected_affected_count: value.expectedAffectedCount,
    p_confirm_affected: value.confirmAffected,
  });
  if (error) throw error;
  if (!data?.[0]) throw new Error("BLOCK_CREATE_UNKNOWN");
  return data[0];
}

export async function deactivateAvailabilityBlock(
  input: z.input<typeof deactivateBlockSchema>,
  client: Client,
) {
  const value = deactivateBlockSchema.parse(input);
  const { data, error } = await client.rpc("staff_deactivate_availability_block", {
    p_center_id: value.centerId,
    p_professional_center_id: value.professionalCenterId,
    p_block_id: value.blockId,
    p_expected_updated_at: value.expectedUpdatedAt,
  });
  if (error) throw error;
  if (!data?.[0]) throw new Error("BLOCK_DEACTIVATE_UNKNOWN");
  return data[0];
}
