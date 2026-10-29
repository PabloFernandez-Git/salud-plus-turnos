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
        >
          <CenterNavigation centerId={centerId} role={role} />
        </DailyDashboardPanel>
      </div>
    </main>
  );
}
