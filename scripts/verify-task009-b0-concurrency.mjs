import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";

// Date would discard the microseconds used by the Appointment CAS.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => value);

const rawUrl = process.env.TASK009_SHADOW_DATABASE_URL;
assert(rawUrl, "TASK009_SHADOW_DATABASE_URL is required");
const url = new URL(rawUrl);
assert.equal(url.protocol, "postgres:");
assert(["127.0.0.1", "localhost"].includes(url.hostname));
assert.equal(url.pathname, "/postgres");
assert.equal(url.username, "postgres");

const C = "91000000-0000-0000-0000-000000000001";
const C2 = "91000000-0000-0000-0000-000000000002";
const ADMIN = "91000000-0000-0000-0000-000000000011";
const RECEPTION = "91000000-0000-0000-0000-000000000012";
const PC = "91000000-0000-0000-0000-000000000031";
const SPECIALTY = "91000000-0000-0000-0000-000000000041";
const PATIENT = "91000000-0000-0000-0000-000000000061";
const DAY = "2030-01-07";
const createSql = "select * from public.staff_create_appointment($1,$2,$3,$4,$5,$6,$7)";
const rescheduleSql = "select * from public.staff_reschedule_appointment($1,$2,$3,$4,$5,$6,$7)";
const statusSql = "select * from public.staff_transition_appointment_status($1,$2,$3,$4)";
const noteSql = "select * from public.staff_update_appointment_note($1,$2,$3,$4)";
const createArgs = (time) => [C, PATIENT, PC, SPECIALTY, DAY, time, null];
const rescheduleArgs = (appointment, time) => [
  C,
  appointment.appointment_id,
  appointment.updated_at,
  PC,
  SPECIALTY,
  DAY,
  time,
];
const newClient = () =>
  new pg.Client({ connectionString: rawUrl, application_name: "task009-b0-r1" });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const owner = newClient();
const results = [];
const expected = new Map();

async function actor(userId) {
  const connection = newClient();
  await connection.connect();
  await connection.query("begin");
  await connection.query("set local statement_timeout = '15s'");
  await connection.query("set local role authenticated");
  await connection.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
  const pid = (await connection.query("select pg_backend_pid() as pid")).rows[0].pid;
  return { connection, pid };
}

async function end(actorSession, commit) {
  try {
    await actorSession.connection.query(commit ? "commit" : "rollback");
  } finally {
    await actorSession.connection.end();
  }
}

async function call(userId, sql, args) {
  const session = await actor(userId);
  try {
    const row = (await session.connection.query(sql, args)).rows[0];
    await end(session, true);
    return row;
  } catch (error) {
    await end(session, false);
    throw error;
  }
}

async function observeLock(firstPid, secondPid, isSettled, deadlineMs = 5000) {
  assert.notEqual(firstPid, secondPid, "Actors must have distinct PostgreSQL backends");
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    const { rows } = await owner.query(
      `select pid, state, xact_start is not null as in_transaction,
              wait_event_type, pg_blocking_pids(pid) as blockers
       from pg_stat_activity where pid = any($1::integer[])`,
      [[firstPid, secondPid]],
    );
    const first = rows.find((row) => row.pid === firstPid);
    const second = rows.find((row) => row.pid === secondPid);
    assert(first && second, "Both backend sessions must remain connected");
    assert.equal(first.state, "idle in transaction");
    assert.equal(first.in_transaction, true);
    if (
      second.state === "active" &&
      second.wait_event_type === "Lock" &&
      second.blockers.includes(firstPid)
    ) {
      assert.equal(isSettled(), false, "Second RPC settled during observed lock wait");
      return { firstPid, secondPid, waitEvent: second.wait_event_type, blockers: second.blockers };
    }
    if (isSettled()) throw new Error("SECOND_SETTLED_WITHOUT_OBSERVED_LOCK");
    await pause(20); // Polling interval; pg_stat_activity and pg_blocking_pids are the evidence.
  }
  throw new Error("NO_OBSERVED_LOCK_BEFORE_DEADLINE");
}

function assertError(outcome, code, message) {
  assert(outcome.error, `Expected ${code}/${message}, got success`);
  assert.equal(outcome.error.code, code);
  assert.equal(outcome.error.message, message);
}

// The first RPC has returned but its transaction is still open. The second RPC
// must actually wait for that transaction before we release it.
async function race(
  id,
  firstUser,
  secondUser,
  firstSql,
  firstArgs,
  secondSql,
  secondArgs,
  options,
) {
  const first = await actor(firstUser);
  let second;
  let firstEnded = false;
  let secondEnded = false;
  try {
    const firstRow = (await first.connection.query(firstSql, firstArgs)).rows[0];
    assert(firstRow, `${id}: first RPC returned no row`);
    second = await actor(secondUser);
    let settled = false;
    const pending = second.connection.query(secondSql, secondArgs).then(
      (value) => {
        settled = true;
        return { value: value.rows[0] };
      },
      (error) => {
        settled = true;
        return { error };
      },
    );
    let observation;
    try {
      observation = await observeLock(first.pid, second.pid, () => settled);
    } catch (error) {
      if (!options.earlyError || error.message !== "SECOND_SETTLED_WITHOUT_OBSERVED_LOCK")
        throw error;
      // The second RPC finished against the still-uncommitted old row. The
      // observer already verified the first backend was idle in transaction.
      observation = {
        firstPid: first.pid,
        secondPid: second.pid,
        waitEvent: null,
        result: "EARLY_CONFLICT_BEFORE_FIRST_END",
      };
    }
    await end(first, options.firstCommit !== false);
    firstEnded = true;
    const outcome = await pending;
    const expectedError = observation.result ? options.earlyError : options.secondError;
    if (expectedError) {
      assertError(outcome, ...expectedError);
      await end(second, false);
    } else {
      assert(!outcome.error, `${id}: unexpected second RPC error ${outcome.error?.code}`);
      assert(outcome.value, `${id}: second RPC returned no row`);
      await end(second, true);
    }
    secondEnded = true;
    results.push({
      id,
      backends: [first.pid, second.pid],
      overlap: "first idle in transaction; second active",
      lock: observation,
      first: options.firstCommit === false ? "ROLLBACK" : "COMMIT",
      firstResult: firstRow,
      secondResult: outcome.error
        ? { sqlstate: outcome.error.code, code: outcome.error.message }
        : outcome.value,
    });
    return { first: firstRow, second: outcome.value };
  } finally {
    if (!firstEnded) await end(first, false);
    if (second && !secondEnded) await end(second, false);
  }
}

function record(appointment, time, status = "PENDING", note = null, duration = 30) {
  assert(appointment.appointment_id);
  assert(appointment.updated_at);
  return {
    id: appointment.appointment_id,
    patient_center_id: PATIENT,
    professional_center_id: PC,
    specialty_id: SPECIALTY,
    starts: `${time}:00`,
    duration,
    status,
    administrative_note: note,
    updated_at: appointment.updated_at,
  };
}

async function snapshot(id, entities = async () => {}) {
  // A fresh third connection reads only committed rows, never either actor's transaction.
  const inspector = newClient();
  await inspector.connect();
  try {
    const { rows } = await inspector.query(
      `select id, patient_center_id, professional_center_id, specialty_id, status,
              administrative_note, updated_at,
              (starts_at at time zone 'America/Argentina/Buenos_Aires')::date::text as local_date,
              (starts_at at time zone 'America/Argentina/Buenos_Aires')::time::text as local_start,
              (extract(epoch from ends_at - starts_at) / 60)::integer as duration
       from public.appointments where center_id=$1 order by id`,
      [C],
    );
    assert.equal(rows.length, expected.size, `${id}: exact Appointment count`);
    for (const row of rows) {
      const want = expected.get(row.id);
      assert(want, `${id}: unexpected Appointment ${row.id}`);
      assert.equal(row.local_date, DAY);
      for (const field of [
        "patient_center_id",
        "professional_center_id",
        "specialty_id",
        "status",
        "administrative_note",
        "updated_at",
        "duration",
      ])
        assert.equal(row[field], want[field], `${id}: ${row.id} ${field}`);
      assert.equal(row.local_start, want.starts, `${id}: ${row.id} starts_at`);
    }
    const overlap = await inspector.query(
      `select count(*)::integer as n from public.appointments a
       join public.appointments b on a.id < b.id
       and a.professional_center_id=b.professional_center_id
       and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
       where a.center_id=$1 and b.center_id=$1
         and a.status in ('PENDING','CONFIRMED','ATTENDED','NO_SHOW')
         and b.status in ('PENDING','CONFIRMED','ATTENDED','NO_SHOW')`,
      [C],
    );
    assert.equal(overlap.rows[0].n, 0, `${id}: double booking`);
    await entities(inspector);
    results.at(-1).persisted = { appointments: rows.length, blockingOverlaps: 0, entities: "PASS" };
  } finally {
    await inspector.end();
  }
}

async function assertAdvanced(newToken, oldToken) {
  const { rows } = await owner.query("select $1::timestamptz > $2::timestamptz as advanced", [
    newToken,
    oldToken,
  ]);
  assert.equal(rows[0].advanced, true, "CAS must advance after an effective update");
}

async function seed() {
  const source = readFileSync("supabase/tests/task-009-b0-mutations.sql", "utf8");
  const seedSql = source.slice(
    source.indexOf("insert into public.centers"),
    source.indexOf("do $test$"),
  );
  assert(seedSql.includes("insert into public.availabilities"));
  await owner.query("begin");
  try {
    await owner.query(seedSql);
    await owner.query("commit");
  } catch (error) {
    await owner.query("rollback");
    throw error;
  }
}

async function cleanup() {
  await owner.query("begin");
  try {
    for (const table of [
      "appointments",
      "availabilities",
      "center_memberships",
      "professional_center_specialties",
      "patient_centers",
      "specialties",
      "professional_centers",
    ]) {
      await owner.query("delete from public." + table + " where center_id in ($1,$2)", [C, C2]);
    }
    await owner.query(
      "delete from public.professionals where id in ('91000000-0000-0000-0000-000000000021','91000000-0000-0000-0000-000000000022')",
    );
    await owner.query("delete from public.persons where id='91000000-0000-0000-0000-000000000051'");
    await owner.query(
      "delete from public.platform_admins where user_id='91000000-0000-0000-0000-000000000014'",
    );
    await owner.query("delete from public.centers where id in ($1,$2)", [C, C2]);
    await owner.query("delete from public.users where id in ($1,$2,$3,$4,$5)", [
      ADMIN,
      RECEPTION,
      "91000000-0000-0000-0000-000000000013",
      "91000000-0000-0000-0000-000000000014",
      "91000000-0000-0000-0000-000000000015",
    ]);
    await owner.query("delete from auth.users where id in ($1,$2,$3,$4,$5)", [
      ADMIN,
      RECEPTION,
      "91000000-0000-0000-0000-000000000013",
      "91000000-0000-0000-0000-000000000014",
      "91000000-0000-0000-0000-000000000015",
    ]);
    await owner.query("commit");
  } catch (error) {
    await owner.query("rollback");
    throw error;
  }
  for (const table of ["appointments", "availabilities", "center_memberships"]) {
    const check = await owner.query(
      "select count(*)::integer as n from public." + table + " where center_id in ($1,$2)",
      [C, C2],
    );
    assert.equal(check.rows[0].n, 0, `${table} fixture cleanup`);
  }
}

async function run() {
  let raced = await race(
    "R01 create/create",
    ADMIN,
    RECEPTION,
    createSql,
    createArgs("09:00"),
    createSql,
    createArgs("09:00"),
    { secondError: ["23P01", "SLOT_ALREADY_TAKEN"] },
  );
  const atNine = raced.first;
  assert.equal(atNine.status, "PENDING");
  expected.set(atNine.appointment_id, record(atNine, "09:00"));
  await snapshot("R01");

  let target = await call(ADMIN, createSql, createArgs("09:30"));
  expected.set(target.appointment_id, record(target, "09:30"));
  raced = await race(
    "R02 create/reschedule",
    ADMIN,
    RECEPTION,
    createSql,
    createArgs("10:00"),
    rescheduleSql,
    rescheduleArgs(target, "10:00"),
    { secondError: ["23P01", "SLOT_ALREADY_TAKEN"] },
  );
  expected.set(raced.first.appointment_id, record(raced.first, "10:00"));
  await snapshot("R02");

  raced = await race(
    "R03 reschedule/reschedule",
    ADMIN,
    RECEPTION,
    rescheduleSql,
    rescheduleArgs(target, "10:30"),
    rescheduleSql,
    rescheduleArgs(target, "11:00"),
    { secondError: ["P0001", "STALE_APPOINTMENT_STATE"] },
  );
  assert.equal(raced.first.appointment_id, target.appointment_id);
  await assertAdvanced(raced.first.updated_at, target.updated_at);
  target = raced.first;
  expected.set(target.appointment_id, record(target, "10:30"));
  await snapshot("R03");

  raced = await race(
    "R04 status/note",
    ADMIN,
    RECEPTION,
    statusSql,
    [C, target.appointment_id, target.updated_at, "CONFIRMED"],
    noteSql,
    [C, target.appointment_id, target.updated_at, "stale note"],
    { secondError: ["P0001", "STALE_APPOINTMENT_STATE"] },
  );
  assert.equal(raced.first.status, "CONFIRMED");
  await assertAdvanced(raced.first.updated_at, target.updated_at);
  target = raced.first;
  expected.set(target.appointment_id, record(target, "10:30", "CONFIRMED"));
  await snapshot("R04");

  raced = await race(
    "R05 cancel/create",
    ADMIN,
    RECEPTION,
    statusSql,
    [C, atNine.appointment_id, atNine.updated_at, "CANCELLED"],
    createSql,
    createArgs("09:00"),
    { earlyError: ["23P01", "SLOT_ALREADY_TAKEN"] },
  );
  assert.equal(raced.first.status, "CANCELLED");
  const afterCancel = raced.second ?? (await call(RECEPTION, createSql, createArgs("09:00")));
  assert.equal(afterCancel.status, "PENDING");
  await assertAdvanced(raced.first.updated_at, atNine.updated_at);
  expected.set(atNine.appointment_id, record(raced.first, "09:00", "CANCELLED"));
  expected.set(afterCancel.appointment_id, record(afterCancel, "09:00"));
  await snapshot("R05");

  const specialtyToken = (
    await owner.query("select updated_at from public.specialties where id=$1", [SPECIALTY])
  ).rows[0].updated_at;
  raced = await race(
    "R06 specialty/create",
    ADMIN,
    RECEPTION,
    "select * from public.admin_set_specialty_active($1,$2,$3,$4)",
    [C, SPECIALTY, specialtyToken, false],
    createSql,
    createArgs("11:00"),
    { secondError: ["P0002", "SPECIALTY_NOT_AVAILABLE"] },
  );
  await snapshot("R06", async (db) => {
    const { rows } = await db.query(
      `select s.is_active, pcs.is_active as assignment_active
       from public.specialties s join public.professional_center_specialties pcs
       on pcs.specialty_id=s.id where s.id=$1 and pcs.professional_center_id=$2`,
      [SPECIALTY, PC],
    );
    assert.deepEqual(rows, [{ is_active: false, assignment_active: true }]);
  });
  await owner.query("update public.specialties set is_active=true where id=$1", [SPECIALTY]);

  const availability = (
    await owner.query(
      "select id, updated_at from public.availabilities where professional_center_id=$1",
      [PC],
    )
  ).rows[0];
  raced = await race(
    "R07 availability/create",
    ADMIN,
    RECEPTION,
    "select * from public.staff_update_availability($1,$2,$3,$4,$5,$6)",
    [C, PC, availability.id, availability.updated_at, "10:00", "12:00"],
    createSql,
    createArgs("09:00"),
    { secondError: ["22023", "OUTSIDE_AVAILABILITY"] },
  );
  await snapshot("R07", async (db) => {
    const { rows } = await db.query(
      "select is_active,start_time::text,end_time::text from public.availabilities where id=$1",
      [availability.id],
    );
    assert.deepEqual(rows, [{ is_active: true, start_time: "10:00:00", end_time: "12:00:00" }]);
  });
  await owner.query("update public.availabilities set start_time='09:00' where id=$1", [
    availability.id,
  ]);

  const availabilityAgain = (
    await owner.query("select updated_at from public.availabilities where id=$1", [availability.id])
  ).rows[0].updated_at;
  raced = await race(
    "R08 availability/reschedule",
    ADMIN,
    RECEPTION,
    "select * from public.staff_update_availability($1,$2,$3,$4,$5,$6)",
    [C, PC, availability.id, availabilityAgain, "10:00", "12:00"],
    rescheduleSql,
    rescheduleArgs(target, "09:30"),
    { secondError: ["22023", "OUTSIDE_AVAILABILITY"] },
  );
  await snapshot("R08", async (db) => {
    const { rows } = await db.query(
      "select is_active,start_time::text,end_time::text from public.availabilities where id=$1",
      [availability.id],
    );
    assert.deepEqual(rows, [{ is_active: true, start_time: "10:00:00", end_time: "12:00:00" }]);
  });
  await owner.query("update public.availabilities set start_time='09:00' where id=$1", [
    availability.id,
  ]);

  const durationSql = "select * from public.staff_update_usual_appointment_duration($1,$2,$3,$4)";
  const pcToken = (
    await owner.query("select updated_at from public.professional_centers where id=$1", [PC])
  ).rows[0].updated_at;
  raced = await race(
    "R09 duration/create",
    ADMIN,
    RECEPTION,
    durationSql,
    [C, PC, pcToken, 60],
    createSql,
    createArgs("09:30"),
    { secondError: ["22023", "OUTSIDE_AVAILABILITY"] },
  );
  await snapshot("R09", async (db) => {
    const { rows } = await db.query(
      "select usual_appointment_duration_minutes as minutes from public.professional_centers where id=$1",
      [PC],
    );
    assert.deepEqual(rows, [{ minutes: 60 }]);
  });
  await owner.query(
    "update public.professional_centers set usual_appointment_duration_minutes=30 where id=$1",
    [PC],
  );

  const pcAgain = (
    await owner.query("select updated_at from public.professional_centers where id=$1", [PC])
  ).rows[0].updated_at;
  raced = await race(
    "R10 duration/reschedule",
    ADMIN,
    RECEPTION,
    durationSql,
    [C, PC, pcAgain, 60],
    rescheduleSql,
    rescheduleArgs(target, "09:30"),
    { secondError: ["22023", "OUTSIDE_AVAILABILITY"] },
  );
  await snapshot("R10", async (db) => {
    const { rows } = await db.query(
      "select usual_appointment_duration_minutes as minutes from public.professional_centers where id=$1",
      [PC],
    );
    assert.deepEqual(rows, [{ minutes: 60 }]);
  });
  await owner.query(
    "update public.professional_centers set usual_appointment_duration_minutes=30 where id=$1",
    [PC],
  );

  const membership = (
    await owner.query(
      "select id from public.center_memberships where center_id=$1 and user_id=$2",
      [C, RECEPTION],
    )
  ).rows[0];
  raced = await race(
    "R11 membership/note",
    ADMIN,
    RECEPTION,
    "select * from public.admin_set_center_membership($1,$2,$3,$4,$5,$6,$7,$8)",
    [C, membership.id, "RECEPTION", null, false, "RECEPTION", null, true],
    noteSql,
    [C, target.appointment_id, target.updated_at, "denied"],
    { secondError: ["42501", "ACCESS_DENIED"] },
  );
  await snapshot("R11", async (db) => {
    const { rows } = await db.query(
      "select role::text,is_active from public.center_memberships where id=$1",
      [membership.id],
    );
    assert.deepEqual(rows, [{ role: "RECEPTION", is_active: false }]);
  });

  // Negative control: both RPCs run in series. It must fail the same observation
  // gate even though the second RPC returns the expected slot conflict.
  const serialFirst = await actor(ADMIN);
  const firstSerial = (await serialFirst.connection.query(createSql, createArgs("11:30"))).rows[0];
  await serialFirst.connection.query("commit");
  expected.set(firstSerial.appointment_id, record(firstSerial, "11:30"));
  // Keep the same backend connected in a new, unrelated transaction. A
  // superficial "two open sessions" check would still call this concurrent.
  await serialFirst.connection.query("begin");
  const serialSecond = await actor(ADMIN);
  try {
    let settled = false;
    const pending = serialSecond.connection.query(createSql, createArgs("11:30")).then(
      () => {
        settled = true;
        return { value: true };
      },
      (error) => {
        settled = true;
        return { error };
      },
    );
    await assert.rejects(
      observeLock(serialFirst.pid, serialSecond.pid, () => settled, 1000),
      /SECOND_SETTLED_WITHOUT_OBSERVED_LOCK|NO_OBSERVED_LOCK_BEFORE_DEADLINE/,
    );
    const outcome = await pending;
    assertError(outcome, "23P01", "SLOT_ALREADY_TAKEN");
    results.push({
      id: "N01 serial negative control",
      backends: [serialFirst.pid, serialSecond.pid],
      result: "REJECTED_FALSE_CONCURRENCY",
    });
  } finally {
    await end(serialFirst, false);
    await end(serialSecond, false);
  }
  await snapshot("N01");

  // Rollback variant: an uncommitted cancellation must not make its slot free.
  const rollbackTarget = await call(ADMIN, createSql, createArgs("11:00"));
  expected.set(rollbackTarget.appointment_id, record(rollbackTarget, "11:00"));
  raced = await race(
    "R12 cancel rollback/create",
    ADMIN,
    ADMIN,
    statusSql,
    [C, rollbackTarget.appointment_id, rollbackTarget.updated_at, "CANCELLED"],
    createSql,
    createArgs("11:00"),
    {
      firstCommit: false,
      secondError: ["23P01", "SLOT_ALREADY_TAKEN"],
      earlyError: ["23P01", "SLOT_ALREADY_TAKEN"],
    },
  );
  await snapshot("R12");
}

await owner.connect();
let seeded = false;
try {
  await seed();
  seeded = true;
  await run();
  console.log(JSON.stringify({ result: "TASK009_B0_R1_CONCURRENCY_PASS", results }));
} finally {
  if (seeded) await cleanup();
  await owner.end();
}
