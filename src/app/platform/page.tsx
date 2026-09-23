import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/modules/access/components/logout-button";
import { getAccessOverview } from "@/modules/access/server/access";
import { AuthorizationError, requirePlatformAdmin } from "@/modules/access/server/authorization";

export default async function PlatformPlaceholderPage() {
  let user;
  let hasTenantAccess = false;
  try {
    user = await requirePlatformAdmin();
    hasTenantAccess = (await getAccessOverview()).centers.length > 0;
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(error.redirectTo);
    throw error;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-xl space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-sky-700">Acceso de plataforma</p>
          <h1 className="text-2xl font-bold text-slate-950">
            Administración próximamente disponible
          </h1>
          <p className="leading-7 text-slate-600">
            Tu cuenta tiene acceso de plataforma. La administración estará disponible en esta ruta
            durante la subfase B2.
          </p>
          <p className="text-sm text-slate-500">Cuenta: {user.email}</p>
        </div>
        <div className="space-y-3">
          {hasTenantAccess ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href="/select-center"
            >
              Ver accesos a centros
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
