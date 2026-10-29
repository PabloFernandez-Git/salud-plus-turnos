import { describe, expect, it } from "vitest";
import { timezoneLabel, timezoneMatchesQuery } from "./timezone-label";

describe("timezone labels", () => {
  it("shows the city, country and current offset without replacing the IANA value", () => {
    expect(timezoneLabel("America/Argentina/Buenos_Aires", new Date("2026-01-15T12:00:00Z"))).toBe(
      "Buenos Aires, Argentina (GMT-3)",
    );
    expect(timezoneLabel("Asia/Kolkata", new Date("2026-01-15T12:00:00Z"))).toBe(
      "Kolkata, India (GMT+5:30)",
    );
  });

  it("calculates seasonal offsets for zones with DST", () => {
    expect(timezoneLabel("America/New_York", new Date("2026-01-15T12:00:00Z"))).toBe(
      "New York, Estados Unidos (GMT-5)",
    );
    expect(timezoneLabel("America/New_York", new Date("2026-07-15T12:00:00Z"))).toBe(
      "New York, Estados Unidos (GMT-4)",
    );
    expect(timezoneLabel("Europe/Madrid", new Date("2026-01-15T12:00:00Z"))).toBe(
      "Madrid, España (GMT+1)",
    );
    expect(timezoneLabel("Europe/Madrid", new Date("2026-07-15T12:00:00Z"))).toBe(
      "Madrid, España (GMT+2)",
    );
  });

  it("searches by city, country and identifier, ignoring accents", () => {
    const zone = "America/Argentina/Buenos_Aires";
    const label = timezoneLabel(zone);
    expect(timezoneMatchesQuery(zone, "buenos", label)).toBe(true);
    expect(timezoneMatchesQuery(zone, "argentina", label)).toBe(true);
    expect(timezoneMatchesQuery(zone, "america/argentina", label)).toBe(true);
    expect(
      timezoneMatchesQuery("America/Mexico_City", "mexico", timezoneLabel("America/Mexico_City")),
    ).toBe(true);
  });

  it("leaves an unsupported value visible for form validation", () => {
    expect(timezoneLabel("Mars/Olympus")).toBe("Mars/Olympus");
  });

  it("formats a valid legacy alias without changing its submitted identifier", () => {
    expect(timezoneLabel("US/Eastern", new Date("2026-01-15T12:00:00Z"))).toBe(
      "New York, Estados Unidos (GMT-5)",
    );
  });

  it("does not confuse the reversed Etc/GMT sign with a city label", () => {
    expect(timezoneLabel("Etc/GMT+5", new Date("2026-01-15T12:00:00Z"))).toBe("GMT-5");
  });

  it("includes a country or territory for every suggested IANA zone", () => {
    const missing = Intl.supportedValuesOf("timeZone").filter(
      (zone) => !timezoneLabel(zone).includes(", "),
    );
    expect(missing).toEqual([]);
  });
});
