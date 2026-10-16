import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import test from "node:test";
import pg from "pg";

const run = promisify(execFile);
const image = "ghcr.io/supabase/postgres:17.6.1.166";
const source = readFileSync("supabase/tests/task-006b-foundation.sql", "utf8").replaceAll(
  "\r\n",
  "\n",
);
const findingMessage = "TASK-006B exposed an unapproved global Professional listing routine";
const messageOffset = source.indexOf(`raise exception '${findingMessage}'`);
assert(messageOffset >= 0, "TASK-006B Professional listing invariant is missing.");
const blockStart = source.lastIndexOf("  if exists (", messageOffset);
const blockEnd = source.indexOf("\n  end if;", messageOffset);
assert(blockStart >= 0 && blockEnd > messageOffset, "TASK-006B invariant cannot be extracted.");
const invariant = source.slice(blockStart, blockEnd + "\n  end if;".length);
const gate = `do $task008_ir01$ begin\n${invariant}\nend $task008_ir01$;`;

test("TASK008-IR-01 allows only the approved Professional list signature", async (t) => {
  const container = `task008-ir01-${randomBytes(6).toString("hex")}`;
  const password = randomBytes(24).toString("base64url");
  let client;
  let started = false;
  try {
    await run(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--pull",
        "never",
        "--name",
        container,
        "--env",
        `POSTGRES_PASSWORD=${password}`,
        "--publish",
        "127.0.0.1::5432",
        image,
      ],
      { timeout: 120_000, windowsHide: true },
    );
    started = true;
    const { stdout } = await run("docker", ["port", container, "5432/tcp"], {
      timeout: 15_000,
      windowsHide: true,
    });
    const port = Number(stdout.trim().match(/:(\d+)$/)?.[1]);
    assert(Number.isInteger(port) && port > 0, "Local PostgreSQL port was not published.");

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const candidate = new pg.Client({
        host: "127.0.0.1",
        port,
        database: "postgres",
        user: "postgres",
        password,
        connectionTimeoutMillis: 1500,
      });
      try {
        await candidate.connect();
        client = candidate;
        break;
      } catch {
        await candidate.end().catch(() => undefined);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
      }
    }
    assert(client, "Disposable PostgreSQL did not become ready.");

    await client.query("begin");
    await client.query(`create function public.staff_list_availability_professional_centers(uuid)
      returns integer language sql as $$select 1$$`);
    await t.test(
      "approved public.staff_list_availability_professional_centers(uuid) passes",
      async () => {
        await client.query(gate);
      },
    );

    await client.query(`create function public.staff_list_availability_professional_centers(uuid,text)
      returns integer language sql as $$select 2$$`);
    await t.test("additional (uuid,text) overload is rejected", async () => {
      await assert.rejects(
        client.query(gate),
        (error) => error?.code === "P0001" && error.message === findingMessage,
      );
    });
    await client.query("rollback");
    const { rows } = await client.query(`select
      to_regprocedure('public.staff_list_availability_professional_centers(uuid)') is null as approved_gone,
      to_regprocedure('public.staff_list_availability_professional_centers(uuid,text)') is null as overload_gone`);
    assert.deepEqual(rows[0], { approved_gone: true, overload_gone: true });
  } finally {
    if (client) {
      await client.query("rollback").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
    if (started) {
      await run("docker", ["rm", "--force", container], {
        timeout: 30_000,
        windowsHide: true,
      }).catch(() => undefined);
      const { stdout } = await run(
        "docker",
        ["ps", "--all", "--filter", `name=^/${container}$`, "--format", "{{.ID}}"],
        { timeout: 15_000, windowsHide: true },
      );
      assert.equal(stdout.trim(), "", "Disposable PostgreSQL container remains after cleanup.");
    }
  }
});
