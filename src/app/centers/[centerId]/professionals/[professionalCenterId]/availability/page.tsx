import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageReveal } from "@/components/page-reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  requireProfessionalContext,
  requireRole,
} from "@/modules/access/server/authorization";
import { AvailabilityScreen } from "@/modules/availability/components/availability-screen";
import {
  AvailabilityNotFoundError,
  getAvailabilityForProfessionalCenter,
} from "@/modules/availability/server/availability";

export default async function AvailabilityDetailPage({
  params,
}: {
  params: Promise<{ centerId: string; professionalCenterId: string }>;
}) {
  const raw = await params;
  const ids = z.object({ centerId: z.uuid(), professionalCenterId: z.uuid() }).safeParse(raw);
  if (!ids.success) notFound();
  const { centerId, professionalCenterId } = ids.data;
  const client = await createSupabaseServerClient();
  let context;
  try {
    context = await requireRole(centerId, ["ADMIN", "RECEPTION", "PROFESSIONAL"], client);
    if (context.membership.role === "PROFESSIONAL") {
      const own = await requireProfessionalContext(centerId, client);
      if (own.professional.professionalCenterId !== professionalCenterId) notFound();
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      notFound();
    }
    throw error;
  }
  let availability;
  try {
    availability = await getAvailabilityForProfessionalCenter(
      centerId,
      professionalCenterId,
      client,
    );
  } catch (error) {
    if (
      error instanceof AvailabilityNotFoundError ||
      (error && typeof error === "object" && "code" in error && error.code === "42501")
    )
      notFound();
    throw error;
  }
  return (
    <PageReveal>
      <AvailabilityScreen
        centerId={centerId}
        centerName={context.center.name}
        timezone={context.center.timezone}
        professional={availability.professional}
        intervals={availability.intervals}
        canEdit={context.membership.role !== "PROFESSIONAL"}
        canViewProfessionals={context.membership.role === "ADMIN"}
      />
    </PageReveal>
  );
}
