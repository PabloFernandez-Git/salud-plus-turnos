import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import { AuthorizationError } from "./authorization";
import {
  listAvailableProfessionalCenters,
  listCenterUsers,
  listManageableProfessionalCenters,
  resolveCenterIdentityByEmail,
} from "./center-users";

type Row = Record<string, unknown>;

function fakeClient({
  actorId = "user-admin",
  rpcRows = {},
  tables,
}: {
  actorId?: string;
  rpcRows?: Record<string, Row>;
  tables: Record<string, Row[]>;
}) {
  return {
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: actorId, email: `${actorId}@example.test` } },
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
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        maybeSingle: async () => {
          const result = rows();
          return {
            data: result[0] ?? null,
            error: result.length > 1 ? new Error("multiple") : null,
          };
        },
        then: (
          resolve: (value: { data: Row[]; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
      };
      return builder;
    },
    rpc(functionName: string) {
      return {
        single: async () => ({ data: rpcRows[functionName] ?? null, error: null }),
      };
    },
  } as unknown as SupabaseClient<Database>;
}

const centerA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Centro A",
  timezone: "America/Argentina/Buenos_Aires",
  is_active: true,
};
const centerB = { ...centerA, id: "22222222-2222-4222-8222-222222222222", name: "Centro B" };
const admin = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  center_id: centerA.id,
  user_id: "user-admin",
  role: "ADMIN",
  professional_center_id: null,
  is_active: true,
};

function baseTables() {
  return {
    centers: [centerA, centerB],
    platform_admins: [],
    users: [
      {
        id: "user-admin",
        email: "admin@example.test",
        first_name: "Ana",
        last_name: "Admin",
      },
      {
        id: "user-reception",
        email: "recepcion@example.test",
        first_name: "Rita",
        last_name: "Recepción",
      },
      {
        id: "user-professional",
        email: "professional@example.test",
        first_name: "Pablo",
        last_name: "Profesional",
      },
      {
        id: "user-other-center",
        email: "other@example.test",
        first_name: "Otro",
        last_name: "Centro",
      },
    ],
    center_memberships: [
      admin,
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        center_id: centerA.id,
        user_id: "user-reception",
        role: "RECEPTION",
        professional_center_id: null,
        is_active: false,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        center_id: centerA.id,
        user_id: "user-professional",
        role: "PROFESSIONAL",
        professional_center_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        is_active: true,
      },
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        center_id: centerB.id,
        user_id: "user-other-center",
        role: "ADMIN",
        professional_center_id: null,
        is_active: true,
      },
    ],
    professional_centers: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        center_id: centerA.id,
        professional_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        license_number: "MP 1234",
        is_active: true,
      },
    ],
    professionals: [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        first_name: "Paula",
        last_name: "Médica",
      },
    ],
  };
}

describe("listCenterUsers", () => {
  it("lists only memberships from the authorized Center and composes allowed Professional data", async () => {
    const users = await listCenterUsers(centerA.id, fakeClient({ tables: baseTables() }));

    expect(users).toHaveLength(3);
    expect(users.map((user) => user.userId)).not.toContain("user-other-center");
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "admin@example.test",
          firstName: "Ana",
          lastName: "Admin",
          role: "ADMIN",
          isActive: true,
          professional: null,
        }),
        expect.objectContaining({
          email: "recepcion@example.test",
          role: "RECEPTION",
          isActive: false,
          professional: null,
        }),
        expect.objectContaining({
          email: "professional@example.test",
          role: "PROFESSIONAL",
          isActive: true,
          professional: {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            firstName: "Paula",
            lastName: "Médica",
            licenseNumber: "MP 1234",
            isActive: true,
          },
        }),
      ]),
    );
  });

  it("denies a non-ADMIN before listing", async () => {
    const tables = baseTables();
    tables.center_memberships = [{ ...admin, role: "RECEPTION" }];

    await expect(listCenterUsers(centerA.id, fakeClient({ tables }))).rejects.toMatchObject<
      Partial<AuthorizationError>
    >({ code: "ROLE_FORBIDDEN" });
  });
});

describe("resolveCenterIdentityByEmail", () => {
  it("normalizes an exact email and returns only the approved identity contract", async () => {
    const resolution = {
      identity_exists: true,
      user_id: "user-reception",
      email: "recepcion@example.test",
      first_name: "Rita",
      last_name: "Recepción",
      center_membership_exists: true,
      center_membership_is_active: false,
    };
    const client = fakeClient({
      tables: baseTables(),
      rpcRows: { admin_resolve_user_by_email: resolution },
    });

    await expect(
      resolveCenterIdentityByEmail(centerA.id, "  RECEPCION@EXAMPLE.TEST ", client),
    ).resolves.toEqual(resolution);
  });

  it("denies resolution to a non-ADMIN", async () => {
    const tables = baseTables();
    tables.center_memberships = [{ ...admin, role: "PROFESSIONAL" }];

    await expect(
      resolveCenterIdentityByEmail(centerA.id, "known@example.test", fakeClient({ tables })),
    ).rejects.toMatchObject<Partial<AuthorizationError>>({ code: "ROLE_FORBIDDEN" });
  });
});

describe("listAvailableProfessionalCenters", () => {
  it("returns only active and unoccupied ProfessionalCenters from the authorized Center", async () => {
    const tables = baseTables();
    tables.professional_centers.push(
      {
        id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        center_id: centerA.id,
        professional_id: "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        license_number: "MP 9876",
        is_active: true,
      },
      {
        id: "22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        center_id: centerA.id,
        professional_id: "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        license_number: "MP inactive",
        is_active: false,
      },
      {
        id: "33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        center_id: centerB.id,
        professional_id: "33333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        license_number: "MP other",
        is_active: true,
      },
    );
    tables.professionals.push(
      {
        id: "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        first_name: "Zoe",
        last_name: "Disponible",
      },
      {
        id: "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        first_name: "Inés",
        last_name: "Inactiva",
      },
      {
        id: "33333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        first_name: "Cora",
        last_name: "Otro centro",
      },
    );

    await expect(
      listAvailableProfessionalCenters(centerA.id, fakeClient({ tables })),
    ).resolves.toEqual([
      {
        id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        firstName: "Zoe",
        lastName: "Disponible",
        licenseNumber: "MP 9876",
      },
    ]);
  });

  it("returns an empty list when the Center has no eligible ProfessionalCenter", async () => {
    await expect(
      listAvailableProfessionalCenters(centerA.id, fakeClient({ tables: baseTables() })),
    ).resolves.toEqual([]);
  });
});

describe("listManageableProfessionalCenters", () => {
  it("marks active same-Center associations with the occupying membership", async () => {
    const tables = baseTables();
    tables.professional_centers.push({
      id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      center_id: centerA.id,
      professional_id: "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      license_number: "MP 9876",
      is_active: true,
    });
    tables.professionals.push({
      id: "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      first_name: "Zoe",
      last_name: "Disponible",
    });

    await expect(
      listManageableProfessionalCenters(centerA.id, fakeClient({ tables })),
    ).resolves.toEqual([
      {
        id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        firstName: "Zoe",
        lastName: "Disponible",
        licenseNumber: "MP 9876",
        occupiedMembershipId: null,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        firstName: "Paula",
        lastName: "Médica",
        licenseNumber: "MP 1234",
        occupiedMembershipId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    ]);
  });
});
