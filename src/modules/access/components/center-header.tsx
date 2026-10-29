"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavigationLoader } from "@/components/navigation-loader";
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
  isPlatformAdmin,
}: {
  centerId: string;
  centerName: string;
  user: CenterMembershipContext["user"];
  role: CenterMembershipContext["membership"]["role"];
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  const dashboardPath = `/centers/${centerId}`;
  const isDashboard = pathname === dashboardPath || pathname === `${dashboardPath}/`;

  return (
    <header className="border-b border-slate-200 bg-white [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
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
        <div
          className={`flex w-full shrink-0 flex-col gap-2 sm:justify-end ${isDashboard && isPlatformAdmin ? "sm:w-auto sm:flex-col lg:flex-row" : "sm:w-auto"}`}
        >
          {isPlatformAdmin && isDashboard ? (
            <Link
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:w-[232px]"
              href="/platform"
            >
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
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M6 12H4a2 2 0 0 0-2 2v8h20v-6a2 2 0 0 0-2-2h-2" />
                <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
              </svg>
              Administrar plataforma
              <NavigationLoader />
            </Link>
          ) : null}
          {isDashboard ? (
            <div className={isPlatformAdmin ? "sm:w-[232px]" : undefined}>
              <LogoutButton variant="quiet" confirm />
            </div>
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
