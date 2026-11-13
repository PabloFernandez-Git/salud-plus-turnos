"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  Clock3,
  HeartPulse,
  House,
  Settings2,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Database } from "@/lib/supabase/database.types";

type MembershipRole = Database["public"]["Enums"]["membership_role"];
type Destination = { title: string; path: string; icon: LucideIcon };

export function CenterNavigation({
  centerId,
  role,
  onNavigate,
  compact = false,
  expanded = true,
}: {
  centerId: string;
  role: MembershipRole;
  onNavigate?: () => void;
  compact?: boolean;
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const root = `/centers/${centerId}`;
  const pathWithinCenter = pathname.startsWith(`${root}/`) ? pathname.slice(root.length + 1) : "";
  const segments = pathWithinCenter.split("/");
  const activePath =
    segments[0] === "professionals" && segments[2] === "availability"
      ? "availability"
      : segments[0];
  const daily: Destination[] = [
    { title: "Agenda", path: "agenda", icon: CalendarDays },
    { title: "Turnos", path: "appointments", icon: Clock3 },
    ...(role === "PROFESSIONAL"
      ? []
      : [{ title: "Pacientes", path: "patients", icon: UsersRound }]),
  ];
  const administration: Destination[] = [
    ...(role === "ADMIN"
      ? [{ title: "Profesionales", path: "professionals", icon: Stethoscope }]
      : []),
    { title: "Disponibilidad", path: "availability", icon: CalendarClock },
    ...(role === "ADMIN"
      ? [
          { title: "Especialidades", path: "specialties", icon: HeartPulse },
          { title: "Gestión de usuarios", path: "users", icon: ShieldCheck },
          { title: "Configuración del centro", path: "settings", icon: Settings2 },
        ]
      : []),
  ];

  function navigationLink(destination: Destination) {
    const href = destination.path ? `${root}/${destination.path}` : root;
    const active = destination.path
      ? activePath === destination.path
      : pathname === root || pathname === `${root}/`;
    const Icon = destination.icon;
    return (
      <Link
        aria-label={destination.title}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${active ? "bg-sky-100 text-sky-800" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}
        href={href}
        key={href}
        onClick={onNavigate}
      >
        <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        <span
          aria-hidden={compact}
          className={
            compact
              ? `whitespace-nowrap transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`
              : undefined
          }
        >
          {destination.title}
        </span>
      </Link>
    );
  }

  return (
    <nav aria-label="Navegación del centro" className={compact ? "space-y-4" : "space-y-6"}>
      <section aria-label="Inicio">
        {navigationLink({ title: "Dashboard", path: "", icon: House })}
      </section>
      <section
        aria-labelledby="daily-navigation-heading"
        className={compact ? "border-t border-slate-200 pt-3" : undefined}
      >
        <h2
          className={`px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${compact ? `h-5 overflow-hidden whitespace-nowrap transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}` : ""}`}
          id="daily-navigation-heading"
        >
          Operación diaria
        </h2>
        <div className={`${compact ? "mt-1" : "mt-2"} space-y-1`}>{daily.map(navigationLink)}</div>
      </section>
      <section
        aria-labelledby="administration-navigation-heading"
        className={compact ? "border-t border-slate-200 pt-3" : undefined}
      >
        <h2
          className={`px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${compact ? `h-5 overflow-hidden whitespace-nowrap transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}` : ""}`}
          id="administration-navigation-heading"
        >
          Administración del centro
        </h2>
        <div className={`${compact ? "mt-1" : "mt-2"} space-y-1`}>
          {administration.map(navigationLink)}
        </div>
      </section>
    </nav>
  );
}
