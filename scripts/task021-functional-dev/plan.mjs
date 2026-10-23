import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export const projectRef = "ehllxymqyzrofydrvtzo";
export const limits = Object.freeze({
  authUsers: 6,
  centers: 2,
  professionals: 2,
  patients: 2,
  appointments: 10,
});
export const resources = Object.freeze([
  ["auth.users", "id"],
  ["public.users", "id"],
  ["public.centers", "id"],
  ["public.center_memberships", "id"],
  ["public.professionals", "id"],
  ["public.professional_centers", "id"],
  ["public.specialties", "id"],
  [
    "public.professional_center_specialties",
    "professional_center_id::text || '/' || specialty_id::text",
  ],
  ["public.persons", "id"],
  ["public.patient_centers", "id"],
  ["public.appointments", "id"],
  ["public.availabilities", "id"],
  ["public.platform_admins", "user_id"],
  ["private.provisioning_operations", "id"],
]);
function dateInCenter(instant) {
  const pieces = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (name) => pieces.find((x) => x.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function buildPlan(runId = randomUUID(), now = new Date()) {
  assert.match(runId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert(!Number.isNaN(now.getTime()));
  const day = dateInCenter(now);
  for (const minutes of [-40, 165])
    assert.equal(
      dateInCenter(new Date(now.getTime() + minutes * 60_000)),
      day,
      "Run window must stay within one Center civil date, with room for past and upcoming fixtures",
    );
  const ids = Object.fromEntries(
    [
      "centerA",
      "centerB",
      "professionalA",
      "professionalA2",
      "pcA",
      "pcA2",
      "specialtyA",
      "personA",
      "personA2",
      "patientA",
      "patientA2",
      "adminMembershipA",
      "receptionMembershipA",
      "professionalMembershipA",
      "professionalMembershipA2",
      "adminMembershipB",
    ].map((key) => [key, randomUUID()]),
  );
  const actors = Object.fromEntries(
    ["adminA", "receptionA", "professionalA", "professionalA2", "adminB", "unlinked"].map((key) => [
      key,
      { id: null, email: `task021-${runId}-${key.toLowerCase()}@example.test` },
    ]),
  );
  const definitions = [
    ["a1-pending-1", "PENDING", "pcA", "patientA", 45],
    ["a2-pending", "PENDING", "pcA2", "patientA2", 55],
    ["a1-confirmed-1", "CONFIRMED", "pcA", "patientA", 65],
    ["a1-pending-2", "PENDING", "pcA", "patientA", 85],
    ["a1-confirmed-2", "CONFIRMED", "pcA", "patientA", 105],
    ["a1-pending-3", "PENDING", "pcA", "patientA", 125],
    ["a1-confirmed-3", "CONFIRMED", "pcA", "patientA", 145],
    ["a1-attended", "ATTENDED", "pcA", "patientA", -10],
    ["a1-no-show", "NO_SHOW", "pcA", "patientA", -30],
    ["a1-cancelled", "CANCELLED", "pcA", "patientA", -40],
  ];
  const appointments = definitions.map(([label, status, pc, patient, minutes]) => ({
    id: randomUUID(),
    label,
    status,
    professionalCenter: pc,
    patient,
    startsAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
    endsAt: new Date(now.getTime() + (minutes + 20) * 60_000).toISOString(),
  }));
  return {
    version: 1,
    projectRef,
    runId,
    createdAt: now.toISOString(),
    localDate: day,
    ids,
    actors,
    appointments,
  };
}
export function ownedRows(plan) {
  const i = plan.ids;
  const users = Object.values(plan.actors)
    .map((x) => x.id)
    .filter(Boolean);
  return {
    "auth.users": users,
    "public.users": users,
    "public.centers": [i.centerA, i.centerB],
    "public.center_memberships": [
      i.adminMembershipA,
      i.receptionMembershipA,
      i.professionalMembershipA,
      i.professionalMembershipA2,
      i.adminMembershipB,
    ],
    "public.professionals": [i.professionalA, i.professionalA2],
    "public.professional_centers": [i.pcA, i.pcA2],
    "public.specialties": [i.specialtyA],
    "public.professional_center_specialties": [
      `${i.pcA}/${i.specialtyA}`,
      `${i.pcA2}/${i.specialtyA}`,
    ],
    "public.persons": [i.personA, i.personA2],
    "public.patient_centers": [i.patientA, i.patientA2],
    "public.appointments": plan.appointments.map((x) => x.id),
    "public.availabilities": [],
    "public.platform_admins": [],
    "private.provisioning_operations": [],
  };
}
export function expectedRows(plan, scope) {
  const selected = plan.appointments.filter(
    (x) =>
      scope === "staff" ||
      x.professionalCenter === scope ||
      plan.ids[x.professionalCenter] === scope,
  );
  const count = (status) => selected.filter((x) => x.status === status).length;
  const upcoming = selected
    .filter((x) => ["PENDING", "CONFIRMED"].includes(x.status))
    .sort(
      (a, b) => a.startsAt.localeCompare(b.startsAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, 5);
  return {
    pending_count: count("PENDING"),
    confirmed_count: count("CONFIRMED"),
    attended_count: count("ATTENDED"),
    no_show_count: count("NO_SHOW"),
    cancelled_count: count("CANCELLED"),
    ...(scope === "staff"
      ? {
          professional_centers_with_appointments_count: new Set(
            selected.filter((x) => x.status !== "CANCELLED").map((x) => x.professionalCenter),
          ).size,
        }
      : {}),
    upcoming: upcoming.map((x) => x.id),
  };
}
export function assertPlan(plan) {
  assert.equal(plan.projectRef, projectRef);
  assert.equal(Object.keys(plan.actors).length, limits.authUsers);
  assert.equal(plan.appointments.length, limits.appointments);
  const blocking = plan.appointments.filter((x) =>
    ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW"].includes(x.status),
  );
  for (const left of blocking) {
    const start = Date.parse(left.startsAt);
    const end = Date.parse(left.endsAt);
    assert(
      Number.isFinite(start) && Number.isFinite(end) && start < end,
      `Invalid interval: ${left.label}`,
    );
    for (const right of blocking) {
      if (left === right || left.professionalCenter !== right.professionalCenter) continue;
      assert(
        end <= Date.parse(right.startsAt) || Date.parse(right.endsAt) <= start,
        `Blocking appointments overlap: ${left.label} / ${right.label}`,
      );
    }
  }
  const owned = ownedRows(plan);
  assert.equal(owned["public.centers"].length, limits.centers);
  assert.equal(owned["public.professionals"].length, limits.professionals);
  assert.equal(owned["public.patient_centers"].length, limits.patients);
  for (const [table, ids] of Object.entries(owned))
    assert.equal(new Set(ids).size, ids.length, `Repeated ownership key in ${table}`);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(expectedRows(plan, "staff")).filter(([key]) => key !== "upcoming"),
    ),
    {
      pending_count: 4,
      confirmed_count: 3,
      attended_count: 1,
      no_show_count: 1,
      cancelled_count: 1,
      professional_centers_with_appointments_count: 2,
    },
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(expectedRows(plan, "pcA")).filter(([key]) => key !== "upcoming"),
    ),
    {
      pending_count: 3,
      confirmed_count: 3,
      attended_count: 1,
      no_show_count: 1,
      cancelled_count: 1,
    },
  );
  return plan;
}
