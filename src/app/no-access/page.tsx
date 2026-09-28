import { redirect } from "next/navigation";

import { LogoutButton } from "@/modules/access/components/logout-button";
import { getPostLoginDestination } from "@/modules/access/server/access";
import {
  AuthorizationError,
  requireAuthenticatedIdentity,
} from "@/modules/access/server/authorization";

export default async function NoAccessPage() {
  let identity;
  try {
    identity = await requireAuthenticatedIdentity();
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    throw error;
  }

  try {
    const destination = await getPostLoginDestination();
    if (destination !== "/no-access") redirect(destination);
  } catch (error) {
    if (
      !(error instanceof AuthorizationError) ||
      !["PROFILE_NOT_PROVISIONED", "UNAUTHENTICATED"].includes(error.code)
    ) {
      throw error;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-sky-700">Salud Plus</p>
          <h1 className="text-2xl font-bold text-slate-950">Sin acceso activo</h1>
          <p className="leading-7 text-slate-600">
            Tu cuenta no tiene acceso activo a ningún centro. Contactá a un administrador si creés
            que esto es un error.
          </p>
          {identity.email ? (
            <p className="text-sm text-slate-500">Cuenta: {identity.email}</p>
          ) : null}
        </div>
        <LogoutButton />
      </section>
    </main>
  );
}
