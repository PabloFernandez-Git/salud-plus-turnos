import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { getDailyDashboard } from "../server/daily-dashboard";
import { refreshDailyDashboardAction } from "./daily-dashboard-actions";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("../server/daily-dashboard", () => ({ getDailyDashboard: vi.fn() }));

describe("dashboard refresh action", () => {
  it("distinguishes access denial from an internal read failure", async () => {
    vi.mocked(getDailyDashboard).mockRejectedValueOnce(
      new AuthorizationError("CENTER_ACCESS_DENIED"),
    );
    await expect(refreshDailyDashboardAction("center-a")).resolves.toMatchObject({
      status: "denied",
    });
    vi.mocked(getDailyDashboard).mockRejectedValueOnce(new Error("connection failed"));
    await expect(refreshDailyDashboardAction("center-a")).resolves.toMatchObject({
      status: "error",
    });
  });
});
