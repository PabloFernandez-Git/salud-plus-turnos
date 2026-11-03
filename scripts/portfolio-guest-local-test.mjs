import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key, "LOCAL_SUPABASE_PUBLISHABLE_KEY is required");

const localUrl = "http://127.0.0.1:54321";
const demoCenterId = "d0000000-0000-4000-8000-000000000001";
const otherCenterId = "d0000000-0000-4000-8000-0000000000ff";
const database = new pg.Client({
  host: "127.0.0.1",
  port: 54322,
  user: "postgres",
  password: "postgres",
  database: "postgres",
});
await database.connect();

function visitor() {
  return createClient(localUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function expectGuestRead(client, ownId, otherId) {
  const [centers, profiles, memberships, dashboard] = await Promise.all([
    client.from("centers").select("id, name"),
    client.from("users").select("id, email"),
    client.from("center_memberships").select("center_id, user_id, role"),
    client.rpc("staff_get_daily_dashboard", { p_center_id: demoCenterId }),
  ]);
  assert.equal(centers.error, null, JSON.stringify(centers.error));
  assert.deepEqual(
    centers.data?.map((row) => row.id),
    [demoCenterId],
  );
  assert.equal(profiles.error, null, JSON.stringify(profiles.error));
  assert.deepEqual(
    profiles.data?.map((row) => row.id),
    [ownId],
  );
  assert.ok(!profiles.data?.some((row) => row.id === otherId));
  assert.equal(memberships.error, null, JSON.stringify(memberships.error));
  assert.deepEqual(
    memberships.data?.map((row) => row.user_id),
    [ownId],
  );
  assert.equal(memberships.data?.[0]?.role, "ADMIN");
  assert.equal(dashboard.error, null, JSON.stringify(dashboard.error));
  assert.ok(dashboard.data);

  const otherCenter = await client.from("centers").select("id").eq("id", otherCenterId);
  assert.equal(otherCenter.error, null, JSON.stringify(otherCenter.error));
  assert.deepEqual(otherCenter.data, []);
  const foreignDashboard = await client.rpc("staff_get_daily_dashboard", {
    p_center_id: otherCenterId,
  });
  assert.ok(foreignDashboard.error || !foreignDashboard.data?.length);

  const forbiddenWrite = await client
    .from("centers")
    .update({ name: "UNAUTHORIZED" })
    .eq("id", demoCenterId);
  assert.ok(forbiddenWrite.error, "Direct DML must be denied");
  const forbiddenRpc = await client.rpc("staff_resolve_patient_identity", {
    p_center_id: demoCenterId,
    p_document_number: "DEMO-PAC-001",
    p_nationality_code: "AR",
    p_birth_date: "1990-01-01",
  });
  assert.ok(forbiddenRpc.error, "Sensitive RPC must be denied");
  const forbiddenAppointment = await client.rpc("staff_create_appointment", {
    p_center_id: demoCenterId,
    p_patient_center_id: "d0000000-0000-4000-8000-000000000051",
    p_professional_center_id: "d0000000-0000-4000-8000-000000000031",
    p_specialty_id: "d0000000-0000-4000-8000-000000000011",
    p_local_date: "2026-11-03",
    p_local_start_time: "09:00",
  });
  assert.ok(forbiddenAppointment.error, "Appointment write RPC must be denied");
}

try {
  const hookAllowed = await database.query(
    `select public.portfolio_allow_anonymous_signup('{"user":{"is_anonymous":true}}') as result`,
  );
  assert.deepEqual(hookAllowed.rows[0].result, {});
  const hookDenied = await database.query(
    `select public.portfolio_allow_anonymous_signup('{"user":{"is_anonymous":false,"email":"x@example.test"}}') as result`,
  );
  assert.equal(hookDenied.rows[0].result.error.http_code, 403);
  const grants = await database.query(`select
    has_function_privilege('authenticated', 'public.portfolio_allow_anonymous_signup(jsonb)', 'EXECUTE') as guest_hook,
    has_function_privilege('supabase_auth_admin', 'public.portfolio_allow_anonymous_signup(jsonb)', 'EXECUTE') as auth_hook,
    has_table_privilege('authenticated', 'public.users', 'INSERT') as guest_insert`);
  assert.deepEqual(grants.rows[0], { guest_hook: false, auth_hook: true, guest_insert: false });

  const first = visitor();
  const second = visitor();
  const firstSignIn = await first.auth.signInAnonymously();
  const secondSignIn = await second.auth.signInAnonymously();
  assert.equal(firstSignIn.error, null, JSON.stringify(firstSignIn.error));
  assert.equal(secondSignIn.error, null, JSON.stringify(secondSignIn.error));
  const firstId = firstSignIn.data.user?.id;
  const secondId = secondSignIn.data.user?.id;
  assert.ok(firstId && secondId && firstId !== secondId);
  assert.equal(firstSignIn.data.user?.is_anonymous, true);
  assert.equal(secondSignIn.data.user?.is_anonymous, true);
  const reused = await first.auth.getUser();
  assert.equal(reused.error, null, JSON.stringify(reused.error));
  assert.equal(reused.data.user?.id, firstId);

  const count = await database.query(
    `select count(*)::int as profiles from public.users where id = any($1::uuid[])`,
    [[firstId, secondId]],
  );
  assert.equal(count.rows[0].profiles, 2);

  await database.query(
    `insert into public.centers (id, name, timezone) values ($1, 'Other fictional center', 'UTC')`,
    [otherCenterId],
  );
  await expectGuestRead(first, firstId, secondId);
  await expectGuestRead(second, secondId, firstId);
  await database.query(`delete from public.centers where id = $1`, [otherCenterId]);

  // A later Auth identity link must not remove the RLS guest restriction.
  await database.query("begin");
  try {
    await database.query("set local role authenticated");
    await database.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: firstId, role: "authenticated", is_anonymous: false }),
    ]);
    const linkedIdentity = await database.query(`
      select id from public.users order by id
    `);
    assert.deepEqual(
      linkedIdentity.rows.map((row) => row.id),
      [firstId],
    );
    const linkedMembership = await database.query(`
      select user_id from public.center_memberships order by user_id
    `);
    assert.deepEqual(
      linkedMembership.rows.map((row) => row.user_id),
      [firstId],
    );
  } finally {
    await database.query("rollback");
  }

  const emailSignup = await visitor().auth.signUp({
    email: "forbidden-guest-test@example.invalid",
    password: "password-for-local-test-123",
  });
  assert.ok(emailSignup.error, "Non-anonymous Auth signup must be denied");
  assert.match(emailSignup.error.message, /Only anonymous DEMO signups are allowed/);
  const forbiddenUser = await database.query(
    `select count(*)::int as count from auth.users where email = 'forbidden-guest-test@example.invalid'`,
  );
  assert.equal(forbiddenUser.rows[0].count, 0);

  // The trigger must enforce a project-wide ceiling even if Auth IP limits are bypassed.
  await database.query("begin");
  try {
    const current = await database.query(
      `select count(*)::int as count from auth.users where is_anonymous`,
    );
    await database.query(
      `insert into auth.users (id, aud, role, is_anonymous, created_at, updated_at)
       select gen_random_uuid(), 'authenticated', 'authenticated', true, now(), now()
       from generate_series(1, $1)`,
      [500 - current.rows[0].count],
    );
    const atCapacity = await database.query(
      `select count(*)::int as count from auth.users where is_anonymous`,
    );
    assert.equal(atCapacity.rows[0].count, 500);
    await assert.rejects(
      database.query(`insert into auth.users (id, aud, role, is_anonymous)
        values (gen_random_uuid(), 'authenticated', 'authenticated', true)`),
      /Portfolio DEMO guest capacity reached/,
    );
  } finally {
    await database.query("rollback");
  }

  await database.query(
    `update auth.users set created_at = now() - interval '31 days' where id = $1`,
    [firstId],
  );
  const cleanupSql = readFileSync(
    new URL("../supabase/demo/cleanup-guests.sql", import.meta.url),
    "utf8",
  ).replace(/rollback;\s*$/i, "commit;");
  assert.notEqual(
    cleanupSql,
    readFileSync(new URL("../supabase/demo/cleanup-guests.sql", import.meta.url), "utf8"),
  );
  await database.query(
    readFileSync(new URL("../supabase/demo/cleanup-guests.sql", import.meta.url), "utf8"),
  );
  const previewRetained = await database.query(
    `select count(*)::int as count from auth.users where id = $1`,
    [firstId],
  );
  assert.equal(previewRetained.rows[0].count, 1, "Default cleanup must roll back");
  await database.query(cleanupSql);
  const remaining = await database.query(
    `select id from auth.users where id = any($1::uuid[]) order by id`,
    [[firstId, secondId]],
  );
  assert.deepEqual(
    remaining.rows.map((row) => row.id),
    [secondId],
  );
  const childRows = await database.query(
    `select (select count(*) from public.users where id = $1)::int as profiles,
      (select count(*) from public.center_memberships where user_id = $1)::int as memberships`,
    [firstId],
  );
  assert.deepEqual(childRows.rows[0], { profiles: 0, memberships: 0 });
  const operator = await database.query(
    `select count(*)::int as count from auth.users where email = 'demo@salud-plus.example'`,
  );
  assert.equal(operator.rows[0].count, 1);
  process.stdout.write("PORTFOLIO_GUEST_LOCAL_INTEGRATION_PASSED\n");
} finally {
  await database.end();
}
