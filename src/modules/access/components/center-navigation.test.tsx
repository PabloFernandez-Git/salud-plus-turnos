import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CenterNavigation } from "./center-navigation";

const centerId = "11111111-1111-4111-8111-111111111111";
afterEach(cleanup);

describe("center navigation", () => {
  it("shows all center destinations to ADMIN", () => {
    render(<CenterNavigation centerId={centerId} role="ADMIN" />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "Agenda",
      "Turnos",
      "Pacientes",
      "Profesionales",
      "Disponibilidad",
      "Especialidades",
      "Gestión de usuarios",
    ]);
    expect(screen.getByRole("heading", { name: "Operación diaria" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Administración del centro" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/patients`,
    );
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/agenda`,
    );
  });
  it("shows operational destinations including Agenda to RECEPTION", () => {
    render(<CenterNavigation centerId={centerId} role="RECEPTION" />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "Agenda",
      "Turnos",
      "Pacientes",
      "Disponibilidad",
    ]);
  });
  it("shows Availability, own Appointments and Agenda to PROFESSIONAL", () => {
    render(<CenterNavigation centerId={centerId} role="PROFESSIONAL" />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "Agenda",
      "Turnos",
      "Disponibilidad",
    ]);
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveTextContent("tu actividad");
    expect(screen.getByRole("link", { name: "Turnos" })).toHaveTextContent("tus turnos");
    expect(screen.getByRole("link", { name: "Disponibilidad" })).toHaveTextContent("tus horarios");
  });
});
