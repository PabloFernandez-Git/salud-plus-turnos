import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { openDevDatabase } from "../task009-gate-d/dev-connection.mjs";
import { captureInventory, compareInventory } from "../task009-gate-d/inventory.mjs";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "../lib/supabase-dev-env.mjs";
import {
  assertPlanAbsent,
  cleanupDatabase,
  insertFixture,
  inspectFixtureState,
  reconcileBrowserAppointment,
} from "./database.mjs";
import { cleanupOwned, executeValidation } from "./flow.mjs";
import { ledgerPath, readLedger, saveLedger } from "./ledger.mjs";
import { DEV_PROJECT_REF } from "./plan.mjs";

const mode = process.argv[2];
if (!["--execute", "--recover"].includes(mode) || process.argv.length !== 3)
  throw new Error("Use exactly --execute or --recover");
if (process.env.TASK013_DEV_WRITE_AUTHORIZATION !== "TASK-013-VISUAL-DEV-APPROVED")
  throw new Error("Explicit TASK-013 DEV write authorization is missing; STOP");

function runChild(args, env = process.env) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: resolve("."),
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolveResult() : reject(new Error(`Local child exited ${code}`)),
    );
  });
}

async function buildWithoutChangingNextEnv() {
  const path = resolve("next-env.d.ts");
  const original = readFileSync(path);
  const env = { ...process.env };
  delete env.SUPABASE_DB_PASSWORD;
  delete env.TASK013_DEV_WRITE_AUTHORIZATION;
  try {
    await runChild([resolve("node_modules/next/dist/bin/next"), "build"], env);
  } finally {
    if (!readFileSync(path).equals(original)) writeFileSync(path, original);
    if (!readFileSync(path).equals(original))
      throw new Error("next-env.d.ts could not be restored");
  }
}

async function main() {
  const dev = loadSupabaseDevConfig();
  assertLinkedSupabaseProject();
  if (dev.projectRef !== DEV_PROJECT_REF) throw new Error("DEV project differs; STOP");
  if (!process.env.SUPABASE_DB_PASSWORD?.trim() || !process.env.SUPABASE_SECRET_KEY?.trim())
    throw new Error("Existing DEV database password and Auth Admin key are required");
  if (mode === "--execute") {
    if (existsSync(ledgerPath))
      throw new Error("Existing TASK-013 ledger; recover or inspect before new run");
    await buildWithoutChangingNextEnv();
  } else if (!existsSync(ledgerPath)) {
    throw new Error("No TASK-013 ledger to recover");
  }
  const admin = createClient(dev.url, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const db = await openDevDatabase("agenda-visual");
  const password = `Task013-${randomBytes(24).toString("base64url")}Aa1!`;
  const adapters = {
    async preflight() {
      const result = await admin.auth.admin.getUserById("00000000-0000-4000-8000-000000000000");
      if (result.data?.user || result.error?.status !== 404)
        throw new Error("DEV Auth Admin read-only probe failed; STOP");
    },
    captureInventory: () => captureInventory(db),
    compareInventory: (after, before) => compareInventory(after, before),
    assertPlanAbsent: (plan) => assertPlanAbsent(db, plan),
    inspectFixtureState: (ledger) => inspectFixtureState(db, ledger),
    insertFixture: (ledger, path) => insertFixture(db, ledger, path),
    reconcileBrowserAppointment: (ledger, path) => reconcileBrowserAppointment(db, ledger, path),
    cleanupDatabase: (ledger, path) => cleanupDatabase(db, ledger, path),
    async createAuth(ledger) {
      const created = await admin.auth.admin.createUser({
        email: ledger.authEmail,
        password,
        email_confirm: true,
        user_metadata: { taskId: "TASK-013", runId: ledger.runId },
      });
      if (created.data?.user?.id && created.data.user.email === ledger.authEmail)
        return created.data.user.id;
      const found = await db.query(
        "select id from auth.users where email=$1 and raw_user_meta_data ->> 'taskId'='TASK-013' and raw_user_meta_data ->> 'runId'=$2",
        [ledger.authEmail, ledger.runId],
      );
      if (found.rowCount !== 1) throw new Error("Auth CREATE outcome uncertain; preserve ledger");
      return found.rows[0].id;
    },
    async assertAuthAbsent(ledger) {
      const found = await db.query("select id from auth.users where email=$1", [ledger.authEmail]);
      if (found.rowCount) throw new Error("Synthetic Auth user exists without owned UUID; STOP");
    },
    async deleteAuth(ledger) {
      const found = await admin.auth.admin.getUserById(ledger.authUserId);
      if (found.error?.status === 404) {
        await this.assertAuthAbsent(ledger);
        return;
      }
      const user = found.data?.user;
      if (
        found.error ||
        user?.email !== ledger.authEmail ||
        user.user_metadata?.taskId !== "TASK-013" ||
        user.user_metadata?.runId !== ledger.runId
      )
        throw new Error("Synthetic Auth ownership mismatch; STOP");
      const deleted = await admin.auth.admin.deleteUser(ledger.authUserId);
      if (deleted.error) {
        const remains = await db.query("select id from auth.users where id=$1", [
          ledger.authUserId,
        ]);
        if (remains.rowCount) throw new Error("Exact synthetic Auth deletion failed; STOP");
      }
      await this.assertAuthAbsent(ledger);
    },
    async runBrowser(ledger, path) {
      const evidenceDir = resolve(".harness/tasks/archive/TASK-013/evidence", ledger.runId);
      if (existsSync(evidenceDir)) throw new Error("Evidence directory already exists; STOP");
      mkdirSync(evidenceDir, { recursive: true });
      const env = {
        ...process.env,
        TASK013_LEDGER_PATH: path,
        TASK013_TEST_PASSWORD: password,
        TASK013_EVIDENCE_DIR: evidenceDir,
        CI: "1",
      };
      for (const key of [
        "SUPABASE_DB_PASSWORD",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "TASK013_DEV_WRITE_AUTHORIZATION",
      ])
        delete env[key];
      try {
        await runChild(
          [
            resolve("node_modules/@playwright/test/cli.js"),
            "test",
            "tests/e2e/task-013-agenda.spec.mjs",
            "--config",
            "playwright.task013.config.ts",
            "--workers=1",
          ],
          env,
        );
      } finally {
        const images = readdirSync(evidenceDir).filter((name) => name.endsWith(".png"));
        ledger.evidence = images.map((name) => ({
          file: name,
          sha256: createHash("sha256")
            .update(readFileSync(resolve(evidenceDir, name)))
            .digest("hex"),
        }));
        saveLedger(ledger, path);
      }
      if (ledger.evidence.length !== 13) throw new Error("Required visual evidence is incomplete");
    },
  };
  try {
    if (mode === "--execute") {
      const result = await executeValidation({ adapters, ledgerPath });
      console.log(
        `TASK013_VISUAL_PASS runId=${result.runId}; cleanup=exact; evidence=${result.evidence.length}`,
      );
    } else {
      const ledger = readLedger();
      await adapters.preflight(ledger);
      await cleanupOwned({ adapters, ledger, ledgerPath });
      console.log(`TASK013_RECOVERY_CLEANED runId=${ledger.runId}`);
    }
  } finally {
    await db.end();
  }
}

await main();
