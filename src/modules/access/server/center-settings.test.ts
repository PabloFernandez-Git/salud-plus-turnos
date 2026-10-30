import { describe, expect, it, vi } from "vitest";
import { CenterSettingsConflictError, updateCenterSettings } from "./center-settings";

const input = {
  centerId: "11111111-1111-4111-8111-111111111111",
  expectedUpdatedAt: "2026-10-30T10:00:00.123456+00:00",
  centerName: "Centro",
  centerPhone: "",
  centerEmail: "",
  centerAddress: "",
};

describe("center settings persistence", () => {
  it("sends only allowed fields, NULL for empty optionals and the exact CAS token", async () => {
    const rpc = vi.fn(() => ({
      single: async () => ({
        data: {
          center_id: input.centerId,
          name: "Centro",
          phone: null,
          email: null,
          address: null,
          updated_at: "2026-10-30T10:01:00.123457+00:00",
        },
        error: null,
      }),
    }));
    const saved = await updateCenterSettings(input, { rpc } as never);
    expect(rpc).toHaveBeenCalledWith("admin_update_center_settings", {
      p_center_id: input.centerId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_name: "Centro",
      p_phone: null,
      p_email: null,
      p_address: null,
    });
    expect(saved.updatedAt).toBe("2026-10-30T10:01:00.123457+00:00");
  });

  it("maps only the stable SQL stale error to a conflict", async () => {
    const rpc = vi.fn(() => ({
      single: async () => ({
        data: null,
        error: { code: "P0001", message: "STALE_CENTER_SETTINGS" },
      }),
    }));
    await expect(updateCenterSettings(input, { rpc } as never)).rejects.toBeInstanceOf(
      CenterSettingsConflictError,
    );
  });
});
