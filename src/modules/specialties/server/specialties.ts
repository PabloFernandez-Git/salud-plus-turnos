import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/modules/access/server/authorization";
import {
  createSpecialtySchema,
  setSpecialtyActiveSchema,
  specialtyCenterIdSchema,
  updateSpecialtySchema,
} from "../schemas/specialty";

type ServerClient = SupabaseClient<Database>;

export type SpecialtyListItem = Pick<
  Database["public"]["Tables"]["specialties"]["Row"],
  "id" | "name" | "description" | "is_active" | "updated_at"
>;

async function clientOrNew(client?: ServerClient) {
  return client ?? createSupabaseServerClient();
}

export async function listSpecialties(centerId: string, client?: ServerClient) {
  const parsedCenterId = specialtyCenterIdSchema.parse(centerId);
  const supabase = await clientOrNew(client);
  await requireRole(parsedCenterId, ["ADMIN"], supabase);

  const { data, error } = await supabase
    .from("specialties")
    .select("id, name, description, is_active, updated_at")
    .eq("center_id", parsedCenterId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as SpecialtyListItem[];
}

export async function createSpecialty(
  input: z.input<typeof createSpecialtySchema>,
  client?: ServerClient,
) {
  const parsed = createSpecialtySchema.parse(input);
  const supabase = await clientOrNew(client);
  await requireRole(parsed.centerId, ["ADMIN"], supabase);
  const { data, error } = await supabase
    .rpc("admin_create_specialty", {
      p_center_id: parsed.centerId,
      p_name: parsed.name,
      p_description: "",
    })
    .single();
  if (error) throw error;
  return data;
}

export async function updateSpecialty(
  input: z.input<typeof updateSpecialtySchema>,
  client?: ServerClient,
) {
  const parsed = updateSpecialtySchema.parse(input);
  const supabase = await clientOrNew(client);
  await requireRole(parsed.centerId, ["ADMIN"], supabase);

  // Description is outside TASK-006C. Keep its current server value rather than trusting a form field.
  const { data: current, error: readError } = await supabase
    .from("specialties")
    .select("description")
    .eq("center_id", parsed.centerId)
    .eq("id", parsed.specialtyId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) throw { code: "P0002", message: "RESOURCE_NOT_FOUND" };

  const { data, error } = await supabase
    .rpc("admin_update_specialty", {
      p_center_id: parsed.centerId,
      p_specialty_id: parsed.specialtyId,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_name: parsed.name,
      p_description: current.description ?? "",
    })
    .single();
  if (error) throw error;
  return data;
}

export async function setSpecialtyActive(
  input: z.input<typeof setSpecialtyActiveSchema>,
  client?: ServerClient,
) {
  const parsed = setSpecialtyActiveSchema.parse(input);
  const supabase = await clientOrNew(client);
  await requireRole(parsed.centerId, ["ADMIN"], supabase);
  const { data, error } = await supabase
    .rpc("admin_set_specialty_active", {
      p_center_id: parsed.centerId,
      p_specialty_id: parsed.specialtyId,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_is_active: parsed.isActive,
    })
    .single();
  if (error) throw error;
  return data;
}
