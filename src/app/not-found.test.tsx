import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("global not-found page", () => {
  it("shows Salud Plus copy and returns through the session-aware root route", () => {
    render(<NotFound />);

    expect(screen.getByText("Error")).toBeVisible();
    expect(screen.getByText("404")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "No encontramos esta página" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Es posible que la dirección sea incorrecta o que la página ya no esté disponible.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText(/This page could not be found/i)).not.toBeInTheDocument();
  });
});
