import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const action = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("../actions/center-user-actions", () => ({ updateCenterMembershipAction: action }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { CenterUserListItem, ManageableProfessionalCenter } from "../server/center-users";
import { ManageCenterMembershipPanel } from "./manage-center-membership-panel";

const centerId = "11111111-1111-4111-8111-111111111111";
const user: CenterUserListItem = {
  id: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
  firstName: "Ana",
  lastName: "Admin",
  email: "ana@example.test",
  role: "ADMIN",
  isActive: true,
  professional: null,
};
const professionalCenters: ManageableProfessionalCenter[] = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    firstName: "Paula",
    lastName: "Libre",
    licenseNumber: "MP 1",
    occupiedMembershipId: null,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    firstName: "Olga",
    lastName: "Ocupada",
    licenseNumber: "MP 2",
    occupiedMembershipId: "66666666-6666-4666-8666-666666666666",
  },
];

function renderPanel(overrides: Partial<Parameters<typeof ManageCenterMembershipPanel>[0]> = {}) {
  return render(
    <ManageCenterMembershipPanel
      activeAdminCount={2}
      centerId={centerId}
      professionalCenters={professionalCenters}
      user={user}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  action.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
  action.mockResolvedValue({
    status: "success",
    message: "Acceso actualizado con el estado confirmado por el servidor.",
    membership: {
      id: user.id,
      role: "RECEPTION",
      professionalCenterId: null,
      isActive: true,
    },
  });
});
afterEach(cleanup);

describe("ManageCenterMembershipPanel", () => {
  it("shows only Center access data and requires an explicit role-change confirmation", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));

    expect(screen.getByText("Ana Admin")).toBeVisible();
    expect(screen.getByText("ana@example.test")).toBeVisible();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Ana Admin");
    expect(dialog).toHaveTextContent("Nuevo rol: Recepción");
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cambios" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const submitted = action.mock.calls[0]?.[0] as FormData;
    expect(Object.fromEntries(submitted.entries())).toMatchObject({
      centerId,
      membershipId: user.id,
      expectedRole: "ADMIN",
      role: "RECEPTION",
      expectedIsActive: "true",
      isActive: "true",
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
  });

  it("requires explicit confirmation for deactivation and reactivation", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "inactive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("desactivar el acceso");

    cleanup();
    renderPanel({ user: { ...user, role: "RECEPTION", isActive: false } });
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("reactivar el acceso");
  });

  it("anticipates the evident last-ADMIN rejection", () => {
    renderPanel({ activeAdminCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "inactive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));

    expect(screen.getByRole("alert")).toHaveTextContent("único Administrador activo");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks PROFESSIONAL when no eligible ProfessionalCenter exists", () => {
    renderPanel({ activeAdminCount: 2, professionalCenters: [] });
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));

    expect(
      within(screen.getByLabelText("Rol en este centro")).getByRole("option", {
        name: /Profesional/,
      }),
    ).toBeDisabled();
  });

  it("offers a membership its own active ProfessionalCenter but hides one occupied by another", () => {
    const professionalUser: CenterUserListItem = {
      ...user,
      role: "PROFESSIONAL",
      professional: {
        id: professionalCenters[0]!.id,
        firstName: "Paula",
        lastName: "Libre",
        licenseNumber: "MP 1",
        isActive: true,
      },
    };
    renderPanel({
      user: professionalUser,
      professionalCenters: [
        { ...professionalCenters[0]!, occupiedMembershipId: professionalUser.id },
        professionalCenters[1]!,
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));

    const select = screen.getByLabelText("Profesional asociado");
    expect(within(select).getByRole("option", { name: /Libre, Paula/ })).toBeVisible();
    expect(within(select).queryByRole("option", { name: /Ocupada/ })).not.toBeInTheDocument();
  });

  it("allows pure deactivation with an inactive current ProfessionalCenter but blocks reactivation", () => {
    const inactiveProfessional: CenterUserListItem = {
      ...user,
      role: "PROFESSIONAL",
      professional: {
        id: professionalCenters[0]!.id,
        firstName: "Paula",
        lastName: "Inactiva",
        licenseNumber: "MP 1",
        isActive: false,
      },
    };
    const { unmount } = renderPanel({ user: inactiveProfessional, professionalCenters: [] });
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "inactive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("desactivar el acceso");

    unmount();
    renderPanel({
      user: { ...inactiveProfessional, isActive: false },
      professionalCenters: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent("vínculo profesional actual está inactivo");
  });

  it("uses the safe navigation returned after self-admin loses authorization", async () => {
    action.mockResolvedValueOnce({
      status: "success",
      message: "Acceso actualizado.",
      navigation: `/centers/${centerId}`,
      membership: { id: user.id, role: "RECEPTION", isActive: true, professionalCenterId: null },
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambios" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/centers/${centerId}`));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("refreshes persisted state after an ambiguous transport failure", async () => {
    action.mockRejectedValueOnce(new Error("response lost"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar" }));
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar el resultado");
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
