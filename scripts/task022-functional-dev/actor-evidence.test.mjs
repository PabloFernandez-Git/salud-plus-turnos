import assert from "node:assert/strict";
import { test } from "node:test";
import { assertClosureActorEvidence } from "./actor-evidence.mjs";

const plan = { runId: "run", appointments: [{ id: "appointment" }] };
const valid = () => ({
  runId: plan.runId,
  observations: [
    {
      actor: "receptionA",
      outcome: "PASS",
      httpStatus: 200,
      renderedPage: "patient_dialog",
      patientVisible: true,
      upcomingAppointmentId: "appointment",
      failures: [],
    },
    ...["professionalA", "adminB", "unlinked"].map((actor) => ({
      actor,
      outcome: "PASS",
      httpStatus: 200,
      renderedPage: "not_found",
      notFoundVisible: true,
      protectedDataAbsent: true,
      administrativeControlsAbsent: true,
      noindex: true,
      failures: [],
    })),
  ],
});

test("all four actors and their security evidence are required", () => {
  assert.doesNotThrow(() => assertClosureActorEvidence(valid(), plan));
  const incomplete = valid();
  incomplete.observations.pop();
  assert.throws(() => assertClosureActorEvidence(incomplete, plan));
  const failed = valid();
  failed.observations[1].outcome = "FAIL";
  assert.throws(() => assertClosureActorEvidence(failed, plan));
  const leaked = valid();
  leaked.observations[2].protectedDataAbsent = false;
  assert.throws(() => assertClosureActorEvidence(leaked, plan));
});

test("HTTP 404 needs no robots directive; HTTP 200 does", () => {
  const found404 = valid();
  found404.observations[1].httpStatus = 404;
  found404.observations[1].noindex = "not_required";
  assert.doesNotThrow(() => assertClosureActorEvidence(found404, plan));
  found404.observations[1].httpStatus = 200;
  assert.throws(() => assertClosureActorEvidence(found404, plan));
});
