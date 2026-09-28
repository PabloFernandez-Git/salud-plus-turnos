import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { CenterUserListItem } from "../server/center-users";
import { CenterAdminNavigation } from "./center-admin-navigation";
import { CenterUsersScreen } from "./center-users-screen";

const centerId = "11111111-1111-4111-8111-111111111111";
const users: CenterUserListItem[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    firstName: "Ana",
    lastName: "Admin",
    email: "ana@example.test",
    role: "ADMIN",
    isActive: true,
    professional: null,
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    firstName: "Pablo",
    lastName: "Profesional",
    email: "pablo@example.test",
    role: "PROFESSIONAL",
    isActive: false,
    professional: {
      firstName: "Paula",
      lastName: "Médica",
      licenseNumber: "MP 1234",
      isActive: false,
    },
  },
];

afterEach(cleanup);

describe("Center user navigation", () => {
  it("shows Center → Usuarios only to ADMIN", () => {
    const { rerender } = render(<CenterAdminNavigation centerId={centerId} role="ADMIN" />);
    expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/users`,
    );

    rerender(<CenterAdminNavigation centerId={centerId} role="RECEPTION" />);
    expect(screen.queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
  });

  it("shows Usuarios → Center navigation", () => {
    render(
      <CenterUsersScreen
        actorUserId="99999999-9999-4999-8999-999999999999"
        centerId={centerId}
        centerName="Centro Norte"
        loadFailed={false}
        professionalCenters={[]}
        users={users}
      />,
    );

    expect(screen.getByRole("link", { name: "Volver al centro" })).toHaveAttribute(
      "href",
      `/centers/${centerId}`,
    );
  });
});

describe("CenterUsersScreen", () => {
  it("renders identity, human role, membership state and Professional association", () => {
    render(
      <CenterUsersScreen
        actorUserId="99999999-9999-4999-8999-999999999999"
        centerId={centerId}
        centerName="Centro Norte"
        loadFailed={false}
        professionalCenters={[]}
        users={users}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();
    expect(screen.getByText("Centro Norte")).toBeVisible();

    const adminRow = screen.getByRole("row", { name: /Ana Admin/ });
    expect(within(adminRow).getByText("ana@example.test")).toBeVisible();
    expect(within(adminRow).getByText("Administrador")).toBeVisible();
    expect(within(adminRow).getByText("Activo")).toBeVisible();
    expect(within(adminRow).getByLabelText("Sin profesional asociado")).toHaveTextContent("—");

    const professionalRow = screen.getByRole("row", { name: /Pablo Profesional/ });
    expect(within(professionalRow).getByText("Profesional")).toBeVisible();
    expect(within(professionalRow).getByText("Inactivo")).toBeVisible();
    expect(within(professionalRow).getByText("Paula Médica")).toBeVisible();
    expect(within(professionalRow).getByText("Matrícula: MP 1234")).toBeVisible();
    expect(within(professionalRow).getByText("Vínculo inactivo")).toBeVisible();
    expect(within(professionalRow).getByText("Sólo lectura")).toBeVisible();
    expect(within(professionalRow).queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders an explicit empty state", () => {
    render(
      <CenterUsersScreen
        actorUserId="99999999-9999-4999-8999-999999999999"
        centerId={centerId}
        centerName="Centro vacío"
        loadFailed={false}
        professionalCenters={[]}
        users={[]}
      />,
    );

    expect(screen.getByText("No hay usuarios para mostrar.")).toBeVisible();
  });

  it("renders a safe load error without a table", () => {
    render(
      <CenterUsersScreen
        actorUserId="99999999-9999-4999-8999-999999999999"
        centerId={centerId}
        centerName="Centro Norte"
        loadFailed
        professionalCenters={[]}
        users={[]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los usuarios");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
