import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModuleHeader } from "./module-header";

const centerId = "11111111-1111-4111-8111-111111111111";

describe("ModuleHeader", () => {
  it("shows the main module title, description and action without a redundant breadcrumb", () => {
    render(
      <ModuleHeader
        centerId={centerId}
        title="Turnos"
        description="Consultá los turnos del centro."
        actions={<button type="button">Crear turno</button>}
      />,
    );
    expect(
      screen.queryByRole("navigation", { name: "Ruta de navegación" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Turnos" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear turno" })).toBeVisible();
    expect(screen.getByText("Consultá los turnos del centro.")).toHaveClass("max-w-3xl");
  });

  it("keeps the parent route available on detail and edit screens", () => {
    render(
      <ModuleHeader
        centerId={centerId}
        title="Detalle del turno"
        description="Consultá los datos del turno."
        parent={{ label: "Turnos", href: `/centers/${centerId}/appointments` }}
      />,
    );
    const breadcrumb = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(within(breadcrumb).getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "href",
      `/centers/${centerId}`,
    );
    expect(within(breadcrumb).getByRole("link", { name: "Turnos" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/appointments`,
    );
  });
});
