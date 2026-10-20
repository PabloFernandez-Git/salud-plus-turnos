import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const ledgerPath = resolve(".task009-gate-d/fixture-ledger.json");
export const projectRef = "ehllxymqyzrofydrvtzo";
const retryableRenameCodes = new Set(["EPERM", "EACCES", "EBUSY"]);
const retryPause = new Int32Array(new SharedArrayBuffer(4));

export const limits = Object.freeze({
  authUsers: 8,
  publicUsers: 8,
  platformAdmins: 1,
  centers: 4,
  memberships: 9,
  professionals: 3,
  professionalCenters: 3,
  specialties: 3,
  professionalCenterSpecialties: 3,
  availabilities: 18,
  persons: 6,
  patientCenters: 8,
  appointments: 80,
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value, label) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error(`Invalid ${label} UUID`);
  }
}

function assertOwnedKey(kind, id, label) {
  if (kind === "professionalCenterSpecialties") {
    const parts = typeof id === "string" ? id.split("/") : [];
    if (parts.length !== 2) throw new Error(`Invalid ${label} composite key`);
    parts.forEach((part) => assertUuid(part, label));
    return;
  }
  assertUuid(id, label);
}

export function newLedger(baseline) {
  if (!baseline || baseline.projectRef !== projectRef || baseline.resources?.length !== 14) {
    throw new Error("Verified fourteen-resource DEV baseline is required");
  }
  return {
    version: 1,
    projectRef,
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    stage: "planned",
    baseline,
    plannedAuthEmails: [],
    authUserEmailsById: {},
    appointmentIntents: {},
    appointmentIdsByIntent: {},
    planned: Object.fromEntries(Object.keys(limits).map((kind) => [kind, []])),
    owned: Object.fromEntries(Object.keys(limits).map((kind) => [kind, []])),
    cleanup: Object.fromEntries(Object.keys(limits).map((kind) => [kind, []])),
    evidence: [],
  };
}

export function validateLedger(ledger) {
  if (ledger.projectRef !== projectRef || ledger.version !== 1) {
    throw new Error("Gate D ledger project or version mismatch; STOP");
  }
  assertUuid(ledger.runId, "runId");
  if (ledger.baseline?.projectRef !== projectRef || ledger.baseline.resources?.length !== 14) {
    throw new Error("Gate D ledger baseline mismatch; STOP");
  }
  if (
    !Array.isArray(ledger.plannedAuthEmails) ||
    ledger.plannedAuthEmails.length > limits.authUsers ||
    new Set(ledger.plannedAuthEmails).size !== ledger.plannedAuthEmails.length ||
    !ledger.authUserEmailsById ||
    typeof ledger.authUserEmailsById !== "object"
  ) {
    throw new Error("Auth reservations are invalid; STOP");
  }
  if (
    !ledger.appointmentIntents ||
    typeof ledger.appointmentIntents !== "object" ||
    !ledger.appointmentIdsByIntent ||
    typeof ledger.appointmentIdsByIntent !== "object" ||
    Object.keys(ledger.appointmentIntents).length > limits.appointments
  ) {
    throw new Error("Appointment intent ledger is invalid; STOP");
  }
  for (const email of ledger.plannedAuthEmails) {
    if (!new RegExp(`^task009-${ledger.runId}-[a-z0-9]+@example\\.test$`).test(email)) {
      throw new Error("Auth reservation is outside this synthetic run; STOP");
    }
  }
  for (const [kind, limit] of Object.entries(limits)) {
    const planned = ledger.planned?.[kind];
    const owned = ledger.owned?.[kind];
    const cleanup = ledger.cleanup?.[kind];
    if (!Array.isArray(planned) || !Array.isArray(owned) || !Array.isArray(cleanup)) {
      throw new Error(`${kind} ledger arrays missing; STOP`);
    }
    if (planned.length > limit || new Set(planned).size !== planned.length) {
      throw new Error(`${kind} planned limit or uniqueness failed; STOP`);
    }
    for (const id of planned) assertOwnedKey(kind, id, `${kind} planned`);
    for (const [label, values, parent] of [
      [
        "owned",
        owned,
        kind === "authUsers"
          ? Object.keys(ledger.authUserEmailsById)
          : kind === "appointments"
            ? Object.values(ledger.appointmentIdsByIntent)
            : planned,
      ],
      ["cleanup", cleanup, owned],
    ]) {
      if (new Set(values).size !== values.length || values.some((id) => !parent.includes(id))) {
        throw new Error(`${kind} ${label} ownership failed; STOP`);
      }
    }
  }
  for (const [id, email] of Object.entries(ledger.authUserEmailsById)) {
    assertUuid(id, "Auth user");
    if (!ledger.plannedAuthEmails.includes(email) || !ledger.owned.authUsers.includes(id)) {
      throw new Error("Auth user mapping is not owned by this run; STOP");
    }
  }
  if (new Set(Object.values(ledger.authUserEmailsById)).size !== ledger.owned.authUsers.length) {
    throw new Error("Auth email mapping is not unique; STOP");
  }
  for (const [intentId, context] of Object.entries(ledger.appointmentIntents)) {
    assertUuid(intentId, "appointment intent");
    for (const key of ["centerId", "patientCenterId", "professionalCenterId", "specialtyId"]) {
      assertUuid(context?.[key], `appointment intent ${key}`);
    }
    for (const [key, kind] of [
      ["centerId", "centers"],
      ["patientCenterId", "patientCenters"],
      ["professionalCenterId", "professionalCenters"],
      ["specialtyId", "specialties"],
    ]) {
      if (!ledger.owned[kind].includes(context[key])) {
        throw new Error(`Appointment intent references non-owned ${kind}; STOP`);
      }
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(context.localDate) ||
      !/^\d{2}:\d{2}$/.test(context.localTime)
    ) {
      throw new Error("Appointment intent civil time is invalid; STOP");
    }
    if (Number.isNaN(Date.parse(context.reservedAt))) {
      throw new Error("Appointment intent reservation time is invalid; STOP");
    }
  }
  for (const [intentId, appointmentId] of Object.entries(ledger.appointmentIdsByIntent)) {
    if (!Object.hasOwn(ledger.appointmentIntents, intentId)) {
      throw new Error("Appointment UUID lacks a reserved intent; STOP");
    }
    assertUuid(appointmentId, "appointment");
    if (!ledger.owned.appointments.includes(appointmentId)) {
      throw new Error("Appointment mapping lacks ownership; STOP");
    }
  }
  if (
    new Set(Object.values(ledger.appointmentIdsByIntent)).size !== ledger.owned.appointments.length
  ) {
    throw new Error("Appointment mappings are not unique; STOP");
  }
  return ledger;
}

export function readLedger(path = ledgerPath) {
  if (!existsSync(path)) throw new Error("Gate D ledger is missing; STOP");
  return validateLedger(JSON.parse(readFileSync(path, "utf8")));
}

export function replaceLedgerFile(temporary, path, rename = renameSync) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      rename(temporary, path);
      return;
    } catch (error) {
      if (!retryableRenameCodes.has(error.code) || attempt === 39) throw error;
      Atomics.wait(retryPause, 0, 0, 50);
    }
  }
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

export function planOwned(ledger, kind, id) {
  if (!Object.hasOwn(limits, kind)) throw new Error(`Unknown fixture kind: ${kind}`);
  if (kind === "authUsers") throw new Error("Use planAuthEmail before Auth API create");
  if (kind === "appointments") throw new Error("Use planAppointmentIntent before RPC create");
  assertOwnedKey(kind, id, `${kind} planned`);
  if (ledger.planned[kind].includes(id)) return;
  if (ledger.planned[kind].length >= limits[kind]) {
    throw new Error(`${kind} fixture limit would be exceeded; STOP`);
  }
  ledger.planned[kind].push(id);
  saveLedger(ledger);
}

export function markOwned(ledger, kind, id) {
  if (kind === "authUsers") throw new Error("Use markAuthOwned after Auth API create");
  if (kind === "appointments") throw new Error("Use markAppointmentOwned after RPC create");
  assertOwnedKey(kind, id, `${kind} created`);
  if (!ledger.planned[kind]?.includes(id)) {
    throw new Error(`${kind} ${id} was not planned before the write; STOP`);
  }
  if (!ledger.owned[kind].includes(id)) ledger.owned[kind].push(id);
  saveLedger(ledger);
}

export function planAuthEmail(ledger, name) {
  if (!/^[a-z0-9]+$/.test(name)) throw new Error("Invalid synthetic Auth actor name");
  const email = `task009-${ledger.runId}-${name}@example.test`;
  if (ledger.plannedAuthEmails.includes(email)) return email;
  if (ledger.plannedAuthEmails.length >= limits.authUsers) {
    throw new Error("Auth fixture limit would be exceeded; STOP");
  }
  ledger.plannedAuthEmails.push(email);
  saveLedger(ledger);
  return email;
}

export function markAuthOwned(ledger, email, id) {
  assertUuid(id, "Auth user");
  if (!ledger.plannedAuthEmails.includes(email)) {
    throw new Error("Auth email was not reserved before create; STOP");
  }
  if (ledger.owned.authUsers.includes(id)) return;
  if (Object.values(ledger.authUserEmailsById).includes(email)) {
    throw new Error("Auth email already mapped to another UUID; STOP");
  }
  ledger.authUserEmailsById[id] = email;
  ledger.owned.authUsers.push(id);
  saveLedger(ledger);
}

export function planAppointmentIntent(ledger, context) {
  if (Object.keys(ledger.appointmentIntents).length >= limits.appointments) {
    throw new Error("Appointment fixture limit would be exceeded; STOP");
  }
  const intentId = randomUUID();
  ledger.appointmentIntents[intentId] = { ...context, reservedAt: new Date().toISOString() };
  saveLedger(ledger);
  return intentId;
}

export function markAppointmentOwned(ledger, intentId, appointmentId) {
  assertUuid(appointmentId, "appointment");
  if (!Object.hasOwn(ledger.appointmentIntents, intentId)) {
    throw new Error("Appointment intent was not reserved; STOP");
  }
  const existing = ledger.appointmentIdsByIntent[intentId];
  if (existing && existing !== appointmentId) {
    throw new Error("Appointment intent resolved to conflicting UUIDs; STOP");
  }
  if (ledger.owned.appointments.includes(appointmentId) && existing !== appointmentId) {
    throw new Error("Appointment UUID belongs to another intent; STOP");
  }
  ledger.appointmentIdsByIntent[intentId] = appointmentId;
  if (!ledger.owned.appointments.includes(appointmentId))
    ledger.owned.appointments.push(appointmentId);
  saveLedger(ledger);
}

export function markCleaned(ledger, kind, id) {
  assertOwnedKey(kind, id, `${kind} cleanup`);
  if (!ledger.owned[kind]?.includes(id)) {
    throw new Error(`${kind} ${id} is not owned by this run; STOP`);
  }
  if (!ledger.cleanup[kind].includes(id)) ledger.cleanup[kind].push(id);
  saveLedger(ledger);
}
