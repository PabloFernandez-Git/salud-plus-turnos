import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityBlock } from "../server/availability-blocks";
import { AvailabilityBlocksSection } from "./availability-blocks-section";

const { preview, create, deactivate, refresh } = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  deactivate: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions/availability-block-actions", () => ({
  previewAvailabilityBlockAction: (form: FormData) => preview(form),
  createAvailabilityBlockAction: (form: FormData) => create(form),
  deactivateAvailabilityBlockAction: (form: FormData) => deactivate(form),
}));

const centerId = "11111111-1111-4111-8111-111111111111";
const professionalCenterId = "22222222-2222-4222-8222-222222222222";
const block: AvailabilityBlock = {
  id: "33333333-3333-4333-8333-333333333333",
  professionalCenterId,
  startDate: "2026-11-20",
  endDate: "2026-11-22",
  reason: "VACATION",
  updatedAt: "2026-11-16T12:00:00+00:00",
};
function show(blocks: AvailabilityBlock[] = [], canEdit = true) {
  return render(
    <AvailabilityBlocksSection
      centerId={centerId}
      professionalCenterId={professionalCenterId}
      today="2026-11-16"
      blocks={blocks}
      canEdit={canEdit}
    />,
  );
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AvailabilityBlocksSection", () => {
  it("shows active blocks read-only to a professional", () => {
    show([block], false);
    const date = screen.getByText("20/11/2026 – 22/11/2026");
    expect(date).toBeVisible();
    expect(date.parentElement).toHaveTextContent("Motivo: Vacaciones");
    expect(screen.queryByRole("button", { name: "Agregar bloqueo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  it("requires a reviewed count and explicit confirmation for affected appointments", async () => {
    preview.mockResolvedValue({
      status: "success",
      message: "Revisión completada.",
      affectedCount: 2,
    });
    create.mockResolvedValue({ status: "success", message: "Bloqueo guardado." });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Agregar bloqueo" }));
    expect(screen.getByRole("button", { name: "Confirmar bloqueo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Revisar turnos afectados" }));
    await screen.findByText("2 turnos reservados afectados.");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar bloqueo" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Confirmar bloqueo" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Consultar turnos afectados" })).toHaveAttribute(
      "href",
      expect.stringContaining("professional=" + professionalCenterId),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo el bloqueo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar bloqueo" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const form = create.mock.calls[0][0] as FormData;
    expect(form.get("expectedAffectedCount")).toBe("2");
    expect(form.get("confirmAffected")).toBe("true");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("confirms logical removal with the current update token", async () => {
    deactivate.mockResolvedValue({ status: "success", message: "Bloqueo quitado." });
    show([block]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(deactivate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledTimes(1));
    const form = deactivate.mock.calls[0][0] as FormData;
    expect(form.get("blockId")).toBe(block.id);
    expect(form.get("expectedUpdatedAt")).toBe(block.updatedAt);
  });
});
