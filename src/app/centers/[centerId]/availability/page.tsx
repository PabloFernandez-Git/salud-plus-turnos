import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageReveal } from "@/components/page-reveal";
import { ModuleHeader } from "@/components/module-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  requireCenterMembership,
  requireProfessionalContext,
} from "@/modules/access/server/authorization";
import { listAvailabilityProfessionalCenters } from "@/modules/availability/server/availability";

export default async function AvailabilityIndexPage({
  params,
}: {
  params: Promise<{ centerId: string }>;
}) {
  const centerId = z.uuid().safeParse((await params).centerId);
  if (!centerId.success) notFound();
  const client = await createSupabaseServerClient();
  let context;
  try {
    context = await requireCenterMembership(centerId.data, client);
    if (context.membership.role === "PROFESSIONAL") {
      const own = await requireProfessionalContext(centerId.data, client);
      redirect(
        `/centers/${centerId.data}/professionals/${own.professional.professionalCenterId}/availability`,
      );
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      notFound();
    }
    throw error;
  }
  let professionals;
  try {
    professionals = await listAvailabilityProfessionalCenters(centerId.data, client);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42501") notFound();
    throw error;
  }
  return (
    <PageReveal>
      <main className="px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <ModuleHeader
            centerId={centerId.data}
            title="Disponibilidad"
            description="Elegí un profesional para consultar o administrar sus horarios semanales."
          />
          <section
            aria-label="Profesionales con disponibilidad"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            {professionals.length === 0 ? (
              <p className="text-slate-600">Todavía no hay profesionales activos en este centro.</p>
            ) : (
              <ul className="space-y-3">
                {professionals.map((professional) => (
                  <li
                    key={professional.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {professional.firstName} {professional.lastName}
                      </p>
                      <p className="text-sm text-slate-600">
                        Duración habitual: {professional.usualAppointmentDurationMinutes} minutos
                      </p>
                    </div>
                    <Link
                      className="inline-flex min-h-11 items-center rounded-md bg-sky-700 px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                      href={`/centers/${centerId.data}/professionals/${professional.id}/availability`}
                    >
                      Ver disponibilidad
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </PageReveal>
  );
}
