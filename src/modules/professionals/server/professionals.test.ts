import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  createProfessional,
  linkProfessional,
  listProfessionals,
  resolveProfessional,
  setProfessionalCenterActive,
  updateProfessionalCenter,
} from "./professionals";

vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});
const centerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const professionalCenterId = "33333333-3333-4333-8333-333333333333";
const expectedUpdatedAt = "2026-10-09T12:00:00+00:00";
function fakeClient() {
  const centers = [
    {
      id: professionalCenterId,
      professional_id: professionalId,
      license_number: "M-1",
      usual_appointment_duration_minutes: 30,
      is_active: true,
      updated_at: expectedUpdatedAt,
    },
  ];
  const identities = [{ id: professionalId, first_name: "Ana", last_name: "Pérez" }];
  const eq = vi.fn(async () => ({ data: centers, error: null }));
  const inIds = vi.fn(async () => ({ data: identities, error: null }));
  const select = vi.fn((columns: string) =>
    columns.includes("professional_id") ? { eq } : { in: inIds },
  );
  const from = vi.fn(() => ({ select }));
  const single = vi.fn(async () => ({ data: { outcome: "CREATED" }, error: null }));
  const rpc = vi.fn((name: string, args: unknown) => {
    void name;
    void args;
    return { single };
  });
  return {
    client: { from, rpc } as unknown as SupabaseClient<Database>,
    from,
    rpc,
    select,
    eq,
    inIds,
  };
}
describe("Professional server boundary", () => {
  it("lists only current Center PCs and projects minimal identity", async () => {
    vi.mocked(requireRole).mockResolvedValue({} as never);
    const fake = fakeClient();
    const result = await listProfessionals(centerId, fake.client);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN"], fake.client);
    expect(fake.eq).toHaveBeenCalledWith("center_id", centerId);
    expect(fake.inIds).toHaveBeenCalledWith("id", [professionalId]);
    expect(fake.select).toHaveBeenCalledWith("id, first_name, last_name");
    expect(result).toEqual([
      {
        id: professionalCenterId,
        firstName: "Ana",
        lastName: "Pérez",
        licenseNumber: "M-1",
        usualAppointmentDurationMinutes: 30,
        isActive: true,
        updatedAt: expectedUpdatedAt,
      },
    ]);
  });
  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED", "PLATFORM_FORBIDDEN"] as const)(
    "denies %s before reads and RPC",
    async (code) => {
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      const fake = fakeClient();
      await expect(listProfessionals(centerId, fake.client)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      expect(fake.from).not.toHaveBeenCalled();
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(
        resolveProfessional(
          { centerId, nationalityCode: "AR", documentNumber: "123" },
          fake.client,
        ),
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it("uses only approved RPCs and scoped IDs with CAS", async () => {
    vi.mocked(requireRole).mockResolvedValue({} as never);
    const fake = fakeClient();
    await resolveProfessional(
      { centerId, nationalityCode: "AR", documentNumber: "123" },
      fake.client,
    );
    await createProfessional(
      {
        centerId,
        firstName: "Ana",
        lastName: "Pérez",
        nationalityCode: "AR",
        documentNumber: "123",
        email: "ana@example.com",
        phone: null,
        licenseNumber: null,
        usualAppointmentDurationMinutes: 30,
      },
      fake.client,
    );
    await linkProfessional(
      {
        centerId,
        professionalId,
        nationalityCode: "AR",
        documentNumber: "123",
        expectedProfessionalCenterUpdatedAt: null,
        confirmed: true,
      },
      fake.client,
    );
    await updateProfessionalCenter(
      {
        centerId,
        professionalCenterId,
        expectedUpdatedAt,
        licenseNumber: "M-1",
        usualAppointmentDurationMinutes: 30,
      },
      fake.client,
    );
    await setProfessionalCenterActive(
      { centerId, professionalCenterId, expectedUpdatedAt, isActive: false, confirmed: true },
      fake.client,
    );
    expect(fake.rpc.mock.calls.map(([name]) => name)).toEqual([
      "admin_resolve_professional_by_document",
      "admin_create_professional_with_center",
      "admin_link_professional_to_center",
      "admin_update_professional_center",
      "admin_set_professional_center_active",
    ]);
    expect(fake.rpc).toHaveBeenCalledWith(
      "admin_link_professional_to_center",
      expect.objectContaining({
        p_center_id: centerId,
        p_professional_id: professionalId,
        p_expected_professional_center_updated_at: null,
      }),
    );
    expect(fake.rpc).toHaveBeenCalledWith(
      "admin_update_professional_center",
      expect.objectContaining({
        p_center_id: centerId,
        p_professional_center_id: professionalCenterId,
        p_expected_updated_at: expectedUpdatedAt,
      }),
    );
  });
});
