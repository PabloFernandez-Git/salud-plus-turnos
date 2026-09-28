import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import {
  AuthorizationError,
  requireCenterMembership,
  requirePlatformAdmin,
  requireRole,
} from "./authorization";

type Row = Record<string, unknown>;

function fakeClient({
  centers,
  memberships,
  platformAdmins = [],
}: {
  centers: Row[];
  memberships: Row[];
  platformAdmins?: Row[];
}) {
  const tables: Record<string, Row[]> = {
    center_memberships: memberships,
    centers,
    platform_admins: platformAdmins,
    users: [
      {
        id: "user-a",
        email: "user-a@example.test",
        first_name: "User",
        last_name: "A",
      },
    ],
  };

  return {
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: "user-a", email: "user-a@example.test" } },
        error: null,
      }),
    },
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => {
          const rows = (tables[table] ?? []).filter((row) =>
            filters.every(([column, value]) => row[column] === value),
          );
          return { data: rows[0] ?? null, error: rows.length > 1 ? new Error("multiple") : null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
}

const activeCenterA = {
  id: "center-a",
  name: "Centro A",
  timezone: "America/Argentina/Buenos_Aires",
  is_active: true,
};
const activeCenterB = { ...activeCenterA, id: "center-b", name: "Centro B" };
const activeMembershipA = {
  id: "membership-a",
  center_id: "center-a",
  user_id: "user-a",
  role: "RECEPTION",
  professional_center_id: null,
  is_active: true,
};

describe("requireCenterMembership", () => {
  it("allows the user's active Center", async () => {
    const context = await requireCenterMembership(
      "center-a",
      fakeClient({ centers: [activeCenterA], memberships: [activeMembershipA] }),
    );

    expect(context.center.id).toBe("center-a");
  });

  it("denies Center B to a Center A user without leaking B", async () => {
    await expect(
      requireCenterMembership(
        "center-b",
        fakeClient({ centers: [activeCenterA, activeCenterB], memberships: [activeMembershipA] }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "CENTER_ACCESS_DENIED" });
  });

  it("denies an inactive membership", async () => {
    await expect(
      requireCenterMembership(
        "center-a",
        fakeClient({
          centers: [activeCenterA],
          memberships: [{ ...activeMembershipA, is_active: false }],
        }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "CENTER_ACCESS_DENIED" });
  });

  it("denies an inactive Center", async () => {
    await expect(
      requireCenterMembership(
        "center-a",
        fakeClient({
          centers: [{ ...activeCenterA, is_active: false }],
          memberships: [activeMembershipA],
        }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "CENTER_ACCESS_DENIED" });
  });

  it("does not turn PLATFORM_ADMIN into tenant access", async () => {
    await expect(
      requireCenterMembership(
        "center-a",
        fakeClient({
          centers: [activeCenterA],
          memberships: [],
          platformAdmins: [{ user_id: "user-a" }],
        }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "CENTER_ACCESS_DENIED" });
  });
});

describe("requirePlatformAdmin", () => {
  it("allows an explicit PLATFORM_ADMIN", async () => {
    await expect(
      requirePlatformAdmin(
        fakeClient({
          centers: [],
          memberships: [],
          platformAdmins: [{ user_id: "user-a" }],
        }),
      ),
    ).resolves.toMatchObject({ id: "user-a" });
  });

  it.each(["ADMIN", "RECEPTION", "PROFESSIONAL"])(
    "denies a tenant %s without PLATFORM_ADMIN",
    async (role) => {
      await expect(
        requirePlatformAdmin(
          fakeClient({
            centers: [activeCenterA],
            memberships: [{ ...activeMembershipA, role }],
          }),
        ),
      ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "PLATFORM_FORBIDDEN" });
    },
  );

  it("denies an authenticated user without any platform grant", async () => {
    await expect(
      requirePlatformAdmin(fakeClient({ centers: [], memberships: [] })),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "PLATFORM_FORBIDDEN" });
  });
});

describe("requireRole for Center user administration", () => {
  it("allows an active ADMIN of the requested Center", async () => {
    await expect(
      requireRole(
        "center-a",
        ["ADMIN"],
        fakeClient({
          centers: [activeCenterA],
          memberships: [{ ...activeMembershipA, role: "ADMIN" }],
        }),
      ),
    ).resolves.toMatchObject({ membership: { role: "ADMIN" } });
  });

  it.each(["RECEPTION", "PROFESSIONAL"] as const)("denies an active %s", async (role) => {
    await expect(
      requireRole(
        "center-a",
        ["ADMIN"],
        fakeClient({
          centers: [activeCenterA],
          memberships: [{ ...activeMembershipA, role }],
        }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "ROLE_FORBIDDEN" });
  });

  it("denies an inactive ADMIN membership", async () => {
    await expect(
      requireRole(
        "center-a",
        ["ADMIN"],
        fakeClient({
          centers: [activeCenterA],
          memberships: [{ ...activeMembershipA, role: "ADMIN", is_active: false }],
        }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "CENTER_ACCESS_DENIED" });
  });

  it("denies an ADMIN of a different Center", async () => {
    await expect(
      requireRole(
        "center-a",
        ["ADMIN"],
        fakeClient({
          centers: [activeCenterA, activeCenterB],
          memberships: [{ ...activeMembershipA, center_id: "center-b", role: "ADMIN" }],
        }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "CENTER_ACCESS_DENIED" });
  });

  it("denies a PLATFORM_ADMIN without a tenant ADMIN membership", async () => {
    await expect(
      requireRole(
        "center-a",
        ["ADMIN"],
        fakeClient({
          centers: [activeCenterA],
          memberships: [],
          platformAdmins: [{ user_id: "user-a" }],
        }),
      ),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "CENTER_ACCESS_DENIED" });
  });
});
