import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlatformCenterSummary } from "../server/administration";
import { PlatformCentersTable } from "./platform-centers-table";

const center: PlatformCenterSummary = {
  center_id: "11111111-1111-4111-8111-111111111111",
  name: "Centro Norte",
  is_active: true,
  address: "Av. Salud 123",
  phone: "+54 11 4444 5555",
  email: "centro@example.test",
  created_at: "2026-09-23T12:00:00.000Z",
  active_membership_count: 4,
  active_professional_center_count: 2,
  active_specialty_count: 3,
};

describe("PlatformCentersTable", () => {
  it("renders the approved empty state and creation action", () => {
    render(<PlatformCentersTable centers={[]} />);

    expect(screen.getByText("Todavía no hay centros creados.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Crear centro" })).toHaveAttribute(
      "href",
      "#crear-centro",
    );
  });

  it("renders administrative metadata and only the approved aggregate counters", () => {
    render(<PlatformCentersTable centers={[center]} />);

    const row = screen.getByRole("row", { name: /Centro Norte/ });
    expect(within(row).getByText("Activo")).toBeVisible();
    expect(within(row).getByText("Av. Salud 123")).toBeVisible();
    expect(within(row).getByText("+54 11 4444 5555")).toBeVisible();
    expect(within(row).getByText("centro@example.test")).toBeVisible();
    expect(within(row).getByText("4")).toBeVisible();
    expect(within(row).getByText("2")).toBeVisible();
    expect(within(row).getByText("3")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Usuarios" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Profesionales" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Especialidades" })).toBeVisible();
  });
});
