import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppLoader } from "./app-loader";

afterEach(cleanup);

describe("AppLoader", () => {
  it("shows the Salud Plus brand and announces the loading state", () => {
    render(<AppLoader />);

    expect(screen.getByText("Salud Plus")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Salud Plus, cargando")).toHaveClass("sr-only");
  });

  it("uses viewport positioning by default", () => {
    render(<AppLoader />);

    const status = screen.getByRole("status");
    expect(status).toHaveClass("fixed", "inset-0");
    expect(status).not.toHaveClass("h-full");
  });

  it("uses container positioning when fullScreen is false", () => {
    render(<AppLoader fullScreen={false} />);

    const status = screen.getByRole("status");
    expect(status).toHaveClass("h-full");
    expect(status).not.toHaveClass("fixed", "inset-0");
  });

  it("keeps the plus decorative", () => {
    render(<AppLoader />);

    const symbol = screen.getByRole("status").querySelector("span:first-child");
    expect(symbol).toHaveAttribute("aria-hidden", "true");
    expect(symbol).toBeEmptyDOMElement();
  });
});
