import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/auth-actions", () => ({ updatePasswordAction: vi.fn() }));

import { UpdatePasswordForm } from "./update-password-form";

afterEach(cleanup);

describe("UpdatePasswordForm password visibility", () => {
  it("toggles new and confirmation passwords independently", () => {
    render(<UpdatePasswordForm />);

    const password = screen.getByLabelText("Nueva contraseña");
    const confirmation = screen.getByLabelText("Confirmar contraseña");
    expect(password).toHaveAttribute("type", "password");
    expect(confirmation).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(confirmation).toHaveAttribute("autocomplete", "new-password");
    expect(password).toHaveAttribute("minlength", "10");
    expect(confirmation).toHaveAttribute("minlength", "10");

    fireEvent.click(screen.getAllByRole("button", { name: "Mostrar contraseña" })[0]);
    expect(password).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "text");

    fireEvent.click(screen.getAllByRole("button", { name: "Ocultar contraseña" })[0]);
    expect(password).toHaveAttribute("type", "password");
    expect(confirmation).toHaveAttribute("type", "text");
  });
});
