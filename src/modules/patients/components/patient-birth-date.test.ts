import { describe, expect, it } from "vitest";
import { birthDateToIso, formatBirthDateInput, isFutureBirthDate } from "./patient-birth-date";

describe("patient civil birth date", () => {
  it.each([
    ["05051990", "05/05/1990"],
    ["12121985", "12/12/1985"],
    ["05/05/1990", "05/05/1990"],
    ["05", "05/"],
    ["0505", "05/05/"],
    ["05/05", "05/05/"],
    ["05/051", "05/05/1"],
    ["05/05/1990", "05/05/1990"],
  ])("formats typed or pasted %s", (input, formatted) => {
    expect(formatBirthDateInput(input)).toBe(formatted);
  });

  it("lets the user delete and replace parts without a rigid mask", () => {
    expect(formatBirthDateInput("0505199", true)).toBe("0505199");
    expect(formatBirthDateInput("05/05/1980")).toBe("05/05/1980");
    expect(formatBirthDateInput("05/12/1990")).toBe("05/12/1990");
    expect(formatBirthDateInput("05//1990", true)).toBe("05//1990");
    expect(formatBirthDateInput("05//1990")).toBe("05//1990");
    expect(formatBirthDateInput("05/1/1990")).toBe("05/1/1990");
    expect(formatBirthDateInput("0/05/1990", true)).toBe("0/05/1990");
  });

  it.each([
    ["05/05/1990", "1990-05-05"],
    ["29/02/2000", "2000-02-29"],
    ["29/02/2024", "2024-02-29"],
    ["31/04/1990", null],
    ["29/02/1900", null],
    ["29/02/2023", null],
    ["00/01/1990", null],
    ["05/13/1990", null],
    ["05/05/0000", null],
    ["05/05/90", null],
  ])("converts civil date %s to %s", (display, iso) => {
    expect(birthDateToIso(display)).toBe(iso);
  });

  it("compares a date with the center's civil day without shifting the input", () => {
    const instant = new Date("2026-10-26T00:30:00Z");
    expect(isFutureBirthDate("2026-10-26", "America/Argentina/Buenos_Aires", instant)).toBe(true);
    expect(isFutureBirthDate("2026-10-25", "America/Argentina/Buenos_Aires", instant)).toBe(false);
    expect(isFutureBirthDate("2026-10-26", "UTC", instant)).toBe(false);
  });
});
