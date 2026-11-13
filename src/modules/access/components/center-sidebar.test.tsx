import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CenterMobileNavigation, CenterSidebar } from "./center-sidebar";

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathname }));

const centerId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  pathname.mockReturnValue(`/centers/${centerId}`);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callback(0));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("center sidebar mobile menu", () => {
  it("opens with focus and closes after choosing a module", () => {
    render(<CenterMobileNavigation centerId={centerId} role="RECEPTION" />);
    const trigger = screen.getByRole("button", { name: "Abrir menú de navegación" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Menú de navegación" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("button", { name: "Cerrar menú de navegación" })).toHaveFocus();
    expect(within(dialog).queryByRole("link", { name: "Profesionales" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("link", { name: "Agenda" }));
    expect(screen.queryByRole("dialog", { name: "Menú de navegación" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape via the native dialog cancel event", () => {
    render(<CenterMobileNavigation centerId={centerId} role="ADMIN" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú de navegación" }));
    const dialog = screen.getByRole("dialog", { name: "Menú de navegación" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "Menú de navegación" })).not.toBeInTheDocument();
  });
});

describe("center sidebar desktop rail", () => {
  it("expands for mouse hover and contracts on pointer exit", () => {
    render(<CenterSidebar centerId={centerId} role="ADMIN" />);
    const sidebar = screen.getByRole("complementary", { name: "Barra lateral del centro" });
    expect(sidebar).toHaveAttribute("data-expanded", "false");
    fireEvent.pointerEnter(sidebar, { pointerType: "touch" });
    expect(sidebar).toHaveAttribute("data-expanded", "false");
    fireEvent.pointerEnter(sidebar, { pointerType: "mouse" });
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    expect(sidebar.className).toContain("shadow-[4px_0_18px_-8px_rgba(15,23,42,0.22)]");
    fireEvent.pointerLeave(sidebar, { pointerType: "mouse" });
    expect(sidebar).toHaveAttribute("data-expanded", "false");
    expect(sidebar.className).not.toContain("shadow-[4px_0_18px_-8px_rgba(15,23,42,0.22)]");
  });

  it("keeps the rail expanded while keyboard focus stays inside", () => {
    render(<CenterSidebar centerId={centerId} role="PROFESSIONAL" />);
    const sidebar = screen.getByRole("complementary", { name: "Barra lateral del centro" });
    const nav = within(sidebar).getByRole("navigation", { name: "Navegación del centro" });
    const dashboard = within(nav).getByRole("link", { name: "Dashboard" });
    const agenda = within(nav).getByRole("link", { name: "Agenda" });
    expect(dashboard.querySelector("svg")).toBeInTheDocument();
    expect(agenda.querySelector("svg")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Pacientes" })).not.toBeInTheDocument();
    fireEvent.focus(dashboard);
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    fireEvent.pointerLeave(sidebar, { pointerType: "mouse" });
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    fireEvent.blur(dashboard, { relatedTarget: agenda });
    fireEvent.focus(agenda, { relatedTarget: dashboard });
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    fireEvent.blur(agenda, { relatedTarget: document.body });
    expect(sidebar).toHaveAttribute("data-expanded", "false");
  });
});
