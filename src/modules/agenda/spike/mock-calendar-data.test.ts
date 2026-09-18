import { describe, expect, it } from "vitest";
import {
  getAppointmentDurationMinutes,
  getDaySummary,
  MOCK_APPOINTMENTS,
  PROFESSIONALS,
  REFERENCE_DATE,
} from "./mock-calendar-data";

describe("deterministic calendar spike data", () => {
  it("contains exactly three professionals", () => {
    expect(PROFESSIONALS).toHaveLength(3);
    expect(PROFESSIONALS.map(({ id }) => id)).toEqual(["ana", "bruno", "clara"]);
  });

  it("contains the required 20, 30 and 45 minute appointments on the reference day", () => {
    const durations = MOCK_APPOINTMENTS.filter(
      ({ start }) => start.toDateString() === REFERENCE_DATE.toDateString(),
    ).map(getAppointmentDurationMinutes);

    expect(durations).toEqual([20, 30, 45]);
  });

  it("contains simultaneous appointments from two professionals", () => {
    const simultaneousAppointments = MOCK_APPOINTMENTS.filter(
      ({ start }) => start.getDate() === 14 && start.getHours() === 10 && start.getMinutes() === 0,
    );

    expect(simultaneousAppointments).toHaveLength(2);
    expect(new Set(simultaneousAppointments.map(({ professionalId }) => professionalId)).size).toBe(
      2,
    );
  });

  it("builds a useful daily summary from the filtered appointments", () => {
    expect(getDaySummary(REFERENCE_DATE, MOCK_APPOINTMENTS)).toEqual({
      appointmentCount: 3,
      professionalNames: ["Dra. Ana Torres", "Dr. Bruno Silva", "Dra. Clara Méndez"],
    });
  });
});
