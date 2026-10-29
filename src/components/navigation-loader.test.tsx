import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkStatus = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", () => ({ useLinkStatus: () => linkStatus }));

import { NavigationLoader } from "./navigation-loader";

afterEach(() => {
  cleanup();
  linkStatus.pending = false;
});

describe("NavigationLoader", () => {
  it("shows the shared loader only while link navigation is pending", () => {
    const view = render(<NavigationLoader />);
    const app = view.container;
    app.inert = false;
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    linkStatus.pending = true;
    view.rerender(<NavigationLoader />);
    expect(screen.getByRole("status")).toHaveTextContent("Salud Plus, cargando");
    expect(screen.getByRole("status").parentElement?.parentElement).toBe(document.body);
    expect(app.inert).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("status").parentElement);

    linkStatus.pending = false;
    view.rerender(<NavigationLoader />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(app.inert).toBe(false);
  });
});
