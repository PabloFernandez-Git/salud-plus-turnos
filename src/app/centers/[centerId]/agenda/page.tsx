import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageReveal } from "@/components/page-reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  requireRole,
  requireProfessionalContext,
} from "@/modules/access/server/authorization";
import { listAvailabilityProfessionalCenters } from "@/modules/availability/server/availability";
import { centerLocalDate } from "@/modules/appointments/search/appointment-search";
import { getBookableSpecialties } from "@/modules/appointments/server/appointments";
import { parseAgendaSearch } from "@/modules/agenda/agenda-search";
import { AgendaCalendar } from "@/modules/agenda/components/agenda-calendar";
import { listAgendaAppointments } from "@/modules/agenda/server/agenda-appointments";

export default async function AgendaPage({
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
  let ownProfessionalCenterId: string | null = null;
  try {
    context = await requireRole(centerId, ["ADMIN", "RECEPTION", "PROFESSIONAL"], client);
    if (context.membership.role === "PROFESSIONAL") {
      const professional = await requireProfessionalContext(centerId, client);
      ownProfessionalCenterId = professional.professional.professionalCenterId;
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      notFound();
    }
    throw error;
  }
  const role = context.membership.role;
  const today = centerLocalDate(context.center.timezone);
  const filters = parseAgendaSearch(await searchParams, today, role !== "PROFESSIONAL");
  let appointments: Awaited<ReturnType<typeof listAgendaAppointments>> = [];
  let professionals: Awaited<ReturnType<typeof listAvailabilityProfessionalCenters>> = [];
  let specialties: Awaited<ReturnType<typeof getBookableSpecialties>> = [];
  let specialtyUnavailable = false;
  let loadFailed = false;
  try {
    if (role !== "PROFESSIONAL") {
      professionals = await listAvailabilityProfessionalCenters(centerId, client);
      specialties = await getBookableSpecialties({ centerId }, client);
    }
    const selectedSpecialty = specialties.find((item) => item.specialty_id === filters.specialtyId);
    specialtyUnavailable = Boolean(filters.specialtyId && !selectedSpecialty);
    if (!specialtyUnavailable)
      appointments = await listAgendaAppointments(
        centerId,
        filters,
        ownProfessionalCenterId,
        client,
        selectedSpecialty?.specialty_name,
      );
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      (error && typeof error === "object" && "code" in error && error.code === "42501")
    )
      notFound();
    loadFailed = true;
    appointments = [];
  }
  return (
    <PageReveal>
      <AgendaCalendar
        key={JSON.stringify(filters)}
        centerId={centerId}
        centerName={context.center.name}
        timezone={context.center.timezone}
        today={today}
        role={role}
        filters={filters}
        appointments={appointments}
        professionals={professionals}
        specialties={specialties}
        specialtyUnavailable={specialtyUnavailable}
        loadFailed={loadFailed}
      />
    </PageReveal>
  );
}
