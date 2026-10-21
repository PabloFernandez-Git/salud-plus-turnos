import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingChoice } from "@/modules/appointments/components/booking-selector";
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

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("react-big-calendar", () => ({
  dateFnsLocalizer: () => ({}),
  Calendar: ({
    view,
    selectable,
    onSelectSlot,
    onDrillDown,
  }: {
    view: string;
    selectable: boolean;
    onSelectSlot: (slot: { start: Date; resourceId?: string }) => void;
    onDrillDown: (date: Date) => void;
  }) => (
    <div data-testid="calendar" data-view={view} data-selectable={String(selectable)}>
      <button
        type="button"
        onClick={() =>
          onSelectSlot({
            start: new Date(2026, 9, 21, 10, 30),
            resourceId: view === "day" ? professionalId : undefined,
          })
        }
      >
        Elegir franja
      </button>
      <button type="button" onClick={() => onDrillDown(new Date(2026, 9, 22, 12))}>
        Abrir fecha
      </button>
    </div>
  ),
}));
vi.mock("@/modules/appointments/components/booking-selector", () => ({
  BookingSelector: ({
    initial,
    onChange,
  }: {
    initial: { specialtyId: string; professionalCenterId: string; localDate: string };
    onChange: (choice: BookingChoice) => void;
  }) => (
    <div>
      <output data-testid="initial-booking">{JSON.stringify(initial)}</output>
      <button
        type="button"
        onClick={() =>
          onChange({
            specialtyId,
            specialtyName: "Clínica",
            professionalCenterId: professionalId,
            professionalName: "Luisa Vega",
            duration: 30,
            localDate: "2026-10-21",
            localStartTime: "10:30",
            localEndDate: "2026-10-21",
            localEndTime: "11:00",
            startsAt: "2026-10-21T13:30:00Z",
            endsAt: "2026-10-21T14:00:00Z",
          })
        }
      >
        Seleccionar horario confirmado
      </button>
    </div>
  ),
}));

const centerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const specialtyId = "33333333-3333-4333-8333-333333333333";
const props = {
  centerId,
  centerName: "Centro",
  timezone: "America/Argentina/Buenos_Aires",
  today: "2026-10-21",
  role: "RECEPTION" as const,
  appointments: [],
  professionals: [
    {
      id: professionalId,
      firstName: "Luisa",
      lastName: "Vega",
      usualAppointmentDurationMinutes: 30,
      updatedAt: "2026-10-01T00:00:00Z",
    },
  ],
  specialties: [{ specialty_id: specialtyId, specialty_name: "Clínica" }],
  loadFailed: false,
};
afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("AgendaCalendar slot navigation", () => {
  it("opens PostgreSQL-backed selection from Day and carries all fields to Crear turno", () => {
    render(
      <AgendaCalendar {...props} filters={{ date: "2026-10-21", view: "day", specialtyId }} />,
    );
    expect(screen.getByTestId("calendar")).toHaveAttribute("data-selectable", "true");
    fireEvent.click(screen.getByRole("button", { name: "Elegir franja" }));
    expect(screen.getByTestId("initial-booking")).toHaveTextContent(professionalId);
    expect(screen.getByTestId("initial-booking")).toHaveTextContent("2026-10-21");
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar horario confirmado" }));
    const href = screen
      .getByRole("link", { name: "Continuar para crear turno" })
      .getAttribute("href");
    expect(href).toContain(`specialtyId=${specialtyId}`);
    expect(href).toContain(`professionalCenterId=${professionalId}`);
    expect(href).toContain("localDate=2026-10-21");
    expect(href).toContain("startsAt=2026-10-21T13%3A30%3A00Z");
  });

  it("requires a specialty and a professional before querying Week slots", () => {
    const { rerender } = render(
      <AgendaCalendar {...props} filters={{ date: "2026-10-21", view: "week" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Elegir franja" }));
    expect(screen.getByRole("status")).toHaveTextContent("Elegí una especialidad");
    rerender(
      <AgendaCalendar {...props} filters={{ date: "2026-10-21", view: "week", specialtyId }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Elegir franja" }));
    expect(screen.getByRole("status")).toHaveTextContent("Elegí un profesional");
    rerender(
      <AgendaCalendar
        {...props}
        filters={{
          date: "2026-10-21",
          view: "week",
          specialtyId,
          professionalCenterId: professionalId,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Elegir franja" }));
    expect(screen.getByTestId("initial-booking")).toHaveTextContent(professionalId);
  });

  it("keeps Month as a summary and drills into Day", () => {
    render(
      <AgendaCalendar
        {...props}
        filters={{
          date: "2026-10-21",
          view: "month",
          specialtyId,
          professionalCenterId: professionalId,
        }}
      />,
    );
    expect(screen.getByTestId("calendar")).toHaveAttribute("data-selectable", "false");
    fireEvent.click(screen.getByRole("button", { name: "Abrir fecha" }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining(`view=day&date=2026-10-22`));
  });
});
