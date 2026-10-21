"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CenterMembershipContext } from "../server/authorization";
import { LogoutButton } from "./logout-button";

const roleLabels = {
  ADMIN: "Administrador",
  RECEPTION: "Recepción",
  PROFESSIONAL: "Profesional",
} as const;

export function CenterHeader({
  centerId,
  centerName,
  user,
  role,
}: {
  centerId: string;
  centerName: string;
  user: CenterMembershipContext["user"];
  role: CenterMembershipContext["membership"]["role"];
}) {
  const pathname = usePathname();
  const dashboardPath = `/centers/${centerId}`;
  const isDashboard = pathname === dashboardPath || pathname === `${dashboardPath}/`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
            Centro activo
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {centerName}
          </p>
          <p className="mt-1 break-words text-sm text-slate-600">
            {user.firstName} {user.lastName} · {user.email} · {roleLabels[role]}
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          {isDashboard ? (
            <LogoutButton variant="quiet" confirm />
          ) : (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href={dashboardPath}
            >
              Volver al inicio
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
