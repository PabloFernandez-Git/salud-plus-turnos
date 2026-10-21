import { describe, expect, it } from "vitest";
import {
  agendaRange,
  agendaUrl,
  appointmentPrefillUrl,
  calendarDate,
  centerWallTime,
  civilDate,
  moveAgendaDate,
  parseAgendaSearch,
} from "./agenda-search";

describe("agenda civil dates and filters", () => {
  it("uses the Center's date and discards malformed or Professional-only filters", () => {
    expect(
      parseAgendaSearch(
        { view: "month", date: "2026-02-30", professional: "bad" },
        "2026-10-21",
        false,
      ),
    ).toEqual({ date: "2026-10-21", view: "month" });
    expect(
      parseAgendaSearch(
        { view: "week", date: "2026-10-20", status: "CANCELLED" },
        "2026-10-21",
        true,
      ),
    ).toEqual({ date: "2026-10-20", view: "week", status: "CANCELLED" });
  });

  it("keeps specialty IDs in staff navigation and builds a slot handoff URL", () => {
    const specialtyId = "33333333-3333-4333-8333-333333333333";
    const filters = parseAgendaSearch({ specialty: specialtyId }, "2026-10-21", true);
    expect(filters.specialtyId).toBe(specialtyId);
    expect(
      parseAgendaSearch({ specialty: specialtyId }, "2026-10-21", false).specialtyId,
    ).toBeUndefined();
    expect(agendaUrl("center", filters)).toContain(`specialty=${specialtyId}`);
    const handoff = appointmentPrefillUrl("center", {
      specialtyId,
      professionalCenterId: "44444444-4444-4444-8444-444444444444",
      localDate: "2026-10-21",
      startsAt: "2026-10-21T12:00:00+00:00",
    });
    expect(new URL(handoff, "http://localhost").searchParams.get("startsAt")).toBe(
      "2026-10-21T12:00:00+00:00",
    );
  });

  it("bounds week and month to supported civil ranges", () => {
    expect(agendaRange({ date: "2026-11-01", view: "week" })).toEqual({
      fromDate: "2026-10-26",
      toDate: "2026-11-01",
    });
    expect(agendaRange({ date: "2028-02-15", view: "month" })).toEqual({
      fromDate: "2028-02-01",
      toDate: "2028-02-29",
    });
    expect(moveAgendaDate("2026-01-31", "month", 1)).toBe("2026-02-01");
  });

  it("maps instants to Center wall time without assuming the browser zone", () => {
    const before = centerWallTime("2026-11-01T05:30:00Z", "America/New_York");
    const after = centerWallTime("2026-11-01T06:30:00Z", "America/New_York");
    expect([before.localDate, before.localTime]).toEqual(["2026-11-01", "01:30"]);
    expect([after.localDate, after.localTime]).toEqual(["2026-11-01", "01:30"]);
    expect(before.ambiguous).toBe(true);
    expect(after.ambiguous).toBe(true);
    expect(before.offsetLabel).not.toBe(after.offsetLabel);
    expect(before.representable).toBe(false);
    expect(after.representable).toBe(false);
    expect(civilDate(calendarDate("2026-10-21"))).toBe("2026-10-21");
    expect(agendaUrl("center", { date: "2026-10-21", view: "day", status: "PENDING" })).toContain(
      "status=PENDING",
    );
  });

  it("flags a Center time that falls in the browser's DST gap", () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const result = centerWallTime("2026-03-08T05:30:00Z", "America/Argentina/Buenos_Aires");
      expect(result.localTime).toBe("02:30");
      expect(result.date.getHours()).toBe(3);
      expect(result.representable).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
