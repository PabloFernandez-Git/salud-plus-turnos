import { describe, expect, it, vi } from "vitest";
import {
  callDailyDashboardRpc,
  DashboardContractError,
  parseDashboardRow,
} from "./daily-dashboard-rpc";

const centerId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const base = {
  as_of: "2026-11-01T05:20:00+00:00",
  local_date: "2026-11-01",
  timezone: "America/New_York",
  pending_count: 2,
  confirmed_count: 1,
  attended_count: 3,
  no_show_count: 1,
  cancelled_count: 4,
  upcoming: [
    {
      appointment_id: appointmentId,
      starts_at: "2026-11-01T06:30:00+00:00",
      ends_at: "2026-11-01T07:00:00+00:00",
      status: "PENDING",
      patient_first_name: "Eva",
      patient_last_name: "López",
      specialty_name: "Clínica",
    },
  ],
};
const staff = {
  ...base,
  professional_centers_with_appointments_count: 2,
  upcoming: base.upcoming.map((item) => ({
    ...item,
    professional_center_id: "33333333-3333-4333-8333-333333333333",
    professional_first_name: "Ana",
    professional_last_name: "García",
  })),
};

const mockClient = (data: unknown, error: unknown = null) => ({
  rpc: vi.fn(async () => ({ data, error })),
});

describe("daily dashboard RPC boundary", () => {
  it.each(["staff", "professional"] as const)(
    "selects the %s RPC with only center ID",
    async (scope) => {
      const row = scope === "staff" ? staff : base;
      const client = mockClient([row]);
      const result = await callDailyDashboardRpc(client as never, scope, centerId);
      expect(client.rpc).toHaveBeenCalledWith(
        scope === "staff" ? "staff_get_daily_dashboard" : "professional_get_own_daily_dashboard",
        { p_center_id: centerId },
      );
      expect(result.activeTotal).toBe(7);
      expect(result.toAttend).toBe(3);
      expect(result.row.cancelled_count).toBe(4);
      expect("professional_centers_with_appointments_count" in result.row).toBe(scope === "staff");
    },
  );

  it("rejects professional payloads containing staff fields", () => {
    expect(() => parseDashboardRow("professional", [staff])).toThrow(DashboardContractError);
    expect(() =>
      parseDashboardRow("professional", [{ ...base, upcoming: staff.upcoming }]),
    ).toThrow(DashboardContractError);
  });

  it("rejects missing rows, unsafe counts, more than five or wrong-day upcoming", () => {
    expect(() => parseDashboardRow("staff", [])).toThrow(DashboardContractError);
    expect(() =>
      parseDashboardRow("staff", [{ ...staff, pending_count: Number.MAX_SAFE_INTEGER + 1 }]),
    ).toThrow(DashboardContractError);
    expect(() =>
      parseDashboardRow("staff", [{ ...staff, upcoming: Array(6).fill(staff.upcoming[0]) }]),
    ).toThrow(DashboardContractError);
    expect(() =>
      parseDashboardRow("professional", [
        { ...base, upcoming: [{ ...base.upcoming[0], starts_at: "2026-11-02T06:30:00Z" }] },
      ]),
    ).toThrow(DashboardContractError);
  });

  it("preserves PostgreSQL errors and validates the DST repeated hour", async () => {
    expect(parseDashboardRow("professional", [base]).row.upcoming).toHaveLength(1);
    const error = { code: "42501" };
    await expect(
      callDailyDashboardRpc(mockClient(null, error) as never, "professional", centerId),
    ).rejects.toBe(error);
  });

  it("distinguishes zero active from activity without upcoming", () => {
    const empty = parseDashboardRow("professional", [
      {
        ...base,
        pending_count: 0,
        confirmed_count: 0,
        attended_count: 0,
        no_show_count: 0,
        upcoming: [],
      },
    ]);
    const past = parseDashboardRow("professional", [
      {
        ...base,
        pending_count: 0,
        confirmed_count: 0,
        attended_count: 1,
        no_show_count: 0,
        upcoming: [],
      },
    ]);
    expect(empty.activeTotal).toBe(0);
    expect(past.activeTotal).toBe(1);
  });
});
