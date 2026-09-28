import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import { CenterMembershipMutationError, setCenterMembership } from "./administration";
import { AuthorizationError } from "./authorization";

type Row = Record<string, unknown>;

const centerA = "11111111-1111-4111-8111-111111111111";
const centerB = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const targetUserId = "44444444-4444-4444-8444-444444444444";
const targetMembershipId = "55555555-5555-4555-8555-555555555555";

function fakeClient(
  actorRole: "ADMIN" | "RECEPTION" = "ADMIN",
  rpcError: { code: string; message: string } | null = null,
) {
  const tables: Record<string, Row[]> = {
    users: [
      {
        id: actorId,
        email: "admin@example.test",
        first_name: "Ana",
        last_name: "Admin",
      },
    ],
    centers: [
      { id: centerA, name: "Centro A", timezone: "UTC", is_active: true },
      { id: centerB, name: "Centro B", timezone: "UTC", is_active: true },
    ],
    center_memberships: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        center_id: centerA,
        user_id: actorId,
        role: actorRole,
        professional_center_id: null,
        is_active: true,
      },
      {
        id: targetMembershipId,
        center_id: centerB,
        user_id: targetUserId,
        role: "RECEPTION",
        professional_center_id: null,
        is_active: true,
      },
    ],
  };
  const rpc = vi.fn(() => ({
    single: async () => ({
      data: {
        membership_id: targetMembershipId,
        role: "ADMIN",
        professional_center_id: null,
        is_active: true,
      },
      error: rpcError,
    }),
  }));
  const client = {
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: actorId, email: "admin@example.test" } },
        error: null,
      }),
    },
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      const rows = () =>
        (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        maybeSingle: async () => {
          const result = rows();
          return {
            data: result[0] ?? null,
            error: result.length > 1 ? new Error("multiple") : null,
          };
        },
      };
      return builder;
    },
    rpc,
  } as unknown as SupabaseClient<Database>;

  return { client, rpc, tables };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    centerId: centerA,
    membershipId: targetMembershipId,
    expectedRole: "RECEPTION" as const,
    expectedProfessionalCenterId: null,
    expectedIsActive: true,
    role: "ADMIN" as const,
    professionalCenterId: null,
    isActive: true,
    ...overrides,
  };
}

describe("setCenterMembership", () => {
  it("rejects a membership id from another Center before invoking the RPC", async () => {
    const { client, rpc } = fakeClient();

    await expect(setCenterMembership(input(), client)).rejects.toMatchObject<
      Partial<CenterMembershipMutationError>
    >({ code: "NOT_FOUND" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale role/state snapshot before invoking the RPC", async () => {
    const { client, rpc, tables } = fakeClient();
    const target = tables.center_memberships![1]!;
    target.center_id = centerA;
    target.role = "ADMIN";

    await expect(setCenterMembership(input(), client)).rejects.toMatchObject<
      Partial<CenterMembershipMutationError>
    >({ code: "STALE" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the verified same-Center target to admin_set_center_membership", async () => {
    const { client, rpc, tables } = fakeClient();
    tables.center_memberships![1]!.center_id = centerA;

    await expect(setCenterMembership(input(), client)).resolves.toMatchObject({
      actorUserId: actorId,
      targetUserId,
      membership: { role: "ADMIN", is_active: true },
    });
    expect(rpc).toHaveBeenCalledWith("admin_set_center_membership", {
      p_center_id: centerA,
      p_expected_is_active: true,
      p_expected_professional_center_id: null,
      p_expected_role: "RECEPTION",
      p_is_active: true,
      p_membership_id: targetMembershipId,
      p_professional_center_id: null,
      p_role: "ADMIN",
    });
  });

  it("maps an atomic RPC stale rejection to the recoverable application error", async () => {
    const { client, rpc, tables } = fakeClient("ADMIN", {
      code: "P0001",
      message: "STALE_MEMBERSHIP_STATE",
    });
    tables.center_memberships![1]!.center_id = centerA;

    await expect(setCenterMembership(input(), client)).rejects.toMatchObject<
      Partial<CenterMembershipMutationError>
    >({ code: "STALE" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("denies a RECEPTION actor before resolving the target", async () => {
    const { client, rpc, tables } = fakeClient("RECEPTION");
    tables.center_memberships![1]!.center_id = centerA;

    await expect(setCenterMembership(input(), client)).rejects.toMatchObject<
      Partial<AuthorizationError>
    >({ code: "ROLE_FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
