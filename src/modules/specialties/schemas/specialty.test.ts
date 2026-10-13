import { describe, expect, it } from "vitest";

import {
  createSpecialtySchema,
  setSpecialtyActiveSchema,
  updateSpecialtySchema,
} from "./specialty";

const centerId = "11111111-1111-4111-8111-111111111111";
const specialtyId = "22222222-2222-4222-8222-222222222222";
const expectedUpdatedAt = "2026-10-09T12:00:00+00:00";

describe("specialty schemas", () => {
  it("trims a name and rejects empty or excessive names", () => {
    expect(createSpecialtySchema.parse({ centerId, name: " Cardiología " }).name).toBe(
      "Cardiología",
    );
    expect(createSpecialtySchema.safeParse({ centerId, name: "   " }).success).toBe(false);
    expect(createSpecialtySchema.safeParse({ centerId, name: "x".repeat(121) }).success).toBe(
      false,
    );
  });

  it("normalizes optional descriptions without inventing a DB length limit", () => {
    expect(createSpecialtySchema.parse({ centerId, name: "Clínica" }).description).toBe("");
    expect(
      createSpecialtySchema.parse({ centerId, name: "Clínica", description: null }).description,
    ).toBe("");
    expect(
      createSpecialtySchema.parse({ centerId, name: "Clínica", description: "  Adultos  " })
        .description,
    ).toBe("Adultos");
    expect(
      updateSpecialtySchema.parse({
        centerId,
        specialtyId,
        expectedUpdatedAt,
        name: "Clínica",
        description: "   ",
      }).description,
    ).toBe("");
    expect(
      createSpecialtySchema.safeParse({ centerId, name: "Clínica", description: 5 }).success,
    ).toBe(false);
  });

  it("requires a valid scoped identity and CAS token for edits", () => {
    expect(
      updateSpecialtySchema.safeParse({ centerId, specialtyId, expectedUpdatedAt, name: "Clínica" })
        .success,
    ).toBe(true);
    expect(
      updateSpecialtySchema.safeParse({
        centerId,
        specialtyId: "other",
        expectedUpdatedAt,
        name: "Clínica",
      }).success,
    ).toBe(false);
    expect(
      updateSpecialtySchema.safeParse({
        centerId,
        specialtyId,
        expectedUpdatedAt: "bad",
        name: "Clínica",
      }).success,
    ).toBe(false);
  });

  it("requires explicit confirmation for both state directions", () => {
    for (const isActive of [true, false]) {
      expect(
        setSpecialtyActiveSchema.safeParse({
          centerId,
          specialtyId,
          expectedUpdatedAt,
          isActive,
          confirmed: true,
        }).success,
      ).toBe(true);
      expect(
        setSpecialtyActiveSchema.safeParse({
          centerId,
          specialtyId,
          expectedUpdatedAt,
          isActive,
          confirmed: false,
        }).success,
      ).toBe(false);
    }
  });
});
