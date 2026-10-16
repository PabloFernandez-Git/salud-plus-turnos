import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/auth-actions", () => ({ loginAction: vi.fn() }));

import { LoginForm } from "./login-form";

afterEach(cleanup);

describe("LoginForm password visibility", () => {
  it("keeps login autocomplete and toggles only the password field", () => {
    render(<LoginForm />);

    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    fireEvent.change(password, { target: { value: "secreto-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("secreto-123");
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });
});
