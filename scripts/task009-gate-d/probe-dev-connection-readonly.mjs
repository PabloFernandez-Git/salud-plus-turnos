import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { openDevDatabase, safeConnectionDiagnostic } from "./dev-connection.mjs";
import { ledgerPath, projectRef } from "./ledger.mjs";

assert.equal(process.argv.length, 2, "Run the connection probe without arguments");
assert.equal(existsSync(ledgerPath), false, "Fixture ledger exists; STOP and inspect it first");

const client = await openDevDatabase("read-only-probe");
let transactionOpen = false;
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  transactionOpen = true;
  await client.query("SET LOCAL statement_timeout = '5s'");
  const result = await client.query(
    "select current_database() as database, current_user as role, current_setting('server_version') as version, current_setting('transaction_read_only') as read_only",
  );
  const identity = result.rows[0];
  assert.equal(identity.database, "postgres");
  assert.equal(identity.role, "postgres");
  assert.equal(identity.read_only, "on");
  console.log(
    JSON.stringify({
      result: "TASK009_DEV_CONNECTION_READ_ONLY_PASS",
      projectRef,
      database: identity.database,
      role: identity.role,
      readOnly: identity.read_only,
      serverVersion: identity.version,
    }),
  );
} catch (error) {
  const diagnostic = safeConnectionDiagnostic(
    error,
    process.env.SUPABASE_DB_PASSWORD ?? "",
    "read-only probe",
  );
  throw new Error(
    `DEV PostgreSQL ${diagnostic.phase} failed [${diagnostic.code}]: ${diagnostic.message}`,
  );
} finally {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
  await client.end().catch(() => undefined);
}
