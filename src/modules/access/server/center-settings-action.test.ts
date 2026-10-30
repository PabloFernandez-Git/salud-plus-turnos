import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "./authorization";
import { CenterSettingsConflictError } from "./center-settings";
import { performUpdateCenterSettingsAction } from "./center-settings-action";

const centerId = "11111111-1111-4111-8111-111111111111";
const version = "2026-10-30T10:00:00.123456+00:00";

function form(changes: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    centerId,
    expectedUpdatedAt: version,
    centerName: "  Centro A  ",
    centerPhone: "  555  ",
    centerEmail: "",
    centerAddress: "",
    ...changes,
  }))
    data.set(key, value);
  return data;
}

function deps() {
  return {
    createClient: vi.fn(async () => ({}) as never),
    authorize: vi.fn(async () => ({}) as never),
    persist: vi.fn(async () => ({
      id: centerId,
      name: "Centro A",
      phone: "555",
      email: null,
      address: null,
      updatedAt: "2026-10-30T10:01:00.654321+00:00",
    })),
    revalidate: vi.fn(),
  };
}

describe("center settings action", () => {
  it("authorizes the route center and persists normalized data with exact version", async () => {
    const runtime = deps();
    const result = await performUpdateCenterSettingsAction(form(), runtime);
    expect(runtime.authorize).toHaveBeenCalledWith(centerId, ["ADMIN"], expect.anything());
    expect(runtime.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId,
        expectedUpdatedAt: version,
        centerName: "Centro A",
        centerPhone: "555",
        centerEmail: "",
        centerAddress: "",
      }),
      expect.anything(),
    );
    expect(runtime.revalidate).toHaveBeenCalledWith(centerId);
    expect(result).toMatchObject({ status: "success", settings: { name: "Centro A" } });
    expect(result).not.toHaveProperty("refreshPending");
  });

  it("rejects missing name and invalid email without persisting", async () => {
    const runtime = deps();
    const result = await performUpdateCenterSettingsAction(
      form({ centerName: " ", centerEmail: "bad" }),
      runtime,
    );
    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: {
        centerName: expect.any(Array),
        centerEmail: expect.any(Array),
      },
    });
    expect(runtime.persist).not.toHaveBeenCalled();
  });

  it("rejects a role denial before payload validation", async () => {
    const runtime = deps();
    runtime.authorize.mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));
    expect(
      await performUpdateCenterSettingsAction(form({ centerName: " " }), runtime),
    ).toMatchObject({
      status: "forbidden",
    });
    expect(runtime.persist).not.toHaveBeenCalled();
  });

  it("distinguishes conflict, authorization and an uncertain persistence outcome", async () => {
    for (const [error, status] of [
      [new CenterSettingsConflictError(), "conflict"],
      [{ code: "42501" }, "forbidden"],
      [new Error("network"), "uncertain"],
    ] as const) {
      const runtime = deps();
      runtime.persist.mockRejectedValueOnce(error);
      expect(await performUpdateCenterSettingsAction(form(), runtime)).toMatchObject({ status });
      expect(runtime.revalidate).not.toHaveBeenCalled();
    }
  });

  it("does not expose RPC lookup details or blame user input when persistence is unavailable", async () => {
    const runtime = deps();
    runtime.persist.mockRejectedValueOnce({
      code: "PGRST202",
      message: "Could not find the function in the schema cache",
    });
    expect(await performUpdateCenterSettingsAction(form(), runtime)).toEqual({
      status: "error",
      message: "No pudimos guardar los cambios en este momento. Intentá de nuevo más tarde.",
    });
    expect(runtime.revalidate).not.toHaveBeenCalled();
  });

  it("returns confirmed persisted settings when revalidation fails after the write", async () => {
    const runtime = deps();
    runtime.revalidate.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });

    const result = await performUpdateCenterSettingsAction(form(), runtime);

    expect(result).toMatchObject({
      status: "success",
      refreshPending: true,
      settings: { id: centerId, name: "Centro A", updatedAt: "2026-10-30T10:01:00.654321+00:00" },
    });
    expect(runtime.persist).toHaveBeenCalledOnce();
    expect(runtime.revalidate).toHaveBeenCalledWith(centerId);
  });
});
