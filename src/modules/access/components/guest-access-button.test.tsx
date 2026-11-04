import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: {} }),
}));
vi.mock("../domain/guest-auth", () => ({ enterPortfolioDemoAsGuest: vi.fn() }));

import { enterPortfolioDemoAsGuest } from "../domain/guest-auth";
import { GuestAccessButton } from "./guest-access-button";

afterEach(cleanup);

describe("GuestAccessButton", () => {
  it("waits for a token, then resets the challenge after Auth rejects it", async () => {
    const resetCaptcha = vi.fn();
    vi.mocked(enterPortfolioDemoAsGuest).mockRejectedValueOnce(new Error("invalid captcha"));
    const view = render(<GuestAccessButton captchaToken={null} resetCaptcha={resetCaptcha} />);
    const button = screen.getByRole("button", { name: "Explorar demo como invitado" });
    expect(button).toBeDisabled();
    view.rerender(<GuestAccessButton captchaToken="invalid-token" resetCaptcha={resetCaptcha} />);
    fireEvent.click(button);
    await waitFor(() => expect(resetCaptcha).toHaveBeenCalledOnce());
    expect(enterPortfolioDemoAsGuest).toHaveBeenCalledWith({}, "invalid-token");
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos abrir la demo");
  });
});
