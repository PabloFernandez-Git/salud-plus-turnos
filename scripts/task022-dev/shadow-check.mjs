// Smoke test of the new deployment runner against an isolated loopback shadow.
// Never accepts a hosted/project URL or accesses Supabase DEV.
import assert from "node:assert/strict";
import pg from "pg";
import { applyExactlyOne, localChecks, readOnlyPreflight } from "./gate.mjs";

assert(process.env.TASK022_SHADOW_URL, "TASK022_SHADOW_URL must be set for the local shadow");
const url = new URL(process.env.TASK022_SHADOW_URL);
assert.equal(url.protocol, "postgresql:");
assert(["127.0.0.1", "localhost"].includes(url.hostname));
assert.equal(url.port, "55422");
assert.equal(url.pathname, "/postgres");
assert.equal(decodeURIComponent(url.username), "postgres");
assert.equal(url.search, "");
assert.equal(url.hash, "");

const local = localChecks();
const client = new pg.Client({
  connectionString: url.toString(),
  ssl: false,
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  await client.query("create schema if not exists supabase_migrations");
  await client.query(`
    create table if not exists supabase_migrations.schema_migrations
      (version text primary key, statements text[], name text)
  `);
  const initial = (
    await client.query("select version from supabase_migrations.schema_migrations order by version")
  ).rows.map((row) => row.version);
  if (initial.length === 0) {
    for (const priorVersion of local.priorVersions) {
      await client.query("insert into supabase_migrations.schema_migrations(version) values($1)", [
        priorVersion,
      ]);
    }
  } else {
    assert.deepEqual(initial, local.priorVersions);
  }
  const before = await readOnlyPreflight(client, local);
  await applyExactlyOne(client, local, before);
  console.log("TASK022_SHADOW_RUNNER_PASS prior=23 applied=1 postcheck=PASS");
} finally {
  await client.end().catch(() => undefined);
}
