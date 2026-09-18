import type { DaySummary, MockAppointment, Professional, ProfessionalId } from "./types";

function localDate(day: number, hour = 12, minute = 0) {
  return new Date(2026, 3, day, hour, minute, 0, 0);
}

export const REFERENCE_DATE = localDate(15);

export const PROFESSIONALS: Professional[] = [
  {
    id: "ana",
    name: "Dra. Ana Torres",
    specialty: "Clínica médica",
    color: "#2563eb",
  },
  {
    id: "bruno",
    name: "Dr. Bruno Silva",
    specialty: "Cardiología",
    color: "#7c3aed",
  },
  {
    id: "clara",
    name: "Dra. Clara Méndez",
    specialty: "Dermatología",
    color: "#047857",
  },
];

export const MOCK_APPOINTMENTS: MockAppointment[] = [
  {
    id: "wed-ana-20",
    title: "Turno de 20 min",
    professionalId: "ana",
    start: localDate(15, 9, 0),
    end: localDate(15, 9, 20),
  },
  {
    id: "wed-bruno-30",
    title: "Turno de 30 min",
    professionalId: "bruno",
    start: localDate(15, 9, 30),
    end: localDate(15, 10, 0),
  },
  {
    id: "wed-clara-45",
    title: "Turno de 45 min",
    professionalId: "clara",
    start: localDate(15, 10, 15),
    end: localDate(15, 11, 0),
  },
  {
    id: "mon-clara",
    title: "Control",
    professionalId: "clara",
    start: localDate(13, 11, 0),
    end: localDate(13, 11, 30),
  },
  {
    id: "tue-ana-overlap",
    title: "Consulta simultánea",
    professionalId: "ana",
    start: localDate(14, 10, 0),
    end: localDate(14, 10, 45),
  },
  {
    id: "tue-bruno-overlap",
    title: "Control simultáneo",
    professionalId: "bruno",
    start: localDate(14, 10, 0),
    end: localDate(14, 10, 30),
  },
  {
    id: "thu-bruno",
    title: "Seguimiento",
    professionalId: "bruno",
    start: localDate(16, 14, 0),
    end: localDate(16, 14, 30),
  },
  {
    id: "fri-ana",
    title: "Consulta",
    professionalId: "ana",
    start: localDate(17, 8, 30),
    end: localDate(17, 9, 0),
  },
  {
    id: "next-month-clara",
    title: "Control mensual",
    professionalId: "clara",
    start: new Date(2026, 4, 5, 10, 0, 0, 0),
    end: new Date(2026, 4, 5, 10, 30, 0, 0),
  },
];

export const ALL_PROFESSIONAL_IDS = PROFESSIONALS.map(({ id }) => id);

export function getProfessional(professionalId: ProfessionalId) {
  const professional = PROFESSIONALS.find(({ id }) => id === professionalId);

  if (!professional) {
    throw new Error(`Profesional ficticio no encontrado: ${professionalId}`);
  }

  return professional;
}

export function filterAppointments(professionalIds: ProfessionalId[]) {
  return MOCK_APPOINTMENTS.filter(({ professionalId }) => professionalIds.includes(professionalId));
}

export function getAppointmentDurationMinutes(appointment: MockAppointment) {
  return (appointment.end.getTime() - appointment.start.getTime()) / 60_000;
}

export function getDaySummary(date: Date, appointments: MockAppointment[]): DaySummary {
  const dayAppointments = appointments.filter(
    ({ start }) =>
      start.getFullYear() === date.getFullYear() &&
      start.getMonth() === date.getMonth() &&
      start.getDate() === date.getDate(),
  );
  const professionalNames = Array.from(
    new Set(dayAppointments.map(({ professionalId }) => getProfessional(professionalId).name)),
  );

  return {
    appointmentCount: dayAppointments.length,
    professionalNames,
  };
}
