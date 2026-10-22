import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export const projectRef = "ehllxymqyzrofydrvtzo";
export const resourceColumns = Object.freeze([
  ["auth.users", "id"],
  ["public.users", "id"],
  ["public.centers", "id"],
  ["public.center_memberships", "id"],
  ["public.professionals", "id"],
  ["public.professional_centers", "id"],
  ["public.specialties", "id"],
  ["public.professional_center_specialties", "professional_center_id, specialty_id"],
  ["public.persons", "id"],
  ["public.patient_centers", "id"],
  ["public.appointments", "id"],
  ["public.availabilities", "id"],
  ["public.platform_admins", "user_id"],
  ["private.provisioning_operations", "id"],
]);

export const fixtureLimits = Object.freeze({
  authUsers: 5,
  centers: 2,
  patients: 3,
  appointments: 30,
});

export const focusedFixtureLimits = Object.freeze({
  authUsers: 4,
  centers: 2,
  patients: 1,
  appointments: 1,
});

function nextNovemberOverlap(after) {
  let year = after.getUTCFullYear();
  for (;;) {
    const first = new Date(Date.UTC(year, 10, 1));
    const sunday = 1 + ((7 - first.getUTCDay()) % 7);
    const firstOccurrence = new Date(Date.UTC(year, 10, sunday, 5, 30));
    if (firstOccurrence.getTime() > after.getTime() + 86_400_000) {
      return [
        firstOccurrence.toISOString(),
        new Date(firstOccurrence.getTime() + 3_600_000).toISOString(),
      ];
    }
    year += 1;
  }
}

export function buildFixturePlan(runId = randomUUID(), now = new Date()) {
  assert.match(runId, /^[0-9a-f-]{36}$/i);
  assert(!Number.isNaN(now.getTime()));
  const ids = Object.fromEntries(
    [
      "centerA",
      "centerB",
      "professionalA",
      "professionalB",
      "pcA",
      "pcB",
      "specialtyA",
      "specialtyB",
      "personA",
      "personEmpty",
      "personB",
      "patientA",
      "patientEmpty",
      "patientB",
      "adminMembershipA",
      "receptionMembershipA",
      "professionalMembershipA",
      "adminMembershipB",
    ].map((key) => [key, randomUUID()]),
  );
  const actors = Object.fromEntries(
    ["adminA", "receptionA", "professionalA", "adminB", "unlinked"].map((name) => [
      name,
      { id: null, email: `task022-${runId}-${name.toLowerCase()}@example.test` },
    ]),
  );
  const appointments = [];
  const add = (patient, start, status, label) =>
    appointments.push({
      id: randomUUID(),
      patient,
      center: patient === "patientB" ? "centerB" : "centerA",
      professionalCenter: patient === "patientB" ? "pcB" : "pcA",
      specialty: patient === "patientB" ? "specialtyB" : "specialtyA",
      startsAt: new Date(start).toISOString(),
      status,
      label,
    });
  const day = 86_400_000;
  const hour = 3_600_000;
  const oldTie = now.getTime() - 5 * day;
  for (let i = 0; i < 21; i += 1) add("patientA", oldTie, "CANCELLED", `history-tie-${i + 1}`);
  add("patientA", oldTie - day, "ATTENDED", "attended-past");
  add("patientA", oldTie - day - hour, "NO_SHOW", "no-show-past");
  add("patientA", oldTie - day - 2 * hour, "PENDING", "pending-past");
  const [overlapEarly, overlapLate] = nextNovemberOverlap(now);
  add("patientA", overlapEarly, "CANCELLED", "dst-first-offset");
  add("patientA", overlapLate, "CANCELLED", "dst-second-offset");
  add("patientA", now.getTime() + 10 * day, "ATTENDED", "attended-future");
  add("patientA", now.getTime() + 7 * day, "PENDING", "pending-future");
  add("patientA", now.getTime() + 8 * day, "CONFIRMED", "confirmed-future");
  add("patientB", now.getTime() + 9 * day, "PENDING", "other-center");
  assert.equal(appointments.length, fixtureLimits.appointments);
  return { version: 1, projectRef, runId, createdAt: now.toISOString(), ids, actors, appointments };
}

export function buildFocusedFixturePlan(runId = randomUUID(), now = new Date()) {
  assert.match(runId, /^[0-9a-f-]{36}$/i);
  assert(!Number.isNaN(now.getTime()));
  const ids = Object.fromEntries(
    [
      "centerA",
      "centerB",
      "professionalA",
      "pcA",
      "specialtyA",
      "personA",
      "patientA",
      "receptionMembershipA",
      "professionalMembershipA",
      "adminMembershipB",
    ].map((key) => [key, randomUUID()]),
  );
  const actors = Object.fromEntries(
    ["receptionA", "professionalA", "adminB", "unlinked"].map((name) => [
      name,
      { id: null, email: `task022-${runId}-${name.toLowerCase()}@example.test` },
    ]),
  );
  const appointments = [
    {
      id: randomUUID(),
      patient: "patientA",
      center: "centerA",
      professionalCenter: "pcA",
      specialty: "specialtyA",
      startsAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
      status: "CONFIRMED",
      label: "reception-visible-future",
    },
  ];
  return {
    version: 1,
    scope: "denial",
    projectRef,
    runId,
    createdAt: now.toISOString(),
    ids,
    actors,
    appointments,
  };
}

export function ownedRows(plan) {
  const i = plan.ids;
  const authIds = Object.values(plan.actors)
    .map((actor) => actor.id)
    .filter(Boolean);
  if (plan.scope === "denial")
    return {
      "auth.users": authIds,
      "public.users": authIds,
      "public.centers": [i.centerA, i.centerB],
      "public.center_memberships": [
        i.receptionMembershipA,
        i.professionalMembershipA,
        i.adminMembershipB,
      ],
      "public.professionals": [i.professionalA],
      "public.professional_centers": [i.pcA],
      "public.specialties": [i.specialtyA],
      "public.professional_center_specialties": [`${i.pcA}/${i.specialtyA}`],
      "public.persons": [i.personA],
      "public.patient_centers": [i.patientA],
      "public.appointments": plan.appointments.map((row) => row.id),
      "public.availabilities": [],
      "public.platform_admins": [],
      "private.provisioning_operations": [],
    };
  return {
    "auth.users": authIds,
    "public.users": authIds,
    "public.centers": [i.centerA, i.centerB],
    "public.center_memberships": [
      i.adminMembershipA,
      i.receptionMembershipA,
      i.professionalMembershipA,
      i.adminMembershipB,
    ],
    "public.professionals": [i.professionalA, i.professionalB],
    "public.professional_centers": [i.pcA, i.pcB],
    "public.specialties": [i.specialtyA, i.specialtyB],
    "public.professional_center_specialties": [
      `${i.pcA}/${i.specialtyA}`,
      `${i.pcB}/${i.specialtyB}`,
    ],
    "public.persons": [i.personA, i.personEmpty, i.personB],
    "public.patient_centers": [i.patientA, i.patientEmpty, i.patientB],
    "public.appointments": plan.appointments.map((row) => row.id),
    "public.availabilities": [],
    "public.platform_admins": [],
    "private.provisioning_operations": [],
  };
}

export function assertFocusedFixtureLimits(plan) {
  assert.equal(plan.scope, "denial");
  assert.equal(plan.projectRef, projectRef);
  assert.equal(Object.keys(plan.actors).length, focusedFixtureLimits.authUsers);
  assert.deepEqual(Object.keys(plan.actors), ["receptionA", "professionalA", "adminB", "unlinked"]);
  assert.equal(ownedRows(plan)["public.centers"].length, focusedFixtureLimits.centers);
  assert.equal(ownedRows(plan)["public.patient_centers"].length, focusedFixtureLimits.patients);
  assert.equal(plan.appointments.length, focusedFixtureLimits.appointments);
  assert.equal(plan.appointments[0].patient, "patientA");
  assert.equal(plan.appointments[0].center, "centerA");
  assert.equal(plan.appointments[0].status, "CONFIRMED");
  for (const [table, ids] of Object.entries(ownedRows(plan))) {
    assert.equal(new Set(ids).size, ids.length, `${table} repeats a fixture key`);
    assert(ids.every((id) => typeof id === "string" && id.length > 0));
  }
}

export function assertFixtureLimits(plan) {
  assert.equal(Object.keys(plan.actors).length, fixtureLimits.authUsers);
  assert.equal(ownedRows(plan)["public.centers"].length, fixtureLimits.centers);
  assert.equal(ownedRows(plan)["public.patient_centers"].length, fixtureLimits.patients);
  assert.equal(plan.appointments.length, fixtureLimits.appointments);
  for (const [table, ids] of Object.entries(ownedRows(plan))) {
    assert.equal(new Set(ids).size, ids.length, `${table} repeats a fixture key`);
  }
}
