import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { listProfessionalSpecialtyConfiguration } from "./professionals";
import { updateProfessionalSpecialties } from "./professional-specialties";

vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});
const centerId = "11111111-1111-4111-8111-111111111111";
const pcId = "22222222-2222-4222-8222-222222222222";
const activeId = "33333333-3333-4333-8333-333333333333";
const inactiveId = "44444444-4444-4444-8444-444444444444";
const token = "2026-10-09T12:00:00+00:00";

describe("Professional specialty server boundary", () => {
  it("reads active and inactive rows only for the authorized Center in two scoped queries", async () => {
    vi.mocked(requireRole).mockResolvedValue({} as never);
    const eq = vi.fn((table: string, key: string, value: string) => {
      expect(key).toBe("center_id");
      expect(value).toBe(centerId);
      return Promise.resolve({
        error: null,
        data:
          table === "specialties"
            ? [
                { id: activeId, name: "Cardiología", is_active: true },
                { id: inactiveId, name: "Clínica", is_active: false },
              ]
            : [
                { professional_center_id: pcId, specialty_id: activeId, is_active: true },
                { professional_center_id: pcId, specialty_id: inactiveId, is_active: true },
              ],
      });
    });
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => ({ eq: (key: string, value: string) => eq(table, key, value) })),
    }));
    const client = { from } as unknown as SupabaseClient<Database>;
    const result = await listProfessionalSpecialtyConfiguration(centerId, client);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN"], client);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "specialties",
      "professional_center_specialties",
    ]);
    expect(result.associations).toHaveLength(2);
    expect(result.specialties.find((row) => row.id === inactiveId)?.isActive).toBe(false);
  });

  it("fails closed if an association cannot be matched to a visible Center Specialty", async () => {
    vi.mocked(requireRole).mockResolvedValue({} as never);
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          error: null,
          data:
            table === "specialties"
              ? [{ id: activeId, name: "Cardiología", is_active: true }]
              : [{ professional_center_id: pcId, specialty_id: inactiveId, is_active: true }],
        })),
      })),
    }));
    await expect(
      listProfessionalSpecialtyConfiguration(centerId, {
        from,
      } as unknown as SupabaseClient<Database>),
    ).rejects.toThrow("SPECIALTY_NOT_VISIBLE");
  });

  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED", "PLATFORM_FORBIDDEN"] as const)(
    "denies %s before reading or mutating",
    async (code) => {
      const from = vi.fn();
      const rpc = vi.fn();
      const client = { from, rpc } as unknown as SupabaseClient<Database>;
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(listProfessionalSpecialtyConfiguration(centerId, client)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(
        updateProfessionalSpecialties(
          {
            centerId,
            professionalCenterId: pcId,
            expectedUpdatedAt: token,
            activateSpecialtyIds: [activeId],
            deactivateSpecialtyIds: [],
          },
          client,
        ),
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(from).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("calls only the approved batch RPC with exact CAS and delta args", async () => {
    vi.mocked(requireRole).mockResolvedValue({} as never);
    const result = {
      professional_center_id: pcId,
      professional_center_updated_at: "2026-10-09T12:01:00+00:00",
      activated_count: 1,
      deactivated_count: 1,
    };
    const single = vi.fn(async () => ({ data: result, error: null }));
    const rpc = vi.fn(() => ({ single }));
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await expect(
      updateProfessionalSpecialties(
        {
          centerId,
          professionalCenterId: pcId,
          expectedUpdatedAt: token,
          activateSpecialtyIds: [activeId],
          deactivateSpecialtyIds: [inactiveId],
        },
        client,
      ),
    ).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_update_professional_center_specialties", {
      p_center_id: centerId,
      p_professional_center_id: pcId,
      p_expected_professional_center_updated_at: token,
      p_activate_specialty_ids: [activeId],
      p_deactivate_specialty_ids: [inactiveId],
    });
  });
});
