import { notFound, redirect } from "next/navigation";

import { PageReveal } from "@/components/page-reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { SpecialtiesScreen } from "@/modules/specialties/components/specialties-screen";
import { specialtyCenterIdSchema } from "@/modules/specialties/schemas/specialty";
import { listSpecialties, type SpecialtyListItem } from "@/modules/specialties/server/specialties";

export default async function SpecialtiesPage({
  params,
}: {
  params: Promise<{ centerId: string }>;
}) {
  const centerId = specialtyCenterIdSchema.safeParse((await params).centerId);
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

  let specialties: SpecialtyListItem[] = [];
  let loadFailed = false;
  try {
    specialties = await listSpecialties(centerId.data, supabase);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "CENTER_ACCESS_DENIED" || error.code === "ROLE_FORBIDDEN") notFound();
      redirect(error.redirectTo);
    }
    loadFailed = true;
  }

  return (
    <PageReveal>
      <SpecialtiesScreen
        centerId={centerId.data}
        centerName={context.center.name}
        loadFailed={loadFailed}
        specialties={specialties}
      />
    </PageReveal>
  );
}
