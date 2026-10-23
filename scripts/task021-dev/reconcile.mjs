import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, inspect, localChecks } from "./gate.mjs";

const ref = "ehllxymqyzrofydrvtzo";
const version = "20261022130000";
const targetNames = ["staff_get_daily_dashboard", "professional_get_own_daily_dashboard"];

async function snapshot(client) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='15s'");
    const identity = (
      await client.query(
        "select current_database() as db,current_user as role,current_setting('server_version') as version,current_setting('transaction_read_only') as read_only",
      )
    ).rows[0];
    const history = (
      await client.query(
        "select version,name from supabase_migrations.schema_migrations order by version",
      )
    ).rows;
    const record =
      (
        await client.query(
          "select name,statements from supabase_migrations.schema_migrations where version=$1",
          [version],
        )
      ).rows[0] ?? null;
    const functions = (
      await client.query(
        `select p.proname,n.nspname as function_schema,p.oid::regprocedure::text as signature,
        p.pronargs,(p.proargtypes[0]='uuid'::regtype) as one_uuid,
        pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,
        p.proargnames,p.proargmodes,pg_get_function_result(p.oid) as result,
        has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
        has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
        has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
        exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
        (select array_agg(format_type(t.oid,null) order by t.ord)
          from unnest(p.proallargtypes) with ordinality t(oid,ord)) as all_types
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=any($1::text[]) order by p.proname,p.oid`,
        [targetNames],
      )
    ).rows;
    assert.equal(identity.read_only, "on", "Reconciliation transaction is not read-only");
    await client.query("ROLLBACK");
    return { identity, history, record, functions };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

function stateOf(observed, local) {
  const versions = observed.history.map((row) => row.version);
  const pending = isDeepStrictEqual(versions, local.versions);
  const applied = isDeepStrictEqual(versions, [...local.versions, version]);
  if (pending && !observed.record && observed.functions.length === 0) return "PENDING";
  if (applied && observed.record && observed.functions.length === 2) return "APPLIED_CANDIDATE";
  return "INCONSISTENT";
}

async function main() {
  assert.equal(process.argv.length, 3, "Usage: local|read-only");
  const mode = process.argv[2];
  assert(["local", "read-only"].includes(mode), "Usage: local|read-only");
  const local = localChecks();
  console.log(`LOCAL PASS ref=${ref} sha256=${local.sha256} prior=${local.versions.length}`);
  if (mode === "local") return;
  assert.equal(process.env.TASK021_DEV_CONFIRM_REF, ref, "Explicit DEV ref confirmation required");
  const client = await connect();
  try {
    const observed = await snapshot(client);
    const status = stateOf(observed, local);
    const summary = {
      project: "salud-plus-turnos-dev",
      ref,
      identity: observed.identity,
      migrationCount: observed.history.length,
      targetVersionPresent: Boolean(observed.record),
      targetLedgerName: observed.record?.name ?? null,
      targetLedgerStatementsMatch: observed.record
        ? isDeepStrictEqual(observed.record.statements, local.statements)
        : null,
      historyVersions: observed.history.map((row) => row.version),
      functions: observed.functions,
      status,
    };
    console.log(`RECONCILE_OBSERVED ${JSON.stringify(summary)}`);
    assert.equal(observed.identity.db, "postgres", "Wrong database");
    assert.equal(observed.identity.role, "postgres", "Wrong role");
    assert.match(observed.identity.version, /^17\.6(?:\D|$)/, "Unexpected PostgreSQL version");
    assert.notEqual(status, "INCONSISTENT", "Migration history and RPC catalog disagree");
    await inspect(client, local, status === "APPLIED_CANDIDATE");
    const repeated = await snapshot(client);
    assert.deepEqual(repeated, observed, "History or RPC catalog changed during reconciliation");
    console.log(
      `RECONCILE_PASS state=${status === "PENDING" ? "PENDING_24_NO_RPCS" : "APPLIED_25_TWO_RPCS"} migrations=${repeated.history.length} strict_catalog=true`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    const message = String(error.message)
      .replaceAll(process.env.TASK021_DEV_DB_PASSWORD ?? "__NO_SECRET__", "[REDACTED]")
      .slice(0, 350);
    console.error(`STOP TASK-021 RECONCILE [${error.code ?? "CHECK"}]: ${message}`);
    process.exitCode = 1;
  });
