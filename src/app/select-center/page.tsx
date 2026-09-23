import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/modules/access/components/logout-button";
import { determineAccessDestination } from "@/modules/access/domain/access-routing";
import { getAccessOverview } from "@/modules/access/server/access";
import { AuthorizationError } from "@/modules/access/server/authorization";

export default async function SelectCenterPage() {
  let overview;
  try {
    overview = await getAccessOverview();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(error.redirectTo);
    throw error;
  }

  if (overview.centers.length <= 1) {
    redirect(determineAccessDestination(overview));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-3xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-sky-700">Salud Plus</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Seleccioná un centro
            </h1>
            <p className="text-slate-600">
              Mostramos únicamente tus accesos activos en centros activos.
            </p>
          </div>
          <div className="w-full sm:w-44">
            <LogoutButton />
          </div>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2">
          {overview.centers.map((center) => (
            <li key={center.id}>
              <Link
                className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                href={`/centers/${center.id}`}
              >
                <span className="block text-lg font-semibold text-slate-950">{center.name}</span>
                <span className="mt-1 block text-sm text-slate-600">Rol: {center.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
