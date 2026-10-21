import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import {
  assertPlanAbsent,
  auditOwnership,
  cleanupDatabase,
  insertFixture,
  inspectFixtureState,
} from "./database.mjs";
import { saveLedger } from "./ledger.mjs";
import { makePlan } from "./plan.mjs";

const authId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

class SimulatedPg {
  constructor() {
    this.tables = new Map();
    this.assignments = new Map();
    this.auth = new Map();
    this.transaction = null;
  }
  table(name) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name);
  }
  result(rows) {
    return { rows, rowCount: rows.length };
  }
  async query(sql, params = []) {
    const statement = sql.trim().toLowerCase();
    if (statement === "begin") {
      this.transaction = structuredClone({ tables: this.tables, assignments: this.assignments });
      return this.result([]);
    }
    if (statement === "commit") {
      this.transaction = null;
      return this.result([]);
    }
    if (statement === "rollback") {
      if (this.transaction) {
        this.tables = this.transaction.tables;
        this.assignments = this.transaction.assignments;
      }
      this.transaction = null;
      return this.result([]);
    }
    if (statement.startsWith("set local")) return this.result([]);
    if (statement.startsWith("insert into public.professional_center_specialties")) {
      const [pc, specialty, center] = params;
      const key = `${pc}/${specialty}`;
      if (this.assignments.has(key)) throw new Error("duplicate assignment");
      this.assignments.set(key, {
        professional_center_id: pc,
        specialty_id: specialty,
        center_id: center,
      });
      return this.result([]);
    }
    if (statement.startsWith("insert into public.")) {
      const table = statement.match(/^insert into (public\.[a-z_]+)/)?.[1];
      if (!table) throw new Error(`Unrecognized insert: ${sql}`);
      const row = { id: params[0] };
      if (table === "public.users") {
        if (!statement.startsWith("insert into public.users(id,email,") || !params[1])
          throw new Error('null value in column "email" of relation "users"');
        if (params[1] !== this.auth.get(params[0])?.email)
          throw new Error("public.users email differs from synthetic Auth user");
        row.email = params[1];
      }
      if (table === "public.center_memberships")
        Object.assign(row, { center_id: params[1], user_id: params[2] });
      if (table === "public.professional_centers")
        Object.assign(row, { professional_id: params[1], center_id: params[2] });
      if (table === "public.specialties") row.center_id = params[1];
      if (table === "public.availabilities")
        Object.assign(row, { professional_center_id: params[1], center_id: params[2] });
      if (table === "public.patient_centers")
        Object.assign(row, { person_id: params[1], center_id: params[2] });
      if (table === "public.appointments")
        Object.assign(row, {
          center_id: params[1],
          patient_center_id: params[2],
          professional_center_id: params[3],
          specialty_id: params[4],
        });
      if (this.table(table).has(row.id)) throw new Error(`duplicate ${table}`);
      this.table(table).set(row.id, row);
      return this.result([]);
    }
    if (statement.startsWith("select 1 from public.professional_center_specialties")) {
      const keys = [`${params[0]}/${params[1]}`, `${params[2]}/${params[3]}`];
      return this.result(
        keys.filter((key) => this.assignments.has(key)).map(() => ({ "?column?": 1 })),
      );
    }
    if (
      statement.startsWith(
        "select professional_center_id, specialty_id from public.professional_center_specialties",
      )
    )
      return this.result(
        [...this.assignments.values()].filter((row) => row.center_id === params[0]),
      );
    if (statement.startsWith("select professional_center_id::text"))
      return this.result(
        [...this.assignments.values()]
          .filter((row) => row.center_id === params[0])
          .map((row) => ({ key: `${row.professional_center_id}/${row.specialty_id}` })),
      );
    if (statement.startsWith("delete from public.professional_center_specialties")) {
      const rows = [...this.assignments.entries()].filter(([, row]) => row.center_id === params[0]);
      for (const [key] of rows) this.assignments.delete(key);
      return this.result(rows.map(([key]) => ({ key })));
    }
    if (statement.startsWith("select id,email,raw_user_meta_data"))
      return this.result(
        [this.auth.get(params[0])]
          .filter(Boolean)
          .map((row) => ({ id: row.id, email: row.email, task_id: row.taskId, run_id: row.runId })),
      );
    if (statement.startsWith("select id from auth.users where email="))
      return this.result(
        [...this.auth.values()]
          .filter((row) => row.email === params[0])
          .map((row) => ({ id: row.id })),
      );
    if (
      statement.startsWith(
        "select id from public.appointments where center_id=$1 and patient_center_id=",
      )
    )
      return this.result([]);
    const table = statement.match(
      /(?:select|delete) [\s\S]+? (?:from )?(public\.[a-z_]+) where /,
    )?.[1];
    if (!table) throw new Error(`Unrecognized query: ${sql}`);
    const rows = [...this.table(table).values()];
    if (statement.startsWith("select ")) {
      const column = statement.match(/^select ([a-z_]+) from /)?.[1];
      if (statement.includes("=any($1::uuid[])")) {
        const field = statement.match(/where ([a-z_]+)=any/)?.[1];
        return this.result(
          rows
            .filter((row) => params[0].includes(row[field]))
            .map((row) => ({ [column]: row[column] })),
        );
      }
      const field = statement.match(/where ([a-z_]+)=\$1/)?.[1];
      return this.result(
        rows.filter((row) => row[field] === params[0]).map((row) => ({ [column]: row[column] })),
      );
    }
    if (statement.startsWith("delete ")) {
      const field = statement.match(/where ([a-z_]+)=any/)?.[1];
      const selected = rows.filter((row) => params[0].includes(row[field]));
      for (const row of selected) this.table(table).delete(row.id);
      return this.result(selected.map((row) => ({ [field]: row[field] })));
    }
    throw new Error(`Unrecognized SQL: ${sql}`);
  }
}

function tempPath() {
  const root = mkdtempSync(join(tmpdir(), "task013-db-sim-"));
  const child = relative(resolve(tmpdir()), resolve(root));
  if (
    !child ||
    child.startsWith("..") ||
    child.includes(`..${sep}`) ||
    !/^task013-db-sim-[A-Za-z0-9]+$/.test(child)
  )
    throw new Error("Simulated DB path escaped temp directory");
  return { root, path: join(root, "ledger.json") };
}

test("SQL fixture adapter commits, audits and removes the exact isolated Center", async () => {
  const { root, path } = tempPath();
  try {
    const db = new SimulatedPg();
    const plan = makePlan({ now: new Date("2026-10-21T12:00:00Z") });
    await assertPlanAbsent(db, plan);
    db.auth.set(authId, {
      id: authId,
      email: plan.authEmail,
      taskId: "TASK-013",
      runId: plan.runId,
    });
    plan.authUserId = authId;
    plan.stage = "auth_ready";
    saveLedger(plan, path);
    await insertFixture(db, plan, path);
    assert.equal(await inspectFixtureState(db, plan), "complete");
    await auditOwnership(db, plan);
    await cleanupDatabase(db, plan, path);
    assert.equal(await inspectFixtureState(db, plan), "absent");
    assert.equal([...db.tables.values()].flatMap((table) => [...table.values()]).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("SQL fixture adapter refuses cleanup after an unowned Center row appears", async () => {
  const { root, path } = tempPath();
  try {
    const db = new SimulatedPg();
    const plan = makePlan({ now: new Date("2026-10-21T12:00:00Z") });
    db.auth.set(authId, {
      id: authId,
      email: plan.authEmail,
      taskId: "TASK-013",
      runId: plan.runId,
    });
    plan.authUserId = authId;
    plan.stage = "auth_ready";
    saveLedger(plan, path);
    await insertFixture(db, plan, path);
    db.table("public.appointments").set("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      center_id: plan.ids.center,
    });
    await assert.rejects(cleanupDatabase(db, plan, path), /attached to Center differs/);
    assert.equal(db.table("public.centers").has(plan.ids.center), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
