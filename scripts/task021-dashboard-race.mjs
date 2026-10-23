// Run only after explicit authorization against a disposable LOCAL Supabase DB.
// Uses the committed fixture from task-021-dashboard-concurrency-setup.sql.
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.TASK021_LOCAL_DATABASE_URL;
if (!connectionString) throw new Error("TASK021_LOCAL_DATABASE_URL is required");
const url = new URL(connectionString);
if (
  url.protocol !== "postgresql:" ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55322" ||
  url.pathname !== "/postgres" ||
  url.username !== "postgres" ||
  url.search !== "" ||
  url.hash !== ""
) {
  throw new Error("Refusing a non-default local Supabase PostgreSQL target");
}

const localConnection = {
  host: "127.0.0.1",
  port: 55322,
  database: "postgres",
  user: "postgres",
  password: decodeURIComponent(url.password),
  ssl: false,
};

const centerId = "a2130000-0000-0000-0000-000000000001";
const appointmentId = "a2130000-0000-0000-0000-000000000071";
const actorId = "a2130000-0000-0000-0000-000000000011";
const iterations = 1000;
const reader = new Client({ ...localConnection, application_name: "task021-race-reader" });
const writer = new Client({ ...localConnection, application_name: "task021-race-writer" });

let connectedReader = false;
let connectedWriter = false;
let runError;
try {
  await reader.connect();
  connectedReader = true;
  await writer.connect();
  connectedWriter = true;
  const fixture = await writer.query(
    `select a.starts_at > statement_timestamp() + interval '10 minutes' as future,
      (a.starts_at at time zone c.timezone)::date =
        (statement_timestamp() at time zone c.timezone)::date as today
     from public.appointments as a
     join public.centers as c on c.id = a.center_id
     where a.id = $1 and a.center_id = $2`,
    [appointmentId, centerId],
  );
  if (fixture.rows.length !== 1 || !fixture.rows[0].future || !fixture.rows[0].today) {
    throw new Error("Refresh the local concurrency fixture before this race");
  }
  await reader.query("set role authenticated");
  await reader.query("select set_config('request.jwt.claim.sub', $1, false)", [actorId]);

  const outcomes = await Promise.allSettled([
    (async () => {
      for (let i = 0; i < iterations; i += 1) {
        // Each call is one READ COMMITTED statement. A mixed count/list would
        // violate this invariant for the single fixture appointment.
        const { rows } = await reader.query("select * from public.staff_get_daily_dashboard($1)", [
          centerId,
        ]);
        if (rows.length !== 1) throw new Error(`Expected one row at read ${i}`);
        const row = rows[0];
        const pending = Number(row.pending_count);
        const confirmed = Number(row.confirmed_count);
        const upcoming = row.upcoming;
        if (
          pending + confirmed !== 1 ||
          Number(row.attended_count) !== 0 ||
          Number(row.no_show_count) !== 0 ||
          Number(row.cancelled_count) !== 0 ||
          !Array.isArray(upcoming) ||
          upcoming.length !== 1 ||
          upcoming[0].appointment_id !== appointmentId ||
          upcoming[0].status !== (pending === 1 ? "PENDING" : "CONFIRMED")
        ) {
          throw new Error(`Mixed dashboard snapshot at read ${i}: ${JSON.stringify(row)}`);
        }
      }
    })(),
    (async () => {
      for (let i = 0; i < iterations; i += 1) {
        const result = await writer.query(
          `update public.appointments
           set status = case when status = 'PENDING' then 'CONFIRMED'
             else 'PENDING' end
           where id = $1`,
          [appointmentId],
        );
        if (result.rowCount !== 1) throw new Error("Fixture appointment missing");
      }
    })(),
  ]);
  const failures = outcomes.filter((outcome) => outcome.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "TASK-021 concurrent read/write check failed",
    );
  }
} catch (error) {
  runError = error;
}

const cleanupErrors = [];
if (connectedWriter) {
  try {
    await writer.query("update public.appointments set status = 'PENDING' where id = $1", [
      appointmentId,
    ]);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await writer.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
}
if (connectedReader) {
  try {
    await reader.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
}
if (runError || cleanupErrors.length > 0) {
  throw new AggregateError(
    [...(runError ? [runError] : []), ...cleanupErrors],
    "TASK-021 race or cleanup failed",
  );
}
console.log(`TASK-021 READ COMMITTED race: ${iterations} coherent reads; cleanup passed`);
