import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("../server/access", () => ({ getPostLoginDestination: vi.fn().mockResolvedValue("/") }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginAction } from "./auth-actions";

const previousDemoMode = process.env.PORTFOLIO_DEMO_MODE;
const previousCaptchaRequired = process.env.PORTFOLIO_CAPTCHA_REQUIRED;
const signInWithPassword = vi.fn();

function loginData(captchaToken?: string) {
  const form = new FormData();
  form.set("email", "demo@example.test");
  form.set("password", "correcta");
  if (captchaToken !== undefined) form.set("captchaToken", captchaToken);
  return form;
}

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { signInWithPassword },
  } as never);
});

afterEach(() => {
  if (previousDemoMode === undefined) delete process.env.PORTFOLIO_DEMO_MODE;
  else process.env.PORTFOLIO_DEMO_MODE = previousDemoMode;
  if (previousCaptchaRequired === undefined) delete process.env.PORTFOLIO_CAPTCHA_REQUIRED;
  else process.env.PORTFOLIO_CAPTCHA_REQUIRED = previousCaptchaRequired;
});

describe("DEMO password CAPTCHA", () => {
  it("rejects a missing token before opening Supabase Auth", async () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    process.env.PORTFOLIO_CAPTCHA_REQUIRED = "true";
    await expect(loginAction({ status: "idle" }, loginData())).resolves.toMatchObject({
      status: "error",
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("sends a valid token and rejects an invalid token returned by Auth", async () => {
    process.env.PORTFOLIO_DEMO_MODE = "true";
    process.env.PORTFOLIO_CAPTCHA_REQUIRED = "true";
    await expect(loginAction({ status: "idle" }, loginData("valid-token"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "demo@example.test",
      password: "correcta",
      options: { captchaToken: "valid-token" },
    });

    signInWithPassword.mockResolvedValueOnce({ error: { message: "captcha verification failed" } });
    await expect(
      loginAction({ status: "idle" }, loginData("invalid-token")),
    ).resolves.toMatchObject({
      status: "error",
    });
    expect(signInWithPassword).toHaveBeenLastCalledWith({
      email: "demo@example.test",
      password: "correcta",
      options: { captchaToken: "invalid-token" },
    });
  });

  it("leaves non-DEMO login without CAPTCHA", async () => {
    process.env.PORTFOLIO_DEMO_MODE = "false";
    process.env.PORTFOLIO_CAPTCHA_REQUIRED = "true";
    await expect(loginAction({ status: "idle" }, loginData())).rejects.toThrow("NEXT_REDIRECT");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "demo@example.test",
      password: "correcta",
    });
  });
});
