import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function dismissBy(method: "Cerrar" | "Cancelar" | "Fondo" | "Escape") {
  const dialog = screen.getByRole("dialog", { name: "Administrar acceso" });
  if (method === "Fondo") {
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      left: 400,
      right: 900,
      top: 100,
      bottom: 700,
    } as DOMRect);
    fireEvent.click(dialog, { clientX: 100, clientY: 50 });
  } else if (method === "Escape") {
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
  } else {
    fireEvent.click(within(dialog).getByRole("button", { name: method }));
  }
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
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
  it.each(["Cerrar", "Cancelar", "Fondo", "Escape"] as const)(
    "closes with %s and restores focus when unchanged",
    (method) => {
      renderPanel();
      const trigger = screen.getByRole("button", { name: "Administrar acceso" });
      trigger.focus();
      fireEvent.click(trigger);
      dismissBy(method);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
    },
  );

  it.each(["Cerrar", "Cancelar", "Fondo", "Escape"] as const)(
    "guards edited values on %s and discards only after confirmation",
    (method) => {
      renderPanel();
      const trigger = screen.getByRole("button", { name: "Administrar acceso" });
      fireEvent.click(trigger);
      fireEvent.change(screen.getByLabelText("Rol en este centro"), {
        target: { value: "RECEPTION" },
      });
      dismissBy(method);
      expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
      expect(screen.getByLabelText("Rol en este centro")).toHaveValue("RECEPTION");
      dismissBy(method);
      fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
    },
  );

  it("keeps inner clicks open and uses a shared action footer", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    const dialog = screen.getByRole("dialog", { name: "Administrar acceso" });
    fireEvent.click(within(dialog).getByRole("heading", { name: "Administrar acceso" }));
    expect(dialog).toBeVisible();
    const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
    const review = within(dialog).getByRole("button", { name: "Revisar cambios" });
    expect(review).toBeDisabled();
    expect(cancel.parentElement).toBe(review.parentElement);
    expect(cancel.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveAttribute(
      "aria-label",
      "Cerrar",
    );
  });

  it("enables review only for a valid semantic change and disables it after reverting", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    const review = screen.getByRole("button", { name: "Revisar cambios" });
    expect(review).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    expect(review).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Rol en este centro"), { target: { value: "ADMIN" } });
    expect(review).toBeDisabled();
    expect(screen.queryByText("No hay cambios para guardar.")).not.toBeInTheDocument();
  });

  it("shows only Center access data and requires an explicit role-change confirmation", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));

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
    expect(screen.queryByRole("dialog", { name: "Administrar acceso" })).not.toBeInTheDocument();
  });

  it("requires explicit confirmation for deactivation and reactivation", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "inactive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("desactivar el acceso");

    cleanup();
    renderPanel({ user: { ...user, role: "RECEPTION", isActive: false } });
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("reactivar el acceso");
  });

  it("anticipates the evident last-ADMIN rejection", () => {
    renderPanel({ activeAdminCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "inactive" },
    });
    expect(screen.getByRole("button", { name: "Revisar cambios" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("único Administrador activo");
    expect(
      screen.queryByRole("group", { name: "Confirmar cambio de acceso" }),
    ).not.toBeInTheDocument();
  });

  it("blocks PROFESSIONAL when no eligible ProfessionalCenter exists", () => {
    renderPanel({ activeAdminCount: 2, professionalCenters: [] });
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Estado del acceso"), {
      target: { value: "active" },
    });
    expect(screen.getByRole("button", { name: "Revisar cambios" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "No hay otro profesional activo y disponible",
    );
  });

  it("uses the safe navigation returned after self-admin loses authorization", async () => {
    action.mockResolvedValueOnce({
      status: "success",
      message: "Acceso actualizado.",
      navigation: `/centers/${centerId}`,
      membership: { id: user.id, role: "RECEPTION", isActive: true, professionalCenterId: null },
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar el resultado");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "Administrar acceso" })).toBeVisible();
    expect(screen.getByLabelText("Rol en este centro")).toHaveValue("RECEPTION");
  });

  it("renders a native modal outside the table and restores focus after Cancel", () => {
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <ManageCenterMembershipPanel
                activeAdminCount={2}
                centerId={centerId}
                professionalCenters={professionalCenters}
                user={user}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    const trigger = screen.getByRole("button", { name: "Administrar acceso" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Administrar acceso" });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("requires explicit discard for unsaved changes and keeps edits when continuing", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByLabelText("Rol en este centro")).toHaveValue("RECEPTION");
    expect(screen.getByLabelText("Rol en este centro")).toHaveFocus();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps edited values and server validation errors available for correction", async () => {
    action.mockResolvedValueOnce({
      status: "error",
      message: "El acceso cambió mientras lo estabas editando.",
      fieldErrors: { role: ["Revisá el rol seleccionado."] },
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El acceso cambió");
    expect(screen.getByLabelText("Rol en este centro")).toHaveValue("RECEPTION");
    expect(screen.getByRole("dialog", { name: "Administrar acceso" })).toBeVisible();
  });

  it("keeps focus and blocks closing while a confirmed update is pending", async () => {
    let finish!: (state: unknown) => void;
    action.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Administrar acceso" }));
    fireEvent.change(screen.getByLabelText("Rol en este centro"), {
      target: { value: "RECEPTION" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambios" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const dialog = screen.getByRole("dialog", { name: "Administrar acceso" });
    expect(dialog).toHaveFocus();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).toBeVisible();
    expect(dialog).toHaveFocus();
    await act(async () => {
      finish({
        status: "success",
        message: "Acceso actualizado.",
        membership: { id: user.id, role: "RECEPTION", isActive: true, professionalCenterId: null },
      });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
