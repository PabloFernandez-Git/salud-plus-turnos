import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import { CenterMembershipMutationError } from "./administration";
import { AuthorizationError } from "./authorization";
import { performUpdateCenterMembershipAction } from "./center-membership-actions";

const centerId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const professionalCenterId = "33333333-3333-4333-8333-333333333333";
const actorUserId = "44444444-4444-4444-8444-444444444444";
const targetUserId = "55555555-5555-4555-8555-555555555555";
const client = {} as SupabaseClient<Database>;

function form(overrides: Record<string, string> = {}) {
  const values = {
    centerId,
    membershipId,
    expectedRole: "ADMIN",
    expectedProfessionalCenterId: "",
    expectedIsActive: "true",
    role: "RECEPTION",
    professionalCenterId: "",
    isActive: "true",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function dependencies() {
  return {
    createServerClient: vi.fn(async () => client),
    requireCenterAdmin: vi.fn(async () => ({}) as never),
    updateMembership: vi.fn(async (input) => ({
      actorUserId,
      targetUserId,
      membership: {
        membership_id: input.membershipId,
        role: input.role,
        professional_center_id: input.professionalCenterId,
        is_active: input.isActive,
      },
    })),
    revalidateUsers: vi.fn(),
  };
}

describe("performUpdateCenterMembershipAction", () => {
  it("reauthorizes before parsing the mutation payload", async () => {
    const deps = dependencies();
    deps.requireCenterAdmin.mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));

    const state = await performUpdateCenterMembershipAction(
      form({ membershipId: "attacker-value" }),
      deps,
    );

    expect(state).toMatchObject({ status: "error", message: expect.stringContaining("permiso") });
    expect(deps.updateMembership).not.toHaveBeenCalled();
  });

  it.each([
    ["ADMIN", "RECEPTION", true, true],
    ["RECEPTION", "ADMIN", true, true],
    ["RECEPTION", "RECEPTION", false, true],
    ["RECEPTION", "RECEPTION", true, false],
  ] as const)(
    "submits the desired membership transition %s → %s / %s → %s",
    async (expectedRole, role, expectedIsActive, isActive) => {
      const deps = dependencies();
      const state = await performUpdateCenterMembershipAction(
        form({
          expectedRole,
          role,
          expectedIsActive: String(expectedIsActive),
          isActive: String(isActive),
        }),
        deps,
      );

      expect(state).toMatchObject({
        status: "success",
        membership: { id: membershipId, role, isActive },
      });
      expect(deps.updateMembership).toHaveBeenCalledWith(
        expect.objectContaining({ centerId, membershipId, role, isActive }),
        client,
      );
      expect(deps.revalidateUsers).toHaveBeenCalledWith(centerId);
    },
  );

  it("returns the persisted ProfessionalCenter selected by the RPC", async () => {
    const deps = dependencies();
    const state = await performUpdateCenterMembershipAction(
      form({ role: "PROFESSIONAL", professionalCenterId }),
      deps,
    );

    expect(state).toMatchObject({
      status: "success",
      membership: { role: "PROFESSIONAL", professionalCenterId },
    });
  });

  it.each([
    ["23514", "The center must retain an active ADMIN.", "conservar"],
    ["23505", "The ProfessionalCenter already has an active PROFESSIONAL membership.", "asignado"],
    ["23514", "An active ProfessionalCenter in this center is required.", "no es válido"],
    ["P0002", "Center membership not found.", "cambió"],
    ["42501", "Center administration denied.", "permiso"],
  ])("maps database error %s without leaking SQL details", async (code, message, expected) => {
    const deps = dependencies();
    deps.updateMembership.mockRejectedValueOnce({ code, message });

    const state = await performUpdateCenterMembershipAction(form(), deps);

    expect(state).toMatchObject({ status: "error", message: expect.stringContaining(expected) });
    expect(state.message).not.toContain(message);
  });

  it("rejects a stale browser snapshot before calling the RPC", async () => {
    const deps = dependencies();
    deps.updateMembership.mockRejectedValueOnce(new CenterMembershipMutationError("STALE"));

    const state = await performUpdateCenterMembershipAction(form(), deps);

    expect(state).toMatchObject({ status: "error", message: expect.stringContaining("cambió") });
  });

  it("navigates safely after a successful self-demotion or self-deactivation", async () => {
    const demotion = dependencies();
    demotion.updateMembership.mockResolvedValueOnce({
      actorUserId,
      targetUserId: actorUserId,
      membership: {
        membership_id: membershipId,
        role: "RECEPTION",
        professional_center_id: null,
        is_active: true,
      },
    });
    await expect(performUpdateCenterMembershipAction(form(), demotion)).resolves.toMatchObject({
      status: "success",
      navigation: `/centers/${centerId}`,
    });

    const deactivation = dependencies();
    deactivation.updateMembership.mockResolvedValueOnce({
      actorUserId,
      targetUserId: actorUserId,
      membership: {
        membership_id: membershipId,
        role: "ADMIN",
        professional_center_id: null,
        is_active: false,
      },
    });
    await expect(
      performUpdateCenterMembershipAction(form({ role: "ADMIN", isActive: "false" }), deactivation),
    ).resolves.toMatchObject({ status: "success", navigation: "/select-center" });
  });
});
