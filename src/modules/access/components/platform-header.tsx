import { HeartPulse, House } from "lucide-react";
import Link from "next/link";

import { NavigationLoader } from "@/components/navigation-loader";
import { LogoutButton } from "./logout-button";

export function PlatformHeader({
  email,
  centerDestination,
}: {
  email: string;
  centerDestination: { href: string; label: string } | null;
}) {
  return (
    <header className="relative z-40 border-b border-slate-200 bg-white [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div className="flex w-full flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-8">
          <Link
            className="flex shrink-0 cursor-pointer items-center gap-3 rounded-md text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 sm:self-center"
            href="/platform"
          >
            <HeartPulse aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
            <span className="whitespace-nowrap text-lg font-bold tracking-tight">Salud Plus</span>
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
              Administración de plataforma
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              Centros
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Gestioná los centros, sus estados y sus administradores iniciales.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Desde este panel no se accede a pacientes, agenda ni datos clínicos.
            </p>
            <p className="mt-1 break-words text-sm text-slate-500">Cuenta: {email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:shrink-0 lg:justify-end">
          {centerDestination && (
            <Link
              aria-label={centerDestination.label}
              className="group relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-800 transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href={centerDestination.href}
            >
              <House aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-full z-50 mt-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-0 sm:left-auto"
              >
                {centerDestination.label}
              </span>
              <NavigationLoader />
            </Link>
          )}
          <LogoutButton variant="quiet" iconOnly />
        </div>
      </div>
    </header>
  );
}
