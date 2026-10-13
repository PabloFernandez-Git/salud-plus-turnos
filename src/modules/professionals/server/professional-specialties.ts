import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/modules/access/server/authorization";
import { updateProfessionalSpecialtiesSchema } from "../schemas/professional-specialties";

type ServerClient = SupabaseClient<Database>;

export async function updateProfessionalSpecialties(
  input: z.input<typeof updateProfessionalSpecialtiesSchema>,
  client?: ServerClient,
) {
  const parsed = updateProfessionalSpecialtiesSchema.parse(input);
  const supabase = client ?? (await createSupabaseServerClient());
  await requireRole(parsed.centerId, ["ADMIN"], supabase);
  const { data, error } = await supabase
    .rpc("admin_update_professional_center_specialties", {
      p_center_id: parsed.centerId,
      p_professional_center_id: parsed.professionalCenterId,
      p_expected_professional_center_updated_at: parsed.expectedUpdatedAt,
      p_activate_specialty_ids: parsed.activateSpecialtyIds,
      p_deactivate_specialty_ids: parsed.deactivateSpecialtyIds,
    })
    .single();
  if (error) throw error;
  return data;
}
