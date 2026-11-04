import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/auth-actions", () => ({ loginAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { loginAction } from "../actions/auth-actions";
import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  vi.mocked(loginAction).mockReset();
  delete window.turnstile;
  document.getElementById("portfolio-turnstile-script")?.remove();
});

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
    const guestButton = screen.getByRole("button", { name: "Explorar demo como invitado" });
    const passwordButton = screen.getByRole("button", { name: "Ingresar" });
    expect(guestButton).toBeDisabled();
    expect(guestButton).toHaveClass(
      "bg-sky-700",
      "cursor-pointer",
      "disabled:cursor-not-allowed",
      "disabled:opacity-60",
    );
    expect(passwordButton).toHaveClass(
      "bg-white",
      "cursor-pointer",
      "disabled:cursor-not-allowed",
      "disabled:opacity-60",
    );
    expect(screen.getByText("O ingresá con email y contraseña")).toBeVisible();
    expect(
      guestButton.compareDocumentPosition(passwordButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shares a verified token between DEMO password and guest sign-in", async () => {
    let verify: (token: string) => void = () => {};
    window.turnstile = {
      render: vi.fn((_element, options) => {
        verify = options.callback;
        return "widget-1";
      }),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    render(<LoginForm isPortfolioDemo guestAccessEnabled turnstileSiteKey="public-site-key" />);
    expect(screen.getByRole("button", { name: "Explorar demo como invitado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    act(() => verify("valid-token"));
    expect(screen.getByRole("button", { name: "Explorar demo como invitado" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(document.querySelector('input[name="captchaToken"]')).toHaveValue("valid-token");
    expect(screen.getAllByLabelText("Verificación de seguridad")).toHaveLength(1);
  });

  it("keeps the full application login unchanged outside DEMO", () => {
    render(<LoginForm turnstileSiteKey="public-site-key" />);
    const passwordButton = screen.getByRole("button", { name: "Ingresar" });
    expect(passwordButton).toBeEnabled();
    expect(passwordButton).toHaveClass("bg-sky-700");
    expect(passwordButton).not.toHaveClass("cursor-pointer");
    expect(document.querySelector('input[name="captchaToken"]')).toBeNull();
    expect(screen.queryByLabelText("Verificación de seguridad")).toBeNull();
  });

  it("resets a spent token after DEMO password Auth rejects the attempt", async () => {
    let verify: (token: string) => void = () => {};
    const reset = vi.fn();
    window.turnstile = {
      render: vi.fn((_element, options) => {
        verify = options.callback;
        return "widget-1";
      }),
      remove: vi.fn(),
      reset,
    };
    vi.mocked(loginAction).mockResolvedValueOnce({ status: "error", message: "Intento rechazado" });
    render(<LoginForm isPortfolioDemo turnstileSiteKey="1x00000000000000000000AA" />);
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    act(() => verify("spent-token"));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "demo@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "correcta" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ingresar" })));
    await waitFor(() => expect(reset).toHaveBeenCalledWith("widget-1"));
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
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
