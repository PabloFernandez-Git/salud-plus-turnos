import { describe, expect, it } from "vitest";
import { blockPeriodSchema, createBlockSchema } from "./availability-block";

const base = {
  centerId: "11111111-1111-4111-8111-111111111111",
  professionalCenterId: "22222222-2222-4222-8222-222222222222",
};

describe("availability block input", () => {
  it("accepts one or several inclusive civil days", () => {
    expect(
      blockPeriodSchema.safeParse({ ...base, startDate: "2026-11-20", endDate: "2026-11-20" })
        .success,
    ).toBe(true);
    expect(
      blockPeriodSchema.safeParse({ ...base, startDate: "2026-11-20", endDate: "2026-11-24" })
        .success,
    ).toBe(true);
  });

  it("rejects impossible and reverse dates", () => {
    expect(
      blockPeriodSchema.safeParse({ ...base, startDate: "2026-02-30", endDate: "2026-03-01" })
        .success,
    ).toBe(false);
    expect(
      blockPeriodSchema.safeParse({ ...base, startDate: "2026-11-24", endDate: "2026-11-20" })
        .success,
    ).toBe(false);
  });

  it("accepts only the four coded reasons and an explicit confirmation value", () => {
    const valid = {
      ...base,
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      expectedAffectedCount: "2",
      confirmAffected: "true",
    };
    expect(createBlockSchema.safeParse({ ...valid, reason: "ABSENCE" }).success).toBe(true);
    expect(createBlockSchema.safeParse({ ...valid, reason: "medical detail" }).success).toBe(false);
    expect(
      createBlockSchema.safeParse({ ...valid, reason: "ABSENCE", confirmAffected: "yes" }).success,
    ).toBe(false);
  });
});
