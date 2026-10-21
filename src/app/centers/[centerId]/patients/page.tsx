import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { PageReveal } from "@/components/page-reveal";
import { ORIGINAL_SEARCH_HEADER } from "@/lib/original-search-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { PatientsScreen } from "@/modules/patients/components/patients-screen";
import {
  parsePatientSearchParams,
  patientSearchUrl,
  type PatientSearchParams,
} from "@/modules/patients/search/patient-search-params";
import { listPatientCenters, type PatientPage } from "@/modules/patients/server/patients";
import { getPatientCenter, type PatientDetail } from "@/modules/patients/server/patient-management";

function handleAuthorization(error: AuthorizationError): never {
  if (error.code === "UNAUTHENTICATED") redirect("/login");
  if (error.code === "CENTER_ACCESS_DENIED" || error.code === "ROLE_FORBIDDEN") notFound();
  redirect(error.redirectTo);
}

export default async function PatientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ centerId: string }>;
  searchParams: Promise<PatientSearchParams>;
}) {
  const centerId = z.uuid().safeParse((await params).centerId);
  if (!centerId.success) notFound();
  const supabase = await createSupabaseServerClient();
  let context;
  try {
    context = await requireRole(centerId.data, ["ADMIN", "RECEPTION"], supabase);
  } catch (error) {
    if (error instanceof AuthorizationError) handleAuthorization(error);
    throw error;
  }
  const originalSearch = (await headers()).get(ORIGINAL_SEARCH_HEADER) ?? "";
  const parsed = parsePatientSearchParams(centerId.data, await searchParams, originalSearch);
  if (parsed.needsRedirect) redirect(parsed.canonicalUrl);
  const filters = { query: parsed.query, state: parsed.state, page: parsed.page };
  let result: PatientPage | null = null;
  let loadFailed = false;
  try {
    result = await listPatientCenters(centerId.data, filters, supabase);
  } catch (error) {
    if (error instanceof AuthorizationError) handleAuthorization(error);
    loadFailed = true;
  }
  if (result && filters.page > 1 && result.rows.length === 0) {
    redirect(
      patientSearchUrl(
        centerId.data,
        { ...filters, page: 1 },
        parsed.patientId,
        parsed.returnToAppointments,
      ),
    );
  }
  let detail: PatientDetail | null = null;
  let detailFailed = false;
  if (parsed.patientId) {
    try {
      detail = await getPatientCenter(centerId.data, parsed.patientId, supabase);
    } catch (error) {
      if (error instanceof AuthorizationError) handleAuthorization(error);
      detailFailed = true;
    }
  }
  return (
    <PageReveal>
      <PatientsScreen
        centerId={centerId.data}
        centerName={context.center.name}
        filters={filters}
        result={result}
        loadFailed={loadFailed}
        detail={detail}
        detailFailed={detailFailed || Boolean(parsed.patientId && !detail)}
        returnToAppointments={parsed.returnToAppointments}
      />
    </PageReveal>
  );
}
