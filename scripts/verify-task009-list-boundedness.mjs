import assert from "node:assert/strict";
import pg from "pg";

const rawUrl = process.env.TASK009_SHADOW_DATABASE_URL;
assert(rawUrl, "TASK009_SHADOW_DATABASE_URL is required");
const target = new URL(rawUrl);
assert.equal(target.hostname, "127.0.0.1", "This regression runs only against local shadow");

const centerId = "91000000-0000-0000-0000-000000000001";
const professionalCenterId = "91000000-0000-0000-0000-000000000031";
const client = new pg.Client({ connectionString: rawUrl, application_name: "task009-list-bounds" });

function indexConditions(plan) {
  return [
    ...(plan["Index Cond"]
      ? [
          {
            name: plan["Index Name"],
            condition: plan["Index Cond"],
            rows: plan["Actual Rows"],
            readBlocks: plan["Shared Read Blocks"],
            hitBlocks: plan["Shared Hit Blocks"],
          },
        ]
      : []),
    ...(plan.Plans ?? []).flatMap(indexConditions),
  ];
}

async function actualPageSql(functionName, day, professional, cursor = null, limit = 30) {
  const definition = (
    await client.query(
      `select pg_get_functiondef(p.oid) as definition from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname=$1`,
      [functionName],
    )
  ).rows[0]?.definition;
  assert(definition, `${functionName}: missing function definition`);
  const page = definition.match(
    /with page as materialized \(\s*([\s\S]*?)\s*\), numbered as \(/i,
  )?.[1];
  assert(page, `${functionName}: missing page query`);
  const replacements = {
    p_center_id: `'${centerId}'::uuid`,
    v_professional_center_id: `'${professionalCenterId}'::uuid`,
    v_lower_utc: `(('${day}'::date::timestamp at time zone 'UTC') - interval '15 hours')`,
    v_upper_utc: `((('${day}'::date::timestamp + interval '1 day') at time zone 'UTC') + interval '15 hours')`,
    v_timezone: `'America/New_York'`,
    p_from_date: `'${day}'::date`,
    p_to_date: `'${day}'::date`,
    p_status: `null::public.appointment_status`,
    p_professional_center_id: `null::uuid`,
    p_cursor_starts_at: cursor ? `'${cursor.startsAt}'::timestamptz` : `null::timestamptz`,
    p_cursor_id: cursor ? `'${cursor.id}'::uuid` : `null::uuid`,
    p_limit: String(limit),
  };
  let sql = page;
  for (const [name, value] of Object.entries(replacements)) {
    sql = sql.replace(new RegExp(`\\b${name}\\b`, "g"), () => value);
  }
  assert(
    !/\b(?:p_center_id|v_professional_center_id|v_lower_utc|v_upper_utc|v_timezone|p_from_date|p_to_date|p_status|p_professional_center_id|p_cursor_starts_at|p_cursor_id|p_limit)\b/.test(
      sql,
    ),
  );
  assert.equal(professional, functionName.startsWith("professional_"));
  return sql;
}

async function assertRpc(actorId, professional, day, expectedIds) {
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actorId]);
  const rpc = professional
    ? "public.professional_list_own_appointments"
    : "public.staff_list_appointments";
  const result = await client.query(
    `select appointment_id from ${rpc}($1::uuid,$2::date,$2::date) order by starts_at`,
    [centerId, day],
  );
  assert.deepEqual(
    result.rows.map((row) => row.appointment_id),
    expectedIds,
    `${rpc} ${day} for ${actorId}`,
  );
}

async function expectedLocalDay(day) {
  const result = await client.query(
    `select id from public.appointments
     where center_id=$1 and professional_center_id=$2
       and (starts_at at time zone 'America/New_York')::date=$3::date
     order by starts_at,id`,
    [centerId, professionalCenterId, day],
  );
  return result.rows.map((row) => row.id);
}

async function assertPagination(actorId, professional, day, expectedIds) {
  const rpc = professional
    ? "public.professional_list_own_appointments"
    : "public.staff_list_appointments";
  const pages = [];
  let cursor = null;
  do {
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actorId]);
    const rows = (
      await client.query(
        `select appointment_id, starts_at, has_more from ${rpc}(
          $1::uuid,$2::date,$2::date,null
          ${professional ? "" : ",null::uuid"},$3::timestamptz,$4::uuid,7)`,
        [centerId, day, cursor?.startsAt ?? null, cursor?.id ?? null],
      )
    ).rows;
    assert(rows.length > 0, `${rpc}: unexpected empty page`);
    pages.push(...rows.map((row) => row.appointment_id));
    cursor = { startsAt: rows.at(-1).starts_at, id: rows.at(-1).appointment_id };
    if (!rows.at(-1).has_more) break;
  } while (pages.length <= expectedIds.length);
  assert.deepEqual(pages, expectedIds, `${rpc}: pagination ${day} for ${actorId}`);
}

try {
  await client.connect();
  await client.query("begin");
  await client.query(`
    insert into public.centers (id,name,timezone)
    values ('${centerId}','TASK009 boundedness','America/New_York');
    insert into auth.users (id,email) values
      ('91000000-0000-0000-0000-000000000011','task009-bounds-admin@example.test'),
      ('91000000-0000-0000-0000-000000000012','task009-bounds-reception@example.test'),
      ('91000000-0000-0000-0000-000000000013','task009-bounds-professional@example.test');
    insert into public.users (id,first_name,last_name,email)
    select id,'TASK009','Bounded',email from auth.users
    where id::text like '91000000-0000-0000-0000-00000000001%';
    insert into public.professionals
      (id,first_name,last_name,nationality_code,document_number,email)
    values ('91000000-0000-0000-0000-000000000021','Bounds','Professional','AR',
      'TASK009-BOUNDS-P1','bounds-professional@example.test');
    insert into public.professional_centers
      (id,professional_id,center_id,usual_appointment_duration_minutes)
    values ('${professionalCenterId}','91000000-0000-0000-0000-000000000021',
      '${centerId}',30);
    insert into public.specialties (id,center_id,name)
    values ('91000000-0000-0000-0000-000000000041','${centerId}','Bounds');
    insert into public.professional_center_specialties
      (professional_center_id,specialty_id,center_id)
    values ('${professionalCenterId}','91000000-0000-0000-0000-000000000041','${centerId}');
    insert into public.center_memberships
      (center_id,user_id,role,professional_center_id,is_active) values
      ('${centerId}','91000000-0000-0000-0000-000000000011','ADMIN',null,true),
      ('${centerId}','91000000-0000-0000-0000-000000000012','RECEPTION',null,true),
      ('${centerId}','91000000-0000-0000-0000-000000000013','PROFESSIONAL',
        '${professionalCenterId}',true);
    insert into public.persons
      (id,first_name,last_name,birth_date,nationality_code,document_number)
    values ('91000000-0000-0000-0000-000000000051','Bounds','Patient',
      '1990-01-01','AR','TASK009-BOUNDS-X1');
    insert into public.patient_centers (id,person_id,center_id,phone)
    values ('91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000051','${centerId}','123456');
    insert into public.appointments
      (center_id,patient_center_id,professional_center_id,specialty_id,
       starts_at,ends_at,status)
    select '${centerId}',
      '91000000-0000-0000-0000-000000000061','${professionalCenterId}',
      '91000000-0000-0000-0000-000000000041',
      timestamp '2020-01-01 00:00' at time zone 'UTC' + n * interval '1 hour',
      timestamp '2020-01-01 00:01' at time zone 'UTC' + n * interval '1 hour',
      'CANCELLED'
    from generate_series(0,49999) as n;
    insert into public.appointments
      (id,center_id,patient_center_id,professional_center_id,specialty_id,
       starts_at,ends_at,status)
    select fixture.id::uuid,'${centerId}',
      '91000000-0000-0000-0000-000000000061','${professionalCenterId}',
      '91000000-0000-0000-0000-000000000041',
      fixture.local_start at time zone 'America/New_York',
      (fixture.local_start at time zone 'America/New_York') + interval '1 minute',
      'CANCELLED'
    from (values
      ('91000000-0000-0000-0000-000000000071','2030-03-31 23:59'::timestamp),
      ('91000000-0000-0000-0000-000000000072','2030-04-01 00:00'::timestamp),
      ('91000000-0000-0000-0000-000000000073','2030-04-01 23:59'::timestamp),
      ('91000000-0000-0000-0000-000000000074','2030-04-02 00:00'::timestamp)
    ) as fixture(id,local_start);
    analyze public.appointments;
  `);

  const cases = [
    { day: "2019-01-01", ids: [] },
    {
      day: "2030-04-01",
      ids: ["91000000-0000-0000-0000-000000000072", "91000000-0000-0000-0000-000000000073"],
    },
    { day: "2040-01-01", ids: [] },
  ];
  const springIds = await expectedLocalDay("2020-03-08");
  const fallIds = await expectedLocalDay("2020-11-01");
  assert.equal(springIds.length, 23, "New York spring DST has 23 hours");
  assert.equal(fallIds.length, 25, "New York fall DST has 25 hours");
  cases.push({ day: "2020-03-08", ids: springIds }, { day: "2020-11-01", ids: fallIds });
  await client.query("set local role authenticated");
  for (const { day, ids } of cases) {
    await assertRpc("91000000-0000-0000-0000-000000000011", false, day, ids);
    await assertRpc("91000000-0000-0000-0000-000000000012", false, day, ids);
    await assertRpc("91000000-0000-0000-0000-000000000013", true, day, ids);
  }
  for (const [actorId, professional] of [
    ["91000000-0000-0000-0000-000000000011", false],
    ["91000000-0000-0000-0000-000000000012", false],
    ["91000000-0000-0000-0000-000000000013", true],
  ]) {
    await assertPagination(actorId, professional, "2020-11-01", fallIds);
  }
  await client.query("reset role");

  const plans = [];
  for (const professional of [false, true]) {
    for (const { day, ids } of cases.slice(0, 3)) {
      const functionName = professional
        ? "professional_list_own_appointments"
        : "staff_list_appointments";
      const pageSql = await actualPageSql(functionName, day, professional);
      const plan = (
        await client.query(
          `explain (analyze, buffers, format json) with page as materialized (${pageSql}) select * from page`,
        )
      ).rows[0]["QUERY PLAN"][0];
      const conditions = indexConditions(plan.Plan);
      assert(
        conditions.some(
          ({ name, condition }) =>
            name ===
              (professional
                ? "appointments_professional_center_starts_at_idx"
                : "appointments_center_starts_at_idx") &&
            /starts_at\s*>=/.test(condition) &&
            /starts_at\s*</.test(condition) &&
            new RegExp(`${professional ? "professional_center_id" : "center_id"}\\s*=`).test(
              condition,
            ),
        ),
        `Missing bounded index condition for ${professional ? "Professional" : "staff"} ${day}: ${JSON.stringify(conditions)}`,
      );
      assert.equal(plan.Plan["Actual Rows"], ids.length);
      plans.push({
        role: professional ? "Professional" : "staff",
        day,
        rows: plan.Plan["Actual Rows"],
        indexConditions: conditions,
        sharedReadBlocks: plan.Plan["Shared Read Blocks"],
        sharedHitBlocks: plan.Plan["Shared Hit Blocks"],
      });
    }
  }
  console.log(
    JSON.stringify({ result: "TASK009_LIST_BOUNDEDNESS_PASS", historyRows: 50000, plans }, null, 2),
  );
} finally {
  try {
    await client.query("rollback");
  } finally {
    await client.end();
  }
}
