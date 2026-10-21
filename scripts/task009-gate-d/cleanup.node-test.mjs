import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repo = resolve(".");
const tableKinds = new Map([
  ["public.appointments", "appointments"],
  ["public.availabilities", "availabilities"],
  ["public.patient_centers", "patientCenters"],
  ["public.persons", "persons"],
  ["public.specialties", "specialties"],
  ["public.center_memberships", "memberships"],
  ["public.professional_centers", "professionalCenters"],
  ["public.professionals", "professionals"],
  ["public.platform_admins", "platformAdmins"],
  ["public.centers", "centers"],
  ["public.users", "publicUsers"],
]);

function mockResources(ledger, failDelete = false) {
  const remaining = Object.fromEntries(
    Object.entries(ledger.owned).map(([kind, ids]) => [kind, new Set(ids)]),
  );
  let authDeleted = 0;
  let rolledBack = false;
  const client = {
    async query(sql, params = []) {
      if (/^(BEGIN|COMMIT|SET LOCAL)/.test(sql)) return { rows: [], rowCount: 0 };
      if (sql === "ROLLBACK") {
        rolledBack = true;
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("current_database() as database")) {
        return { rows: [{ database: "postgres", role: "postgres", read_only: "on" }] };
      }
      if (sql.includes("from supabase_migrations.schema_migrations")) {
        return { rows: ledger.baseline.migrations.map((version) => ({ version })) };
      }
      if (sql.includes("md5(coalesce(string_agg")) {
        const resource = sql.match(/from ([\w.]+)$/)?.[1];
        const row = ledger.baseline.resources.find((item) => item.resource === resource);
        assert(row, `Unknown inventory ${resource}`);
        return { rows: [{ row_count: row.rowCount, id_digest: row.idDigest }] };
      }
      if (sql.includes("from auth.users where id=any")) {
        const rows = [...remaining.authUsers].map((id) => ({
          id,
          email: ledger.authUserEmailsById[id],
          gate: "TASK-009",
          run_id: ledger.runId,
        }));
        return { rows, rowCount: rows.length };
      }
      if (sql.startsWith("select 1 from public.professional_center_specialties")) {
        const key = `${params[0]}/${params[1]}`;
        return {
          rows: remaining.professionalCenterSpecialties.has(key) ? [{}] : [],
          rowCount: remaining.professionalCenterSpecialties.has(key) ? 1 : 0,
        };
      }
      if (sql.includes("from public.professional_center_specialties where center_id=any")) {
        const rows = [...remaining.professionalCenterSpecialties].map((key) => ({ key }));
        return { rows, rowCount: rows.length };
      }
      if (sql.startsWith("delete from public.professional_center_specialties")) {
        const key = `${params[0]}/${params[1]}`;
        const present = remaining.professionalCenterSpecialties.delete(key);
        return {
          rows: present ? [{ professional_center_id: params[0] }] : [],
          rowCount: present ? 1 : 0,
        };
      }
      const table = sql.match(/(?:from|delete from) ([\w.]+)/)?.[1];
      const kind = tableKinds.get(table);
      assert(kind, `Unexpected query: ${sql}`);
      const column = kind === "platformAdmins" ? "user_id" : "id";
      if (sql.startsWith("delete")) {
        if (failDelete && kind === "appointments") return { rows: [], rowCount: 0 };
        const rows = params[0]
          .filter((id) => remaining[kind].delete(id))
          .map((id) => ({ [column]: id }));
        return { rows, rowCount: rows.length };
      }
      const rows = [...remaining[kind]].map((id) => ({ [column]: id, id }));
      return { rows, rowCount: rows.length };
    },
  };
  const admin = {
    auth: {
      admin: {
        async getUserById(id) {
          assert(remaining.authUsers.has(id));
          return {
            data: {
              user: {
                id,
                email: ledger.authUserEmailsById[id],
                user_metadata: { gate: "TASK-009", runId: ledger.runId },
              },
            },
          };
        },
        async deleteUser(id) {
          authDeleted++;
          remaining.authUsers.delete(id);
          return { error: null };
        },
      },
    },
  };
  return {
    client,
    admin,
    remaining,
    get authDeleted() {
      return authDeleted;
    },
    get rolledBack() {
      return rolledBack;
    },
  };
}

test("Gate D exact-UUID cleanup completes and stops on a mismatched DELETE", async () => {
  const oldCwd = process.cwd();
  const temporary = join(tmpdir(), `g9-clean-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(temporary, "supabase", "migrations"), { recursive: true });
  try {
    for (const name of readdirSync(join(repo, "supabase", "migrations"))) {
      if (/^\d{14}_.+\.sql$/.test(name)) {
        writeFileSync(join(temporary, "supabase", "migrations", name), "");
      }
    }
    process.chdir(temporary);
    const { cleanupFixtures } = await import("./cleanup.mjs");
    const source = JSON.parse(
      readFileSync(join(repo, ".task009-gate-d", "fixture-ledger.json"), "utf8"),
    );
    const freshLedger = () => {
      const ledger = structuredClone(source);
      ledger.stage = "fixtures_ready";
      for (const kind of Object.keys(ledger.cleanup)) ledger.cleanup[kind] = [];
      delete ledger.finalInventory;
      return ledger;
    };

    const complete = freshLedger();
    const good = mockResources(complete);
    assert.deepEqual(await cleanupFixtures(good.client, good.admin, complete), {
      residueZero: true,
      inventoryRestored: true,
    });
    assert.equal(complete.stage, "cleaned");
    assert.equal(good.authDeleted, 8);
    for (const ids of Object.values(good.remaining)) assert.equal(ids.size, 0);
    assert.deepEqual(complete.finalInventory, complete.baseline);

    const mismatch = freshLedger();
    const bad = mockResources(mismatch, true);
    await assert.rejects(cleanupFixtures(bad.client, bad.admin, mismatch), /cleanup result/);
    assert.equal(bad.rolledBack, true);
    assert.equal(bad.authDeleted, 0);
    assert.equal(mismatch.stage, "cleanup_started");
  } finally {
    process.chdir(oldCwd);
    rmSync(temporary, { recursive: true, force: true });
  }
});
