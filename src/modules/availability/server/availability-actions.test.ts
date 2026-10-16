import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { performAvailabilityAction } from "./availability-actions";

const centerId = "11111111-1111-4111-8111-111111111111";
const professionalCenterId = "22222222-2222-4222-8222-222222222222";
const availabilityId = "33333333-3333-4333-8333-333333333333";
const expectedUpdatedAt = "2026-10-16T12:00:00+00:00";
const client = {} as SupabaseClient<Database>;
function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    centerId,
    professionalCenterId,
    availabilityId,
    expectedUpdatedAt,
    weekday: "1",
    startTime: "09:00",
    endTime: "13:00",
    minutes: "30",
    ...overrides,
  }))
    result.set(key, value);
  return result;
}
function deps() {
  return {
    createServerClient: vi.fn(async () => client),
    authorize: vi.fn(async () => ({}) as never),
    create: vi.fn(async () => ({ has_future_outside_availability: false }) as never),
    update: vi.fn(async () => ({ has_future_outside_availability: false }) as never),
    deactivate: vi.fn(async () => ({ has_future_outside_availability: false }) as never),
    updateDuration: vi.fn(async () => ({}) as never),
    revalidate: vi.fn(),
  };
}

describe("Availability Server Actions", () => {
  it.each(["create", "update", "deactivate", "duration"] as const)(
    "reauthorizes %s before RPC",
    async (operation) => {
      const dependencies = deps();
      dependencies.authorize.mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));
      expect(await performAvailabilityAction(operation, form(), dependencies)).toMatchObject({
        status: "error",
      });
      expect(dependencies.create).not.toHaveBeenCalled();
      expect(dependencies.update).not.toHaveBeenCalled();
      expect(dependencies.deactivate).not.toHaveBeenCalled();
      expect(dependencies.updateDuration).not.toHaveBeenCalled();
    },
  );
  it("creates under ADMIN/RECEPTION role check, returns boolean warning, and revalidates scoped paths", async () => {
    const dependencies = deps();
    dependencies.create.mockResolvedValueOnce({ has_future_outside_availability: true } as never);
    expect(await performAvailabilityAction("create", form(), dependencies)).toMatchObject({
      status: "success",
      warning: true,
    });
    expect(dependencies.authorize).toHaveBeenCalledWith(centerId, ["ADMIN", "RECEPTION"], client);
    expect(dependencies.create).toHaveBeenCalledWith(
      { centerId, professionalCenterId, weekday: 1, startTime: "09:00", endTime: "13:00" },
      client,
    );
    expect(dependencies.revalidate).toHaveBeenCalledWith(centerId, professionalCenterId);
  });
  it("sends the exact rendered token for edit, remove and duration", async () => {
    const dependencies = deps();
    await performAvailabilityAction("update", form(), dependencies);
    await performAvailabilityAction("deactivate", form(), dependencies);
    await performAvailabilityAction("duration", form(), dependencies);
    expect(dependencies.update).toHaveBeenCalledWith(
      {
        centerId,
        professionalCenterId,
        availabilityId,
        expectedUpdatedAt,
        startTime: "09:00",
        endTime: "13:00",
      },
      client,
    );
    expect(dependencies.deactivate).toHaveBeenCalledWith(
      { centerId, professionalCenterId, availabilityId, expectedUpdatedAt },
      client,
    );
    expect(dependencies.updateDuration).toHaveBeenCalledWith(
      { centerId, professionalCenterId, expectedUpdatedAt, minutes: 30 },
      client,
    );
  });
  it("rejects invalid interval before mutation and maps stale separately", async () => {
    const dependencies = deps();
    expect(
      await performAvailabilityAction("create", form({ endTime: "08:00" }), dependencies),
    ).toMatchObject({ status: "error", fieldErrors: { endTime: expect.any(String) } });
    expect(dependencies.create).not.toHaveBeenCalled();
    dependencies.update.mockRejectedValueOnce({
      code: "P0001",
      message: "STALE_AVAILABILITY_STATE",
    });
    expect(await performAvailabilityAction("update", form(), dependencies)).toMatchObject({
      status: "stale",
    });
  });
  it("maps overlap to stable user message without SQL", async () => {
    const dependencies = deps();
    dependencies.create.mockRejectedValueOnce({
      code: "23P01",
      message:
        'conflicting key value violates exclusion constraint "availabilities_no_active_overlap"',
    });
    const result = await performAvailabilityAction("create", form(), dependencies);
    expect(result.message).toContain("superpone");
    expect(result.message).not.toContain("constraint");
  });
});
