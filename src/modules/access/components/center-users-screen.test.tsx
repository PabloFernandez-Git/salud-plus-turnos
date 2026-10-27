import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../actions/center-user-actions", () => ({
  updateCenterMembershipAction: vi.fn(),
}));

import type { CenterUserListItem } from "../server/center-users";
import { CenterNavigation } from "./center-navigation";
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
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      firstName: "Paula",
      lastName: "Médica",
      licenseNumber: "MP 1234",
      isActive: false,
    },
  },
];

afterEach(cleanup);

describe("Center user navigation", () => {
  it("shows Center → Gestión de usuarios only to ADMIN", () => {
    const { rerender } = render(<CenterNavigation centerId={centerId} role="ADMIN" />);
    expect(screen.getByRole("link", { name: "Gestión de usuarios" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/users`,
    );

    rerender(<CenterNavigation centerId={centerId} role="RECEPTION" />);
    expect(screen.queryByRole("link", { name: "Gestión de usuarios" })).not.toBeInTheDocument();
  });

  it("shows Gestión de usuarios → Inicio navigation", () => {
    render(
      <CenterUsersScreen
        actorUserId="99999999-9999-4999-8999-999999999999"
        centerId={centerId}
        centerName="Centro Norte"
        loadFailed={false}
        manageableProfessionalCenters={[]}
        professionalCenters={[]}
        users={users}
      />,
    );

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
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
        manageableProfessionalCenters={[]}
        professionalCenters={[]}
        users={users}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Gestión de usuarios" })).toBeVisible();
    expect(
      screen.getByText("Gestión de usuarios", { selector: '[aria-current="page"]' }),
    ).toBeVisible();
    expect(screen.queryByText("Centro Norte")).not.toBeInTheDocument();
    expect(screen.getByText("Administrá los usuarios, roles y accesos del centro.")).toHaveClass(
      "max-w-3xl",
      "text-sm",
      "leading-6",
      "text-slate-600",
    );

    const adminRow = screen.getByRole("row", { name: /Ana Admin/ });
    expect(within(adminRow).getByText("ana@example.test")).toBeVisible();
    expect(within(adminRow).getByText("Administrador")).toBeVisible();
    expect(within(adminRow).getByText("Activo")).toBeVisible();
    const noProfessional = within(adminRow).getByLabelText("Sin profesional asociado");
    expect(noProfessional).toHaveTextContent("—");
    expect(noProfessional.closest("td")).toHaveClass("text-center");

    const professionalRow = screen.getByRole("row", { name: /Pablo Profesional/ });
    expect(within(professionalRow).getByText("Profesional")).toBeVisible();
    expect(within(professionalRow).getByText("Inactivo")).toBeVisible();
    expect(within(professionalRow).getByText("Paula Médica")).toBeVisible();
    expect(within(professionalRow).getByText("Paula Médica").closest("td")).not.toHaveClass(
      "text-center",
    );
    expect(within(professionalRow).getByText("Matrícula: MP 1234")).toBeVisible();
    expect(within(professionalRow).getByText("Vínculo inactivo")).toBeVisible();
    expect(
      within(professionalRow).getByRole("button", { name: "Administrar acceso" }),
    ).toBeVisible();

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Ana Admin");
    expect(cards[0]).toHaveTextContent("ana@example.test");
    expect(cards[0]).toHaveTextContent("Administrador");
    expect(cards[0]).toHaveTextContent("Activo");
    expect(within(cards[0]!).getByRole("button", { name: "Administrar acceso" })).toHaveClass(
      "w-full",
    );
    expect(cards[1]).toHaveTextContent("Pablo Profesional");
    expect(cards[1]).toHaveTextContent("pablo@example.test");
    expect(cards[1]).toHaveTextContent("Inactivo");
    expect(cards[1]).toHaveTextContent("Paula Médica");
    expect(cards[1]).toHaveTextContent("Matrícula: MP 1234");
    expect(screen.getByRole("table").parentElement).toHaveClass("hidden", "md:block");
  });

  it("renders an explicit empty state", () => {
    render(
      <CenterUsersScreen
        actorUserId="99999999-9999-4999-8999-999999999999"
        centerId={centerId}
        centerName="Centro vacío"
        loadFailed={false}
        manageableProfessionalCenters={[]}
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
        manageableProfessionalCenters={[]}
        professionalCenters={[]}
        users={[]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los usuarios");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
