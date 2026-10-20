import { describe, expect, it } from "vitest";
import {
  addCivilDays,
  appointmentLocalParts,
  appointmentSearchUrl,
  centerLocalDate,
  parseAppointmentSearch,
} from "./appointment-search";

const centerId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";

describe("appointment list search and center time", () => {
  it("uses the Center date even when the UTC date differs", () => {
    const instant = new Date("2026-10-20T01:00:00Z");
    expect(centerLocalDate("America/Argentina/Buenos_Aires", instant)).toBe("2026-10-19");
    expect(appointmentLocalParts(instant.toISOString(), "America/Argentina/Buenos_Aires")).toEqual({
      date: "2026-10-19",
      time: "22:00",
    });
    expect(centerLocalDate("Pacific/Auckland", instant)).toBe("2026-10-20");
  });
  it("uses civil day arithmetic across month boundaries", () => {
    expect(addCivilDays("2026-10-19", 30)).toBe("2026-11-18");
    expect(addCivilDays("2026-11-01", -30)).toBe("2026-10-02");
  });
  it("preserves the exact cursor timestamp and filters in page links", () => {
    const cursor = { startsAt: "2026-10-20T12:00:00.123456+00:00", id: appointmentId };
    const url = appointmentSearchUrl(centerId, {
      fromDate: "2026-10-20",
      toDate: "2026-10-30",
      status: "CANCELLED",
      cursor,
    });
    const params = Object.fromEntries(new URL(url, "http://local.test").searchParams);
    expect(parseAppointmentSearch(params, "2026-10-19", true)).toEqual({
      fromDate: "2026-10-20",
      toDate: "2026-10-30",
      status: "CANCELLED",
      cursor,
    });
    expect(parseAppointmentSearch(params, "2026-10-19", false)).toEqual({
      fromDate: "2026-10-20",
      toDate: "2026-10-30",
      status: "CANCELLED",
      cursor,
    });
  });
  it("defaults to upcoming 31 days and bounds invalid dates or manipulated professional filter", () => {
    expect(parseAppointmentSearch({}, "2026-10-19", true)).toEqual({
      fromDate: "2026-10-19",
      toDate: "2026-11-18",
    });
    expect(
      parseAppointmentSearch(
        { from: "2026-10-19", to: "2026-12-01", professional: centerId },
        "2026-10-19",
        false,
      ),
    ).toEqual({ fromDate: "2026-10-19", toDate: "2026-11-18" });
    expect(
      parseAppointmentSearch(
        { from: "2026-10-19", to: "2026-10-19", professional: centerId },
        "2026-10-19",
        true,
      ),
    ).toMatchObject({ professionalCenterId: centerId });
  });
});
