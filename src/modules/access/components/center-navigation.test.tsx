import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CenterNavigation } from "./center-navigation";

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathname }));

const centerId = "11111111-1111-4111-8111-111111111111";
const root = `/centers/${centerId}`;

beforeEach(() => pathname.mockReturnValue(root));
afterEach(cleanup);

describe("center navigation", () => {
  it.each([
    [
      "ADMIN",
      [
        "Dashboard",
        "Agenda",
        "Turnos",
        "Pacientes",
        "Profesionales",
        "Disponibilidad",
        "Especialidades",
        "Gestión de usuarios",
        "Configuración del centro",
      ],
    ],
    ["RECEPTION", ["Dashboard", "Agenda", "Turnos", "Pacientes", "Disponibilidad"]],
    ["PROFESSIONAL", ["Dashboard", "Agenda", "Turnos", "Disponibilidad"]],
  ] as const)("shows existing destinations to %s", (role, labels) => {
    render(<CenterNavigation centerId={centerId} role={role} />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(labels);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", root);
    expect(screen.getByRole("link", { name: "Turnos" })).toHaveAttribute(
      "href",
      `${root}/appointments`,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the parent module active on detail pages", () => {
    pathname.mockReturnValue(`${root}/appointments/appointment-id`);
    render(<CenterNavigation centerId={centerId} role="ADMIN" />);
    expect(screen.getByRole("link", { name: "Turnos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it.each(["ADMIN", "PROFESSIONAL"] as const)(
    "marks nested availability as active for %s",
    (role) => {
      pathname.mockReturnValue(`${root}/professionals/professional-id/availability`);
      render(<CenterNavigation centerId={centerId} role={role} />);
      expect(screen.getByRole("link", { name: "Disponibilidad" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      if (role === "ADMIN")
        expect(screen.getByRole("link", { name: "Profesionales" })).not.toHaveAttribute(
          "aria-current",
        );
    },
  );
});
