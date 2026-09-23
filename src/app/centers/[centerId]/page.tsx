import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { LogoutButton } from "@/modules/access/components/logout-button";
import { AuthorizationError, requireCenterMembership } from "@/modules/access/server/authorization";

const centerIdSchema = z.uuid();

export default async function CenterPage({ params }: { params: Promise<{ centerId: string }> }) {
  const parsedCenterId = centerIdSchema.safeParse((await params).centerId);
  if (!parsedCenterId.success) notFound();

  let context;
  try {
    context = await requireCenterMembership(parsedCenterId.data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "CENTER_ACCESS_DENIED") notFound();
      redirect(error.redirectTo);
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-sky-700">Centro activo</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {context.center.name}
            </h1>
            <p className="text-sm text-slate-600">
              {context.user.firstName} {context.user.lastName} · {context.user.email}
            </p>
            <p className="text-sm font-medium text-slate-700">Rol: {context.membership.role}</p>
          </div>
          <div className="w-full sm:w-44">
            <LogoutButton />
          </div>
        </header>

        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Espacio del centro</h2>
          <p className="mt-2 leading-7 text-slate-600">
            El acceso está listo. La agenda y los demás módulos se incorporarán en las próximas
            etapas.
          </p>
        </section>
      </section>
    </main>
  );
}
