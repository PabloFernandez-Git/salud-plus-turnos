import test from "node:test";
import assert from "node:assert/strict";
import { assertPlan, buildPlan, expectedRows, ownedRows } from "./plan.mjs";

const runId = "11111111-1111-4111-8111-111111111111";
const noon = new Date("2026-10-22T15:00:00Z");

test("minimal fixture plan has exact roles, counts and five stable upcoming", () => {
  const plan = assertPlan(buildPlan(runId, noon));
  const staff = expectedRows(plan, "staff");
  const own = expectedRows(plan, plan.ids.pcA);
  const second = expectedRows(plan, plan.ids.pcA2);
  assert.deepEqual(
    [
      staff.pending_count,
      staff.confirmed_count,
      staff.attended_count,
      staff.no_show_count,
      staff.cancelled_count,
    ],
    [4, 3, 1, 1, 1],
  );
  assert.deepEqual(
    [
      own.pending_count,
      own.confirmed_count,
      own.attended_count,
      own.no_show_count,
      own.cancelled_count,
    ],
    [3, 3, 1, 1, 1],
  );
  assert.deepEqual(
    [
      second.pending_count,
      second.confirmed_count,
      second.attended_count,
      second.no_show_count,
      second.cancelled_count,
    ],
    [1, 0, 0, 0, 0],
  );
  assert.equal(staff.upcoming.length, 5);
  assert.equal(own.upcoming.length, 5);
  assert.equal(second.upcoming.length, 1);
  const owned = ownedRows(plan);
  assert.equal(owned["public.appointments"].length, 10);
  assert.equal(owned["public.center_memberships"].length, 5);
  assert.equal(owned["public.professional_center_specialties"].length, 2);
});

test("fixture planning stops if the local civil date would change", () => {
  assert.throws(() => buildPlan(runId, new Date("2026-10-22T03:20:00Z")), /Run window/);
  assert.throws(() => buildPlan(runId, new Date("2026-10-23T00:30:00Z")), /Run window/);
  assert.throws(() => buildPlan(runId, new Date("2026-10-23T02:00:00Z")), /Run window/);
});

test("blocking appointments are disjoint for each professional, with contiguous ranges allowed", () => {
  const plan = assertPlan(buildPlan(runId, noon));
  const blocking = plan.appointments.filter((row) => row.status !== "CANCELLED");
  for (let index = 0; index < blocking.length; index++) {
    for (const other of blocking.slice(index + 1)) {
      const row = blocking[index];
      if (row.professionalCenter !== other.professionalCenter) continue;
      assert(
        Date.parse(row.endsAt) <= Date.parse(other.startsAt) ||
          Date.parse(other.endsAt) <= Date.parse(row.startsAt),
        `${row.label} overlaps ${other.label}`,
      );
    }
  }
  const first = plan.appointments.find((row) => row.label === "a1-pending-1");
  const next = plan.appointments.find((row) => row.label === "a1-confirmed-1");
  assert.equal(first.endsAt, next.startsAt);
});

test("plan rejects the failed +45/+55 collision and historical blocking collision", () => {
  const original = buildPlan(runId, noon);
  const future = structuredClone(original);
  const confirmed = future.appointments.find((row) => row.label === "a1-confirmed-1");
  confirmed.startsAt = new Date(noon.getTime() + 55 * 60_000).toISOString();
  confirmed.endsAt = new Date(noon.getTime() + 75 * 60_000).toISOString();
  assert.throws(() => assertPlan(future), /Blocking appointments overlap/);

  const history = structuredClone(original);
  const noShow = history.appointments.find((row) => row.label === "a1-no-show");
  noShow.startsAt = new Date(noon.getTime() - 20 * 60_000).toISOString();
  noShow.endsAt = noon.toISOString();
  assert.throws(() => assertPlan(history), /Blocking appointments overlap/);
});
