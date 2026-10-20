import assert from "node:assert/strict";
import pg from "pg";
import { localChecks, loopbackConnection, verifyCatalog } from "./verify.mjs";

const versions = await localChecks();
const shadowUrl = new URL(loopbackConnection(process.env.TASK009_SHADOW_DATABASE_URL));
// Supabase reserves authenticator memberships for its local superuser.
shadowUrl.username = "supabase_admin";
const client = new pg.Client({
  connectionString: shadowUrl.toString(),
});
await client.connect();

const signature = "public.staff_search_appointment_slots(uuid,uuid,uuid,date)";
const negativeCases = [
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
    name: "unauthorized_direct_execute",
    sql: [
      "create role task009_unreviewed_role noinherit",
      `grant execute on function ${signature} to task009_unreviewed_role`,
    ],
    error: /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  },
  {
    name: "unauthorized_grant_option",
    sql: [`grant execute on function ${signature} to authenticated with grant option`],
    error: /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  },
  {
    name: "infrastructure_graph_drift",
    sql: ["grant authenticated to supabase_storage_admin with inherit false, set true"],
    error: /approved infrastructure role membership graph differs/,
  },
  {
    name: "unauthorized_superuser",
    sql: ["create role task009_unreviewed_role superuser"],
    error: /unapproved superuser role/,
  },
];

try {
  const existing = await client.query(
    "select 1 from pg_roles where rolname='task009_unreviewed_role'",
  );
  assert.equal(existing.rowCount, 0, "adversarial role already exists outside this run");
  await verifyCatalog(client, versions);
  const paths = (
    await client.query(`select r.rolname,
      pg_has_role(r.oid,'authenticated'::regrole,'USAGE') as inherits_authenticated,
      pg_has_role(r.oid,'authenticated'::regrole,'SET') as can_set_authenticated
      from pg_roles r where r.rolname in ('authenticator','supabase_storage_admin')
      order by r.rolname`)
  ).rows;
  const edges = (
    await client.query(`select m.rolname as member,p.rolname as granted_role,
      a.admin_option,a.inherit_option,a.set_option
      from pg_auth_members a
      join pg_roles m on m.oid=a.member
      join pg_roles p on p.oid=a.roleid
      where m.rolname in ('authenticator','supabase_storage_admin')
      order by m.rolname,p.rolname`)
  ).rows;
  const failures = [];
  for (const item of negativeCases) {
    await client.query("begin");
    try {
      for (const sql of item.sql) await client.query(sql);
      if (item.name === "unauthorized_direct_set" || item.name === "unauthorized_transitive_set") {
        const path = (
          await client.query(`select
            pg_has_role('task009_unreviewed_role','authenticated','USAGE') as usage,
            pg_has_role('task009_unreviewed_role','authenticated','SET') as can_set`)
        ).rows[0];
        assert.deepEqual(path, { usage: false, can_set: true }, item.name);
      }
      await assert.rejects(verifyCatalog(client, versions), item.error, item.name);
      failures.push(item.name);
    } finally {
      await client.query("rollback");
    }
  }
  await verifyCatalog(client, versions);
  assert.equal(
    (await client.query("select 1 from pg_roles where rolname='task009_unreviewed_role'")).rowCount,
    0,
    "adversarial role survived rollback",
  );
  console.log(
    JSON.stringify({
      result: "TASK009_GATE_D_ACL_ADVERSARIAL_PASS",
      migrations: versions.length,
      approvedPaths: paths,
      approvedEdges: edges,
      rejectedMutants: failures,
      rolledBack: true,
    }),
  );
} finally {
  await client.query("rollback").catch(() => undefined);
  await client.end();
}
