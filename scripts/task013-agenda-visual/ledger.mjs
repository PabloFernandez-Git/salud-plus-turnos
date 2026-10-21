import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { replaceLedgerFile } from "../task009-gate-d/ledger.mjs";
import { DEV_PROJECT_REF, TASK_ID } from "./plan.mjs";

export const ledgerPath = resolve(".harness/tasks/archive/TASK-013/validation-ledger.json");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stages = new Set([
  "planned",
  "auth_ready",
  "creating",
  "fixtures_ready",
  "browser_running",
  "browser_complete",
  "cleanup_started",
  "database_cleaned",
  "cleaned",
]);
const idKeys = [
  "center",
  "membership",
  "professionalA",
  "professionalB",
  "pcA",
  "pcB",
  "specialtyA",
  "specialtyB",
  "person",
  "patient",
  "appointmentA",
  "appointmentB",
  "appointmentCancelled",
  "appointmentNext",
  "appointmentDstEarly",
  "appointmentDstLate",
];

export function validateLedger(ledger) {
  if (
    ledger?.version !== 1 ||
    ledger.taskId !== TASK_ID ||
    ledger.projectRef !== DEV_PROJECT_REF ||
    !uuid.test(ledger.runId) ||
    !stages.has(ledger.stage) ||
    ledger.centerTimezone !== "America/New_York" ||
    ledger.dstDate !== "2026-11-01" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(ledger.date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(ledger.nextDate) ||
    ledger.authEmail !== `task013-${ledger.runId}@example.test`
  )
    throw new Error("TASK-013 ledger identity or shape differs; STOP");
  if (JSON.stringify(Object.keys(ledger.ids ?? {}).sort()) !== JSON.stringify([...idKeys].sort()))
    throw new Error("Planned UUID keys differ; STOP");
  for (const [key, value] of Object.entries(ledger.ids)) {
    if (!uuid.test(value)) throw new Error(`Invalid planned UUID ${key}; STOP`);
  }
  if (ledger.authUserId !== null && !uuid.test(ledger.authUserId))
    throw new Error("Invalid owned Auth UUID; STOP");
  if (typeof ledger.authDeleted !== "boolean") throw new Error("Invalid Auth cleanup state; STOP");
  if (ledger.browserAppointmentId !== null && !uuid.test(ledger.browserAppointmentId))
    throw new Error("Invalid owned browser Appointment UUID; STOP");
  if (ledger.availabilities?.length !== 5 || ledger.appointments?.length !== 6)
    throw new Error("Fixture bounds differ; STOP");
  for (const row of [...ledger.availabilities, ...ledger.appointments]) {
    if (!uuid.test(row.id)) throw new Error("Invalid fixture row UUID; STOP");
  }
  if (
    JSON.stringify(ledger.appointments.map((row) => row.id)) !==
    JSON.stringify([
      ledger.ids.appointmentA,
      ledger.ids.appointmentB,
      ledger.ids.appointmentCancelled,
      ledger.ids.appointmentNext,
      ledger.ids.appointmentDstEarly,
      ledger.ids.appointmentDstLate,
    ])
  )
    throw new Error("Appointment UUIDs differ from the owned plan; STOP");
  const allIds = [
    ledger.runId,
    ...Object.values(ledger.ids),
    ...ledger.availabilities.map((row) => row.id),
    ...(ledger.authUserId ? [ledger.authUserId] : []),
    ...(ledger.browserAppointmentId ? [ledger.browserAppointmentId] : []),
  ];
  if (new Set(allIds).size !== allIds.length) throw new Error("Fixture UUIDs overlap; STOP");
  if (!Array.isArray(ledger.evidence) || ledger.evidence.length > 20)
    throw new Error("Evidence bounds differ; STOP");
  return ledger;
}

export function readLedger(path = ledgerPath) {
  if (!existsSync(path)) throw new Error("TASK-013 ledger missing; STOP");
  return validateLedger(JSON.parse(readFileSync(path, "utf8")));
}

export function saveLedger(ledger, path = ledgerPath) {
  validateLedger(ledger);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  replaceLedgerFile(temporary, path);
}
