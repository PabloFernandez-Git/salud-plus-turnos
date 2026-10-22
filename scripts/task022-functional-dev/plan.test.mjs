import assert from "node:assert/strict";
import { test } from "node:test";
import { expectedIds } from "./checks.mjs";
import { browserEnvironment, nextEnvironment } from "./environment.mjs";
import {
  assertFixtureLimits,
  assertFocusedFixtureLimits,
  buildFixturePlan,
  buildFocusedFixturePlan,
  ownedRows,
} from "./plan.mjs";

test("focused denial plan uses only four identities, two centers, one patient and one turn", () => {
  const plan = buildFocusedFixturePlan(
    "00000000-0000-4000-8000-000000000024",
    new Date("2026-10-22T12:00:00Z"),
  );
  assertFocusedFixtureLimits(plan);
  assert.deepEqual(Object.keys(plan.actors), ["receptionA", "professionalA", "adminB", "unlinked"]);
  assert.equal(ownedRows(plan)["public.center_memberships"].length, 3);
  assert.equal(ownedRows(plan)["public.professional_centers"].length, 1);
  assert.equal(ownedRows(plan)["public.patient_centers"].length, 1);
  assert.equal(plan.appointments.length, 1);
  assert.equal(expectedIds(plan, "centerA", "patientA", "UPCOMING").length, 1);
  assert.equal(expectedIds(plan, "centerA", "patientA", "HISTORY").length, 0);
  const unexpectedActor = structuredClone(plan);
  unexpectedActor.actors.adminA = { id: null, email: "unexpected@example.test" };
  assert.throws(() => assertFocusedFixtureLimits(unexpectedActor));
  const unexpectedAppointment = structuredClone(plan);
  unexpectedAppointment.appointments.push({
    ...plan.appointments[0],
    id: "11111111-1111-4111-8111-111111111111",
  });
  assert.throws(() => assertFocusedFixtureLimits(unexpectedAppointment));
});

test("TASK-022 fixture plan stays inside approved limits and owns every domain UUID", () => {
  const plan = buildFixturePlan(
    "00000000-0000-4000-8000-000000000022",
    new Date("2026-10-22T12:00:00Z"),
  );
  assertFixtureLimits(plan);
  assert.equal(Object.keys(plan.actors).length, 5);
  assert.equal(ownedRows(plan)["public.patient_centers"].length, 3);
  assert.equal(plan.appointments.length, 30);
  assert.equal(expectedIds(plan, "centerA", "patientA", "UPCOMING").length, 2);
  assert.equal(expectedIds(plan, "centerA", "patientA", "HISTORY").length, 27);
  assert.equal(expectedIds(plan, "centerB", "patientB", "UPCOMING").length, 1);
  assert.equal(expectedIds(plan, "centerA", "patientEmpty", "HISTORY").length, 0);
  const tied = plan.appointments.filter((row) => row.label.startsWith("history-tie-"));
  assert.equal(tied.length, 21);
  assert.equal(new Set(tied.map((row) => row.startsAt)).size, 1);
  assert.equal(new Set(tied.map((row) => row.id)).size, 21);
});

test("Chromium and isolated Next never inherit privileged credentials", () => {
  const source = {
    PATH: "path",
    SUPABASE_DB_PASSWORD: "db-secret",
    SUPABASE_SECRET_KEY: "admin-secret",
    TASK022_FIXTURE_PASSWORD: "old-password",
    NODE_EXTRA_CA_CERTS: "pinned-ca",
  };
  const browser = browserEnvironment(
    source,
    { url: "https://ehllxymqyzrofydrvtzo.supabase.co", publishableKey: "public" },
    "synthetic-password",
  );
  const next = nextEnvironment(browser);
  for (const output of [browser, next]) {
    assert.equal(output.SUPABASE_DB_PASSWORD, undefined);
    assert.equal(output.SUPABASE_SECRET_KEY, undefined);
  }
  assert.equal(browser.TASK022_FIXTURE_PASSWORD, "synthetic-password");
  assert.equal(next.TASK022_FIXTURE_PASSWORD, undefined);
});

test("TASK-022 DST fixture represents both New York repeated-hour offsets", () => {
  const plan = buildFixturePlan(
    "00000000-0000-4000-8000-000000000023",
    new Date("2026-10-22T12:00:00Z"),
  );
  const early = plan.appointments.find((row) => row.label === "dst-first-offset");
  const late = plan.appointments.find((row) => row.label === "dst-second-offset");
  assert.equal(Date.parse(late.startsAt) - Date.parse(early.startsAt), 3_600_000);
  const local = (value) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset",
    }).format(new Date(value));
  assert.match(local(early.startsAt), /01:30.*GMT-4/);
  assert.match(local(late.startsAt), /01:30.*GMT-5/);
});
