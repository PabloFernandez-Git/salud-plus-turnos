import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageReveal } from "@/components/page-reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  requireProfessionalContext,
  requireRole,
} from "@/modules/access/server/authorization";
import {
  AvailabilityNotFoundError,
  getAvailabilityForProfessionalCenter,
} from "@/modules/availability/server/availability";
import { AppointmentDetailScreen } from "@/modules/appointments/components/appointment-detail-screen";
import { outsideCurrentAvailability } from "@/modules/appointments/search/appointment-availability-warning";
import { getAppointment } from "@/modules/appointments/server/appointments";

async function presentationTime() {
  return Date.now();
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ centerId: string; appointmentId: string }>;
}) {
  const values = await params;
  const centerId = z.uuid().safeParse(values.centerId);
  const appointmentId = z.uuid().safeParse(values.appointmentId);
  if (!centerId.success || !appointmentId.success) notFound();
  const client = await createSupabaseServerClient();
  let context;
  try {
    context = await requireRole(centerId.data, ["ADMIN", "RECEPTION", "PROFESSIONAL"], client);
    if (context.membership.role === "PROFESSIONAL")
      await requireProfessionalContext(centerId.data, client);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      notFound();
    }
    throw error;
  }
  let detail;
  try {
    detail = await getAppointment(
      { centerId: centerId.data, appointmentId: appointmentId.data },
      client,
    );
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      (error && typeof error === "object" && "code" in error && error.code === "42501")
    )
      notFound();
    throw error;
  }
  if (!detail.appointment) notFound();
  let outsideAvailability: boolean | null = false;
  if (
    detail.kind === "STAFF" &&
    detail.appointment.status !== "CANCELLED" &&
    outsideCurrentAvailability(detail.appointment, context.center.timezone, [])
  ) {
    try {
      const availability = await getAvailabilityForProfessionalCenter(
        centerId.data,
        detail.appointment.professional_center_id,
        client,
      );
      outsideAvailability = outsideCurrentAvailability(
        detail.appointment,
        context.center.timezone,
        availability.intervals,
      );
    } catch (error) {
      // Historical appointments remain readable when their professional link is inactive.
      if (error instanceof AvailabilityNotFoundError)
        outsideAvailability = outsideCurrentAvailability(
          detail.appointment,
          context.center.timezone,
          [],
        );
      else outsideAvailability = null;
    }
  }
  const serverNow = await presentationTime();
  if (detail.kind === "STAFF") {
    return (
      <PageReveal>
        <AppointmentDetailScreen
          key={detail.appointment.updated_at}
          centerId={centerId.data}
          centerName={context.center.name}
          timezone={context.center.timezone}
          serverNow={serverNow}
          detail={{ kind: "STAFF", appointment: detail.appointment }}
          outsideAvailability={outsideAvailability}
        />
      </PageReveal>
    );
  }
  return (
    <PageReveal>
      <AppointmentDetailScreen
        key={detail.appointment.updated_at}
        centerId={centerId.data}
        centerName={context.center.name}
        timezone={context.center.timezone}
        serverNow={serverNow}
        detail={{ kind: "PROFESSIONAL", appointment: detail.appointment }}
        outsideAvailability={false}
      />
    </PageReveal>
  );
}
