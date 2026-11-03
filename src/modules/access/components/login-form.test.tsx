import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/auth-actions", () => ({ loginAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { LoginForm } from "./login-form";

afterEach(cleanup);

describe("LoginForm password visibility", () => {
  it("keeps login available without recovery navigation in portfolio mode", () => {
    render(<LoginForm isPortfolioDemo />);
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("Contraseña")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Olvidaste tu contraseña/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Explorar demo como invitado" }),
    ).not.toBeInTheDocument();
  });

  it("shows guest entry only with the DEMO activation flag", () => {
    render(<LoginForm isPortfolioDemo guestAccessEnabled />);
    expect(screen.getByRole("button", { name: "Explorar demo como invitado" })).toBeEnabled();
  });

  it("requires a Turnstile token before guest signup when configured", () => {
    render(<LoginForm isPortfolioDemo guestAccessEnabled turnstileSiteKey="public-site-key" />);
    expect(screen.getByRole("button", { name: "Explorar demo como invitado" })).toBeDisabled();
  });

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
