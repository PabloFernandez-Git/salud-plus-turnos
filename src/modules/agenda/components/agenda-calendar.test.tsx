import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaCalendar } from "./agenda-calendar";

// jsdom has no layout observer; real scrolling is checked in local-visual.mjs.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const centerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";

afterEach(cleanup);

describe("AgendaCalendar", () => {
  it("keeps full event details available with a compact visual label", () => {
    const { container } = render(
      <AgendaCalendar
        centerId={centerId}
        centerName="Centro"
        timezone="America/New_York"
        today="2026-10-28"
        role="ADMIN"
        filters={{ date: "2026-10-28", view: "day" }}
        loadFailed={false}
        professionals={[
          {
            id: professionalId,
            firstName: "Task013",
            lastName: "Profesional A",
            usualAppointmentDurationMinutes: 30,
            updatedAt: "2026-10-01T00:00:00Z",
          },
        ]}
        appointments={[
          {
            id: "a",
            startsAt: "2026-10-28T13:00:00Z",
            endsAt: "2026-10-28T13:30:00Z",
            status: "PENDING",
            patientName: "Paciente Sintético",
            specialtyName: "Clínica",
            professionalCenterId: professionalId,
            professionalName: "Task013 Profesional A",
          },
        ]}
      />,
    );
    const event = container.querySelector(".rbc-event");
    expect(event).toHaveTextContent("Paciente Sintético");
    expect(event).toHaveTextContent("Task013 Profesional A");
    expect(event).toHaveTextContent("Pendiente");
    expect(event?.querySelector(".agenda-event-content")?.getAttribute("title")).toContain(
      "09:00–09:30",
    );
  });

  it("renders the hourly gutter and professional column used by the visual runner", () => {
    const { container } = render(
      <AgendaCalendar
        centerId={centerId}
        centerName="Centro"
        timezone="America/New_York"
        today="2026-10-28"
        role="ADMIN"
        filters={{
          date: "2026-10-28",
          view: "day",
          specialtyId: "33333333-3333-4333-8333-333333333333",
          professionalCenterId: professionalId,
        }}
        loadFailed={false}
        professionals={[
          {
            id: professionalId,
            firstName: "Task013",
            lastName: "Profesional A",
            usualAppointmentDurationMinutes: 30,
            updatedAt: "2026-10-01T00:00:00Z",
          },
        ]}
        appointments={[]}
      />,
    );
    expect(
      container.querySelectorAll(".rbc-time-content .rbc-time-gutter .rbc-timeslot-group"),
    ).toHaveLength(24);
    expect(container.querySelectorAll(".rbc-time-content .rbc-day-slot")).toHaveLength(1);
  });

  it("renders a real monthly summary from Center-local appointments", () => {
    render(
      <AgendaCalendar
        centerId={centerId}
        centerName="Centro"
        timezone="America/Argentina/Buenos_Aires"
        today="2026-10-21"
        role="ADMIN"
        filters={{ date: "2026-10-21", view: "month" }}
        loadFailed={false}
        professionals={[
          {
            id: professionalId,
            firstName: "Luisa",
            lastName: "Vega",
            usualAppointmentDurationMinutes: 30,
            updatedAt: "2026-10-01T00:00:00Z",
          },
        ]}
        appointments={[
          {
            id: "a",
            startsAt: "2026-10-21T12:00:00Z",
            endsAt: "2026-10-21T12:30:00Z",
            status: "PENDING",
            patientName: "Ana Paz",
            specialtyName: "Clínica",
            professionalCenterId: professionalId,
            professionalName: "Luisa Vega",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /21: 1 turno\. Abrir día/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear turno" })).toBeInTheDocument();
  });

  it("lists a Center time that the browser calendar cannot place accurately", () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const { container } = render(
        <AgendaCalendar
          centerId={centerId}
          centerName="Centro"
          timezone="America/Argentina/Buenos_Aires"
          today="2026-03-08"
          role="PROFESSIONAL"
          filters={{ date: "2026-03-08", view: "day" }}
          loadFailed={false}
          professionals={[]}
          appointments={[
            {
              id: "a",
              startsAt: "2026-03-08T05:30:00Z",
              endsAt: "2026-03-08T06:00:00Z",
              status: "PENDING",
              patientName: "Ana Paz",
              specialtyName: "Clínica",
              professionalCenterId: professionalId,
              professionalName: "Mi agenda",
            },
          ]}
        />,
      );
      expect(
        screen.getByRole("heading", { name: "Turnos con horario especial" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^2026-03-08 · 02:30 GMT-3–03:00/ }),
      ).toBeInTheDocument();
      expect(container.querySelectorAll(".rbc-event")).toHaveLength(0);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
