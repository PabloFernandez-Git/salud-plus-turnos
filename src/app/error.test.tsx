import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import AppError from "./error";

it("shows a generic recoverable error with an explicit retry", () => {
  render(<AppError />);

  expect(screen.getByRole("alert")).not.toHaveTextContent("database");
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
});
