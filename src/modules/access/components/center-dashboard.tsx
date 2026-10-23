import type { Database } from "@/lib/supabase/database.types";
import { DailyDashboardPanel } from "@/modules/dashboard/components/daily-dashboard-panel";
import { CenterNavigation } from "./center-navigation";

type MembershipRole = Database["public"]["Enums"]["membership_role"];

export function CenterDashboard({
  centerId,
  membershipId,
  role,
}: {
  centerId: string;
  membershipId: string;
  role: MembershipRole;
}) {
  return (
    <main>
      <div className="mx-auto max-w-[1400px] space-y-10 px-5 py-8 sm:px-8 sm:py-10">
        <DailyDashboardPanel
          key={`${centerId}:${membershipId}:${role}`}
          centerId={centerId}
          membershipId={membershipId}
          role={role}
        />
        <section aria-labelledby="dashboard-navigation-heading">
          <div className="mb-8">
            <h2
              id="dashboard-navigation-heading"
              className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
            >
              ¿Qué querés hacer hoy?
            </h2>
            <p className="mt-2 text-sm text-slate-600">Elegí un módulo para empezar.</p>
          </div>
          <CenterNavigation centerId={centerId} role={role} />
        </section>
      </div>
    </main>
  );
}
