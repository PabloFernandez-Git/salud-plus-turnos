import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { performSpecialtyAction } from "./specialty-actions";

const centerId = "11111111-1111-4111-8111-111111111111";
const specialtyId = "22222222-2222-4222-8222-222222222222";
const expectedUpdatedAt = "2026-10-09T12:00:00+00:00";
const client = {} as SupabaseClient<Database>;

function form(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    centerId,
    specialtyId,
    expectedUpdatedAt,
    name: " Cardiología ",
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
    create: vi.fn(async () => ({}) as never),
    update: vi.fn(async () => ({}) as never),
    setActive: vi.fn(async () => ({}) as never),
    revalidate: vi.fn(),
  };
}

describe("Specialty Server Actions", () => {
  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED", "PLATFORM_FORBIDDEN"] as const)(
    "denies %s before payload processing or RPC",
    async (code) => {
      const dependencies = deps();
      dependencies.requireAdmin.mockRejectedValueOnce(new AuthorizationError(code));
      const state = await performSpecialtyAction("update", form({ name: "" }), dependencies);
      expect(state.message).toContain("permiso");
      expect(dependencies.update).not.toHaveBeenCalled();
    },
  );

  it("creates a trimmed name and refreshes the scoped list", async () => {
    const dependencies = deps();
    expect(await performSpecialtyAction("create", form(), dependencies)).toMatchObject({
      status: "success",
    });
    expect(dependencies.create).toHaveBeenCalledWith(
      { centerId, name: "Cardiología", description: "" },
      client,
    );
    expect(dependencies.revalidate).toHaveBeenCalledWith(centerId);
  });

  it("edits using the rendered CAS token, including a no-op name", async () => {
    const dependencies = deps();
    await performSpecialtyAction("update", form(), dependencies);
    expect(dependencies.update).toHaveBeenCalledWith(
      { centerId, specialtyId, expectedUpdatedAt, name: "Cardiología", description: "" },
      client,
    );
  });

  it("accepts a description on create and edit, including clearing it", async () => {
    const dependencies = deps();
    await performSpecialtyAction("create", form({ description: "  Adultos  " }), dependencies);
    expect(dependencies.create).toHaveBeenCalledWith(
      { centerId, name: "Cardiología", description: "Adultos" },
      client,
    );
    await performSpecialtyAction(
      "update",
      form({ name: " Clínica ", description: " Pediatría " }),
      dependencies,
    );
    expect(dependencies.update).toHaveBeenCalledWith(
      { centerId, specialtyId, expectedUpdatedAt, name: "Clínica", description: "Pediatría" },
      client,
    );
    await performSpecialtyAction("update", form({ description: "   " }), dependencies);
    expect(dependencies.update).toHaveBeenLastCalledWith(
      { centerId, specialtyId, expectedUpdatedAt, name: "Cardiología", description: "" },
      client,
    );
  });

  it.each(["true", "false"])("sends explicit state %s with CAS", async (isActive) => {
    const dependencies = deps();
    await performSpecialtyAction("setActive", form({ isActive }), dependencies);
    expect(dependencies.setActive).toHaveBeenCalledWith(
      { centerId, specialtyId, expectedUpdatedAt, isActive: isActive === "true", confirmed: true },
      client,
    );
  });

  it("rejects malformed payloads before mutations", async () => {
    const dependencies = deps();
    expect(
      (await performSpecialtyAction("create", form({ name: "  " }), dependencies)).fieldErrors
        ?.name,
    ).toBeDefined();
    expect(
      (await performSpecialtyAction("update", form({ specialtyId: "bad" }), dependencies)).status,
    ).toBe("error");
    expect(
      (await performSpecialtyAction("setActive", form({ confirmed: "false" }), dependencies))
        .status,
    ).toBe("error");
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(dependencies.update).not.toHaveBeenCalled();
    expect(dependencies.setActive).not.toHaveBeenCalled();
  });

  it("returns a field error for a non-text description without calling the RPC", async () => {
    const dependencies = deps();
    const payload = form();
    payload.set("description", new File(["invalid"], "description.txt"));
    const state = await performSpecialtyAction("create", payload, dependencies);
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.description).toBeDefined();
    expect(dependencies.create).not.toHaveBeenCalled();
  });

  it.each([
    ["P0001", "SPECIALTY_NAME_ALREADY_EXISTS", "Ya existe", "error"],
    ["P0001", "STALE_SPECIALTY_STATE", "otra sesión", "stale"],
    ["P0002", "RESOURCE_NOT_FOUND", "listado", "stale"],
    ["42501", "CENTER_ADMINISTRATION_DENIED", "permiso", "error"],
  ])("maps %s %s to safe feedback", async (code, message, expected, status) => {
    const dependencies = deps();
    dependencies.update.mockRejectedValueOnce({ code, message });
    const state = await performSpecialtyAction("update", form(), dependencies);
    expect(state).toMatchObject({ status, message: expect.stringContaining(expected) });
    expect(dependencies.revalidate).not.toHaveBeenCalled();
  });

  it("reports stale state changes without a retry", async () => {
    const dependencies = deps();
    dependencies.setActive.mockRejectedValueOnce({
      code: "P0001",
      message: "STALE_SPECIALTY_STATE",
    });
    const state = await performSpecialtyAction("setActive", form(), dependencies);
    expect(state.status).toBe("stale");
    expect(dependencies.setActive).toHaveBeenCalledTimes(1);
    expect(dependencies.revalidate).not.toHaveBeenCalled();
  });

  it("maps a duplicate on create, including a reserved inactive name", async () => {
    const dependencies = deps();
    dependencies.create.mockRejectedValueOnce({
      code: "P0001",
      message: "SPECIALTY_NAME_ALREADY_EXISTS",
    });
    const state = await performSpecialtyAction(
      "create",
      form({ name: " cardiología " }),
      dependencies,
    );
    expect(state.message).toContain("inactiva");
    expect(dependencies.revalidate).not.toHaveBeenCalled();
  });
});
