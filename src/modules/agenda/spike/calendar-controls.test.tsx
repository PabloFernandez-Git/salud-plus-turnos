import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarControls } from "./calendar-controls";
import { PROFESSIONALS, REFERENCE_DATE } from "./mock-calendar-data";

afterEach(cleanup);

function renderControls(
  selectedProfessionalIds: Array<"ana" | "bruno" | "clara"> = ["ana", "bruno", "clara"],
) {
  const onNavigate = vi.fn();
  const onToggleProfessional = vi.fn();
  const onViewChange = vi.fn();

  render(
    <CalendarControls
      date={REFERENCE_DATE}
      onNavigate={onNavigate}
      onToggleProfessional={onToggleProfessional}
      onViewChange={onViewChange}
      professionals={PROFESSIONALS}
      selectedProfessionalIds={selectedProfessionalIds}
      view="day"
    />,
  );

  return { onNavigate, onToggleProfessional, onViewChange };
}

describe("CalendarControls", () => {
  it("changes view and navigates through explicit controls", () => {
    const { onNavigate, onViewChange } = renderControls();

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Fecha de referencia" }));

    expect(onViewChange).toHaveBeenCalledWith("week");
    expect(onNavigate).toHaveBeenNthCalledWith(1, "next");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "reference");
  });

  it("exposes filters for all professionals", () => {
    const { onToggleProfessional } = renderControls();

    fireEvent.click(screen.getByRole("checkbox", { name: "Ana Torres" }));

    expect(onToggleProfessional).toHaveBeenCalledWith("ana");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("prevents an empty professional selection", () => {
    renderControls(["ana"]);

    expect(screen.getByRole("checkbox", { name: "Ana Torres" })).toBeDisabled();
  });
});
