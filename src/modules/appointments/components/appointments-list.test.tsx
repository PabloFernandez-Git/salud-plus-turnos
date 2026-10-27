import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppointmentsList } from "./appointments-list";

const centerId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const professionalCenterId = "33333333-3333-4333-8333-333333333333";
const row = {
  appointment_id: appointmentId,
  starts_at: "2026-10-20T01:00:00+00:00",
  ends_at: "2026-10-20T01:30:00+00:00",
  updated_at: "2026-10-19T12:00:00.123456+00:00",
  status: "CANCELLED" as const,
  patient_first_name: "Ana",
  patient_last_name: "Sol",
  specialty_name: "Clínica",
  has_more: true,
};
const filters = {
  fromDate: "2026-10-01",
  toDate: "2026-10-31",
  status: "CANCELLED" as const,
  professionalCenterId,
};
const common = {
  centerId,
  centerName: "Centro",
  timezone: "America/Argentina/Buenos_Aires",
  today: "2026-10-19",
  filters,
  professionals: [
    {
      id: professionalCenterId,
      firstName: "Dr",
      lastName: "Paz",
      usualAppointmentDurationMinutes: 30,
      updatedAt: "u",
    },
  ],
  loadFailed: false,
};
afterEach(cleanup);

describe("appointment list", () => {
  it("keeps mobile quick links equal and identifies the active date preset from existing filters", () => {
    const { rerender } = render(
      <AppointmentsList
        {...common}
        filters={{ fromDate: "2026-10-19", toDate: "2026-11-18" }}
        role="RECEPTION"
        result={{ kind: "STAFF", rows: [], hasMore: false, nextCursor: null }}
      />,
    );
    const upcoming = screen.getByRole("link", { name: "Próximos turnos" });
    const recent = screen.getByRole("link", { name: "Últimos 30 días, incluidos cancelados" });
    expect(upcoming.parentElement).toHaveClass("flex-col", "sm:flex-row");
    for (const link of [upcoming, recent])
      expect(link).toHaveClass("w-full", "min-h-12", "sm:w-auto");
    expect(upcoming).toHaveAttribute("aria-current", "true");
    expect(recent).not.toHaveAttribute("aria-current");
    expect(upcoming).toHaveAttribute("href", `/centers/${centerId}/appointments`);
    expect(
      new URL(recent.getAttribute("href")!, "http://local.test").searchParams.get("from"),
    ).toBe("2026-09-19");
    rerender(
      <AppointmentsList
        {...common}
        filters={{ fromDate: "2026-09-19", toDate: "2026-10-19" }}
        role="RECEPTION"
        result={{ kind: "STAFF", rows: [], hasMore: false, nextCursor: null }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Últimos 30 días, incluidos cancelados" }),
    ).toHaveAttribute("aria-current", "true");
    rerender(
      <AppointmentsList
        {...common}
        role="RECEPTION"
        result={{ kind: "STAFF", rows: [], hasMore: false, nextCursor: null }}
      />,
    );
    expect(screen.getByRole("link", { name: "Próximos turnos" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: "Últimos 30 días, incluidos cancelados" }),
    ).not.toHaveAttribute("aria-current");
  });
  it("shows staff filters, a historical cancelled turn and a cursor link with exact instant", () => {
    render(
      <AppointmentsList
        {...common}
        role="ADMIN"
        result={{
          kind: "STAFF",
          rows: [
            {
              ...row,
              professional_center_id: professionalCenterId,
              professional_first_name: "Dr",
              professional_last_name: "Paz",
            },
          ],
          hasMore: true,
          nextCursor: { startsAt: row.starts_at, id: appointmentId },
        }}
      />,
    );
    expect(screen.getByText("Consultá y gestioná los turnos del centro.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Crear turno" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Profesional" })).toHaveValue(professionalCenterId);
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveValue("CANCELLED");
    expect(screen.getByText("19/10/2026 · 22:00–22:30")).toBeInTheDocument();
    expect(screen.getAllByText("Cancelado")).toHaveLength(2);
    const next = screen.getByRole("link", { name: "Siguiente página" }).getAttribute("href") ?? "";
    expect(new URL(next, "http://local.test").searchParams.get("cursorStartsAt")).toBe(
      row.starts_at,
    );
    expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/appointments/${appointmentId}`,
    );
  });
  it("keeps Professional limited to own list with no staff controls", () => {
    render(
      <AppointmentsList
        {...common}
        role="PROFESSIONAL"
        result={{
          kind: "PROFESSIONAL",
          rows: [row],
          hasMore: false,
          nextCursor: { startsAt: row.starts_at, id: appointmentId },
        }}
      />,
    );
    expect(screen.getByText("Consultá y gestioná los turnos del centro.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Profesional" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Crear turno" })).not.toBeInTheDocument();
    expect(screen.queryByText("Dr Paz")).not.toBeInTheDocument();
  });
  it("provides empty and error recovery states", () => {
    const { rerender } = render(
      <AppointmentsList
        {...common}
        role="RECEPTION"
        result={{ kind: "STAFF", rows: [], hasMore: false, nextCursor: null }}
      />,
    );
    expect(screen.getByText("No hay turnos para estos filtros.")).toBeInTheDocument();
    rerender(<AppointmentsList {...common} role="RECEPTION" result={null} loadFailed />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los turnos.");
    expect(screen.getByRole("link", { name: "Reintentar" })).toBeInTheDocument();
  });
});
