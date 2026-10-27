import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CivilDatePicker, civilWeekday } from "./civil-date-picker";

afterEach(cleanup);

describe("civil date picker", () => {
  it("keeps Gregorian weekdays and leap days independent from device time", () => {
    expect(civilWeekday("2026-10-27")).toBe(1);
    expect(civilWeekday("2024-02-29")).toBe(3);
    expect(civilWeekday("2026-11-01")).toBe(6);
  });
  it("shows DD/MM/YYYY, navigates months and returns a civil date string", () => {
    const onChange = vi.fn();
    render(<CivilDatePicker value="2026-10-27" referenceDate="2026-10-27" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Fecha local del centro 27/10/2026" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "martes 27 de octubre de 2026" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "domingo 1 de noviembre de 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-01");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("supports arrow, page and Escape keys with visible focus", () => {
    const onChange = vi.fn();
    render(<CivilDatePicker value="" referenceDate="2026-10-27" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: /Fecha local del centro/ });
    fireEvent.click(trigger);
    const current = screen.getByRole("button", { name: "martes 27 de octubre de 2026" });
    expect(current).toHaveFocus();
    fireEvent.keyDown(current, { key: "ArrowRight" });
    const next = screen.getByRole("button", { name: "miércoles 28 de octubre de 2026" });
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: "PageDown" });
    const nextMonth = screen.getByRole("button", { name: "sábado 28 de noviembre de 2026" });
    expect(nextMonth).toHaveFocus();
    fireEvent.keyDown(nextMonth, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Calendario" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("exposes disabled and error states", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CivilDatePicker value="" referenceDate="2026-10-27" disabled onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: /Fecha local del centro/ })).toBeDisabled();
    rerender(<CivilDatePicker value="" referenceDate="2026-10-27" error onChange={onChange} />);
    expect(screen.getByRole("button", { name: /Fecha local del centro/ })).toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá la fecha seleccionada.");
  });
  it("closes the inline calendar when keyboard focus leaves it", () => {
    const onChange = vi.fn();
    render(
      <>
        <CivilDatePicker value="" referenceDate="2026-10-27" onChange={onChange} />
        <button type="button">Siguiente control</button>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Fecha local del centro/ }));
    const day = screen.getByRole("button", { name: "martes 27 de octubre de 2026" });
    fireEvent.blur(day, {
      relatedTarget: screen.getByRole("button", { name: "Siguiente control" }),
    });
    expect(screen.queryByRole("group", { name: "Calendario" })).not.toBeInTheDocument();
  });
});
