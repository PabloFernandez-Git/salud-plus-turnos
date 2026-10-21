import { randomUUID } from "node:crypto";

export const TASK_ID = "TASK-013";
export const DEV_PROJECT_REF = "ehllxymqyzrofydrvtzo";
export const CENTER_TIMEZONE = "America/New_York";
export const DST_DATE = "2026-11-01";

function addDays(date, amount) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function weekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
}

export function makePlan({ now = new Date(), runId = randomUUID() } = {}) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const piece = (type) => parts.find((item) => item.type === type)?.value;
  const today = `${piece("year")}-${piece("month")}-${piece("day")}`;
  // Keep the two populated dates in the same calendar week on any run date.
  const date = addDays(today, 7 + ((3 - weekday(today) + 7) % 7));
  const nextDate = addDays(date, 1);
  const id = Object.fromEntries(
    [
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
    ].map((key) => [key, randomUUID()]),
  );
  const availabilities = [
    { id: randomUUID(), pc: id.pcA, weekday: weekday(date), start: "09:00", end: "13:00" },
    { id: randomUUID(), pc: id.pcB, weekday: weekday(date), start: "09:00", end: "13:00" },
    { id: randomUUID(), pc: id.pcA, weekday: weekday(nextDate), start: "09:00", end: "13:00" },
    { id: randomUUID(), pc: id.pcB, weekday: weekday(nextDate), start: "09:00", end: "13:00" },
    { id: randomUUID(), pc: id.pcA, weekday: 7, start: "00:30", end: "03:30" },
  ];
  return {
    version: 1,
    taskId: TASK_ID,
    projectRef: DEV_PROJECT_REF,
    runId,
    createdAt: new Date().toISOString(),
    stage: "planned",
    centerTimezone: CENTER_TIMEZONE,
    date,
    nextDate,
    dstDate: DST_DATE,
    ids: id,
    authEmail: `task013-${runId}@example.test`,
    authUserId: null,
    authDeleted: false,
    browserAppointmentId: null,
    availabilities,
    appointments: [
      {
        id: id.appointmentA,
        pc: id.pcA,
        specialty: id.specialtyA,
        date,
        time: "09:00",
        status: "PENDING",
      },
      {
        id: id.appointmentB,
        pc: id.pcB,
        specialty: id.specialtyB,
        date,
        time: "09:00",
        status: "CONFIRMED",
      },
      {
        id: id.appointmentCancelled,
        pc: id.pcA,
        specialty: id.specialtyA,
        date,
        time: "10:00",
        status: "CANCELLED",
      },
      {
        id: id.appointmentNext,
        pc: id.pcA,
        specialty: id.specialtyA,
        date: nextDate,
        time: "11:00",
        status: "ATTENDED",
      },
      {
        id: id.appointmentDstEarly,
        pc: id.pcA,
        specialty: id.specialtyA,
        instant: "2026-11-01T05:30:00Z",
        status: "PENDING",
      },
      {
        id: id.appointmentDstLate,
        pc: id.pcA,
        specialty: id.specialtyA,
        instant: "2026-11-01T06:30:00Z",
        status: "CONFIRMED",
      },
    ],
    baseline: null,
    evidence: [],
    cleanup: null,
  };
}
