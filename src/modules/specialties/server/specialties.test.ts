import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  createSpecialty,
  listSpecialties,
  setSpecialtyActive,
  updateSpecialty,
} from "./specialties";

vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});

const centerId = "11111111-1111-4111-8111-111111111111";
const specialtyId = "22222222-2222-4222-8222-222222222222";
const expectedUpdatedAt = "2026-10-09T12:00:00+00:00";
const row = {
  id: specialtyId,
  name: "Cardiología",
  description: "Conservada",
  is_active: true,
  updated_at: expectedUpdatedAt,
};

function fakeClient(data = [row]) {
  const single = vi.fn(async () => ({ data: row, error: null }));
  const order = vi.fn(async () => ({ data, error: null }));
  const eq = vi.fn(() => ({ eq, order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(() => ({ single }));
  return { client: { from, rpc } as unknown as SupabaseClient<Database>, from, rpc, eq };
}

describe("Specialty server query and RPC boundary", () => {
  it("lists active and inactive rows only after ADMIN authorization and center filtering", async () => {
    vi.mocked(requireRole).mockResolvedValue({} as never);
    const fake = fakeClient([
      { ...row },
      { ...row, id: "33333333-3333-4333-8333-333333333333", is_active: false },
    ]);
    expect(await listSpecialties(centerId, fake.client)).toHaveLength(2);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN"], fake.client);
    expect(fake.eq).toHaveBeenCalledWith("center_id", centerId);
  });

  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED", "PLATFORM_FORBIDDEN"] as const)(
    "does not read or mutate for %s",
    async (code) => {
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      const fake = fakeClient();
      await expect(listSpecialties(centerId, fake.client)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      expect(fake.from).not.toHaveBeenCalled();
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );

  it("uses approved RPCs for optional and editable descriptions with CAS", async () => {
    vi.mocked(requireRole).mockResolvedValue({} as never);
    const fake = fakeClient();
    await createSpecialty({ centerId, name: " Cardiología " }, fake.client);
    expect(fake.rpc).toHaveBeenCalledWith("admin_create_specialty", {
      p_center_id: centerId,
      p_name: "Cardiología",
      p_description: "",
    });
    await createSpecialty({ centerId, name: " Clínica ", description: "  Adultos  " }, fake.client);
    expect(fake.rpc).toHaveBeenCalledWith("admin_create_specialty", {
      p_center_id: centerId,
      p_name: "Clínica",
      p_description: "Adultos",
    });
    await updateSpecialty(
      { centerId, specialtyId, expectedUpdatedAt, name: "Clínica", description: "  Pediatría  " },
      fake.client,
    );
    expect(fake.rpc).toHaveBeenCalledWith("admin_update_specialty", {
      p_center_id: centerId,
      p_specialty_id: specialtyId,
      p_expected_updated_at: expectedUpdatedAt,
      p_name: "Clínica",
      p_description: "Pediatría",
    });
    await updateSpecialty(
      { centerId, specialtyId, expectedUpdatedAt, name: "Clínica", description: "  " },
      fake.client,
    );
    expect(fake.rpc).toHaveBeenCalledWith("admin_update_specialty", {
      p_center_id: centerId,
      p_specialty_id: specialtyId,
      p_expected_updated_at: expectedUpdatedAt,
      p_name: "Clínica",
      p_description: "",
    });
    await setSpecialtyActive(
      { centerId, specialtyId, expectedUpdatedAt, isActive: false, confirmed: true },
      fake.client,
    );
    expect(fake.rpc).toHaveBeenCalledWith("admin_set_specialty_active", {
      p_center_id: centerId,
      p_specialty_id: specialtyId,
      p_expected_updated_at: expectedUpdatedAt,
      p_is_active: false,
    });
  });
});
