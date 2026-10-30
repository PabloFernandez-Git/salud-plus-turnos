import { describe, expect, it } from "vitest";
import { centerSettingsFormSchema } from "./center-institutional";
import { platformCenterFormSchema } from "./platform";

const fields = {
  centerName: "  Centro A  ",
  centerPhone: "  555  ",
  centerEmail: "  contacto@example.test  ",
  centerAddress: "  Calle 1  ",
};
const settings = {
  centerId: "11111111-1111-4111-8111-111111111111",
  expectedUpdatedAt: "2026-10-30T10:00:00.123456+00:00",
};

describe("center institutional fields", () => {
  it("shares trimmed institutional values between creation and editing", () => {
    const edited = centerSettingsFormSchema.parse({ ...settings, ...fields });
    const created = platformCenterFormSchema.parse({
      ...fields,
      operationId: settings.centerId,
      isRetryingOperation: "false",
      centerTimezone: "UTC",
      adminEmail: "admin@example.test",
    });
    expect(edited.centerName).toBe("Centro A");
    expect(edited.centerPhone).toBe("555");
    expect(edited.centerEmail).toBe("contacto@example.test");
    expect(edited.centerAddress).toBe("Calle 1");
    expect(created.centerName).toBe(edited.centerName);
    expect(created.centerEmail).toBe(edited.centerEmail);
    expect(edited.expectedUpdatedAt).toBe(settings.expectedUpdatedAt);
  });

  it("allows empty optional values and rejects blank name or invalid email", () => {
    expect(
      centerSettingsFormSchema.parse({ ...settings, centerName: "Centro", centerEmail: "" }),
    ).toMatchObject({ centerPhone: "", centerEmail: "", centerAddress: "" });
    expect(
      centerSettingsFormSchema.safeParse({ ...settings, ...fields, centerName: "  " }).success,
    ).toBe(false);
    expect(
      centerSettingsFormSchema.safeParse({ ...settings, ...fields, centerEmail: "mal" }).success,
    ).toBe(false);
  });
});
