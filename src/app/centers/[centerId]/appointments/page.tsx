import { notFound, redirect } from "next/navigation";
import { PageReveal } from "@/components/page-reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  requireRole,
  requireProfessionalContext,
} from "@/modules/access/server/authorization";
import { listAvailabilityProfessionalCenters } from "@/modules/availability/server/availability";
import { AppointmentsList } from "@/modules/appointments/components/appointments-list";
import {
  centerLocalDate,
  parseAppointmentSearch,
} from "@/modules/appointments/search/appointment-search";
import { listAppointments } from "@/modules/appointments/server/appointments";
import { z } from "zod";

export default async function AppointmentsPage({
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
    context = await requireRole(centerId, ["ADMIN", "RECEPTION", "PROFESSIONAL"], client);
    if (context.membership.role === "PROFESSIONAL")
      await requireProfessionalContext(centerId, client);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      notFound();
    }
    throw error;
  }
  const role = context.membership.role;
  const today = centerLocalDate(context.center.timezone);
  const filters = parseAppointmentSearch(await searchParams, today, role !== "PROFESSIONAL");
  let result: Awaited<ReturnType<typeof listAppointments>> | null = null;
  let professionals: Awaited<ReturnType<typeof listAvailabilityProfessionalCenters>> = [];
  let loadFailed = false;
  try {
    result = await listAppointments({ centerId, ...filters }, client);
    if (role !== "PROFESSIONAL")
      professionals = await listAvailabilityProfessionalCenters(centerId, client);
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      (error && typeof error === "object" && "code" in error && error.code === "42501")
    )
      notFound();
    loadFailed = true;
  }
  return (
    <PageReveal>
      <AppointmentsList
        centerId={centerId}
        centerName={context.center.name}
        timezone={context.center.timezone}
        today={today}
        role={role}
        filters={filters}
        result={result}
        loadFailed={loadFailed}
        professionals={professionals}
      />
    </PageReveal>
  );
}
