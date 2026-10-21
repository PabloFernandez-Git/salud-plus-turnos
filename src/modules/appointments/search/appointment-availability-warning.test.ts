import { describe, expect, it } from "vitest";
import { outsideCurrentAvailability } from "./appointment-availability-warning";

const appointment = {
  appointment_id: "11111111-1111-4111-8111-111111111111",
  patient_center_id: "22222222-2222-4222-8222-222222222222",
  professional_center_id: "33333333-3333-4333-8333-333333333333",
  specialty_id: "44444444-4444-4444-8444-444444444444",
  starts_at: "2026-10-20T12:00:00+00:00",
  ends_at: "2026-10-20T12:30:00+00:00",
  updated_at: "2026-10-19T12:00:00+00:00",
  status: "PENDING" as const,
  patient_first_name: "Ana",
  patient_last_name: "Sol",
  specialty_name: "Clínica",
  professional_first_name: "Dr",
  professional_last_name: "Paz",
  administrative_note: null,
};
const now = new Date("2026-10-19T12:00:00Z");
describe("future Appointment availability warning", () => {
  it("warns when a future slot no longer fits a current weekly interval", () => {
    expect(outsideCurrentAvailability(appointment, "America/Argentina/Buenos_Aires", [], now)).toBe(
      true,
    );
    expect(
      outsideCurrentAvailability(
        appointment,
        "America/Argentina/Buenos_Aires",
        [{ id: "a", weekday: 2, startTime: "10:00", endTime: "11:00", updatedAt: "u" }],
        now,
      ),
    ).toBe(true);
    expect(
      outsideCurrentAvailability(
        appointment,
        "America/Argentina/Buenos_Aires",
        [{ id: "a", weekday: 2, startTime: "09:00", endTime: "10:00", updatedAt: "u" }],
        now,
      ),
    ).toBe(false);
  });
  it("does not retroactively warn on historical appointments", () => {
    expect(
      outsideCurrentAvailability(
        appointment,
        "America/Argentina/Buenos_Aires",
        [],
        new Date("2026-10-21T00:00:00Z"),
      ),
    ).toBe(false);
  });
  it("does not warn for a future CANCELLED appointment", () => {
    expect(
      outsideCurrentAvailability(
        { ...appointment, status: "CANCELLED" },
        "America/Argentina/Buenos_Aires",
        [],
        now,
      ),
    ).toBe(false);
  });
});
