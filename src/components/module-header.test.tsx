import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModuleHeader } from "./module-header";

const centerId = "11111111-1111-4111-8111-111111111111";

describe("ModuleHeader", () => {
  it("gives modules a consistent path to Inicio and places actions beside the title", () => {
    render(
      <ModuleHeader
        centerId={centerId}
        title="Turnos"
        description="Consultá los turnos del centro."
        actions={<button type="button">Crear turno</button>}
      />,
    );
    const breadcrumb = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(within(breadcrumb).getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "href",
      `/centers/${centerId}`,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Turnos" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear turno" })).toBeVisible();
    expect(screen.getByText("Consultá los turnos del centro.")).toHaveClass("max-w-3xl");
  });
});
