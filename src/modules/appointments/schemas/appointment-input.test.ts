import { describe, expect, it } from "vitest";
import {
  canTransitionStatus,
  createAppointmentSchema,
  localDateSchema,
  localStartTimeSchema,
  noteUpdateSchema,
  professionalListSchema,
  staffListSchema,
} from "./appointment-input";

const id = "11111111-1111-4111-8111-111111111111";
const token = "2026-10-19T12:00:00.123456+00:00";
describe("appointment input contracts", () => {
  it("rejects invalid civil dates and times without browser timezone parsing", () => {
    expect(localDateSchema.safeParse("2026-02-29").success).toBe(false);
    expect(localDateSchema.safeParse("2028-02-29").success).toBe(true);
    for (const time of ["24:00", "09:00:01", "9:00", "09:60"]) {
      expect(localStartTimeSchema.safeParse(time).success).toBe(false);
    }
  });
  it("enforces 31 inclusive days, page cap and cursor pair", () => {
    expect(
      staffListSchema.safeParse({
        centerId: id,
        fromDate: "2026-10-01",
        toDate: "2026-10-31",
        limit: 50,
        cursor: { startsAt: token, id },
      }).success,
    ).toBe(true);
    expect(
      staffListSchema.safeParse({ centerId: id, fromDate: "2026-10-01", toDate: "2026-11-01" })
        .success,
    ).toBe(false);
    expect(
      professionalListSchema.safeParse({
        centerId: id,
        fromDate: "2026-10-01",
        toDate: "2026-10-01",
        limit: 51,
      }).success,
    ).toBe(false);
    expect(
      staffListSchema.safeParse({
        centerId: id,
        fromDate: "2026-10-01",
        toDate: "2026-10-01",
        cursor: { startsAt: token },
      }).success,
    ).toBe(false);
  });
  it("rejects manipulated CREATE fields and excessive note", () => {
    const input = {
      centerId: id,
      patientCenterId: id,
      professionalCenterId: id,
      specialtyId: id,
      localDate: "2026-10-20",
      localStartTime: "09:00",
    };
    for (const field of ["status", "endsAt", "startsAt", "durationMinutes", "appointmentId"]) {
      expect(createAppointmentSchema.safeParse({ ...input, [field]: "arbitrary" }).success).toBe(
        false,
      );
    }
    expect(
      createAppointmentSchema.safeParse({ ...input, administrativeNote: "x".repeat(2000) }).success,
    ).toBe(true);
    expect(
      createAppointmentSchema.safeParse({ ...input, administrativeNote: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(
      createAppointmentSchema.safeParse({ ...input, administrativeNote: "😀".repeat(2000) })
        .success,
    ).toBe(true);
    expect(
      createAppointmentSchema.safeParse({ ...input, administrativeNote: "😀".repeat(2001) })
        .success,
    ).toBe(false);
  });
  it("accepts text, empty and NULL note, with exact CAS token", () => {
    for (const administrativeNote of ["texto", "", null, "x".repeat(2000)]) {
      const result = noteUpdateSchema.parse({
        centerId: id,
        appointmentId: id,
        expectedUpdatedAt: token,
        administrativeNote,
      });
      expect(result.expectedUpdatedAt).toBe(token);
      expect(result.administrativeNote).toBe(administrativeNote);
    }
    expect(
      noteUpdateSchema.safeParse({
        centerId: id,
        appointmentId: id,
        expectedUpdatedAt: token,
        administrativeNote: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
  it("enforces the approved transition matrix", () => {
    expect(canTransitionStatus("PENDING", "CONFIRMED", "ADMIN")).toBe(true);
    expect(canTransitionStatus("CONFIRMED", "CONFIRMED", "ADMIN")).toBe(false);
    expect(canTransitionStatus("CONFIRMED", "NO_SHOW", "PROFESSIONAL")).toBe(true);
    expect(canTransitionStatus("PENDING", "CANCELLED", "PROFESSIONAL")).toBe(false);
    for (const terminal of ["ATTENDED", "NO_SHOW", "CANCELLED"] as const) {
      expect(canTransitionStatus(terminal, "ATTENDED", "ADMIN")).toBe(false);
    }
  });
});
