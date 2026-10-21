import { createClient } from "@supabase/supabase-js";
import { openDevDatabase } from "./dev-connection.mjs";
import { markAppointmentOwned, planAppointmentIntent, saveLedger } from "./ledger.mjs";
import { testRemainingRaces } from "./races.mjs";

function assert(condition, label) {
  if (!condition) throw new Error(label);
}

function record(ledger, label, outcome = "PASS") {
  ledger.evidence.push({ at: new Date().toISOString(), label, outcome });
  saveLedger(ledger);
}

async function asActor(client, userId, work, readOnly = false) {
  await client.query(readOnly ? "BEGIN TRANSACTION READ ONLY" : "BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL ROLE authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = await work(client);
    await client.query(readOnly ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function expectPgError(label, work, code, message) {
  try {
    await work();
  } catch (error) {
    if (error.code !== code || (message && error.message !== message)) {
      throw new Error(`${label}: unexpected SQL error ${error.code ?? "none"}`);
    }
    return;
  }
  throw new Error(`${label}: operation unexpectedly succeeded`);
}

const slotsSql = "select * from public.staff_search_appointment_slots($1,$2,$3,$4)";
const createSql = "select * from public.staff_create_appointment($1,$2,$3,$4,$5,$6,$7)";
const rescheduleSql = "select * from public.staff_reschedule_appointment($1,$2,$3,$4,$5,$6,$7)";
const statusSql = "select * from public.staff_transition_appointment_status($1,$2,$3,$4)";
const noteSql = "select * from public.staff_update_appointment_note($1,$2,$3,$4)";

function civilDate(daysAhead) {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

function dateText(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function slots(client, actorId, centerId, pcId, specialtyId, date) {
  return asActor(
    client,
    actorId,
    async (db) => (await db.query(slotsSql, [centerId, pcId, specialtyId, date])).rows,
    true,
  );
}

async function createAppointment(client, ledger, actorId, context, note = null) {
  const intentId = planAppointmentIntent(ledger, context);
  const result = await asActor(client, actorId, async (db) =>
    db.query(createSql, [
      context.centerId,
      context.patientCenterId,
      context.professionalCenterId,
      context.specialtyId,
      context.localDate,
      context.localTime,
      note,
    ]),
  );
  const row = result.rows[0];
  assert(row?.appointment_id, "CREATE did not return an appointment UUID");
  markAppointmentOwned(ledger, intentId, row.appointment_id);
  return row;
}

async function validateCivilRows(client, rows, timezone, date) {
  assert(rows.length > 0, `No future slots for ${timezone} on ${date}`);
  for (const row of rows) {
    const converted = (
      await client.query(
        "select to_char($1::timestamptz at time zone $3,'YYYY-MM-DD') as start_date,to_char($1::timestamptz at time zone $3,'HH24:MI') as start_time,to_char($2::timestamptz at time zone $3,'YYYY-MM-DD') as end_date,to_char($2::timestamptz at time zone $3,'HH24:MI') as end_time",
        [row.starts_at, row.ends_at, timezone],
      )
    ).rows[0];
    assert(dateText(row.local_date) === converted.start_date, "Civil start date drift");
    assert(row.local_start_time === converted.start_time, "Civil start time drift");
    assert(dateText(row.local_end_date) === converted.end_date, "Civil end date drift");
    assert(row.local_end_time === converted.end_time, "Civil end time drift");
    assert(
      new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime() === 1_800_000,
      "Slot duration differs from 30 minutes",
    );
  }
}

async function transitionDates(client, timezone) {
  const result = await client.query(
    "with days as (select day::date as d from generate_series(current_date+7,current_date+interval '2 years',interval '1 day') as day) select d,extract(epoch from (((d::timestamp+interval '4 hours') at time zone $1)-(d::timestamp at time zone $1)))::int as elapsed_seconds from days where extract(isodow from d)=7 and (((d::timestamp+interval '4 hours') at time zone $1)-(d::timestamp at time zone $1))<>interval '4 hours' order by d",
    [timezone],
  );
  const gap = result.rows.find((row) => row.elapsed_seconds < 14_400)?.d;
  const overlap = result.rows.find((row) => row.elapsed_seconds > 14_400)?.d;
  assert(gap && overlap, `No future gap and overlap found for ${timezone}`);
  return {
    gap: dateText(gap),
    overlap: dateText(overlap),
  };
}

async function testAuth(dev, ledger, password) {
  for (const [name, actor] of Object.entries(ledger.actors)) {
    const client = createClient(dev.url, dev.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const signIn = await client.auth.signInWithPassword({ email: actor.email, password });
    assert(!signIn.error && signIn.data.user?.id === actor.id, `Auth login failed for ${name}`);
    if (name === "admina") {
      const rpc = await client.rpc("staff_list_bookable_specialties", {
        p_center_id: ledger.ids.centerA,
      });
      assert(
        !rpc.error && rpc.data?.some((row) => row.specialty_id === ledger.ids.specialtyA),
        "JWT RPC list failed",
      );
      const refreshed = await client.auth.refreshSession();
      assert(!refreshed.error && refreshed.data.user?.id === actor.id, "Auth refresh failed");
    }
    const signOut = await client.auth.signOut();
    assert(!signOut.error, `Auth logout failed for ${name}`);
  }
  record(ledger, "Auth login eight synthetic users, refresh/logout, JWT-backed RPC");
}

async function testAccess(client, ledger) {
  const id = ledger.ids;
  const actor = ledger.actors;
  const allowed = await asActor(
    client,
    actor.admina.id,
    async (db) =>
      (await db.query("select * from public.staff_list_bookable_specialties($1)", [id.centerA]))
        .rows,
    true,
  );
  assert(
    allowed.some((row) => row.specialty_id === id.specialtyA),
    "ADMIN A missing specialty",
  );
  const reception = await asActor(
    client,
    actor.receptiona.id,
    async (db) =>
      (
        await db.query(
          "select * from public.staff_bookable_professional_centers_for_specialty($1,$2)",
          [id.centerA, id.specialtyA],
        )
      ).rows,
    true,
  );
  assert(
    reception.some((row) => row.professional_center_id === id.pcA),
    "RECEPTION missing PC",
  );
  for (const name of ["professionalb", "inactivea", "platformonly", "unlinked", "adminb"]) {
    await expectPgError(
      `${name} cross-center or inactive denial`,
      () =>
        asActor(client, actor[name].id, (db) =>
          db.query("select * from public.staff_list_bookable_specialties($1)", [id.centerA]),
        ),
      "42501",
    );
  }
  await expectPgError(
    "PROFESSIONAL A denied staff RPC",
    () =>
      asActor(client, actor.professionala.id, (db) =>
        db.query("select * from public.staff_list_bookable_specialties($1)", [id.centerA]),
      ),
    "42501",
  );
  await expectPgError(
    "inactive Center denied",
    () =>
      asActor(client, actor.adminb.id, (db) =>
        db.query("select * from public.staff_list_bookable_specialties($1)", [id.centerD]),
      ),
    "42501",
  );
  for (const centerId of [id.centerB, id.centerC]) {
    const rows = await asActor(
      client,
      actor.adminb.id,
      async (db) =>
        (await db.query("select * from public.staff_list_bookable_specialties($1)", [centerId]))
          .rows,
      true,
    );
    assert(rows.length === 1, "ADMIN B explicit membership did not grant expected Center");
  }
  await expectPgError(
    "authenticated generic appointment table SELECT denied",
    () =>
      asActor(
        client,
        actor.admina.id,
        (db) => db.query("select id from public.appointments"),
        true,
      ),
    "42501",
  );
  await expectPgError(
    "anon direct Appointment RPC denied",
    async () => {
      await client.query("BEGIN TRANSACTION READ ONLY");
      try {
        await client.query("SET LOCAL ROLE anon");
        await client.query(slotsSql, [id.centerA, id.pcA, id.specialtyA, civilDate(7)]);
        await client.query("ROLLBACK");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    },
    "42501",
  );
  record(ledger, "tenant/RLS/RPC role matrix and generic table denial");
}

async function testDst(client, ledger) {
  const id = ledger.ids;
  const actor = ledger.actors.adminb.id;
  for (const [timezone, centerId, pcId, specialtyId, patientCenterId, invalid] of [
    [
      "America/New_York",
      id.centerB,
      id.pcB,
      id.specialtyB,
      id.patientB,
      { gap: "02:00", overlap: "01:00" },
    ],
    [
      "Australia/Lord_Howe",
      id.centerC,
      id.pcC,
      id.specialtyC,
      id.patientC,
      { gap: "02:00", overlap: "01:30" },
    ],
  ]) {
    const dates = await transitionDates(client, timezone);
    for (const [kind, date] of Object.entries(dates)) {
      const rows = await slots(client, actor, centerId, pcId, specialtyId, date);
      await validateCivilRows(client, rows, timezone, date);
      assert(
        !rows.some((row) => row.local_start_time === invalid[kind]),
        `${timezone} ${kind} invalid slot exposed`,
      );
      const context = {
        centerId,
        patientCenterId,
        professionalCenterId: pcId,
        specialtyId,
        localDate: date,
        localTime: invalid[kind],
      };
      const intentId = planAppointmentIntent(ledger, context);
      await expectPgError(
        `${timezone} ${kind} manipulated CREATE`,
        async () => {
          const result = await asActor(client, actor, (db) =>
            db.query(createSql, [
              centerId,
              patientCenterId,
              pcId,
              specialtyId,
              date,
              invalid[kind],
              null,
            ]),
          );
          if (result.rows[0]?.appointment_id)
            markAppointmentOwned(ledger, intentId, result.rows[0].appointment_id);
        },
        "22023",
        kind === "gap" ? "INVALID_LOCAL_TIME" : "AMBIGUOUS_LOCAL_TIME",
      );
      assert(
        rows.some((row) => row.local_start_time === "00:00"),
        `${timezone} lacks 00:00 control slot`,
      );
      const control = await createAppointment(client, ledger, actor, {
        ...context,
        localTime: "00:00",
      });
      await expectPgError(
        `${timezone} ${kind} manipulated RESCHEDULE`,
        () =>
          asActor(client, actor, (db) =>
            db.query(rescheduleSql, [
              centerId,
              control.appointment_id,
              control.updated_at,
              pcId,
              specialtyId,
              date,
              invalid[kind],
            ]),
          ),
        "22023",
        kind === "gap" ? "INVALID_LOCAL_TIME" : "AMBIGUOUS_LOCAL_TIME",
      );
    }
  }
  record(ledger, "PostgreSQL civil coordinates and NY/Lord Howe gap/overlap rejection");
}

async function testAppointments(client, ledger) {
  const id = ledger.ids;
  const actor = ledger.actors;
  const date = civilDate(7);
  const rows = await slots(client, actor.admina.id, id.centerA, id.pcA, id.specialtyA, date);
  await validateCivilRows(client, rows, "America/Argentina/Buenos_Aires", date);
  const midnight = rows.find((row) => row.local_start_time === "00:00");
  const late = rows.find((row) => row.local_start_time === "23:00");
  assert(midnight?.local_end_time === "00:30", "Local midnight slot missing");
  assert(late?.local_end_time === "23:30", "Last full slot before 23:59 missing");
  assert(
    !rows.some((row) => row.local_start_time === "23:30"),
    "Partial slot beyond 23:59 exposed",
  );
  assert(
    new Date(late.starts_at).toISOString().slice(0, 10) !== date,
    "UTC and Center civil dates unexpectedly equal at 23:00",
  );
  const context = (localTime) => ({
    centerId: id.centerA,
    patientCenterId: id.patientA,
    professionalCenterId: id.pcA,
    specialtyId: id.specialtyA,
    localDate: date,
    localTime,
  });
  for (const time of [
    "09:00",
    "10:00",
    "10:30",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
  ]) {
    assert(
      rows.some((row) => row.local_start_time === time),
      `Expected A fixture slot ${time} missing`,
    );
  }

  const first = await createAppointment(
    client,
    ledger,
    actor.admina.id,
    context("09:00"),
    "Synthetic note",
  );
  assert(first.status === "PENDING", "CREATE did not begin PENDING");
  const list = await asActor(
    client,
    actor.receptiona.id,
    async (db) =>
      (
        await db.query("select * from public.staff_list_appointments($1,$2,$3,$4,$5,$6,$7,$8)", [
          id.centerA,
          date,
          date,
          null,
          null,
          null,
          null,
          30,
        ])
      ).rows,
    true,
  );
  assert(
    list.some((row) => row.appointment_id === first.appointment_id),
    "Staff list missing created appointment",
  );
  const detail = await asActor(
    client,
    actor.admina.id,
    async (db) =>
      (
        await db.query("select * from public.staff_get_appointment($1,$2)", [
          id.centerA,
          first.appointment_id,
        ])
      ).rows[0],
    true,
  );
  assert(
    detail.patient_center_id === id.patientA && detail.administrative_note === "Synthetic note",
    "Staff detail contract differs",
  );
  const professionalList = await asActor(
    client,
    actor.professionala.id,
    async (db) =>
      (
        await db.query(
          "select * from public.professional_list_own_appointments($1,$2,$3,$4,$5,$6,$7)",
          [id.centerA, date, date, null, null, null, 30],
        )
      ).rows,
    true,
  );
  assert(
    professionalList.some((row) => row.appointment_id === first.appointment_id),
    "Professional own list missing appointment",
  );
  const professionalDetail = await asActor(
    client,
    actor.professionala.id,
    async (db) =>
      (
        await db.query("select * from public.professional_get_own_appointment($1,$2)", [
          id.centerA,
          first.appointment_id,
        ])
      ).rows[0],
    true,
  );
  for (const forbidden of [
    "patient_center_id",
    "administrative_note",
    "document_number",
    "email",
    "phone",
  ]) {
    assert(
      !Object.hasOwn(professionalDetail, forbidden),
      `Professional detail exposed ${forbidden}`,
    );
    assert(
      professionalList.every((row) => !Object.hasOwn(row, forbidden)),
      `Professional list exposed ${forbidden}`,
    );
  }
  await expectPgError(
    "PROFESSIONAL B cannot view A appointment",
    () =>
      asActor(
        client,
        actor.professionalb.id,
        (db) =>
          db.query("select * from public.professional_get_own_appointment($1,$2)", [
            id.centerA,
            first.appointment_id,
          ]),
        true,
      ),
    "42501",
  );
  const noted = await asActor(
    client,
    actor.receptiona.id,
    async (db) =>
      (
        await db.query(noteSql, [
          id.centerA,
          first.appointment_id,
          first.updated_at,
          "Updated synthetic note",
        ])
      ).rows[0],
  );
  await expectPgError(
    "stale NOTE CAS",
    () =>
      asActor(client, actor.admina.id, (db) =>
        db.query(noteSql, [id.centerA, first.appointment_id, first.updated_at, "stale"]),
      ),
    "P0001",
    "STALE_APPOINTMENT_STATE",
  );
  const confirmed = await asActor(
    client,
    actor.admina.id,
    async (db) =>
      (await db.query(statusSql, [id.centerA, first.appointment_id, noted.updated_at, "CONFIRMED"]))
        .rows[0],
  );
  const attended = await asActor(
    client,
    actor.professionala.id,
    async (db) =>
      (
        await db.query(statusSql, [
          id.centerA,
          first.appointment_id,
          confirmed.updated_at,
          "ATTENDED",
        ])
      ).rows[0],
  );
  assert(attended.status === "ATTENDED", "Professional own transition failed");
  await expectPgError(
    "terminal transition denied",
    () =>
      asActor(client, actor.admina.id, (db) =>
        db.query(statusSql, [id.centerA, first.appointment_id, attended.updated_at, "CANCELLED"]),
      ),
    "P0001",
    "INVALID_STATUS_TRANSITION",
  );

  const second = await createAppointment(client, ledger, actor.receptiona.id, context("10:00"));
  const moved = await asActor(
    client,
    actor.admina.id,
    async (db) =>
      (
        await db.query(rescheduleSql, [
          id.centerA,
          second.appointment_id,
          second.updated_at,
          id.pcA,
          id.specialtyA,
          date,
          "10:30",
        ])
      ).rows[0],
  );
  assert(
    moved.appointment_id === second.appointment_id && moved.status === "PENDING",
    "RESCHEDULE changed identity/status",
  );
  await expectPgError(
    "stale RESCHEDULE CAS",
    () =>
      asActor(client, actor.receptiona.id, (db) =>
        db.query(rescheduleSql, [
          id.centerA,
          second.appointment_id,
          second.updated_at,
          id.pcA,
          id.specialtyA,
          date,
          "11:30",
        ]),
      ),
    "P0001",
    "STALE_APPOINTMENT_STATE",
  );
  const cancelled = await asActor(
    client,
    actor.admina.id,
    async (db) =>
      (
        await db.query(statusSql, [
          id.centerA,
          second.appointment_id,
          moved.updated_at,
          "CANCELLED",
        ])
      ).rows[0],
  );
  assert(cancelled.status === "CANCELLED", "Cancel failed");
  const reopened = await createAppointment(client, ledger, actor.receptiona.id, context("10:30"));
  assert(reopened.appointment_id !== second.appointment_id, "Cancelled slot was not released");
  const historical = await asActor(
    client,
    actor.admina.id,
    async (db) =>
      (
        await db.query("select * from public.staff_get_appointment($1,$2)", [
          id.centerA,
          second.appointment_id,
        ])
      ).rows[0],
    true,
  );
  assert(historical.status === "CANCELLED", "Cancelled history disappeared");
  await expectPgError(
    "cross-center patient rejected",
    () =>
      asActor(client, actor.adminb.id, (db) =>
        db.query(createSql, [id.centerB, id.patientA, id.pcB, id.specialtyB, date, "10:00", null]),
      ),
    "P0002",
  );

  // Deliberately discard the successful CREATE response, then reconcile by exact fixture FKs and slot.
  const intentId = planAppointmentIntent(ledger, context("11:00"));
  await asActor(client, actor.admina.id, (db) =>
    db.query(createSql, [id.centerA, id.patientA, id.pcA, id.specialtyA, date, "11:00", null]),
  );
  const target = rows.find((row) => row.local_start_time === "11:00");
  const matches = await client.query(
    "select id from public.appointments where center_id=$1 and patient_center_id=$2 and professional_center_id=$3 and specialty_id=$4 and starts_at=$5 and ends_at=$6",
    [id.centerA, id.patientA, id.pcA, id.specialtyA, target.starts_at, target.ends_at],
  );
  assert(matches.rowCount === 1, "Lost-response reconciliation is not unique; STOP");
  markAppointmentOwned(ledger, intentId, matches.rows[0].id);
  record(
    ledger,
    "eleven Appointment RPC contracts, privacy, CAS, cancel/release, and unique reconciliation",
  );
  return { date, context, reconciliationId: matches.rows[0].id };
}

async function testCreateRace(ledger, context, actorA, actorB) {
  const a = await openDevDatabase("race-create-a");
  const b = await openDevDatabase("race-create-b");
  try {
    const ctx = context("12:00");
    const intentA = planAppointmentIntent(ledger, ctx);
    const intentB = planAppointmentIntent(ledger, ctx);
    const outcomes = await Promise.allSettled([
      asActor(a, actorA, (db) =>
        db.query(createSql, [
          ctx.centerId,
          ctx.patientCenterId,
          ctx.professionalCenterId,
          ctx.specialtyId,
          ctx.localDate,
          ctx.localTime,
          null,
        ]),
      ),
      asActor(b, actorB, (db) =>
        db.query(createSql, [
          ctx.centerId,
          ctx.patientCenterId,
          ctx.professionalCenterId,
          ctx.specialtyId,
          ctx.localDate,
          ctx.localTime,
          null,
        ]),
      ),
    ]);
    for (const [index, outcome] of outcomes.entries()) {
      if (outcome.status === "fulfilled" && outcome.value.rows[0]?.appointment_id) {
        markAppointmentOwned(
          ledger,
          index === 0 ? intentA : intentB,
          outcome.value.rows[0].appointment_id,
        );
      }
    }
    assert(
      outcomes.filter((outcome) => outcome.status === "fulfilled").length === 1,
      "create/create race did not yield one winner",
    );
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    assert(
      rejected?.reason?.code === "23P01",
      "create/create race loser did not receive GiST conflict",
    );
    record(ledger, "concurrent create/create GiST arbitration");
  } finally {
    await Promise.allSettled([a.end(), b.end()]);
  }
}

export async function runIntegration(client, dev, ledger, password) {
  if (ledger.stage !== "fixtures_ready") throw new Error("Integration requires fixtures_ready");
  await testAuth(dev, ledger, password);
  await testAccess(client, ledger);
  await testDst(client, ledger);
  const main = await testAppointments(client, ledger);
  await testCreateRace(ledger, main.context, ledger.actors.admina.id, ledger.actors.receptiona.id);
  await testRemainingRaces(client, ledger, main.context);
  ledger.stage = "integrated";
  saveLedger(ledger);
  return { testsPassed: ledger.evidence.length, date: main.date };
}
