"use client";

import Link from "next/link";
import { Building2, HeartPulse } from "lucide-react";

import { NavigationLoader } from "@/components/navigation-loader";
import type { CenterMembershipContext } from "../server/authorization";
import { LogoutButton } from "./logout-button";
import { CenterMobileNavigation } from "./center-sidebar";

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
  return (
    <header className="relative z-40 border-b border-slate-200 bg-white [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div className="flex w-full flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto">
            <Link
              className="inline-flex cursor-pointer items-center gap-3 rounded-md text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href={`/centers/${centerId}`}
            >
              <HeartPulse aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              <span className="whitespace-nowrap text-lg font-bold tracking-tight">Salud Plus</span>
            </Link>
            <CenterMobileNavigation centerId={centerId} role={role} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
              Centro activo
            </p>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              {centerName}
            </p>
            <p className="mt-1 break-words text-sm text-slate-600">
              {user.firstName} {user.lastName} · {user.email} · {roleLabels[role]}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:shrink-0 lg:justify-end">
          {isPlatformAdmin && (
            <Link
              aria-label="Administrar plataforma"
              className="group relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-800 transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href="/platform"
            >
              <Building2 aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-full z-50 mt-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-0 sm:left-auto"
              >
                Administrar plataforma
              </span>
              <NavigationLoader />
            </Link>
          )}
          <LogoutButton variant="quiet" confirm />
        </div>
      </div>
    </header>
  );
}
