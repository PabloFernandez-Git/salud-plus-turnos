import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const centerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";

afterEach(cleanup);

describe("AgendaCalendar", () => {
  it.each([
    { date: "2026-11-18", view: "day", title: "miércoles, 18 de noviembre de 2026" },
    { date: "2026-11-18", view: "week", title: "Semana del 16 al 22 de noviembre de 2026" },
    {
      date: "2026-11-30",
      view: "week",
      title: "Semana del 30 de noviembre al 6 de diciembre de 2026",
    },
    {
      date: "2026-12-31",
      view: "week",
      title: "Semana del 28 de diciembre de 2026 al 3 de enero de 2027",
    },
    { date: "2026-11-18", view: "month", title: "Noviembre de 2026" },
    { date: "2026-12-18", view: "month", title: "Diciembre de 2026" },
    { date: "2027-01-18", view: "month", title: "Enero de 2027" },
  ] as const)("shows the visible $view period for $date", ({ date, view, title }) => {
    render(
      <AgendaCalendar
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        today={date}
        role="ADMIN"
        filters={{ date, view }}
        loadFailed={false}
        professionals={[]}
        appointments={[]}
      />,
    );
    expect(screen.getByText(title)).toBeVisible();
  });

  it.each([
    {
      view: "day",
      dates: ["18/11/2026 – 19/11/2026"],
    },
    {
      view: "week",
      dates: ["14/11/2026 – 16/11/2026", "18/11/2026 – 19/11/2026", "21/11/2026"],
    },
    {
      view: "month",
      dates: [
        "14/11/2026 – 16/11/2026",
        "18/11/2026 – 19/11/2026",
        "21/11/2026",
        "24/11/2026 – 26/11/2026",
      ],
    },
  ] as const)(
    "shows only intersecting blocks in $view while keeping the professional filter",
    ({ view, dates }) => {
      const ranges = [
        ["2026-11-14", "2026-11-16"],
        ["2026-11-18", "2026-11-19"],
        ["2026-11-21", "2026-11-21"],
        ["2026-11-24", "2026-11-26"],
        ["2026-12-01", "2026-12-01"],
        ["2026-11-18", "2026-11-18"],
      ];
      render(
        <AgendaCalendar
          centerId={centerId}
          centerName="Centro"
          timezone="UTC"
          today="2026-11-18"
          role="ADMIN"
          filters={{ date: "2026-11-18", view, professionalCenterId: professionalId }}
          loadFailed={false}
          professionals={[]}
          appointments={[]}
          blocks={ranges.map(([startDate, endDate], index) => ({
            id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
            professionalCenterId:
              index === 5 ? "44444444-4444-4444-8444-444444444444" : professionalId,
            startDate,
            endDate,
            reason: "VACATION",
            updatedAt: "2026-11-01T00:00:00Z",
          }))}
        />,
      );
      const notice = screen.getByLabelText("Bloqueos excepcionales");
      expect([...notice.querySelectorAll("li strong")].map((item) => item.textContent)).toEqual(
        dates,
      );
    },
  );

  it.each(["day", "week", "month"] as const)(
    "distinguishes exceptional blocks from booked appointments in %s view",
    (view) => {
      const { container } = render(
        <AgendaCalendar
          centerId={centerId}
          centerName="Centro"
          timezone="Pacific/Auckland"
          today="2026-10-21"
          role="ADMIN"
          filters={{ date: "2026-10-21", view, professionalCenterId: professionalId }}
          loadFailed={false}
          professionals={[
            {
              id: professionalId,
              firstName: "Ana",
              lastName: "Pérez",
              usualAppointmentDurationMinutes: 30,
              updatedAt: "2026-10-01T00:00:00Z",
            },
          ]}
          appointments={[]}
          blocks={[
            {
              id: "33333333-3333-4333-8333-333333333333",
              professionalCenterId: professionalId,
              startDate: "2026-10-21",
              endDate: "2026-10-22",
              reason: "VACATION",
              updatedAt: "2026-10-01T00:00:00Z",
            },
          ]}
        />,
      );
      expect(
        screen.getByRole("heading", { name: "Fechas bloqueadas excepcionalmente" }),
      ).toBeVisible();
      expect(screen.getByText(/Ana Pérez · Vacaciones/)).toBeVisible();
      if (view === "month")
        expect(container.querySelector(".agenda-block-badge")).toHaveTextContent("1 bloqueo");
      else expect(container.querySelector(".agenda-blocked-day")).toBeInTheDocument();
    },
  );
  it.each([
    { date: "2026-10-21", index: 4, selected: "2026-10-23" },
    { date: "2026-10-30", index: 6, selected: "2026-11-01" },
    { date: "2026-12-31", index: 4, selected: "2027-01-01" },
  ])(
    "opens the civil Day from a Week date across month and year boundaries: $selected",
    ({ date, index, selected }) => {
      const { container } = render(
        <AgendaCalendar
          centerId={centerId}
          centerName="Centro"
          timezone="Pacific/Auckland"
          today={date}
          role="RECEPTION"
          filters={{
            date,
            view: "week",
            status: "CONFIRMED",
            specialtyId: "33333333-3333-4333-8333-333333333333",
            professionalCenterId: professionalId,
          }}
          loadFailed={false}
          professionals={[]}
          appointments={[]}
        />,
      );
      const headers = container.querySelectorAll<HTMLButtonElement>(
        ".agenda-calendar-week .rbc-time-header .rbc-header > button",
      );
      expect(headers).toHaveLength(7);
      expect(headers[index]).toHaveTextContent("Abrir día");
      fireEvent.click(headers[index]);
      expect(push).toHaveBeenCalledTimes(1);
      const url = new URL(push.mock.calls[0][0], "http://local.test");
      expect(url.pathname).toBe("/centers/" + centerId + "/agenda");
      expect(url.searchParams.get("view")).toBe("day");
      expect(url.searchParams.get("date")).toBe(selected);
      expect(url.searchParams.get("status")).toBe("CONFIRMED");
      expect(url.searchParams.get("specialty")).toBe("33333333-3333-4333-8333-333333333333");
      expect(url.searchParams.get("professional")).toBe(professionalId);
      expect(screen.getByRole("link", { name: "Crear turno" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Lista de turnos" })).not.toBeInTheDocument();
    },
  );

  it("keeps appointment creation hidden from Professional while Week headings remain available", () => {
    const { container } = render(
      <AgendaCalendar
        centerId={centerId}
        centerName="Centro"
        timezone="America/Argentina/Buenos_Aires"
        today="2026-10-23"
        role="PROFESSIONAL"
        filters={{ date: "2026-10-23", view: "week" }}
        loadFailed={false}
        professionals={[]}
        appointments={[]}
      />,
    );
    expect(screen.queryByRole("link", { name: "Crear turno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lista de turnos" })).not.toBeInTheDocument();
    expect(container.querySelectorAll(".agenda-calendar-week .rbc-header > button")).toHaveLength(
      7,
    );
  });

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

  it("keeps a full Day grid when there are no professionals or appointments", () => {
    const { container, rerender } = render(
      <AgendaCalendar
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        today="2026-10-28"
        role="ADMIN"
        filters={{ date: "2026-10-28", view: "day" }}
        loadFailed={false}
        professionals={[]}
        appointments={[]}
      />,
    );
    expect(container.querySelectorAll(".rbc-time-content .rbc-day-slot")).toHaveLength(1);
    expect(container.querySelectorAll(".rbc-day-slot .rbc-timeslot-group")).toHaveLength(24);

    rerender(
      <AgendaCalendar
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        today="2026-10-28"
        role="ADMIN"
        filters={{ date: "2026-10-28", view: "week" }}
        loadFailed={false}
        professionals={[]}
        appointments={[]}
      />,
    );
    expect(container.querySelectorAll(".rbc-time-content .rbc-day-slot")).toHaveLength(7);
  });

  it("highlights only the current half-hour in the center timezone on Day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T18:20:00Z"));
    try {
      const calendarProps = {
        centerId,
        centerName: "Centro",
        timezone: "America/New_York",
        today: "2026-10-28",
        role: "ADMIN" as const,
        loadFailed: false,
        professionals: [
          {
            id: professionalId,
            firstName: "Elena",
            lastName: "Demo",
            usualAppointmentDurationMinutes: 30,
            updatedAt: "2026-10-01T00:00:00Z",
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            firstName: "Martín",
            lastName: "Demo",
            usualAppointmentDurationMinutes: 30,
            updatedAt: "2026-10-01T00:00:00Z",
          },
        ],
        appointments: [],
      };
      const { container, rerender, unmount } = render(
        <AgendaCalendar {...calendarProps} filters={{ date: "2026-10-28", view: "day" }} />,
      );
      const columns = container.querySelectorAll(".rbc-day-slot");
      expect(columns).toHaveLength(2);
      for (const column of columns) {
        const slots = column.querySelectorAll(".rbc-time-slot");
        expect(column.querySelectorAll(".agenda-current-time-slot")).toHaveLength(1);
        expect(slots[28]).toHaveClass("agenda-current-time-slot");
        expect(slots[27]).not.toHaveClass("agenda-current-time-slot");
        expect(slots[29]).not.toHaveClass("agenda-current-time-slot");
      }
      rerender(<AgendaCalendar {...calendarProps} filters={{ date: "2026-10-27", view: "day" }} />);
      expect(container.querySelectorAll(".rbc-day-slot .agenda-current-time-slot")).toHaveLength(0);
      unmount();
    } finally {
      vi.useRealTimers();
    }
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
    expect(screen.getByText("Consultá la actividad por día, semana o mes.")).toBeVisible();
    expect(screen.queryByText(/Horarios en la zona del centro:/)).not.toBeInTheDocument();
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
