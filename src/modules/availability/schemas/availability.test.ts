import { describe, expect, it } from "vitest";
import {
  appointmentDurationSchema,
  availabilityTimeSchema,
  createAvailabilitySchema,
  updateAvailabilitySchema,
} from "./availability";

const base = {
  centerId: "11111111-1111-4111-8111-111111111111",
  professionalCenterId: "22222222-2222-4222-8222-222222222222",
};

describe("availability input", () => {
  it("accepts ISO weekdays, adjacent minute boundaries and multiple intervals", () => {
    for (const weekday of [1, 7]) {
      expect(
        createAvailabilitySchema.safeParse({
          ...base,
          weekday,
          startTime: "09:00",
          endTime: "13:00",
        }).success,
      ).toBe(true);
      expect(
        createAvailabilitySchema.safeParse({
          ...base,
          weekday,
          startTime: "13:00",
          endTime: "17:00",
        }).success,
      ).toBe(true);
    }
  });
  it.each([0, 8, 1.5])("rejects weekday %s", (weekday) => {
    expect(
      createAvailabilitySchema.safeParse({ ...base, weekday, startTime: "09:00", endTime: "13:00" })
        .success,
    ).toBe(false);
  });
  it.each(["24:00", "12:60", "9:00", "12:00:30", "-1:00"])(
    "rejects invalid minute time %s",
    (time) => {
      expect(availabilityTimeSchema.safeParse(time).success).toBe(false);
    },
  );
  it("rejects start at or after end in create and update", () => {
    for (const [startTime, endTime] of [
      ["13:00", "13:00"],
      ["14:00", "13:00"],
    ]) {
      expect(
        createAvailabilitySchema.safeParse({ ...base, weekday: 1, startTime, endTime }).success,
      ).toBe(false);
      expect(
        updateAvailabilitySchema.safeParse({
          ...base,
          availabilityId: base.centerId,
          expectedUpdatedAt: "2026-10-16T12:00:00+00:00",
          startTime,
          endTime,
        }).success,
      ).toBe(false);
    }
  });
  it.each([5, 30, 480])("accepts duration %s", (minutes) => {
    expect(appointmentDurationSchema.safeParse(minutes).success).toBe(true);
  });
  it.each([0, 4, 481, 11, 30.5])("rejects duration %s", (minutes) => {
    expect(appointmentDurationSchema.safeParse(minutes).success).toBe(false);
  });
});
