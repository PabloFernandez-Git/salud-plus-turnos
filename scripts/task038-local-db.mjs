// Run only against the disposable Supabase PostgreSQL started by this worktree.
// No DEV/PROD connection string is accepted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const url = new URL(
  process.env.TASK038_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
);
if (url.hostname !== "127.0.0.1" || url.port !== "54322" || url.pathname !== "/postgres")
  throw new Error("TASK-038 database tests require the disposable local Supabase PostgreSQL");

const { Client } = pg;
const admin = new Client({ connectionString: url.toString() });
const ids = Object.fromEntries(
  [
    "centerA",
    "centerB",
    "adminA",
    "adminB",
    "receptionA",
    "proA",
    "proB",
    "professional",
    "pcA",
    "pcB",
    "specialtyA",
    "specialtyB",
    "person",
    "patientA",
    "patientB",
  ].map((name) => [name, randomUUID()]),
);
const marker = ids.centerA.slice(0, 8);
const date = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const dates = Array.from({ length: 12 }, (_, index) => date(40 + index));
const slotSql = "select * from public.staff_search_appointment_slots($1,$2,$3,$4)";
const createSql = "select * from public.staff_create_appointment($1,$2,$3,$4,$5,$6,$7)";
const rescheduleSql = "select * from public.staff_reschedule_appointment($1,$2,$3,$4,$5,$6,$7)";
const transitionSql = "select * from public.staff_transition_appointment_status($1,$2,$3,$4)";
const previewSql = "select public.staff_preview_availability_block($1,$2,$3,$4) as count";
const blockSql = "select * from public.staff_create_availability_block($1,$2,$3,$4,$5,$6,$7)";
const removeSql = "select * from public.staff_deactivate_availability_block($1,$2,$3,$4)";

async function actor(userId, work, connection = admin) {
  await connection.query("begin");
  try {
    await connection.query("set local statement_timeout = '10s'");
    await connection.query("set local role authenticated");
    await connection.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = await work(connection);
    await connection.query("commit");
    return result;
  } catch (error) {
    await connection.query("rollback");
    throw error;
  }
}

async function expectedError(work, code, message) {
  try {
    await work();
  } catch (error) {
    assert.equal(error.code, code, `unexpected SQL code: ${error.message}`);
    if (message) assert.equal(error.message, message);
    return;
  }
  assert.fail(`expected ${code} ${message ?? ""}`);
}

async function setup() {
  for (const [key, email] of [
    ["adminA", "admin-a"],
    ["adminB", "admin-b"],
    ["receptionA", "reception-a"],
    ["proA", "pro-a"],
    ["proB", "pro-b"],
  ]) {
    const address = `${email}-${marker}@example.invalid`;
    await admin.query("insert into auth.users (id,email) values ($1,$2)", [ids[key], address]);
    await admin.query(
      "insert into public.users (id,email,first_name,last_name) values ($1,$2,'Test','Actor')",
      [ids[key], address],
    );
  }
  await admin.query(
    "insert into public.centers (id,name,timezone) values ($1,$2,'America/Argentina/Buenos_Aires'),($3,$4,'Pacific/Auckland')",
    [ids.centerA, `TASK038 A ${marker}`, ids.centerB, `TASK038 B ${marker}`],
  );
  await admin.query(
    "insert into public.professionals (id,first_name,last_name,nationality_code,document_number,email) values ($1,'Test','Professional','AR',$2,$3)",
    [ids.professional, marker, `professional-${marker}@example.invalid`],
  );
  await admin.query(
    "insert into public.professional_centers (id,professional_id,center_id) values ($1,$3,$4),($2,$3,$5)",
    [ids.pcA, ids.pcB, ids.professional, ids.centerA, ids.centerB],
  );
  await admin.query(
    "insert into public.specialties (id,center_id,name) values ($1,$3,'General'),($2,$4,'General')",
    [ids.specialtyA, ids.specialtyB, ids.centerA, ids.centerB],
  );
  await admin.query(
    "insert into public.professional_center_specialties (professional_center_id,specialty_id,center_id) values ($1,$3,$5),($2,$4,$6)",
    [ids.pcA, ids.pcB, ids.specialtyA, ids.specialtyB, ids.centerA, ids.centerB],
  );
  await admin.query(
    "insert into public.persons (id,first_name,last_name,birth_date,nationality_code,document_number) values ($1,'Test','Patient','1990-01-01','AR',$2)",
    [ids.person, `P${marker}`],
  );
  await admin.query(
    "insert into public.patient_centers (id,person_id,center_id,phone) values ($1,$3,$4,'123456789'),($2,$3,$5,'123456789')",
    [ids.patientA, ids.patientB, ids.person, ids.centerA, ids.centerB],
  );
  await admin.query(
    "insert into public.center_memberships (center_id,user_id,role,professional_center_id) values ($1,$2,'ADMIN',null),($3,$4,'ADMIN',null),($1,$5,'PROFESSIONAL',$7),($3,$6,'PROFESSIONAL',$8)",
    [ids.centerA, ids.adminA, ids.centerB, ids.adminB, ids.proA, ids.proB, ids.pcA, ids.pcB],
  );
  await admin.query(
    "insert into public.center_memberships (center_id,user_id,role) values ($1,$2,'RECEPTION')",
    [ids.centerA, ids.receptionA],
  );
  for (const center of [
    [ids.centerA, ids.pcA],
    [ids.centerB, ids.pcB],
  ]) {
    await admin.query(
      "insert into public.availabilities (center_id,professional_center_id,weekday,start_time,end_time) select $1,$2,weekday,'09:00','11:00' from generate_series(1,7) as weekday",
      center,
    );
  }
}

async function cleanup() {
  await admin.query("delete from public.appointments where patient_center_id in ($1,$2)", [
    ids.patientA,
    ids.patientB,
  ]);
  await admin.query(
    "delete from public.availability_blocks where professional_center_id in ($1,$2)",
    [ids.pcA, ids.pcB],
  );
  await admin.query("delete from public.availabilities where professional_center_id in ($1,$2)", [
    ids.pcA,
    ids.pcB,
  ]);
  await admin.query("delete from public.center_memberships where center_id in ($1,$2)", [
    ids.centerA,
    ids.centerB,
  ]);
  await admin.query("delete from public.patient_centers where id in ($1,$2)", [
    ids.patientA,
    ids.patientB,
  ]);
  await admin.query("delete from public.persons where id=$1", [ids.person]);
  await admin.query(
    "delete from public.professional_center_specialties where professional_center_id in ($1,$2)",
    [ids.pcA, ids.pcB],
  );
  await admin.query("delete from public.specialties where id in ($1,$2)", [
    ids.specialtyA,
    ids.specialtyB,
  ]);
  await admin.query("delete from public.professional_centers where id in ($1,$2)", [
    ids.pcA,
    ids.pcB,
  ]);
  await admin.query("delete from public.professionals where id=$1", [ids.professional]);
  await admin.query("delete from public.centers where id in ($1,$2)", [ids.centerA, ids.centerB]);
  await admin.query("delete from public.users where id in ($1,$2,$3,$4,$5)", [
    ids.adminA,
    ids.adminB,
    ids.proA,
    ids.proB,
    ids.receptionA,
  ]);
  await admin.query("delete from auth.users where id in ($1,$2,$3,$4,$5)", [
    ids.adminA,
    ids.adminB,
    ids.proA,
    ids.proB,
    ids.receptionA,
  ]);
}

async function run() {
  await admin.connect();
  try {
    await setup();
    const slots = (
      day,
      center = ids.centerA,
      pc = ids.pcA,
      specialty = ids.specialtyA,
      user = ids.adminA,
    ) => actor(user, (db) => db.query(slotSql, [center, pc, specialty, day]));
    const preview = (dayFrom, dayTo, center = ids.centerA, pc = ids.pcA, user = ids.adminA) =>
      actor(user, (db) => db.query(previewSql, [center, pc, dayFrom, dayTo]));
    const block = (
      from,
      to,
      expected,
      confirm,
      center = ids.centerA,
      pc = ids.pcA,
      user = ids.adminA,
    ) =>
      actor(user, (db) =>
        db.query(blockSql, [center, pc, from, to, "VACATION", expected, confirm]),
      );

    assert.ok((await slots(dates[0])).rows.length > 0);
    for (const special of ["infinity", "-infinity"]) {
      for (const [start, end] of [
        [special, dates[1]],
        [dates[1], special],
      ]) {
        await expectedError(() => preview(start, end), "22023", "INVALID_AVAILABILITY_BLOCK");
        await expectedError(
          () => block(start, end, 0, false),
          "22023",
          "INVALID_AVAILABILITY_BLOCK",
        );
        await expectedError(
          () =>
            actor(ids.adminA, (db) =>
              db.query("select * from public.staff_list_availability_blocks($1,$2,$3,$4)", [
                ids.centerA,
                ids.pcA,
                start,
                end,
              ]),
            ),
          "22023",
          "INVALID_AVAILABILITY_BLOCK",
        );
      }
    }
    for (const [start, end] of [
      ["-infinity", dates[1]],
      [dates[1], "infinity"],
    ]) {
      await expectedError(
        () =>
          admin.query(
            "insert into public.availability_blocks (center_id,professional_center_id,start_date,end_date,reason) values ($1,$2,$3,$4,'OTHER')",
            [ids.centerA, ids.pcA, start, end],
          ),
        "23514",
      );
    }
    const receptionBlock = (
      await block(dates[7], dates[7], 0, false, ids.centerA, ids.pcA, ids.receptionA)
    ).rows[0];
    const receptionToken = (
      await admin.query(
        "select updated_at::text as token from public.availability_blocks where id=$1",
        [receptionBlock.block_id],
      )
    ).rows[0].token;
    await actor(ids.receptionA, (db) =>
      db.query(removeSql, [ids.centerA, ids.pcA, receptionBlock.block_id, receptionToken]),
    );
    assert.equal((await preview(dates[0], dates[0])).rows[0].count, 0);
    const one = (await block(dates[0], dates[0], 0, false)).rows[0];
    assert.equal((await slots(dates[0])).rows.length, 0);
    await expectedError(
      () =>
        actor(ids.adminA, (db) =>
          db.query(createSql, [
            ids.centerA,
            ids.patientA,
            ids.pcA,
            ids.specialtyA,
            dates[0],
            "09:00",
            null,
          ]),
        ),
      "22023",
      "OUTSIDE_AVAILABILITY",
    );
    await expectedError(() => block(dates[0], dates[1], 0, false), "23P01");
    await expectedError(
      () => block(dates[2], dates[1], 0, false),
      "22023",
      "INVALID_AVAILABILITY_BLOCK",
    );
    assert.ok((await slots(dates[1])).rows.length > 0);
    const multi = (await block(dates[2], dates[4], 0, false)).rows[0];
    assert.equal((await slots(dates[2])).rows.length, 0);
    assert.equal((await slots(dates[4])).rows.length, 0);
    assert.ok((await slots(dates[5])).rows.length > 0);

    const existing = (
      await actor(ids.adminA, (db) =>
        db.query(createSql, [
          ids.centerA,
          ids.patientA,
          ids.pcA,
          ids.specialtyA,
          dates[5],
          "09:00",
          null,
        ]),
      )
    ).rows[0];
    assert.equal((await preview(dates[5], dates[5])).rows[0].count, 1);
    await expectedError(() => block(dates[5], dates[5], 1, false), "P0001", "STALE_BLOCK_PREVIEW");
    const affected = (await block(dates[5], dates[5], 1, true)).rows[0];
    assert.equal(affected.affected_count, 1);
    const kept = (
      await admin.query("select status,starts_at,ends_at from public.appointments where id=$1", [
        existing.appointment_id,
      ])
    ).rows[0];
    assert.equal(kept.status, "PENDING");
    assert.ok(kept.starts_at < kept.ends_at);
    const existingToken = (
      await admin.query("select updated_at::text as token from public.appointments where id=$1", [
        existing.appointment_id,
      ])
    ).rows[0].token;
    await expectedError(
      () =>
        actor(ids.adminA, (db) =>
          db.query(rescheduleSql, [
            ids.centerA,
            existing.appointment_id,
            existingToken,
            ids.pcA,
            ids.specialtyA,
            dates[2],
            "09:00",
          ]),
        ),
      "22023",
      "OUTSIDE_AVAILABILITY",
    );
    assert.equal(
      (
        await admin.query("select status from public.appointments where id=$1", [
          existing.appointment_id,
        ])
      ).rows[0].status,
      "PENDING",
    );

    const oneToken = (
      await admin.query(
        "select updated_at::text as token from public.availability_blocks where id=$1",
        [one.block_id],
      )
    ).rows[0].token;
    await actor(ids.adminA, (db) =>
      db.query(removeSql, [ids.centerA, ids.pcA, one.block_id, oneToken]),
    );
    assert.ok((await slots(dates[0])).rows.length > 0);
    const replacement = (await block(dates[0], dates[0], 0, false)).rows[0];
    assert.notEqual(replacement.block_id, one.block_id);
    assert.equal((await slots(dates[0])).rows.length, 0);
    const replacementToken = (
      await admin.query(
        "select updated_at::text as token from public.availability_blocks where id=$1",
        [replacement.block_id],
      )
    ).rows[0].token;
    await actor(ids.adminA, (db) =>
      db.query(removeSql, [ids.centerA, ids.pcA, replacement.block_id, replacementToken]),
    );
    assert.ok((await slots(dates[0])).rows.length > 0);
    await expectedError(
      () =>
        actor(ids.proA, (db) =>
          db.query(removeSql, [ids.centerA, ids.pcA, multi.block_id, multi.updated_at]),
        ),
      "42501",
    );
    const own = await actor(ids.proA, (db) =>
      db.query("select * from public.staff_list_availability_blocks($1)", [ids.centerA]),
    );
    assert.ok(own.rows.every((row) => row.professional_center_id === ids.pcA));
    await expectedError(
      () =>
        actor(ids.proA, (db) =>
          db.query("select * from public.staff_list_availability_blocks($1)", [ids.centerB]),
        ),
      "42501",
    );
    await expectedError(
      () => block(dates[8], dates[8], 0, false, ids.centerA, ids.pcB),
      "P0002",
      "RESOURCE_NOT_FOUND",
    );

    const bAppointment = (
      await actor(ids.adminB, (db) =>
        db.query(createSql, [
          ids.centerB,
          ids.patientB,
          ids.pcB,
          ids.specialtyB,
          dates[9],
          "09:00",
          null,
        ]),
      )
    ).rows[0];
    assert.ok(bAppointment);
    const bInstant = (
      await admin.query("select starts_at from public.appointments where id=$1", [
        bAppointment.appointment_id,
      ])
    ).rows[0].starts_at;
    assert.notEqual(bInstant.toISOString().slice(0, 10), dates[9]);
    assert.equal(
      (await preview(dates[9], dates[9], ids.centerB, ids.pcB, ids.adminB)).rows[0].count,
      1,
    );
    const bBlock = (await block(dates[9], dates[9], 1, true, ids.centerB, ids.pcB, ids.adminB))
      .rows[0];
    const crossCenterRows = await actor(ids.proA, (db) =>
      db.query("select id from public.availability_blocks where id=$1", [bBlock.block_id]),
    );
    assert.equal(crossCenterRows.rows.length, 0);
    const ownB = await actor(ids.proB, (db) =>
      db.query("select * from public.staff_list_availability_blocks($1)", [ids.centerB]),
    );
    assert.ok(ownB.rows.some((row) => row.block_id === bBlock.block_id));

    const cancelBeforeBlock = (
      await actor(ids.adminA, (db) =>
        db.query(createSql, [
          ids.centerA,
          ids.patientA,
          ids.pcA,
          ids.specialtyA,
          dates[6],
          "09:00",
          null,
        ]),
      )
    ).rows[0];
    const cancelBeforeBlockToken = (
      await admin.query("select updated_at::text as token from public.appointments where id=$1", [
        cancelBeforeBlock.appointment_id,
      ])
    ).rows[0].token;
    const cancellingConnection = new Client({ connectionString: url.toString() });
    const waitingBlockConnection = new Client({ connectionString: url.toString() });
    await cancellingConnection.connect();
    await waitingBlockConnection.connect();
    try {
      await cancellingConnection.query("begin");
      await cancellingConnection.query("set local role authenticated");
      await cancellingConnection.query("select set_config('request.jwt.claim.sub',$1,true)", [
        ids.adminA,
      ]);
      const cancelled = await cancellingConnection.query(transitionSql, [
        ids.centerA,
        cancelBeforeBlock.appointment_id,
        cancelBeforeBlockToken,
        "CANCELLED",
      ]);
      assert.equal(cancelled.rows[0].status, "CANCELLED");
      let settled = false;
      const pendingBlock = actor(
        ids.adminA,
        (db) => db.query(blockSql, [ids.centerA, ids.pcA, dates[6], dates[6], "OTHER", 1, true]),
        waitingBlockConnection,
      ).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(settled, false, "block writer did not wait for cancellation transaction");
      await cancellingConnection.query("commit");
      await expectedError(() => pendingBlock, "P0001", "STALE_BLOCK_PREVIEW");
      assert.equal((await preview(dates[6], dates[6])).rows[0].count, 0);
      await expectedError(
        () =>
          actor(ids.adminA, (db) =>
            db.query(transitionSql, [
              ids.centerA,
              cancelBeforeBlock.appointment_id,
              cancelBeforeBlockToken,
              "CANCELLED",
            ]),
          ),
        "P0001",
        "STALE_APPOINTMENT_STATE",
      );
    } finally {
      await cancellingConnection.query("rollback").catch(() => undefined);
      await cancellingConnection.end();
      await waitingBlockConnection.end();
    }

    const blockBeforeCancel = (
      await actor(ids.adminA, (db) =>
        db.query(createSql, [
          ids.centerA,
          ids.patientA,
          ids.pcA,
          ids.specialtyA,
          dates[8],
          "09:00",
          null,
        ]),
      )
    ).rows[0];
    const blockBeforeCancelToken = (
      await admin.query("select updated_at::text as token from public.appointments where id=$1", [
        blockBeforeCancel.appointment_id,
      ])
    ).rows[0].token;
    await expectedError(
      () =>
        actor(ids.proA, (db) =>
          db.query(transitionSql, [
            ids.centerA,
            blockBeforeCancel.appointment_id,
            blockBeforeCancelToken,
            "CANCELLED",
          ]),
        ),
      "P0001",
      "INVALID_STATUS_TRANSITION",
    );
    const blockingConnection = new Client({ connectionString: url.toString() });
    const waitingCancelConnection = new Client({ connectionString: url.toString() });
    await blockingConnection.connect();
    await waitingCancelConnection.connect();
    try {
      await blockingConnection.query("begin");
      await blockingConnection.query("set local role authenticated");
      await blockingConnection.query("select set_config('request.jwt.claim.sub',$1,true)", [
        ids.adminA,
      ]);
      const counted = await blockingConnection.query(blockSql, [
        ids.centerA,
        ids.pcA,
        dates[8],
        dates[8],
        "OTHER",
        1,
        true,
      ]);
      assert.equal(counted.rows[0].affected_count, 1);
      let settled = false;
      const pendingCancel = actor(
        ids.adminA,
        (db) =>
          db.query(transitionSql, [
            ids.centerA,
            blockBeforeCancel.appointment_id,
            blockBeforeCancelToken,
            "CANCELLED",
          ]),
        waitingCancelConnection,
      ).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(settled, false, "cancellation did not wait for block transaction");
      await blockingConnection.query("commit");
      assert.equal((await pendingCancel).rows[0].status, "CANCELLED");
      assert.equal((await preview(dates[8], dates[8])).rows[0].count, 0);
    } finally {
      await blockingConnection.query("rollback").catch(() => undefined);
      await blockingConnection.end();
      await waitingCancelConnection.end();
    }

    const bookingConnection = new Client({ connectionString: url.toString() });
    const blockConnection = new Client({ connectionString: url.toString() });
    await bookingConnection.connect();
    await blockConnection.connect();
    try {
      await bookingConnection.query("begin");
      await bookingConnection.query("set local role authenticated");
      await bookingConnection.query("select set_config('request.jwt.claim.sub',$1,true)", [
        ids.adminA,
      ]);
      await bookingConnection.query(createSql, [
        ids.centerA,
        ids.patientA,
        ids.pcA,
        ids.specialtyA,
        dates[10],
        "09:00",
        null,
      ]);
      let settled = false;
      const pending = actor(
        ids.adminA,
        (db) => db.query(blockSql, [ids.centerA, ids.pcA, dates[10], dates[10], "OTHER", 0, false]),
        blockConnection,
      ).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(settled, false, "block writer did not wait for booking transaction");
      await bookingConnection.query("commit");
      await expectedError(() => pending, "P0001", "STALE_BLOCK_PREVIEW");
    } finally {
      await bookingConnection.query("rollback").catch(() => undefined);
      await bookingConnection.end();
      await blockConnection.end();
    }
    const firstBlockConnection = new Client({ connectionString: url.toString() });
    const waitingBookingConnection = new Client({ connectionString: url.toString() });
    await firstBlockConnection.connect();
    await waitingBookingConnection.connect();
    try {
      await firstBlockConnection.query("begin");
      await firstBlockConnection.query("set local role authenticated");
      await firstBlockConnection.query("select set_config('request.jwt.claim.sub',$1,true)", [
        ids.adminA,
      ]);
      await firstBlockConnection.query(blockSql, [
        ids.centerA,
        ids.pcA,
        dates[11],
        dates[11],
        "OTHER",
        0,
        false,
      ]);
      let settled = false;
      const pendingBooking = actor(
        ids.adminA,
        (db) =>
          db.query(createSql, [
            ids.centerA,
            ids.patientA,
            ids.pcA,
            ids.specialtyA,
            dates[11],
            "09:00",
            null,
          ]),
        waitingBookingConnection,
      ).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(settled, false, "booking did not wait for block transaction");
      await firstBlockConnection.query("commit");
      await expectedError(() => pendingBooking, "22023", "OUTSIDE_AVAILABILITY");
    } finally {
      await firstBlockConnection.query("rollback").catch(() => undefined);
      await firstBlockConnection.end();
      await waitingBookingConnection.end();
    }
    console.log(
      "TASK-038 local DB: PASS (slots, civil dates, overlap, booking, cancellation, preservation, roles, center isolation, timezone, concurrency)",
    );
  } finally {
    await cleanup().finally(() => admin.end());
  }
}

run().catch((error) => {
  console.error("TASK-038 local DB: FAIL", error.code ?? error.name, error.message);
  process.exitCode = 1;
});
