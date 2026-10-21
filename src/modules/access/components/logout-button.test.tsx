import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logout = vi.hoisted(() => vi.fn());
vi.mock("../actions/auth-actions", () => ({ logoutAction: logout }));

import { LogoutButton } from "./logout-button";

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    if (this.open) throw new Error("Dialog already open");
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openConfirmation() {
  render(<LogoutButton variant="quiet" confirm />);
  const trigger = screen.getByRole("button", { name: "Cerrar sesión" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", {
    name: "¿Querés cerrar sesión?",
  }) as HTMLDialogElement;
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 400,
    right: 848,
    top: 200,
    bottom: 400,
  } as DOMRect);
  return { trigger, dialog };
}

describe("dashboard logout confirmation", () => {
  it("opens once under React StrictMode", () => {
    render(
      <StrictMode>
        <LogoutButton variant="quiet" confirm />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(screen.getByRole("dialog", { name: "¿Querés cerrar sesión?" })).toBeVisible();
  });

  it("keeps logout inactive until confirmation and restores focus on Cancelar", async () => {
    const { trigger, dialog } = openConfirmation();
    expect(
      within(dialog).getByText("Podés volver a ingresar a Salud Plus cuando quieras."),
    ).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(logout).not.toHaveBeenCalled();
  });

  it.each(["Escape", "Fondo"] as const)("closes on %s without logout", async (method) => {
    const { trigger, dialog } = openConfirmation();
    if (method === "Escape") {
      const event = new Event("cancel", { cancelable: true });
      if (dialog.dispatchEvent(event)) dialog.close();
    } else {
      fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(logout).not.toHaveBeenCalled();
  });

  it("keeps clicks inside open and shows a failed logout without closing", async () => {
    logout.mockResolvedValue({ status: "error", message: "No pudimos cerrar la sesión." });
    const { dialog } = openConfirmation();
    fireEvent.click(within(dialog).getByRole("heading", { name: "¿Querés cerrar sesión?" }));
    fireEvent.click(dialog, { clientX: 500, clientY: 250 });
    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "No pudimos cerrar la sesión.",
    );
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });

  it("blocks duplicate submissions and dismissal while logout is pending", async () => {
    let finish!: (value: { status: string; message: string }) => void;
    logout.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { dialog } = openConfirmation();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(within(dialog).getByRole("button", { name: "Cerrando sesión…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.submit(
      within(dialog).getByRole("button", { name: "Cerrando sesión…" }).closest("form")!,
    );
    const escape = new Event("cancel", { cancelable: true });
    expect(dialog.dispatchEvent(escape)).toBe(false);
    fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    expect(dialog).toBeVisible();
    expect(logout).toHaveBeenCalledOnce();
    await act(async () => finish({ status: "error", message: "No pudimos cerrar la sesión." }));
    expect(await within(dialog).findByRole("alert")).toBeVisible();
  });

  it("preserves immediate logout in other locations", async () => {
    logout.mockResolvedValue({ status: "error", message: "No pudimos cerrar la sesión." });
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
