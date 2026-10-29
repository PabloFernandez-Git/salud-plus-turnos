import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import {
  getAccessOverview,
  getPostLoginDestination,
  hasOptionalPlatformNavigation,
  hasPlatformAdminRole,
} from "./access";

type Row = Record<string, unknown>;

const center = { id: "center-a", name: "Centro A", timezone: "UTC", is_active: true };
const membership = {
  id: "membership-a",
  center_id: "center-a",
  user_id: "user-a",
  role: "RECEPTION",
  professional_center_id: null,
  is_active: true,
};

function fakeClient({
  centers = [center],
  memberships = [membership],
  platformAdmins = [],
  queryErrors = {},
}: {
  centers?: Row[];
  memberships?: Row[];
  platformAdmins?: Row[];
  queryErrors?: Record<string, Error>;
} = {}) {
  const tables: Record<string, Row[]> = {
    users: [{ id: "user-a", email: "user@example.test", first_name: "Ana", last_name: "A" }],
    center_memberships: memberships,
    centers,
    platform_admins: platformAdmins,
  };
  const queriedTables: string[] = [];
  const client = {
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "user-a" } }, error: null }),
    },
    from(table: string) {
      queriedTables.push(table);
      const filters: Array<(row: Row) => boolean> = [];
      const query = () => {
        if (queryErrors[table]) return { data: null, error: queryErrors[table] };
        return {
          data: (tables[table] ?? []).filter((row) => filters.every((test) => test(row))),
          error: null,
        };
      };
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
          const result = query();
          if (result.error) return result;
          return { data: result.data?.[0] ?? null, error: null };
        },
        then: <T>(onFulfilled: (value: ReturnType<typeof query>) => T) =>
          Promise.resolve(query()).then(onFulfilled),
      };
      return builder;
    },
  } as unknown as SupabaseClient<Database>;

  return { client, queriedTables };
}

describe("platform permission reads", () => {
  it("distinguishes a valid negative result from a failed strict lookup", async () => {
    await expect(hasPlatformAdminRole("user-a", fakeClient().client)).resolves.toBe(false);
    const error = new Error("platform lookup failed");
    await expect(
      hasPlatformAdminRole(
        "user-a",
        fakeClient({ queryErrors: { platform_admins: error } }).client,
      ),
    ).rejects.toBe(error);
  });

  it("uses a failed lookup only to hide optional navigation", async () => {
    const failed = fakeClient({ queryErrors: { platform_admins: new Error("unavailable") } });
    await expect(hasOptionalPlatformNavigation("user-a", failed.client)).resolves.toBe(false);
    await expect(
      hasOptionalPlatformNavigation(
        "user-a",
        fakeClient({ platformAdmins: [{ user_id: "user-a" }] }).client,
      ),
    ).resolves.toBe(true);
  });
});

describe("access overview and destination", () => {
  it("keeps one authorized center when the platform lookup fails", async () => {
    const { client } = fakeClient({ queryErrors: { platform_admins: new Error("unavailable") } });
    await expect(getAccessOverview(client)).resolves.toMatchObject({
      centers: [{ id: "center-a" }],
      isPlatformAdmin: null,
    });
    await expect(getPostLoginDestination(client)).resolves.toBe("/centers/center-a");
  });

  it("keeps the selector destination with multiple authorized centers", async () => {
    const client = fakeClient({
      memberships: [membership, { ...membership, id: "membership-b", center_id: "center-b" }],
      centers: [center, { ...center, id: "center-b", name: "Centro B" }],
      queryErrors: { platform_admins: new Error("unavailable") },
    }).client;
    await expect(getPostLoginDestination(client)).resolves.toBe("/select-center");
  });

  it("does not treat an unknown global permission as a definitive no-access result", async () => {
    const error = new Error("platform lookup failed");
    const client = fakeClient({ memberships: [], queryErrors: { platform_admins: error } }).client;
    await expect(getAccessOverview(client)).rejects.toBe(error);
    await expect(getPostLoginDestination(client)).rejects.toBe(error);
  });

  it("preserves platform and no-access destinations for confirmed results", async () => {
    await expect(
      getPostLoginDestination(
        fakeClient({ memberships: [], platformAdmins: [{ user_id: "user-a" }] }).client,
      ),
    ).resolves.toBe("/platform");
    await expect(getPostLoginDestination(fakeClient({ memberships: [] }).client)).resolves.toBe(
      "/no-access",
    );
  });

  it.each(["center_memberships", "centers"])(
    "propagates a %s failure even when the platform lookup succeeds",
    async (table) => {
      const error = new Error(`${table} failed`);
      await expect(
        getAccessOverview(fakeClient({ queryErrors: { [table]: error } }).client),
      ).rejects.toBe(error);
    },
  );

  it("never produces a positive global permission after a lookup failure", async () => {
    const { client } = fakeClient({ queryErrors: { platform_admins: new Error("unavailable") } });
    const overview = await getAccessOverview(client);
    expect(overview.isPlatformAdmin).not.toBe(true);
  });
});
