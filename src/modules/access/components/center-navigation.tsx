import Link from "next/link";
import type { ReactNode } from "react";

import type { Database } from "@/lib/supabase/database.types";

type MembershipRole = Database["public"]["Enums"]["membership_role"];
type Destination = { title: string; description: string; path: string; icon: ReactNode };

function Icon({ kind }: { kind: string }) {
  const paths: Record<string, ReactNode> = {
    agenda: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h3v3H8z" />
      </>
    ),
    appointments: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    patients: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1M17 9h5M19.5 6.5v5" />
      </>
    ),
    professionals: (
      <>
        <circle cx="12" cy="7" r="3" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2M3 12v3h3M21 12v3h-3" />
      </>
    ),
    availability: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18m-12 6 2 2 4-4" />
      </>
    ),
    specialties: (
      <>
        <path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z" />
        <path d="M8 13h2l1-2 2 4 1-2h2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5" />
      </>
    ),
  };
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}

function NavigationCard({ centerId, destination }: { centerId: string; destination: Destination }) {
  return (
    <Link
      aria-describedby={`nav-${destination.path}-description`}
      aria-label={destination.title}
      className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors transition-shadow hover:border-sky-300 hover:shadow-md focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-700"
      href={`/centers/${centerId}/${destination.path}`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
        {destination.icon}
      </span>
      <span className="mt-5 flex items-center justify-between gap-3 text-lg font-semibold text-slate-900">
        {destination.title}
        <svg
          className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-sky-700"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </span>
      <span
        id={`nav-${destination.path}-description`}
        className="mt-1 text-sm leading-6 text-slate-600"
      >
        {destination.description}
      </span>
    </Link>
  );
}

export function CenterNavigation({ centerId, role }: { centerId: string; role: MembershipRole }) {
  const daily: Destination[] = [
    {
      title: "Agenda",
      description:
        role === "PROFESSIONAL"
          ? "Consultá tu actividad por día, semana o mes."
          : "Consultá la actividad del centro por día, semana o mes.",
      path: "agenda",
      icon: <Icon kind="agenda" />,
    },
    {
      title: "Turnos",
      description:
        role === "PROFESSIONAL"
          ? "Consultá tus turnos y su estado."
          : "Consultá y gestioná los turnos del centro.",
      path: "appointments",
      icon: <Icon kind="appointments" />,
    },
    ...(role === "PROFESSIONAL"
      ? []
      : [
          {
            title: "Pacientes",
            description: "Buscá y administrá las fichas de pacientes.",
            path: "patients",
            icon: <Icon kind="patients" />,
          },
        ]),
  ];
  const administration: Destination[] = [
    ...(role === "ADMIN"
      ? [
          {
            title: "Profesionales",
            description: "Gestioná el equipo de atención del centro.",
            path: "professionals",
            icon: <Icon kind="professionals" />,
          },
        ]
      : []),
    {
      title: "Disponibilidad",
      description:
        role === "PROFESSIONAL"
          ? "Consultá y organizá tus horarios de atención."
          : "Consultá y organizá los horarios de atención.",
      path: "availability",
      icon: <Icon kind="availability" />,
    },
    ...(role === "ADMIN"
      ? [
          {
            title: "Especialidades",
            description: "Administrá las especialidades del centro.",
            path: "specialties",
            icon: <Icon kind="specialties" />,
          },
          {
            title: "Usuarios",
            description: "Gestioná los accesos y roles del equipo.",
            path: "users",
            icon: <Icon kind="users" />,
          },
        ]
      : []),
  ];

  return (
    <nav aria-label="Navegación del centro" className="space-y-10">
      <section aria-labelledby="daily-heading">
        <h3 id="daily-heading" className="text-base font-semibold text-slate-900">
          Operación diaria
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {daily.map((destination) => (
            <NavigationCard key={destination.path} centerId={centerId} destination={destination} />
          ))}
        </div>
      </section>
      <section aria-labelledby="administration-heading">
        <h3 id="administration-heading" className="text-base font-semibold text-slate-900">
          Administración del centro
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {administration.map((destination) => (
            <NavigationCard key={destination.path} centerId={centerId} destination={destination} />
          ))}
        </div>
      </section>
    </nav>
  );
}
