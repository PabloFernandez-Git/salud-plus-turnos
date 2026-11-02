import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireRole, AuthorizationError } from "../server/authorization";
import { getCenterSettings } from "../server/center-settings";
import { performUpdateCenterSettingsAction } from "../server/center-settings-action";
import { loadCenterSettingsAction, updateCenterSettingsAction } from "./center-settings-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("../server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});
vi.mock("../server/center-settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/center-settings")>();
  return { ...original, getCenterSettings: vi.fn() };
});
vi.mock("../server/center-settings-action", () => ({
  performUpdateCenterSettingsAction: vi.fn(),
}));

const centerId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => vi.clearAllMocks());

describe("center settings web actions", () => {
  it("reauthorizes a reload for the requested center", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({} as never);
    vi.mocked(getCenterSettings).mockResolvedValueOnce({ id: centerId, name: "Centro" } as never);
    expect(await loadCenterSettingsAction(centerId)).toMatchObject({ name: "Centro" });
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN"], expect.anything());
    expect(getCenterSettings).toHaveBeenCalledWith(centerId, expect.anything());
  });

  it("does not read a center after authorization fails", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));
    await expect(loadCenterSettingsAction(centerId)).rejects.toBeInstanceOf(AuthorizationError);
    expect(getCenterSettings).not.toHaveBeenCalled();
  });

  it("revalidates settings and center layout after a successful update", async () => {
    vi.mocked(performUpdateCenterSettingsAction).mockImplementationOnce(async (_form, deps) => {
      deps?.revalidate?.(centerId);
      return { status: "success", settings: {} as never };
    });
    await updateCenterSettingsAction(new FormData());
    expect(revalidatePath).toHaveBeenCalledWith(`/centers/${centerId}/settings`);
    expect(revalidatePath).toHaveBeenCalledWith(`/centers/${centerId}`, "layout");
  });
});
