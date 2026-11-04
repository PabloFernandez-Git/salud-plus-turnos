import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Turnstile, type TurnstileHandle } from "./turnstile";

type WidgetOptions = {
  callback: (token: string) => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "error-callback": () => boolean;
};

let options: WidgetOptions;
const reset = vi.fn();
const remove = vi.fn();

beforeEach(() => {
  reset.mockClear();
  remove.mockClear();
  window.turnstile = {
    render: vi.fn((_element, widgetOptions) => {
      options = widgetOptions;
      return "widget-1";
    }),
    reset,
    remove,
  };
});

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("loads the widget, exposes a valid token and removes it on unmount", async () => {
    const onTokenChange = vi.fn();
    const view = render(
      <Turnstile onTokenChange={onTokenChange} siteKey="1x00000000000000000000AA" />,
    );
    expect(screen.getByText("Cargando verificación…")).toBeVisible();
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    expect(window.turnstile?.render).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: "1x00000000000000000000AA" }),
    );
    act(() => options.callback("valid-token"));
    expect(onTokenChange).toHaveBeenCalledWith("valid-token");
    expect(screen.getByText("Verificación completada.")).toBeVisible();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("widget-1");
  });

  it("clears expired and failed tokens and lets the visitor retry", async () => {
    const onTokenChange = vi.fn();
    const ref = createRef<TurnstileHandle>();
    render(
      <Turnstile onTokenChange={onTokenChange} ref={ref} siteKey="2x00000000000000000000AB" />,
    );
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    act(() => options.callback("first-token"));
    act(() => options["expired-callback"]());
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("La verificación venció. Intentá nuevamente.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar verificación" }));
    expect(reset).toHaveBeenCalledWith("widget-1");
    act(() => options.callback("second-token"));
    act(() => options["error-callback"]());
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByText("No pudimos completar la verificación. Intentá nuevamente."),
    ).toBeVisible();
    act(() => ref.current?.reset());
    expect(reset).toHaveBeenCalledTimes(2);
    act(() => options["timeout-callback"]());
    expect(screen.getByText("La verificación venció. Intentá nuevamente.")).toBeVisible();
  });
});
