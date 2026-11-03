import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageReveal } from "@/components/page-reveal";
import { ModuleHeader } from "@/components/module-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { NewAppointmentScreen } from "@/modules/appointments/components/new-appointment-screen";
import {
  appointmentTimestampSchema,
  searchSlotsSchema,
} from "@/modules/appointments/schemas/appointment-input";
import { getAppointmentSlots } from "@/modules/appointments/server/appointments";
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
  if (process.env.PORTFOLIO_DEMO_MODE === "true") {
    return (
      <PageReveal>
        <main className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-6xl space-y-6">
            <ModuleHeader
              centerId={centerId}
              title="Crear turno"
              description="Consultá los turnos existentes del centro."
            />
            <p className="rounded-xl border border-sky-200 bg-white p-5 text-slate-800">
              Disponible en la versión completa. Esta demo es de solo lectura.
            </p>
            <Link
              className="font-semibold text-sky-700 underline"
              href={`/centers/${centerId}/appointments`}
            >
              Volver a turnos
            </Link>
          </div>
        </main>
      </PageReveal>
    );
  }
  const search = await searchParams;
  const candidate = search.patientCenterId;
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
  const bookingParamsPresent = [
    search.specialtyId,
    search.professionalCenterId,
    search.localDate,
    search.startsAt,
  ].some((value) => value !== undefined);
  const booking = searchSlotsSchema.extend({ startsAt: appointmentTimestampSchema }).safeParse({
    centerId,
    specialtyId: search.specialtyId,
    professionalCenterId: search.professionalCenterId,
    localDate: search.localDate,
    startsAt: search.startsAt,
  });
  let initialBooking: {
    specialtyId: string;
    professionalCenterId: string;
    localDate: string;
    startsAt: string;
  } | null = null;
  if (booking.success) {
    try {
      const slots = await getAppointmentSlots(
        {
          centerId,
          specialtyId: booking.data.specialtyId,
          professionalCenterId: booking.data.professionalCenterId,
          localDate: booking.data.localDate,
        },
        client,
      );
      if (
        slots.some(
          (slot) =>
            slot.starts_at === booking.data.startsAt && slot.local_date === booking.data.localDate,
        )
      )
        initialBooking = {
          specialtyId: booking.data.specialtyId,
          professionalCenterId: booking.data.professionalCenterId,
          localDate: booking.data.localDate,
          startsAt: booking.data.startsAt,
        };
    } catch (error) {
      if (
        error instanceof AuthorizationError ||
        (error && typeof error === "object" && "code" in error && error.code === "42501")
      )
        notFound();
      // A stale or failed lookup cannot preselect a slot.
    }
  }
  return (
    <PageReveal>
      <NewAppointmentScreen
        centerId={centerId}
        centerName={context.center.name}
        timezone={context.center.timezone}
        initialPatient={initialPatient}
        initialBooking={initialBooking}
        initialBookingUnavailable={bookingParamsPresent && !initialBooking}
      />
    </PageReveal>
  );
}
