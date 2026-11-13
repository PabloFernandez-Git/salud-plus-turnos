import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateCenterPanel } from "@/modules/access/components/create-center-panel";
import { PlatformCentersTable } from "@/modules/access/components/platform-centers-table";
import { PlatformHeader } from "@/modules/access/components/platform-header";
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
      <PlatformHeader centerDestination={centerDestination} email={user.email} />

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
