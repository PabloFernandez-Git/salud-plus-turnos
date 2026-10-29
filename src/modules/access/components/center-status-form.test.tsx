import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setActive = vi.hoisted(() => vi.fn());
vi.mock("../actions/platform-actions", () => ({ setPlatformCenterActiveAction: setActive }));

import { CenterStatusForm } from "./center-status-form";

const centerId = "11111111-1111-4111-8111-111111111111";

describe("CenterStatusForm confirmation", () => {
  beforeEach(() => {
    setActive.mockReset();
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  });
  afterEach(cleanup);

  it("opens and cancels deactivation without calling the action, then restores focus", async () => {
    render(<CenterStatusForm centerId={centerId} centerName="Centro Norte" isActive />);
    const trigger = screen.getByRole("button", { name: "Desactivar" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Desactivar centro" });
    expect(dialog).toHaveTextContent("Centro Norte");
    expect(screen.getByRole("button", { name: "Volver" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(setActive).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(setActive).not.toHaveBeenCalled();
  });

  it("submits deactivation once, blocks closure while pending and reports success", async () => {
    let finish: (() => void) | undefined;
    setActive.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ status: "success", message: "Centro desactivado." });
        }),
    );
    render(<CenterStatusForm centerId={centerId} centerName="Centro Norte" isActive />);
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    const form = screen.getByRole("button", { name: "Desactivar centro" }).closest("form")!;
    expect(new FormData(form).get("centerId")).toBe(centerId);
    expect(new FormData(form).get("isActive")).toBe("false");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(setActive).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    finish?.();
    expect(await screen.findByRole("status")).toHaveTextContent("Centro desactivado.");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps an error in the dialog and allows a safe retry", async () => {
    setActive
      .mockResolvedValueOnce({ status: "error", message: "No pudimos desactivar el centro." })
      .mockResolvedValueOnce({ status: "success", message: "Centro desactivado." });
    render(<CenterStatusForm centerId={centerId} centerName="Centro Norte" isActive />);
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    fireEvent.submit(screen.getByRole("button", { name: "Desactivar centro" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos desactivar");
    fireEvent.submit(screen.getByRole("button", { name: "Desactivar centro" }).closest("form")!);
    expect(await screen.findByRole("status")).toHaveTextContent("Centro desactivado.");
    expect(setActive).toHaveBeenCalledTimes(2);
  });

  it("uses the same accessible confirmation for reactivation", async () => {
    render(<CenterStatusForm centerId={centerId} centerName="Centro Sur" isActive={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    expect(screen.getByRole("dialog", { name: "Reactivar centro" })).toHaveTextContent(
      "Centro Sur",
    );
    const form = screen.getByRole("button", { name: "Reactivar centro" }).closest("form")!;
    expect(new FormData(form).get("isActive")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(setActive).not.toHaveBeenCalled();
  });
});
