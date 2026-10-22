import assert from "node:assert/strict";

export const closureActors = Object.freeze(["receptionA", "professionalA", "adminB", "unlinked"]);

export function assertClosureActorEvidence(result, plan) {
  assert.equal(result.runId, plan.runId);
  assert.deepEqual(
    result.observations.map((row) => row.actor),
    closureActors,
  );
  for (const row of result.observations) {
    assert.equal(row.outcome, "PASS", `${row.actor} Chromium check did not pass`);
    assert([200, 404].includes(row.httpStatus), `${row.actor} HTTP status missing`);
    assert.deepEqual(row.failures, [], `${row.actor} has failed checks`);
  }
  const reception = result.observations[0];
  assert.equal(reception.renderedPage, "patient_dialog");
  assert.equal(reception.patientVisible, true);
  assert.equal(reception.upcomingAppointmentId, plan.appointments[0].id);
  for (const row of result.observations.slice(1)) {
    assert.equal(row.renderedPage, "not_found");
    assert.equal(row.notFoundVisible, true);
    assert.equal(row.protectedDataAbsent, true);
    assert.equal(row.administrativeControlsAbsent, true);
    assert.equal(row.noindex, row.httpStatus === 200 ? true : "not_required");
  }
}
