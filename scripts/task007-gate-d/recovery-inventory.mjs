// Read-only inventory for the single interrupted run. No ledger is created here.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { assert, devClients, openDatabase } from "./fixture-core.mjs";

const runId = "c9818e40-2d4d-4c1b-a392-14a9404a5111";
const centerA = "8677b5f1-9c45-4501-8bd3-3561c6cf8b64";
const centerB = "67109b95-4646-41e1-b2fc-b647fcc5e2d4";
const actorNames = ["admina", "receptiona", "adminb", "professionala", "inactivea", "platformonly"];
const emails = actorNames.map((name) => `task007d-${runId}-${name}@example.test`);
const documents = [
  "PRIV",
  "UNLINK",
  "MANUAL-LINK",
  "RACE",
  "CREATE-RACE",
  "CREATE-LINK-RACE",
  "LINK-RACE",
  "UI",
  "SMOKE",
].map((name) => `${name}-${runId}`);

export async function readScopedInventory(database, projectRef) {
  assert(projectRef === "ehllxymqyzrofydrvtzo", "Unexpected DEV project");
  const rows = async (sql, params) => (await database.query(sql, params)).rows;
  const authUsers = await rows(
    "select id,email from auth.users where email=any($1::text[]) order by email",
    [emails],
  );
  const actorIds = authUsers.map((row) => row.id);
  const centers = await rows(
    "select id,name,is_active from public.centers where id=any($1::uuid[]) or name=$2 order by id",
    [[centerA, centerB], `TASK-007D inactive ${runId}`],
  );
  const centerIds = centers.map((row) => row.id);
  const publicUsers = await rows(
    "select id,email from public.users where email=any($1::text[]) or id=any($2::uuid[]) order by id",
    [emails, actorIds],
  );
  const memberships = await rows(
    "select id,center_id,user_id,role,professional_center_id,is_active from public.center_memberships where center_id=any($1::uuid[]) or user_id=any($2::uuid[]) order by id",
    [centerIds, actorIds],
  );
  const professionals = await rows(
    "select id,nationality_code,document_number,email from public.professionals where document_number=$1 and nationality_code='AR' order by id",
    [`P-${runId}`],
  );
  const professionalCenters = await rows(
    "select id,professional_id,center_id from public.professional_centers where center_id=any($1::uuid[]) or professional_id=any($2::uuid[]) order by id",
    [centerIds, professionals.map((row) => row.id)],
  );
  const platformAdmins = await rows(
    "select user_id from public.platform_admins where user_id=any($1::uuid[]) order by user_id",
    [actorIds],
  );
  const persons = await rows(
    "select id,first_name,last_name,birth_date::text as birth_date,nationality_code,document_number from public.persons where document_number=any($1::text[]) and nationality_code='AR' order by document_number",
    [documents],
  );
  const personIds = persons.map((row) => row.id);
  const patientCenters = await rows(
    "select id,person_id,center_id,phone,email,insurance_name,administrative_notes,is_active from public.patient_centers where center_id=any($1::uuid[]) or person_id=any($2::uuid[]) order by id",
    [centerIds, personIds],
  );
  const countTables = [
    "auth.users",
    "public.users",
    "public.centers",
    "public.center_memberships",
    "public.persons",
    "public.patient_centers",
    "public.professionals",
    "public.professional_centers",
    "public.platform_admins",
    "public.appointments",
  ];
  const counts = {};
  for (const table of countTables) {
    counts[table] = Number((await rows(`select count(*)::int as n from ${table}`))[0].n);
  }
  const references = {};
  for (const [table, column, ids] of [
    ["public.appointments", "center_id", centerIds],
    ["public.appointments", "patient_center_id", patientCenters.map((row) => row.id)],
    ["public.specialties", "center_id", centerIds],
    ["public.availabilities", "center_id", centerIds],
    ["public.professional_center_specialties", "center_id", centerIds],
  ]) {
    references[`${table}.${column}`] = Number(
      (
        await rows(`select count(*)::int as n from ${table} where ${column}=any($1::uuid[])`, [ids])
      )[0].n,
    );
  }
  return {
    projectRef,
    runId,
    scope: { centerA, centerB, actorEmails: emails, documents },
    counts,
    authUsers,
    publicUsers,
    centers,
    memberships,
    professionals,
    professionalCenters,
    platformAdmins,
    persons,
    patientCenters,
    references,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { dev } = devClients();
  assert(dev.projectRef === "ehllxymqyzrofydrvtzo", "Unexpected DEV project");
  const database = await openDatabase(dev, "recovery-inventory");
  try {
    await database.query("begin read only");
    const snapshot = await readScopedInventory(database, dev.projectRef);
    await database.query("rollback");
    console.log(JSON.stringify(snapshot, null, 2));
  } finally {
    await database.query("rollback").catch(() => undefined);
    await database.end();
  }
}
