import Link from "next/link";
import { redirect } from "next/navigation";

import { NavigationLoader } from "@/components/navigation-loader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateCenterPanel } from "@/modules/access/components/create-center-panel";
import { LogoutButton } from "@/modules/access/components/logout-button";
import { PlatformCentersTable } from "@/modules/access/components/platform-centers-table";
import { listAccessibleCentersForUser } from "@/modules/access/server/access";
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
    listAccessibleCentersForUser(user.id, supabase),
  ]);
  const centers = centersResult.status === "fulfilled" ? centersResult.value : [];
  const accessibleCenters = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const centerDestination =
    accessibleCenters?.length === 1
      ? { href: `/centers/${accessibleCenters[0].id}`, label: "Ir a mi centro" }
      : accessibleCenters && accessibleCenters.length > 1
        ? { href: "/select-center", label: "Seleccionar centro" }
        : null;

  return (
    <div className="min-h-screen bg-slate-50 [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sky-700">Administración de plataforma</p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">Centros</h1>
            <div className="mt-2 max-w-3xl space-y-1 leading-7 text-slate-600">
              <p>Gestioná los centros, sus estados y sus administradores iniciales.</p>
              <p>Desde este panel no se accede a pacientes, agenda ni datos clínicos.</p>
            </div>
            <p className="mt-2 break-words text-sm text-slate-500">Cuenta: {user.email}</p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:justify-end lg:flex-row">
            {centerDestination ? (
              <Link
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:w-[232px]"
                href={centerDestination.href}
              >
                {accessibleCenters?.length === 1 ? (
                  <svg
                    aria-hidden="true"
                    className="h-[17px] w-[17px] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <rect height="9" rx="1" width="7" x="3" y="3" />
                    <rect height="5" rx="1" width="7" x="14" y="3" />
                    <rect height="9" rx="1" width="7" x="14" y="12" />
                    <rect height="5" rx="1" width="7" x="3" y="16" />
                  </svg>
                ) : null}
                {centerDestination.label}
                <NavigationLoader />
              </Link>
            ) : null}
            <div className="sm:w-[232px]">
              <LogoutButton variant="quiet" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {overviewResult.status === "rejected" ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            No pudimos cargar tus accesos a centros. Actualizá la página para volver a intentarlo.
          </p>
        ) : null}

        <section className="space-y-4" aria-labelledby="registered-centers-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-slate-950" id="registered-centers-title">
              Centros registrados
            </h2>
            <CreateCenterPanel actorUserId={user.id} key={user.id} />
          </div>
          {centersResult.status === "rejected" ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
              role="alert"
            >
              No pudimos cargar los centros. Actualizá la página para volver a intentarlo.
            </div>
          ) : (
            <PlatformCentersTable centers={centers} />
          )}
        </section>
      </main>
    </div>
  );
}
