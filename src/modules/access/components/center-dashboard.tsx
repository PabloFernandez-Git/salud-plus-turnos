import type { Database } from "@/lib/supabase/database.types";
import { CenterNavigation } from "./center-navigation";

type MembershipRole = Database["public"]["Enums"]["membership_role"];

export function CenterDashboard({ centerId, role }: { centerId: string; role: MembershipRole }) {
  return (
    <main>
      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            ¿Qué querés hacer hoy?
          </h1>
          <p className="mt-2 text-sm text-slate-600">Elegí un módulo para empezar.</p>
        </div>
        <CenterNavigation centerId={centerId} role={role} />
      </div>
    </main>
  );
}
