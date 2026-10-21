import { openDevDatabase } from "./dev-connection.mjs";
import { markAppointmentOwned, planAppointmentIntent, saveLedger } from "./ledger.mjs";

const createSql = "select * from public.staff_create_appointment($1,$2,$3,$4,$5,$6,$7)";
const rescheduleSql = "select * from public.staff_reschedule_appointment($1,$2,$3,$4,$5,$6,$7)";
const statusSql = "select * from public.staff_transition_appointment_status($1,$2,$3,$4)";
const noteSql = "select * from public.staff_update_appointment_note($1,$2,$3,$4)";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function asActor(client, userId, work) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL ROLE authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function create(client, ledger, userId, context) {
  const intentId = planAppointmentIntent(ledger, context);
  const result = await asActor(client, userId, (db) =>
    db.query(createSql, [
      context.centerId,
      context.patientCenterId,
      context.professionalCenterId,
      context.specialtyId,
      context.localDate,
      context.localTime,
      null,
    ]),
  );
  const row = result.rows[0];
  assert(row?.appointment_id, "Race fixture CREATE returned no UUID; STOP");
  markAppointmentOwned(ledger, intentId, row.appointment_id);
  return row;
}

function exactlyOneWinner(outcomes, loserCode, label) {
  const winners = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const losers = outcomes.filter((outcome) => outcome.status === "rejected");
  assert(
    winners.length === 1 && losers.length === 1 && losers[0].reason?.code === loserCode,
    `${label} did not yield one winner and ${loserCode} loser; STOP`,
  );
}

export async function testRemainingRaces(client, ledger, context) {
  const id = ledger.ids;
  const actor = ledger.actors;
  const a = await openDevDatabase("race-a");
  const b = await openDevDatabase("race-b");
  try {
    const moving = await create(client, ledger, actor.admina.id, context("13:00"));
    const createIntent = planAppointmentIntent(ledger, context("13:30"));
    const createReschedule = await Promise.allSettled([
      asActor(a, actor.admina.id, (db) =>
        db.query(rescheduleSql, [
          id.centerA,
          moving.appointment_id,
          moving.updated_at,
          id.pcA,
          id.specialtyA,
          context("13:30").localDate,
          "13:30",
        ]),
      ),
      asActor(b, actor.receptiona.id, (db) =>
        db.query(createSql, [
          id.centerA,
          id.patientA,
          id.pcA,
          id.specialtyA,
          context("13:30").localDate,
          "13:30",
          null,
        ]),
      ),
    ]);
    if (createReschedule[1].status === "fulfilled") {
      const appointmentId = createReschedule[1].value.rows[0]?.appointment_id;
      assert(appointmentId, "create/reschedule CREATE returned no UUID; STOP");
      markAppointmentOwned(ledger, createIntent, appointmentId);
    }
    exactlyOneWinner(createReschedule, "23P01", "create/reschedule");

    const rescheduled = await create(client, ledger, actor.admina.id, context("14:00"));
    const twoReschedules = await Promise.allSettled([
      asActor(a, actor.admina.id, (db) =>
        db.query(rescheduleSql, [
          id.centerA,
          rescheduled.appointment_id,
          rescheduled.updated_at,
          id.pcA,
          id.specialtyA,
          context("14:30").localDate,
          "14:30",
        ]),
      ),
      asActor(b, actor.receptiona.id, (db) =>
        db.query(rescheduleSql, [
          id.centerA,
          rescheduled.appointment_id,
          rescheduled.updated_at,
          id.pcA,
          id.specialtyA,
          context("15:00").localDate,
          "15:00",
        ]),
      ),
    ]);
    exactlyOneWinner(twoReschedules, "P0001", "reschedule/reschedule");

    const cancelling = await create(client, ledger, actor.admina.id, context("15:30"));
    const cancellationIntent = planAppointmentIntent(ledger, context("15:30"));
    const cancelCreate = await Promise.allSettled([
      asActor(a, actor.admina.id, (db) =>
        db.query(statusSql, [
          id.centerA,
          cancelling.appointment_id,
          cancelling.updated_at,
          "CANCELLED",
        ]),
      ),
      asActor(b, actor.receptiona.id, (db) =>
        db.query(createSql, [
          id.centerA,
          id.patientA,
          id.pcA,
          id.specialtyA,
          context("15:30").localDate,
          "15:30",
          null,
        ]),
      ),
    ]);
    assert(cancelCreate[0].status === "fulfilled", "cancel/create CANCEL failed; STOP");
    if (cancelCreate[1].status === "fulfilled") {
      const appointmentId = cancelCreate[1].value.rows[0]?.appointment_id;
      assert(appointmentId, "cancel/create CREATE returned no UUID; STOP");
      markAppointmentOwned(ledger, cancellationIntent, appointmentId);
    } else {
      assert(
        cancelCreate[1].reason?.code === "23P01",
        "cancel/create returned unexpected error; STOP",
      );
      await create(client, ledger, actor.receptiona.id, context("15:30"));
    }

    const versioned = await create(client, ledger, actor.admina.id, context("16:00"));
    const statusNote = await Promise.allSettled([
      asActor(a, actor.admina.id, (db) =>
        db.query(statusSql, [
          id.centerA,
          versioned.appointment_id,
          versioned.updated_at,
          "CONFIRMED",
        ]),
      ),
      asActor(b, actor.receptiona.id, (db) =>
        db.query(noteSql, [
          id.centerA,
          versioned.appointment_id,
          versioned.updated_at,
          "Synthetic race note",
        ]),
      ),
    ]);
    exactlyOneWinner(statusNote, "P0001", "status/note");
    const finalRows = await client.query(
      "select id,status,administrative_note from public.appointments where id=any($1::uuid[])",
      [
        [
          moving.appointment_id,
          rescheduled.appointment_id,
          cancelling.appointment_id,
          versioned.appointment_id,
        ],
      ],
    );
    assert(finalRows.rowCount === 4, "Race appointment persistence mismatch; STOP");
    assert(
      finalRows.rows.find((row) => row.id === cancelling.appointment_id)?.status === "CANCELLED",
      "cancel/create persisted status differs; STOP",
    );
    ledger.evidence.push({
      at: new Date().toISOString(),
      label: "concurrent create/reschedule, reschedule/reschedule, cancel/create, status/note",
      outcome: "PASS",
    });
    saveLedger(ledger);
  } finally {
    await Promise.allSettled([a.end(), b.end()]);
  }
}
