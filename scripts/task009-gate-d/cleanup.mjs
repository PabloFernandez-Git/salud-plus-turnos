import { compareInventory, captureInventory } from "./inventory.mjs";
import { markCleaned, saveLedger } from "./ledger.mjs";

const simpleResources = Object.freeze([
  ["appointments", "public.appointments", "id"],
  ["availabilities", "public.availabilities", "id"],
  ["patientCenters", "public.patient_centers", "id"],
  ["persons", "public.persons", "id"],
  ["specialties", "public.specialties", "id"],
  ["memberships", "public.center_memberships", "id"],
  ["professionalCenters", "public.professional_centers", "id"],
  ["professionals", "public.professionals", "id"],
  ["platformAdmins", "public.platform_admins", "user_id"],
  ["centers", "public.centers", "id"],
  ["publicUsers", "public.users", "id"],
]);

function sameIds(actual, expected, label) {
  const a = [...actual].sort();
  const b = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${label} differs from exact owned UUID set; STOP`);
  }
}

async function selectOwned(client, table, column, ids) {
  if (!ids.length) return [];
  const result = await client.query(
    `select ${column} from ${table} where ${column}=any($1::uuid[])`,
    [ids],
  );
  return result.rows.map((row) => row[column]);
}

export async function auditFixtureOwnership(client, ledger) {
  const authRows = await client.query(
    "select id,email,raw_user_meta_data ->> 'gate' as gate,raw_user_meta_data ->> 'runId' as run_id from auth.users where id=any($1::uuid[])",
    [ledger.owned.authUsers],
  );
  sameIds(
    authRows.rows.map((row) => row.id),
    ledger.owned.authUsers,
    "Auth fixture UUIDs",
  );
  for (const row of authRows.rows) {
    if (
      row.email !== ledger.authUserEmailsById[row.id] ||
      row.gate !== "TASK-009" ||
      row.run_id !== ledger.runId
    ) {
      throw new Error("Auth fixture ownership metadata differs; STOP");
    }
  }
  for (const [kind, table, column] of simpleResources) {
    sameIds(await selectOwned(client, table, column, ledger.owned[kind]), ledger.owned[kind], kind);
  }
  for (const key of ledger.owned.professionalCenterSpecialties) {
    const [pc, specialty] = key.split("/");
    const rows = await client.query(
      "select 1 from public.professional_center_specialties where professional_center_id=$1 and specialty_id=$2",
      [pc, specialty],
    );
    if (rows.rowCount !== 1) throw new Error("Owned PC/Specialty relation missing; STOP");
  }
  for (const [table, column, kind] of [
    ["public.appointments", "center_id", "appointments"],
    ["public.availabilities", "center_id", "availabilities"],
    ["public.center_memberships", "center_id", "memberships"],
    ["public.professional_centers", "center_id", "professionalCenters"],
    ["public.specialties", "center_id", "specialties"],
    ["public.patient_centers", "center_id", "patientCenters"],
  ]) {
    const rows = await client.query(`select id from ${table} where ${column}=any($1::uuid[])`, [
      ledger.owned.centers,
    ]);
    sameIds(
      rows.rows.map((row) => row.id),
      ledger.owned[kind],
      `${table} rows attached to fixture centers`,
    );
  }
  const relations = await client.query(
    "select professional_center_id::text || '/' || specialty_id::text as key from public.professional_center_specialties where center_id=any($1::uuid[])",
    [ledger.owned.centers],
  );
  sameIds(
    relations.rows.map((row) => row.key),
    ledger.owned.professionalCenterSpecialties,
    "PC/Specialty relations attached to fixture centers",
  );
  for (const [table, column, kind] of [
    ["public.center_memberships", "user_id", "memberships"],
    ["public.platform_admins", "user_id", "platformAdmins"],
  ]) {
    const rows = await client.query(
      `select ${kind === "memberships" ? "id" : "user_id"} as id from ${table} where ${column}=any($1::uuid[])`,
      [ledger.owned.authUsers],
    );
    sameIds(
      rows.rows.map((row) => row.id),
      ledger.owned[kind],
      `${table} rows attached to fixture Auth users`,
    );
  }
  return { ownedRowsPresent: true, noUnownedReferencesInFixtureScope: true };
}

async function deleteExact(client, table, column, ids) {
  if (!ids.length) return;
  const rows = await client.query(
    `delete from ${table} where ${column}=any($1::uuid[]) returning ${column}`,
    [ids],
  );
  sameIds(
    rows.rows.map((row) => row[column]),
    ids,
    `${table} cleanup result`,
  );
}

export async function cleanupFixtures(client, admin, ledger) {
  if (!["fixtures_ready", "integrated", "browser_complete"].includes(ledger.stage)) {
    throw new Error(`Cleanup cannot start from ${ledger.stage}; preserve ledger`);
  }
  await auditFixtureOwnership(client, ledger);
  ledger.stage = "cleanup_started";
  saveLedger(ledger);
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    for (const [kind, table, column] of simpleResources) {
      if (kind === "specialties") {
        for (const key of ledger.owned.professionalCenterSpecialties) {
          const [pc, specialty] = key.split("/");
          const result = await client.query(
            "delete from public.professional_center_specialties where professional_center_id=$1 and specialty_id=$2 returning professional_center_id",
            [pc, specialty],
          );
          if (result.rowCount !== 1) throw new Error("PC/Specialty cleanup mismatch; STOP");
        }
      }
      await deleteExact(client, table, column, ledger.owned[kind]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  for (const kind of [
    "appointments",
    "availabilities",
    "patientCenters",
    "persons",
    "professionalCenterSpecialties",
    "specialties",
    "memberships",
    "professionalCenters",
    "professionals",
    "platformAdmins",
    "centers",
    "publicUsers",
  ]) {
    for (const id of ledger.owned[kind]) markCleaned(ledger, kind, id);
  }
  ledger.stage = "database_cleaned";
  saveLedger(ledger);

  for (const id of [...ledger.owned.authUsers].reverse()) {
    const email = ledger.authUserEmailsById[id];
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error || data?.user?.email !== email) {
      throw new Error(`Auth ownership for exact UUID ${id} is uncertain; STOP`);
    }
    if (
      data.user.user_metadata?.gate !== "TASK-009" ||
      data.user.user_metadata?.runId !== ledger.runId
    ) {
      throw new Error(`Auth metadata ownership for exact UUID ${id} differs; STOP`);
    }
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) {
      const found = await client.query("select 1 from auth.users where id=$1", [id]);
      if (found.rowCount) throw new Error(`Auth deletion for exact UUID ${id} failed; STOP`);
    }
    markCleaned(ledger, "authUsers", id);
  }
  const after = await captureInventory(client);
  compareInventory(after, ledger.baseline);
  ledger.stage = "cleaned";
  ledger.finalInventory = after;
  saveLedger(ledger);
  return { residueZero: true, inventoryRestored: true };
}
