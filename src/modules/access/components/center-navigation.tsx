import Link from "next/link";
import type { Database } from "@/lib/supabase/database.types";

type MembershipRole = Database["public"]["Enums"]["membership_role"];
const linkClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800";

export function CenterNavigation({ centerId, role }: { centerId: string; role: MembershipRole }) {
  return (
    <nav aria-label="Navegación del centro" className="flex flex-wrap gap-3">
      {role !== "PROFESSIONAL" && (
        <Link className={linkClass} href={`/centers/${centerId}/patients`}>
          Pacientes
        </Link>
      )}
      <Link className={linkClass} href={`/centers/${centerId}/availability`}>
        Disponibilidad
      </Link>
      {role === "ADMIN" && (
        <>
          <Link className={linkClass} href={`/centers/${centerId}/users`}>
            Usuarios
          </Link>
          <Link className={linkClass} href={`/centers/${centerId}/specialties`}>
            Especialidades
          </Link>
          <Link className={linkClass} href={`/centers/${centerId}/professionals`}>
            Profesionales
          </Link>
        </>
      )}
    </nav>
  );
}
