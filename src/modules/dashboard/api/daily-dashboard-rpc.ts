import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

const timestamp = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative().safe();
const upcomingBase = {
  appointment_id: z.uuid(),
  starts_at: timestamp,
  ends_at: timestamp,
  status: z.enum(["PENDING", "CONFIRMED"]),
  patient_first_name: z.string(),
  patient_last_name: z.string(),
  specialty_name: z.string(),
};
export const professionalUpcomingSchema = z.strictObject(upcomingBase);
export const staffUpcomingSchema = z.strictObject({
  ...upcomingBase,
  professional_center_id: z.uuid(),
  professional_first_name: z.string(),
  professional_last_name: z.string(),
});
const common = {
  as_of: timestamp,
  local_date: z.iso.date(),
  timezone: z.string().min(1),
  pending_count: count,
  confirmed_count: count,
  attended_count: count,
  no_show_count: count,
  cancelled_count: count,
};
export const professionalDashboardRowSchema = z.strictObject({
  ...common,
  upcoming: z.array(professionalUpcomingSchema).max(5),
});
export const staffDashboardRowSchema = z.strictObject({
  ...common,
  professional_centers_with_appointments_count: count,
  upcoming: z.array(staffUpcomingSchema).max(5),
});
export type ProfessionalDashboardRow = z.infer<typeof professionalDashboardRowSchema>;
export type StaffDashboardRow = z.infer<typeof staffDashboardRowSchema>;
export type DailyDashboard =
  | { scope: "staff"; row: StaffDashboardRow; activeTotal: number; toAttend: number }
  | { scope: "professional"; row: ProfessionalDashboardRow; activeTotal: number; toAttend: number };

export class DashboardContractError extends Error {
  constructor() {
    super("Invalid daily dashboard RPC contract");
  }
}

type RpcName = "staff_get_daily_dashboard" | "professional_get_own_daily_dashboard";
type Transport = (
  name: RpcName,
  args: { p_center_id: string },
) => Promise<{ data: unknown; error: unknown }>;

function civilDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseDashboardRow(scope: "staff" | "professional", data: unknown): DailyDashboard {
  const schema = scope === "staff" ? staffDashboardRowSchema : professionalDashboardRowSchema;
  const parsed = z.array(schema).safeParse(data);
  if (!parsed.success || parsed.data.length !== 1) throw new DashboardContractError();
  const row = parsed.data[0];
  try {
    if (civilDate(row.as_of, row.timezone) !== row.local_date) throw new Error();
    const asOf = Date.parse(row.as_of);
    let priorTime = -Infinity;
    let priorId = "";
    const ids = new Set<string>();
    for (const item of row.upcoming) {
      if (
        Date.parse(item.starts_at) < asOf ||
        Date.parse(item.ends_at) <= Date.parse(item.starts_at) ||
        civilDate(item.starts_at, row.timezone) !== row.local_date ||
        ids.has(item.appointment_id)
      )
        throw new Error();
      const time = Date.parse(item.starts_at);
      if (time < priorTime || (time === priorTime && item.appointment_id <= priorId))
        throw new Error();
      priorTime = time;
      priorId = item.appointment_id;
      ids.add(item.appointment_id);
    }
    const toAttend = row.pending_count + row.confirmed_count;
    const activeTotal = toAttend + row.attended_count + row.no_show_count;
    if (
      !Number.isSafeInteger(toAttend) ||
      !Number.isSafeInteger(activeTotal) ||
      row.upcoming.length > toAttend
    )
      throw new Error();
    if (scope === "staff") {
      const staff = row as StaffDashboardRow;
      if (staff.professional_centers_with_appointments_count > activeTotal) throw new Error();
      return { scope, row: staff, activeTotal, toAttend };
    }
    return { scope, row: row as ProfessionalDashboardRow, activeTotal, toAttend };
  } catch {
    throw new DashboardContractError();
  }
}

export async function callDailyDashboardRpc(
  client: SupabaseClient<Database>,
  scope: "staff" | "professional",
  centerId: string,
): Promise<DailyDashboard> {
  const name: RpcName =
    scope === "staff" ? "staff_get_daily_dashboard" : "professional_get_own_daily_dashboard";
  // Generated Database types predate TASK-021; only this transport boundary is narrowed.
  const rpc = client.rpc as unknown as Transport;
  const { data, error } = await rpc.call(client, name, { p_center_id: z.uuid().parse(centerId) });
  if (error) throw error;
  return parseDashboardRow(scope, data);
}
