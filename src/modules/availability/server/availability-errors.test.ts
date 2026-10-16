import { describe, expect, it } from "vitest";
import { mapAvailabilityError } from "./availability-errors";

describe("availability error mapping", () => {
  it("maps only the exact GiST constraint to overlap", () => {
    expect(
      mapAvailabilityError({
        code: "23P01",
        message:
          'conflicting key value violates exclusion constraint "availabilities_no_active_overlap"',
      }),
    ).toBe("overlap");
    expect(
      mapAvailabilityError({
        code: "23P01",
        message: 'conflicting key value violates exclusion constraint "other"',
      }),
    ).toBe("unexpected");
  });
  it("distinguishes stale, missing, denied and invalid", () => {
    expect(mapAvailabilityError({ code: "P0001", message: "STALE_AVAILABILITY_STATE" })).toBe(
      "stale",
    );
    expect(mapAvailabilityError({ code: "P0002", message: "RESOURCE_NOT_FOUND" })).toBe("missing");
    expect(mapAvailabilityError({ code: "42501", message: "AVAILABILITY_MUTATION_DENIED" })).toBe(
      "denied",
    );
    expect(mapAvailabilityError({ code: "22023", message: "INVALID_APPOINTMENT_DURATION" })).toBe(
      "invalid",
    );
  });
  it("never forwards raw SQL or unknown transport errors", () => {
    expect(mapAvailabilityError({ code: "XX000", message: "secret SQL details" })).toBe(
      "unexpected",
    );
    expect(mapAvailabilityError(new Error("network"))).toBe("unexpected");
  });
});
