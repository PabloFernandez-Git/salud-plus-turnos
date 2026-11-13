import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CenterDashboard } from "./center-dashboard";

vi.mock("@/modules/dashboard/components/daily-dashboard-panel", () => ({
  DailyDashboardPanel: ({ children }: { children: ReactNode }) => (
    <section aria-label="Actividad de hoy">
      Indicadores y próximos turnos
      {children}
    </section>
  ),
}));

afterEach(cleanup);

describe("CenterDashboard", () => {
  it.each(["ADMIN", "RECEPTION", "PROFESSIONAL"] as const)(
    "keeps operational content and removes navigation cards for %s",
    (role) => {
      render(
        <CenterDashboard
          centerId="11111111-1111-4111-8111-111111111111"
          membershipId="22222222-2222-4222-8222-222222222222"
          role={role}
        />,
      );
      expect(screen.getByLabelText("Actividad de hoy")).toHaveTextContent(
        "Indicadores y próximos turnos",
      );
      expect(screen.queryByRole("link", { name: "Turnos" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Operación diaria" })).not.toBeInTheDocument();
    },
  );
});
