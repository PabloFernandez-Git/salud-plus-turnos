import { describe, expect, it } from "vitest";

import {
  centerUserIntentPayloadSchema,
  centerUserProvisionFormSchema,
  newCenterUserSchema,
  persistedCenterUserOperationIntentSchema,
} from "./center-user-provisioning";

const centerId = "11111111-1111-4111-8111-111111111111";
const operationId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "33333333-3333-4333-8333-333333333333";
const professionalCenterId = "44444444-4444-4444-8444-444444444444";

function validForm(overrides: Record<string, string> = {}) {
  return {
    operationId,
    centerId,
    isRetryingOperation: "false",
    email: "user@example.test",
    firstName: "Ana",
    lastName: "Pérez",
    initialPassword: "password-10",
    role: "RECEPTION",
    professionalCenterId: "",
    ...overrides,
  };
}

const validIntentPayload = {
  email: "user@example.test",
  identityExists: false,
  firstName: "Ana",
  lastName: "Pérez",
  role: "RECEPTION" as const,
  professionalCenterId: null,
};

describe("center user provisioning schemas", () => {
  it("normalizes email and converts an empty ProfessionalCenter to null", () => {
    const parsed = centerUserProvisionFormSchema.parse({
      ...validForm(),
      email: "  USER@EXAMPLE.TEST ",
    });

    expect(parsed).toMatchObject({
      email: "user@example.test",
      professionalCenterId: null,
      isRetryingOperation: false,
    });
  });

  it("enforces the approved 10-character password minimum without composition rules", () => {
    expect(
      newCenterUserSchema.safeParse({
        firstName: "Ana",
        lastName: "Pérez",
        initialPassword: "123456789",
      }).success,
    ).toBe(false);
    expect(
      newCenterUserSchema.safeParse({
        firstName: "Ana",
        lastName: "Pérez",
        initialPassword: "abcdefghij",
      }).success,
    ).toBe(true);
  });

  it("requires a ProfessionalCenter only for PROFESSIONAL", () => {
    expect(
      centerUserProvisionFormSchema.safeParse(
        validForm({ role: "PROFESSIONAL", professionalCenterId: "" }),
      ).success,
    ).toBe(false);
    expect(
      centerUserProvisionFormSchema.safeParse(
        validForm({ role: "PROFESSIONAL", professionalCenterId }),
      ).success,
    ).toBe(true);
    expect(
      centerUserProvisionFormSchema.safeParse(validForm({ role: "ADMIN", professionalCenterId }))
        .success,
    ).toBe(false);
  });

  it("has no password field in the strict durable intent contract", () => {
    const persisted = {
      version: 1 as const,
      scope: "tenant-provision-user" as const,
      actorUserId,
      centerId,
      operationId,
      payload: validIntentPayload,
    };

    expect(persistedCenterUserOperationIntentSchema.safeParse(persisted).success).toBe(true);
    expect(
      centerUserIntentPayloadSchema.safeParse({
        ...validIntentPayload,
        initialPassword: "must-not-be-persisted",
      }).success,
    ).toBe(false);
    expect(
      persistedCenterUserOperationIntentSchema.safeParse({
        ...persisted,
        password: "must-not-be-persisted",
      }).success,
    ).toBe(false);
  });

  it("rejects cross-scope or malformed durable metadata fail-closed", () => {
    expect(
      persistedCenterUserOperationIntentSchema.safeParse({
        version: 1,
        scope: "platform-create-center",
        actorUserId,
        centerId,
        operationId,
        payload: validIntentPayload,
      }).success,
    ).toBe(false);
    expect(
      persistedCenterUserOperationIntentSchema.safeParse({
        version: 1,
        scope: "tenant-provision-user",
        actorUserId,
        centerId: "not-a-uuid",
        operationId,
        payload: validIntentPayload,
      }).success,
    ).toBe(false);
  });
});
