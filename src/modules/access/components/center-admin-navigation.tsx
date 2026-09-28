import Link from "next/link";

import type { Database } from "@/lib/supabase/database.types";

type MembershipRole = Database["public"]["Enums"]["membership_role"];

export function CenterAdminNavigation({
  centerId,
  role,
}: {
  centerId: string;
  role: MembershipRole;
}) {
  if (role !== "ADMIN") return null;

  return (
    <nav aria-label="Administración del centro">
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
        href={`/centers/${centerId}/users`}
      >
        Usuarios
      </Link>
    </nav>
  );
}
