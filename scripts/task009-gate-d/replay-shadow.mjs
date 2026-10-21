import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { expectedMigrations, localChecks, loopbackConnection, verifyCatalog } from "./verify.mjs";

const url = loopbackConnection(process.env.TASK009_SHADOW_DATABASE_URL);
const versions = await localChecks();
const migration = readFileSync(resolve("supabase/migrations", expectedMigrations.at(-1)), "utf8");
const control = new pg.Client({ connectionString: url });
const observer = new pg.Client({ connectionString: url });
await control.connect();
await observer.connect();

async function slotSnapshot(client) {
  return (
    await client.query(`select p.oid::text as oid, pg_get_function_result(p.oid) as result,
    p.proacl::text as acl, pg_get_functiondef(p.oid) as definition
    from pg_proc p where p.oid=to_regprocedure('public.staff_search_appointment_slots(uuid,uuid,uuid,date)')`)
  ).rows[0];
}

try {
  const existing = await control.query(
    "select to_regclass('supabase_migrations.schema_migrations') as ledger",
  );
  assert.equal(
    existing.rows[0].ledger,
    null,
    "shadow must be a fresh disposable PostgreSQL instance",
  );
  await control.query(
    "create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key)",
  );
  for (let i = 0; i < 22; i++) {
    const file = expectedMigrations[i];
    await control.query(readFileSync(resolve("supabase/migrations", file), "utf8"));
    await control.query("insert into supabase_migrations.schema_migrations(version) values($1)", [
      versions[i],
    ]);
    if (i === 19) {
      // Match the previously observed DEV table ACL in this disposable shadow only.
      await control.query(
        "revoke select, insert, update, delete on all tables in schema public from service_role",
      );
    }
  }
  const before = await slotSnapshot(control);
  assert(
    before &&
      before.result ===
        "TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone)",
  );
  if (process.argv[2] === "--prepare-only") {
    console.log(JSON.stringify({ result: "TASK009_GATE_D_SHADOW_22_PREPARED", migrations: 22 }));
    process.exitCode = 0;
  } else {
    const dependencies = (
      await control.query(`select d.classid::regclass::text as class,
    d.objid::text as object_id, d.deptype from pg_depend d
    where d.refobjid=to_regprocedure('public.staff_search_appointment_slots(uuid,uuid,uuid,date)')
    order by 1,2,3`)
    ).rows;

    // The observer uses a different connection while DROP is still uncommitted.
    await control.query("begin");
    await control.query("drop function public.staff_search_appointment_slots(uuid,uuid,uuid,date)");
    const visibleBeforeCommit = await slotSnapshot(observer);
    assert.deepEqual(visibleBeforeCommit, before, "another session saw an uncommitted DROP");
    await control.query("rollback");

    const injected = migration.replace(
      /create function public\.staff_search_appointment_slots\(/i,
      "select 1/0;\ncreate function public.staff_search_appointment_slots(",
    );
    assert.notEqual(injected, migration);
    await assert.rejects(control.query(injected), (error) => error.code === "22012");
    await control.query("rollback");
    assert.deepEqual(
      await slotSnapshot(control),
      before,
      "failed migration changed old RPC or ACL",
    );
    assert.deepEqual(
      await slotSnapshot(observer),
      before,
      "failed migration changed RPC visible to another session",
    );
    assert.equal(
      (
        await control.query(
          "select count(*)::integer as n from supabase_migrations.schema_migrations",
        )
      ).rows[0].n,
      22,
    );

    await control.query(migration);
    await control.query("insert into supabase_migrations.schema_migrations(version) values($1)", [
      versions[22],
    ]);
    const after = await slotSnapshot(control);
    assert(after && after.oid !== before.oid, "DROP/CREATE did not replace the RPC");
    const catalog = await verifyCatalog(control, versions);
    await control.query("set role service_role");
    await assert.rejects(
      control.query("select * from public.staff_search_appointment_slots(null,null,null,null)"),
      (error) => error.code === "42501" && /permission denied for function/.test(error.message),
    );
    await control.query("reset role");
    await control.query("set role authenticated");
    await assert.rejects(
      control.query("select * from public.staff_search_appointment_slots(null,null,null,null)"),
      (error) => error.code === "42501" && error.message === "APPOINTMENT_ACCESS_DENIED",
    );
    await control.query("reset role");
    console.log(
      JSON.stringify({
        result: "TASK009_GATE_D_SHADOW_REPLAY_PASS",
        postgres: (await control.query("select version() as version")).rows[0].version,
        migrations: versions.length,
        failedMigrationRolledBack: true,
        oldContractVisibleUntilCommit: true,
        oldOid: before.oid,
        newOid: after.oid,
        dependentObjectsBeforeDrop: dependencies,
        catalog,
      }),
    );
  }
} finally {
  await control.query("rollback").catch(() => undefined);
  await control.end();
  await observer.end();
}
