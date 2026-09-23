import { describe, expect, it } from "vitest";

import {
  allowedCallbackDestination,
  buildAccessibleCenters,
  determineAccessDestination,
  type AccessibleCenter,
  type CenterAccessRecord,
  type MembershipAccessRecord,
} from "./access-routing";

const centers: CenterAccessRecord[] = [
  { id: "center-a", isActive: true, name: "Centro A", timezone: "America/Argentina/Buenos_Aires" },
  { id: "center-b", isActive: true, name: "Centro B", timezone: "America/Argentina/Buenos_Aires" },
  { id: "center-c", isActive: false, name: "Centro C", timezone: "America/Argentina/Buenos_Aires" },
];

function membership(
  centerId: string,
  options: Partial<MembershipAccessRecord> = {},
): MembershipAccessRecord {
  return {
    centerId,
    id: `membership-${centerId}`,
    isActive: true,
    professionalCenterId: null,
    role: "RECEPTION",
    ...options,
  };
}

function accessibleCenter(id: string): AccessibleCenter {
  return {
    id,
    membershipId: `membership-${id}`,
    name: id,
    professionalCenterId: null,
    role: "RECEPTION",
    timezone: "America/Argentina/Buenos_Aires",
  };
}

describe("Center access routing", () => {
  it("routes zero memberships to no-access", () => {
    expect(determineAccessDestination({ centers: [], isPlatformAdmin: false })).toBe("/no-access");
  });

  it("routes one membership directly to its Center", () => {
    expect(
      determineAccessDestination({
        centers: [accessibleCenter("center-a")],
        isPlatformAdmin: false,
      }),
    ).toBe("/centers/center-a");
  });

  it("routes two memberships to the selector", () => {
    expect(
      determineAccessDestination({
        centers: [accessibleCenter("center-a"), accessibleCenter("center-b")],
        isPlatformAdmin: false,
      }),
    ).toBe("/select-center");
  });

  it("ignores inactive memberships", () => {
    expect(buildAccessibleCenters([membership("center-a", { isActive: false })], centers)).toEqual(
      [],
    );
  });

  it("ignores inactive Centers", () => {
    expect(buildAccessibleCenters([membership("center-c")], centers)).toEqual([]);
  });

  it("sends an exclusively PLATFORM_ADMIN identity to the protected placeholder", () => {
    expect(determineAccessDestination({ centers: [], isPlatformAdmin: true })).toBe("/platform");
  });

  it("does not allow open callback redirects", () => {
    expect(allowedCallbackDestination("https://evil.example.test")).toBe("/update-password");
    expect(allowedCallbackDestination("//evil.example.test")).toBe("/update-password");
    expect(allowedCallbackDestination("/update-password")).toBe("/update-password");
  });
});
