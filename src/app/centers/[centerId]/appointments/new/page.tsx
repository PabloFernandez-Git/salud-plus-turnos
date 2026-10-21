import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageReveal } from "@/components/page-reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { NewAppointmentScreen } from "@/modules/appointments/components/new-appointment-screen";
import { getPatientCenter } from "@/modules/patients/server/patient-management";

export default async function NewAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ centerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = z.uuid().safeParse((await params).centerId);
  if (!parsed.success) notFound();
  const centerId = parsed.data;
  const client = await createSupabaseServerClient();
  let context;
  try {
    context = await requireRole(centerId, ["ADMIN", "RECEPTION"], client);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      notFound();
    }
    throw error;
  }
  const candidate = (await searchParams).patientCenterId;
  let initialPatient = null;
  if (typeof candidate === "string" && z.uuid().safeParse(candidate).success) {
    try {
      const detail = await getPatientCenter(centerId, candidate, client);
      if (detail?.isActive)
        initialPatient = {
          patientCenterId: detail.patientCenterId,
          firstName: detail.firstName,
          lastName: detail.lastName,
        };
    } catch (error) {
      if (error instanceof AuthorizationError) notFound();
      throw error;
    }
  }
  return (
    <PageReveal>
      <NewAppointmentScreen
        centerId={centerId}
        centerName={context.center.name}
        timezone={context.center.timezone}
        initialPatient={initialPatient}
      />
    </PageReveal>
  );
}
