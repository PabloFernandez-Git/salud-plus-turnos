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

describe("LoginForm", () => {
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

  it("keeps DEMO login enabled without Turnstile when CAPTCHA is off despite a site key", () => {
    render(<LoginForm isPortfolioDemo turnstileSiteKey="public-site-key" />);
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(screen.queryByLabelText("Verificación de seguridad")).toBeNull();
    expect(document.querySelector('input[name="captchaToken"]')).toBeNull();
    expect(document.getElementById("portfolio-turnstile-script")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("blocks DEMO login when CAPTCHA is required but the site key is absent", () => {
    render(<LoginForm isPortfolioDemo captchaRequired />);
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    expect(screen.queryByLabelText("Verificación de seguridad")).toBeNull();
  });

  it("starts on the login tab and switches with tabs and footer controls", () => {
    render(<LoginForm isPortfolioDemo guestAccessEnabled />);
    const loginTab = screen.getByRole("tab", { name: "Iniciar sesión" });
    const guestTab = screen.getByRole("tab", { name: "Demo invitado" });
    const passwordButton = screen.getByRole("button", { name: "Ingresar" });
    expect(loginTab).toHaveAttribute("aria-selected", "true");
    expect(guestTab).toHaveAttribute("aria-selected", "false");
    expect(loginTab.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(loginTab.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
    expect(guestTab.querySelector("svg circle")).toBeInTheDocument();
    expect(guestTab.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    expect(
      screen.getByText("Ingresá con el usuario y contraseña que te asignó tu centro."),
    ).toBeVisible();
    expect(passwordButton).toHaveClass(
      "bg-sky-700",
      "cursor-pointer",
      "disabled:cursor-not-allowed",
    );
    expect(screen.queryByRole("button", { name: "Explorar demo como invitado" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "demo@example.test" } });
    const guestLink = screen.getByRole("button", { name: "Explorá la demo como invitado" });
    expect(guestLink.closest("form")).toBeNull();
    expect(guestLink.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    fireEvent.click(guestLink);
    expect(guestTab).toHaveAttribute("aria-selected", "true");
    expect(guestTab).toHaveFocus();
    expect(loginAction).not.toHaveBeenCalled();
    const heading = screen.getByRole("heading", { name: "Explorá Salud Plus como invitado" });
    expect(heading).toHaveClass("text-xl", "lg:whitespace-nowrap");
    expect(heading.nextElementSibling).toHaveTextContent(
      "Conocé nuestro sistema de gestión de turnos médicos. Explorá sus funcionalidades con datos ficticios y acceso de solo lectura.",
    );
    const guestButton = screen.getByRole("button", { name: "Explorar demo como invitado" });
    expect(guestButton).toBeDisabled();
    expect(guestButton).toHaveClass(
      "bg-sky-700",
      "cursor-pointer",
      "disabled:cursor-not-allowed",
      "disabled:opacity-60",
    );
    expect(screen.getByText("¿Ya tenés una cuenta?")).toBeVisible();
    const loginLink = screen.getByRole("button", { name: "Iniciá sesión" });
    expect(loginLink.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    fireEvent.click(loginLink);
    expect(loginTab).toHaveAttribute("aria-selected", "true");
    expect(loginTab).toHaveFocus();
    expect(screen.getByLabelText("Email")).toHaveValue("demo@example.test");
    fireEvent.click(guestTab);
    expect(guestTab).toHaveAttribute("aria-selected", "true");
  });

  it("supports arrow, Home and End keys across tabs", () => {
    render(<LoginForm isPortfolioDemo guestAccessEnabled />);
    const loginTab = screen.getByRole("tab", { name: "Iniciar sesión" });
    const guestTab = screen.getByRole("tab", { name: "Demo invitado" });
    loginTab.focus();
    fireEvent.keyDown(loginTab, { key: "ArrowRight" });
    expect(guestTab).toHaveFocus();
    expect(guestTab).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(guestTab, { key: "Home" });
    expect(loginTab).toHaveFocus();
    fireEvent.keyDown(loginTab, { key: "End" });
    expect(guestTab).toHaveFocus();
    fireEvent.keyDown(guestTab, { key: "ArrowLeft" });
    expect(loginTab).toHaveFocus();
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
    render(
      <LoginForm
        isPortfolioDemo
        guestAccessEnabled
        captchaRequired
        turnstileSiteKey="public-site-key"
      />,
    );
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    act(() => verify("valid-token"));
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(document.querySelector('input[name="captchaToken"]')).toHaveValue("valid-token");
    expect(screen.getAllByLabelText("Verificación de seguridad")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Demo invitado" }));
    expect(screen.getByRole("button", { name: "Explorar demo como invitado" })).toBeEnabled();
    expect(window.turnstile?.render).toHaveBeenCalledOnce();
    expect(window.turnstile?.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Iniciar sesión" }));
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(document.querySelector('input[name="captchaToken"]')).toHaveValue("valid-token");
  });

  it("keeps the full application login unchanged outside DEMO", () => {
    render(<LoginForm captchaRequired turnstileSiteKey="public-site-key" />);
    const passwordButton = screen.getByRole("button", { name: "Ingresar" });
    expect(passwordButton).toBeEnabled();
    expect(passwordButton).toHaveClass("bg-sky-700");
    expect(passwordButton).not.toHaveClass("cursor-pointer");
    expect(document.querySelector('input[name="captchaToken"]')).toBeNull();
    expect(screen.queryByLabelText("Verificación de seguridad")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
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
    render(
      <LoginForm isPortfolioDemo captchaRequired turnstileSiteKey="1x00000000000000000000AA" />,
    );
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
