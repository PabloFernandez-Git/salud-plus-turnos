import { createRef, type FormEvent } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./password-input";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("starts hidden and toggles visibility without clearing the value", () => {
    render(<PasswordInput aria-label="Contraseña" defaultValue="secreto-123" />);

    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("secreto-123");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("secreto-123");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("secreto-123");
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Mostrar contraseña" }).querySelector("svg"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("does not submit its form when toggled", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Contraseña" name="password" />
      </form>,
    );

    const button = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("forwards native props and the input ref, including controlled changes", () => {
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(
      <PasswordInput
        aria-describedby="password-help"
        aria-invalid="true"
        autoComplete="new-password"
        autoFocus
        className="custom-field"
        id="new-password"
        minLength={10}
        name="password"
        onChange={onChange}
        ref={ref}
        required
        value="initial-value"
      />,
    );

    const input = ref.current!;
    expect(input).toHaveAttribute("id", "new-password");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(input).toHaveAttribute("minlength", "10");
    expect(input).toHaveAttribute("aria-describedby", "password-help");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toBeRequired();
    expect(input).toHaveClass("custom-field");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "changed-value" } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("disables the toggle with the input", () => {
    render(<PasswordInput aria-label="Contraseña" disabled />);
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toBeDisabled();
    expect(screen.getByLabelText("Contraseña")).toBeDisabled();
  });
});
