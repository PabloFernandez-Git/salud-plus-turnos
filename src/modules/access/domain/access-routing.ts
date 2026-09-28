export type MembershipRole = "ADMIN" | "RECEPTION" | "PROFESSIONAL";

export type AccessibleCenter = {
  id: string;
  membershipId: string;
  name: string;
  professionalCenterId: string | null;
  role: MembershipRole;
  timezone: string;
};

export type MembershipAccessRecord = {
  centerId: string;
  id: string;
  isActive: boolean;
  professionalCenterId: string | null;
  role: MembershipRole;
};

export type CenterAccessRecord = {
  id: string;
  isActive: boolean;
  name: string;
  timezone: string;
};

export function buildAccessibleCenters(
  memberships: readonly MembershipAccessRecord[],
  centers: readonly CenterAccessRecord[],
): AccessibleCenter[] {
  const activeCenters = new Map(
    centers.filter((center) => center.isActive).map((center) => [center.id, center]),
  );

  return memberships
    .filter((membership) => membership.isActive)
    .flatMap((membership) => {
      const center = activeCenters.get(membership.centerId);
      if (!center) return [];

      return [
        {
          id: center.id,
          membershipId: membership.id,
          name: center.name,
          professionalCenterId: membership.professionalCenterId,
          role: membership.role,
          timezone: center.timezone,
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function determineAccessDestination({
  centers,
  isPlatformAdmin,
}: {
  centers: readonly AccessibleCenter[];
  isPlatformAdmin: boolean;
}): string {
  if (centers.length === 1) return `/centers/${centers[0].id}`;
  if (centers.length > 1) return "/select-center";
  if (isPlatformAdmin) return "/platform";
  return "/no-access";
}

const allowedCallbackDestinations = new Set(["/update-password"]);

export function allowedCallbackDestination(value: string | null): string {
  if (value && allowedCallbackDestinations.has(value)) return value;
  return "/update-password";
}
