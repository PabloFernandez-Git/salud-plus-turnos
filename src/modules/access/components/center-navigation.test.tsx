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
    for (const [title, description] of [
      ["Agenda", "Consultá la actividad del centro por día, semana o mes"],
      ["Turnos", "Consultá y gestioná los turnos del centro"],
      ["Pacientes", "Buscá y administrá las fichas de pacientes"],
      ["Profesionales", "Gestioná el equipo de atención del centro"],
      ["Disponibilidad", "Consultá y organizá los horarios de atención"],
      ["Especialidades", "Administrá las especialidades del centro"],
      ["Gestión de usuarios", "Gestioná los accesos y roles del equipo"],
    ]) {
      expect(
        screen.getByRole("link", { name: title }).querySelector("[id$='-description']")
          ?.textContent,
      ).toBe(description);
    }
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
    for (const [title, description] of [
      ["Agenda", "Consultá tu actividad por día, semana o mes"],
      ["Turnos", "Consultá tus turnos y su estado"],
      ["Disponibilidad", "Consultá y organizá tus horarios de atención"],
    ]) {
      expect(
        screen.getByRole("link", { name: title }).querySelector("[id$='-description']")
          ?.textContent,
      ).toBe(description);
    }
  });
});
