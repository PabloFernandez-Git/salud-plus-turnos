import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { ProfessionalsScreen } from "@/modules/professionals/components/professionals-screen";
import { professionalCenterIdSchema } from "@/modules/professionals/schemas/professional-center";
import {
  listProfessionalSpecialtyConfiguration,
  listProfessionals,
  type ProfessionalSpecialtyAssociation,
  type ProfessionalSpecialtyOption,
  type ProfessionalListItem,
} from "@/modules/professionals/server/professionals";

export default async function ProfessionalsPage({
  params,
}: {
  params: Promise<{ centerId: string }>;
}) {
  const centerId = professionalCenterIdSchema.safeParse((await params).centerId);
  if (!centerId.success) notFound();
  const supabase = await createSupabaseServerClient();
  let context;
  try {
    context = await requireRole(centerId.data, ["ADMIN"], supabase);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "CENTER_ACCESS_DENIED" || error.code === "ROLE_FORBIDDEN") notFound();
      redirect(error.redirectTo);
    }
    throw error;
  }
  let professionals: ProfessionalListItem[] = [];
  let specialties: ProfessionalSpecialtyOption[] = [];
  let associations: ProfessionalSpecialtyAssociation[] = [];
  let loadFailed = false;
  try {
    const [professionalRows, specialtyConfiguration] = await Promise.all([
      listProfessionals(centerId.data, supabase),
      listProfessionalSpecialtyConfiguration(centerId.data, supabase),
    ]);
    professionals = professionalRows;
    specialties = specialtyConfiguration.specialties;
    associations = specialtyConfiguration.associations;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "CENTER_ACCESS_DENIED" || error.code === "ROLE_FORBIDDEN") notFound();
      redirect(error.redirectTo);
    }
    loadFailed = true;
  }
  return (
    <ProfessionalsScreen
      centerId={centerId.data}
      centerName={context.center.name}
      professionals={professionals}
      specialties={specialties}
      associations={associations}
      loadFailed={loadFailed}
    />
  );
}
