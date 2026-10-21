import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CenterNavigation } from "./center-navigation";

const centerId = "11111111-1111-4111-8111-111111111111";
afterEach(cleanup);

describe("center navigation", () => {
  it("shows all center destinations to ADMIN", () => {
    render(<CenterNavigation centerId={centerId} role="ADMIN" />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Pacientes",
      "Disponibilidad",
      "Turnos",
      "Agenda",
      "Usuarios",
      "Especialidades",
      "Profesionales",
    ]);
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
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Pacientes",
      "Disponibilidad",
      "Turnos",
      "Agenda",
    ]);
  });
  it("shows Availability, own Appointments and Agenda to PROFESSIONAL", () => {
    render(<CenterNavigation centerId={centerId} role="PROFESSIONAL" />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Disponibilidad",
      "Turnos",
      "Agenda",
    ]);
  });
});
