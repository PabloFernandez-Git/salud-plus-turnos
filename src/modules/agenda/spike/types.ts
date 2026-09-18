import type { View } from "react-big-calendar";

export type SpikeView = Extract<View, "day" | "week" | "month">;

export type ProfessionalId = "ana" | "bruno" | "clara";

export type Professional = {
  id: ProfessionalId;
  name: string;
  specialty: string;
  color: string;
};

export type MockAppointment = {
  id: string;
  title: string;
  professionalId: ProfessionalId;
  start: Date;
  end: Date;
};

export type DaySummary = {
  appointmentCount: number;
  professionalNames: string[];
};
