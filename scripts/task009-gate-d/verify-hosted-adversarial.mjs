import assert from "node:assert/strict";
import pg from "pg";
import { localChecks, loopbackConnection, verifyCatalog } from "./verify.mjs";

const versions = await localChecks();
const url = new URL(loopbackConnection(process.env.TASK009_SHADOW_DATABASE_URL));
url.username = "supabase_admin";
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();

const signature = "public.staff_search_appointment_slots(uuid,uuid,uuid,date)";
const failures = [
  {
    name: "realtime_extra_edge",
    sql: [
      "create role task009_unreviewed_role",
      "grant task009_unreviewed_role to supabase_realtime_admin with inherit false, set true",
    ],
    error: /approved infrastructure role membership graph differs/,
  },
  {
    name: "cli_extra_edge",
    sql: [
      "create role task009_unreviewed_role",
      "grant task009_unreviewed_role to cli_login_postgres with inherit false, set true",
    ],
    error: /approved infrastructure role membership graph differs/,
  },
  {
    name: "realtime_inherited_usage",
    sql: [
      "revoke authenticated from supabase_realtime_admin",
      "grant authenticated to supabase_realtime_admin with inherit true, set true",
    ],
    error: /unapproved role inherits authenticated EXECUTE/,
  },
  {
    name: "cli_inherited_usage",
    sql: [
      "revoke postgres from cli_login_postgres",
      "grant postgres to cli_login_postgres with inherit true, set true",
    ],
    error: /unapproved role inherits authenticated EXECUTE/,
  },
  {
    name: "cli_changed_option",
    sql: [
      "revoke postgres from cli_login_postgres",
      "grant postgres to cli_login_postgres with inherit false, set false",
    ],
    error:
      /approved infrastructure role attributes or effective paths differ|approved infrastructure role membership graph differs/,
  },
  {
    name: "realtime_changed_attribute",
    sql: ["alter role supabase_realtime_admin login"],
    error: /approved infrastructure role attributes or effective paths differ/,
  },
  {
    name: "cli_changed_attribute",
    sql: ["alter role cli_login_postgres inherit"],
    error: /approved infrastructure role attributes or effective paths differ/,
  },
  {
    name: "impersonator_role",
    sql: [
      "create role task009_cli_login_postgres noinherit",
      "grant postgres to task009_cli_login_postgres with inherit false, set true",
    ],
    error: /unapproved role can SET ROLE authenticated EXECUTE/,
  },
  {
    name: "unauthorized_inbound_realtime_edge",
    sql: [
      "create role task009_unreviewed_role noinherit",
      "grant supabase_realtime_admin to task009_unreviewed_role with inherit false, set true",
    ],
    error: /unapproved role can SET ROLE authenticated EXECUTE/,
  },
  {
    name: "unauthorized_direct_set",
    sql: [
      "create role task009_unreviewed_role noinherit",
      "grant authenticated to task009_unreviewed_role with inherit false, set true",
    ],
    error: /unapproved role can SET ROLE authenticated EXECUTE/,
  },
  {
    name: "unauthorized_transitive_set",
    sql: [
      "create role task009_unreviewed_role noinherit",
      "grant authenticator to task009_unreviewed_role with inherit false, set true",
    ],
    error: /unapproved role can SET ROLE authenticated EXECUTE/,
  },
  {
    name: "extra_execute_grantee",
    sql: [
      "create role task009_unreviewed_role",
      `grant execute on function ${signature} to task009_unreviewed_role`,
    ],
    error: /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  },
  {
    name: "extra_grant_option",
    sql: [`grant execute on function ${signature} to authenticated with grant option`],
    error: /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  },
  {
    name: "postgres_route_option",
    sql: [
      "revoke authenticated from postgres",
      "grant authenticated to postgres with inherit false, set true",
    ],
    error: /CLI route through postgres to authenticated differs/,
  },
];

try {
  await verifyCatalog(client, versions, "shadow");
  await client.query("begin");
  assert.equal(
    (
      await client.query(
        "select 1 from pg_roles where rolname in ('cli_login_postgres','supabase_realtime_admin')",
      )
    ).rowCount,
    0,
  );
  await client.query("create role supabase_realtime_admin nologin noinherit");
  for (const target of ["anon", "authenticated", "service_role"]) {
    await client.query(`grant ${target} to supabase_realtime_admin with inherit false, set true`);
  }
  await verifyCatalog(client, versions, "dev-hosted");
  await client.query("create role cli_login_postgres login noinherit");
  await client.query("grant postgres to cli_login_postgres with inherit false, set true");
  assert.deepEqual(
    (
      await client.query(
        "select pg_has_role('cli_login_postgres','authenticated','USAGE') as usage, pg_has_role('cli_login_postgres','authenticated','SET') as can_set",
      )
    ).rows[0],
    { usage: false, can_set: true },
  );
  await verifyCatalog(client, versions, "dev-hosted");
  const rejectedMutants = [];
  for (const item of failures) {
    await client.query("savepoint task009_mutant");
    try {
      for (const sql of item.sql) await client.query(sql);
      await assert.rejects(verifyCatalog(client, versions, "dev-hosted"), item.error, item.name);
      rejectedMutants.push(item.name);
    } finally {
      await client.query("rollback to savepoint task009_mutant");
      await client.query("release savepoint task009_mutant");
    }
  }
  await verifyCatalog(client, versions, "dev-hosted");
  await client.query("rollback");
  await verifyCatalog(client, versions, "shadow");
  assert.equal(
    (
      await client.query(
        "select 1 from pg_roles where rolname in ('cli_login_postgres','supabase_realtime_admin','task009_unreviewed_role','task009_cli_login_postgres')",
      )
    ).rowCount,
    0,
  );
  console.log(
    JSON.stringify({
      result: "TASK009_GATE_D_HOSTED_ACL_ADVERSARIAL_PASS",
      migrations: versions.length,
      optionalCliAbsentPassed: true,
      cliPresentPassed: true,
      rejectedMutants,
      rolledBack: true,
    }),
  );
} finally {
  await client.query("rollback").catch(() => undefined);
  await client.end();
}
