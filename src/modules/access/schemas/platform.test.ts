import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLATFORM_TIMEZONE,
  isValidIanaTimezone,
  newPlatformAdminSchema,
  persistedPlatformOperationIntentSchema,
  platformCenterFormSchema,
  platformCenterIntentPayloadSchema,
} from "./platform";

const validCenter = {
  operationId: "11111111-1111-4111-8111-111111111111",
  isRetryingOperation: "false",
  centerName: "Centro Norte",
  centerAddress: "Av. Siempre Viva 123",
  centerPhone: "+54 11 5555 5555",
  centerEmail: "contacto@example.test",
  centerTimezone: DEFAULT_PLATFORM_TIMEZONE,
  adminEmail: "admin@example.test",
  adminFirstName: "Ana",
  adminLastName: "Pérez",
  adminInitialPassword: "password-10",
};

const validIntentPayload = {
  centerName: "Centro Norte",
  centerAddress: "Av. Siempre Viva 123",
  centerPhone: "+54 11 5555 5555",
  centerEmail: "contacto@example.test",
  centerTimezone: DEFAULT_PLATFORM_TIMEZONE,
  adminEmail: "admin@example.test",
  adminFirstName: "Ana",
  adminLastName: "Pérez",
  identityExists: false,
};

const validPersistedIntent = {
  version: 1 as const,
  scope: "platform-create-center" as const,
  actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  operationId: "11111111-1111-4111-8111-111111111111",
  payload: validIntentPayload,
};

describe("platform schemas", () => {
  it("accepts the approved explicit default timezone", () => {
    expect(isValidIanaTimezone(DEFAULT_PLATFORM_TIMEZONE)).toBe(true);
    expect(platformCenterFormSchema.safeParse(validCenter).success).toBe(true);
  });

  it("rejects fixed offsets and unknown timezones", () => {
    expect(isValidIanaTimezone("UTC-3")).toBe(false);
    expect(
      platformCenterFormSchema.safeParse({ ...validCenter, centerTimezone: "Mars/Olympus" })
        .success,
    ).toBe(false);
  });

  it("requires exactly the approved minimum password length for a new identity", () => {
    expect(
      newPlatformAdminSchema.safeParse({
        firstName: "Ana",
        lastName: "Pérez",
        initialPassword: "123456789",
      }).success,
    ).toBe(false);
    expect(
      newPlatformAdminSchema.safeParse({
        firstName: "Ana",
        lastName: "Pérez",
        initialPassword: "abcdefghij",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown properties at the durable snapshot root", () => {
    expect(
      persistedPlatformOperationIntentSchema.safeParse({
        ...validPersistedIntent,
        extraField: "unexpected",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown properties in the nested durable payload", () => {
    const payloadWithExtraField = {
      ...validIntentPayload,
      extraField: "unexpected",
    };

    expect(platformCenterIntentPayloadSchema.safeParse(payloadWithExtraField).success).toBe(false);
    expect(
      persistedPlatformOperationIntentSchema.safeParse({
        ...validPersistedIntent,
        payload: payloadWithExtraField,
      }).success,
    ).toBe(false);
  });
});
