import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateCenterPanel } from "@/modules/access/components/create-center-panel";
import { LogoutButton } from "@/modules/access/components/logout-button";
import { PlatformCentersTable } from "@/modules/access/components/platform-centers-table";
import { getAccessOverview } from "@/modules/access/server/access";
import { listPlatformCenters } from "@/modules/access/server/administration";
import { AuthorizationError, requirePlatformAdmin } from "@/modules/access/server/authorization";

export default async function PlatformPage() {
  const supabase = await createSupabaseServerClient();
  let user;

  try {
    user = await requirePlatformAdmin(supabase);
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(error.redirectTo);
    throw error;
  }

  const [centersResult, overviewResult] = await Promise.allSettled([
    listPlatformCenters(supabase),
    getAccessOverview(supabase),
  ]);
  const centers = centersResult.status === "fulfilled" ? centersResult.value : [];
  const hasTenantAccess =
    overviewResult.status === "fulfilled" && overviewResult.value.centers.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-8">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-sky-700">Administración de plataforma</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Centros</h1>
              <p className="max-w-3xl leading-7 text-slate-600">
                Administrá tenants, su estado y el primer ADMIN. Este panel no accede a pacientes,
                agenda ni otros datos médicos u operativos.
              </p>
              <p className="text-sm text-slate-500">Cuenta: {user.email}</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
                href="#crear-centro"
              >
                Crear centro
              </a>
              {hasTenantAccess ? (
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  href="/select-center"
                >
                  Ver mis centros
                </Link>
              ) : null}
              <div className="min-w-40">
                <LogoutButton />
              </div>
            </div>
          </div>
        </header>

        <CreateCenterPanel actorUserId={user.id} key={user.id} />

        {centersResult.status === "rejected" ? (
          <section
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            role="alert"
          >
            No pudimos cargar los centros. Actualizá la página para volver a intentarlo.
          </section>
        ) : (
          <PlatformCentersTable centers={centers} />
        )}
      </div>
    </main>
  );
}
