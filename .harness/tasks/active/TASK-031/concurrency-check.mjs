// Local disposable PostgreSQL check. Never use against a linked or hosted DB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";

const connection = {
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  application_name: "task031-local-lock-boundary",
};
const center = "91000000-0000-0000-0000-000000000001";
const patient = "91000000-0000-0000-0000-000000000061";
const professional = "91000000-0000-0000-0000-000000000031";
const specialty = "91000000-0000-0000-0000-000000000041";
const user = "91000000-0000-0000-0000-000000000011";

async function waitForDatabaseTime(client, instant) {
  for (;;) {
    const clock = await client.query(
      "select extract(epoch from pg_catalog.clock_timestamp())*1000 as now_ms",
    );
    if (Number(clock.rows[0].now_ms) > instant + 250) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function check(target, id) {
  const setup = new pg.Client(connection);
  const lock = new pg.Client(connection);
  const transition = new pg.Client(connection);
  await Promise.all([setup.connect(), lock.connect(), transition.connect()]);
  try {
    const clock = await setup.query(
      "select extract(epoch from pg_catalog.clock_timestamp())*1000 as now_ms",
    );
    const start = Number(clock.rows[0].now_ms) + 3500;
    const inserted = await setup.query(
      `insert into public.appointments
       (id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status)
       values ($1,$2,$3,$4,$5,to_timestamp($6 / 1000.0),to_timestamp($6 / 1000.0)+interval '30 minutes','PENDING')
       returning updated_at::text as updated_at`,
      [id, center, patient, professional, specialty, start],
    );
    await lock.query("begin");
    await lock.query("select id from public.appointments where id=$1 for update", [id]);
    await transition.query("begin");
    await transition.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    await transition.query("set local role authenticated");
    let settled = false;
    const result = transition
      .query("select * from public.staff_transition_appointment_status($1,$2,$3,$4)", [
        center,
        id,
        inserted.rows[0].updated_at,
        target,
      ])
      .then(
        (value) => {
          settled = true;
          return { ok: true, value };
        },
        (error) => {
          settled = true;
          return { ok: false, error };
        },
      );
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(settled, false, "RPC did not wait on FOR UPDATE");
    await waitForDatabaseTime(setup, start);
    await lock.query("commit");
    try {
      const outcome = await result;
      if (target === "CONFIRMED")
        assert(
          outcome.ok === false &&
            outcome.error.code === "P0001" &&
            outcome.error.message === "APPOINTMENT_TIME_RESTRICTION",
        );
      else {
        assert.equal(outcome.ok, true);
        assert.equal(outcome.value.rows[0].status, "ATTENDED");
      }
    } finally {
      await transition.query("rollback");
    }
  } finally {
    await Promise.allSettled([lock.query("rollback"), transition.query("rollback")]);
    await setup.query("delete from public.appointments where id=$1", [id]);
    await Promise.all([setup.end(), lock.end(), transition.end()]);
  }
}

const setup = new pg.Client(connection);
await setup.connect();
try {
  const exists = await setup.query("select 1 from public.centers where id=$1", [center]);
  if (exists.rowCount === 0) {
    const source = readFileSync("supabase/tests/task-009-b0-mutations.sql", "utf8");
    const prefix = source.slice(0, source.indexOf("select set_config('request.jwt.claim.sub'"));
    assert(prefix.startsWith("begin;"), "Fixture prefix changed");
    await setup.query(`${prefix}\ncommit;`);
  }
} finally {
  await setup.end();
}

await check("CONFIRMED", "91000000-0000-0000-0000-000000000081");
await check("ATTENDED", "91000000-0000-0000-0000-000000000082");
console.log("TASK031_LOCAL_LOCK_BOUNDARY_PASS");
