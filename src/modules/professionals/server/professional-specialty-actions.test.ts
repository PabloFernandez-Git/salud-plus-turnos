import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { performProfessionalSpecialtyAction } from "./professional-specialty-actions";

const centerId = "11111111-1111-4111-8111-111111111111";
const pcId = "22222222-2222-4222-8222-222222222222";
const specialtyId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const token = "2026-10-09T12:00:00+00:00";
const nextToken = "2026-10-09T12:01:00+00:00";
const client = {} as SupabaseClient<Database>;
function form(activate: string[] = [], deactivate: string[] = []) {
  const data = new FormData();
  data.set("centerId", centerId);
  data.set("professionalCenterId", pcId);
  data.set("expectedUpdatedAt", token);
  for (const id of activate) data.append("activateSpecialtyIds", id);
  for (const id of deactivate) data.append("deactivateSpecialtyIds", id);
  return data;
}
function deps() {
  return {
    createServerClient: vi.fn(async () => client),
    requireAdmin: vi.fn(async () => ({}) as never),
    update: vi.fn(async () => ({ professional_center_updated_at: nextToken }) as never),
    revalidate: vi.fn(),
  };
}
describe("Professional specialty Action", () => {
  it("sends several adds and a removal in one batch and returns the authoritative token", async () => {
    const d = deps();
    const result = await performProfessionalSpecialtyAction(
      form([specialtyId, otherId], [pcId]),
      d,
    );
    expect(d.requireAdmin).toHaveBeenCalledWith(centerId, ["ADMIN"], client);
    expect(d.update).toHaveBeenCalledOnce();
    expect(d.update).toHaveBeenCalledWith(
      {
        centerId,
        professionalCenterId: pcId,
        expectedUpdatedAt: token,
        activateSpecialtyIds: [specialtyId, otherId],
        deactivateSpecialtyIds: [pcId],
      },
      client,
    );
    expect(result).toMatchObject({
      status: "success",
      message: "Especialidades del profesional actualizadas",
      updatedAt: nextToken,
    });
    expect(d.revalidate).toHaveBeenCalledWith(centerId);
  });
  it("does not call the RPC for an empty operation", async () => {
    const d = deps();
    expect((await performProfessionalSpecialtyAction(form(), d)).message).toContain(
      "No hay cambios",
    );
    expect(d.update).not.toHaveBeenCalled();
  });
  it("rejects malformed, duplicate and overlapping IDs before RPC", async () => {
    const d = deps();
    const invalid = [
      form(["not-uuid"]),
      form([specialtyId, specialtyId]),
      form([specialtyId], [specialtyId]),
    ];
    for (const data of invalid)
      expect((await performProfessionalSpecialtyAction(data, d)).status).toBe("error");
    expect(d.update).not.toHaveBeenCalled();
  });
  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED", "PLATFORM_FORBIDDEN"] as const)(
    "denies %s even when called directly",
    async (code) => {
      const d = deps();
      d.requireAdmin.mockRejectedValueOnce(new AuthorizationError(code));
      expect((await performProfessionalSpecialtyAction(form([specialtyId]), d)).status).toBe(
        "error",
      );
      expect(d.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["SPECIALTY_NOT_ACTIVE", "stale"],
    ["PROFESSIONAL_CENTER_NOT_ACTIVE", "stale"],
    ["STALE_PROFESSIONAL_CENTER_STATE", "stale"],
  ] as const)("maps %s to refresh-required %s with no retry", async (message, status) => {
    const d = deps();
    d.update.mockRejectedValueOnce({ code: "P0001", message });
    expect((await performProfessionalSpecialtyAction(form([specialtyId]), d)).status).toBe(status);
    expect(d.update).toHaveBeenCalledOnce();
    expect(d.revalidate).not.toHaveBeenCalled();
  });
  it.each(["RESOURCE_NOT_FOUND", "INVALID_SPECIALTY_BATCH"])(
    "fails closed on foreign or manipulated IDs: %s",
    async (message) => {
      const d = deps();
      d.update.mockRejectedValueOnce({
        code: message === "RESOURCE_NOT_FOUND" ? "P0002" : "22023",
        message,
      });
      expect((await performProfessionalSpecialtyAction(form([specialtyId]), d)).status).toBe(
        "stale",
      );
      expect(d.revalidate).not.toHaveBeenCalled();
    },
  );
  it("maps a defensive DB empty batch error without mutation retry", async () => {
    const d = deps();
    d.update.mockRejectedValueOnce({ code: "22023", message: "NO_SPECIALTY_CHANGES" });
    expect((await performProfessionalSpecialtyAction(form([specialtyId]), d)).message).toContain(
      "No hay cambios",
    );
    expect(d.update).toHaveBeenCalledOnce();
  });
});
