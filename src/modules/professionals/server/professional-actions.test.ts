import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { performProfessionalAction } from "./professional-actions";

const centerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const professionalCenterId = "33333333-3333-4333-8333-333333333333";
const expectedUpdatedAt = "2026-10-09T12:00:00+00:00";
const client = {} as SupabaseClient<Database>;
function form(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    centerId,
    nationalityCode: "AR",
    documentNumber: "12.345.678",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.com",
    phone: "",
    licenseNumber: "M-1",
    usualAppointmentDurationMinutes: "30",
    professionalId,
    professionalCenterId,
    expectedUpdatedAt,
    expectedProfessionalCenterUpdatedAt: expectedUpdatedAt,
    isActive: "false",
    confirmed: "true",
    ...overrides,
  }))
    formData.set(key, value);
  return formData;
}
function deps() {
  return {
    createServerClient: vi.fn(async () => client),
    requireAdmin: vi.fn(async () => ({}) as never),
    resolve: vi.fn(async () => ({ resolution_status: "NOT_FOUND" }) as never),
    create: vi.fn(async () => ({}) as never),
    link: vi.fn(async () => ({}) as never),
    update: vi.fn(async () => ({}) as never),
    setActive: vi.fn(async () => ({}) as never),
    revalidate: vi.fn(),
  };
}
describe("Professional Server Actions", () => {
  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED", "PLATFORM_FORBIDDEN"] as const)(
    "denies %s before RPC",
    async (code) => {
      const d = deps();
      d.requireAdmin.mockRejectedValueOnce(new AuthorizationError(code));
      expect((await performProfessionalAction("create", form(), d)).message).toContain("permiso");
      expect(d.create).not.toHaveBeenCalled();
    },
  );
  it("resolves exact document and returns only the RPC result", async () => {
    const d = deps();
    d.resolve.mockResolvedValueOnce({
      resolution_status: "NOT_LINKED",
      first_name: "Ana",
      last_name: "Pérez",
      professional_id: professionalId,
    } as never);
    const result = await performProfessionalAction("resolve", form(), d);
    expect(result).toMatchObject({
      status: "resolved",
      resolution: { first_name: "Ana", last_name: "Pérez" },
    });
    expect(d.resolve).toHaveBeenCalledWith(
      { centerId, nationalityCode: "AR", documentNumber: "12.345.678" },
      client,
    );
  });
  it("creates with the reused email contract and no User/Auth mutation", async () => {
    const d = deps();
    expect(
      (await performProfessionalAction("create", form({ email: " ANA@EXAMPLE.COM " }), d)).status,
    ).toBe("success");
    expect(d.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ana@example.com", usualAppointmentDurationMinutes: 30 }),
      client,
    );
    expect(d.revalidate).toHaveBeenCalledWith(centerId);
  });
  it("requires link confirmation and passes document plus CAS", async () => {
    const d = deps();
    expect((await performProfessionalAction("link", form({ confirmed: "false" }), d)).status).toBe(
      "error",
    );
    expect(d.link).not.toHaveBeenCalled();
    await performProfessionalAction("link", form({ expectedProfessionalCenterUpdatedAt: "" }), d);
    expect(d.link).toHaveBeenCalledWith(
      expect.objectContaining({ professionalId, expectedProfessionalCenterUpdatedAt: null }),
      client,
    );
  });
  it("validates duration and required global fields", async () => {
    const d = deps();
    for (const duration of ["4", "481", "31"])
      expect(
        (
          await performProfessionalAction(
            "create",
            form({ usualAppointmentDurationMinutes: duration }),
            d,
          )
        ).status,
      ).toBe("error");
    expect((await performProfessionalAction("create", form({ firstName: " " }), d)).status).toBe(
      "error",
    );
    expect((await performProfessionalAction("create", form({ email: "bad" }), d)).status).toBe(
      "error",
    );
    expect(d.create).not.toHaveBeenCalled();
  });
  it("updates only local fields with CAS, including no-op values", async () => {
    const d = deps();
    d.update.mockResolvedValueOnce({ updated_at: "2026-10-09T12:01:00+00:00" } as never);
    expect(
      await performProfessionalAction("update", form({ licenseNumber: "  " }), d),
    ).toMatchObject({
      status: "success",
      updatedAt: "2026-10-09T12:01:00+00:00",
    });
    expect(d.update).toHaveBeenCalledWith(
      {
        centerId,
        professionalCenterId,
        expectedUpdatedAt,
        licenseNumber: null,
        usualAppointmentDurationMinutes: 30,
      },
      client,
    );
  });
  it("requires explicit state confirmation", async () => {
    const d = deps();
    expect(
      (await performProfessionalAction("setActive", form({ confirmed: "false" }), d)).status,
    ).toBe("error");
    await performProfessionalAction("setActive", form(), d);
    expect(d.setActive).toHaveBeenCalledWith(
      { centerId, professionalCenterId, expectedUpdatedAt, isActive: false, confirmed: true },
      client,
    );
  });
  it.each([
    ["false", "Profesional desactivado correctamente"],
    ["true", "Profesional activado correctamente"],
  ] as const)("returns the exact success message for isActive=%s", async (isActive, message) => {
    const d = deps();
    expect(await performProfessionalAction("setActive", form({ isActive }), d)).toMatchObject({
      status: "success",
      message,
    });
    expect(d.setActive).toHaveBeenCalledOnce();
  });
  it("returns the configuration message only for update", async () => {
    const d = deps();
    expect(await performProfessionalAction("update", form(), d)).toMatchObject({
      status: "success",
      message: "Configuración del profesional actualizada",
    });
  });
  it.each(["update", "setActive"] as const)("maps stale %s without retry", async (operation) => {
    const d = deps();
    d[operation === "update" ? "update" : "setActive"].mockRejectedValueOnce({
      code: "P0001",
      message: "STALE_PROFESSIONAL_CENTER_STATE",
    });
    expect((await performProfessionalAction(operation, form(), d)).status).toBe("stale");
    expect(d.revalidate).not.toHaveBeenCalled();
  });
  it("explains D4 and directs to Usuarios", async () => {
    const d = deps();
    d.setActive.mockRejectedValueOnce({
      code: "P0001",
      message: "PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP",
    });
    expect((await performProfessionalAction("setActive", form(), d)).message).toContain("Usuarios");
  });
  it("handles create race by requiring another resolve", async () => {
    const d = deps();
    d.create.mockRejectedValueOnce({
      code: "P0001",
      message: "PROFESSIONAL_IDENTITY_ALREADY_EXISTS",
    });
    expect((await performProfessionalAction("create", form(), d)).status).toBe("stale");
    expect(d.link).not.toHaveBeenCalled();
  });
  it.each(["resolve", "create"] as const)(
    "rejects separator-only document before %s RPC with clear feedback",
    async (operation) => {
      const d = deps();
      const result = await performProfessionalAction(operation, form({ documentNumber: "---" }), d);
      expect(result).toMatchObject({
        status: "error",
        message: "Ingresá un documento válido.",
        fieldErrors: { documentNumber: ["Ingresá un documento válido."] },
      });
      expect(d[operation]).not.toHaveBeenCalled();
    },
  );
  it.each(["resolve", "create"] as const)(
    "maps direct RPC INVALID_PROFESSIONAL_INPUT from %s to safe input feedback",
    async (operation) => {
      const d = deps();
      d[operation].mockRejectedValueOnce({ code: "22023", message: "INVALID_PROFESSIONAL_INPUT" });
      const result = await performProfessionalAction(operation, form(), d);
      expect(result).toMatchObject({
        status: "error",
        message: expect.stringContaining("documento"),
      });
      expect(result.message).not.toContain("INVALID_PROFESSIONAL_INPUT");
      expect(result.message).not.toContain("No pudimos completar");
    },
  );
});
