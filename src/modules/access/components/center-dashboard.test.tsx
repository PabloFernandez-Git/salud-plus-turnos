import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CenterDashboard } from "./center-dashboard";

vi.mock("@/modules/dashboard/components/daily-dashboard-panel", () => ({
  DailyDashboardPanel: () => (
    <section aria-label="Actividad de hoy">Indicadores y próximos turnos</section>
  ),
}));

const centerId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";

afterEach(cleanup);

describe("CenterDashboard", () => {
  it.each(["ADMIN", "RECEPTION", "PROFESSIONAL"] as const)(
    "starts navigation with existing groups and keeps Turnos visible for %s",
    (role) => {
      render(<CenterDashboard centerId={centerId} membershipId={membershipId} role={role} />);
      expect(screen.getByLabelText("Actividad de hoy")).toBeInTheDocument();
      expect(screen.queryByText("¿Qué querés hacer hoy?")).not.toBeInTheDocument();
      expect(screen.queryByText("Elegí un módulo para empezar.")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Operación diaria" })).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Administración del centro" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Turnos" })).toHaveAttribute(
        "href",
        "/centers/" + centerId + "/appointments",
      );
    },
  );
});
