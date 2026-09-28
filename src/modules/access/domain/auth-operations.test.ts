import { describe, expect, it, vi } from "vitest";

import {
  INVALID_LOGIN_MESSAGE,
  RECOVERY_RESULT_MESSAGE,
  requestPasswordRecovery,
  signInWithPassword,
  signOutLocally,
  updatePassword,
  type AuthOperationsClient,
} from "./auth-operations";

function authClient(overrides: Partial<AuthOperationsClient> = {}): AuthOperationsClient {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe("Auth operations", () => {
  it("returns a generic error for invalid credentials", async () => {
    const client = authClient({
      signInWithPassword: vi.fn().mockResolvedValue({ error: { message: "User not found" } }),
    });

    await expect(
      signInWithPassword({ email: "persona@example.test", password: "incorrecta" }, client),
    ).resolves.toEqual({ ok: false, message: INVALID_LOGIN_MESSAGE });
  });

  it("accepts valid login credentials", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null });
    const client = authClient({ signInWithPassword: signIn });

    await expect(
      signInWithPassword({ email: "persona@example.test", password: "correcta" }, client),
    ).resolves.toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledWith({
      email: "persona@example.test",
      password: "correcta",
    });
  });

  it("logs out the local session", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = authClient({ signOut });

    await expect(signOutLocally(client)).resolves.toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("keeps password recovery anti-enumeration even when the provider rejects the request", async () => {
    const resetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: { message: "User not found" } });
    const client = authClient({ resetPasswordForEmail });

    await expect(
      requestPasswordRecovery(
        { email: "missing@example.test" },
        client,
        "http://localhost:3000/auth/callback",
      ),
    ).resolves.toEqual({ ok: true, message: RECOVERY_RESULT_MESSAGE });
  });

  it("rejects an update password shorter than 10 characters before calling Auth", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const client = authClient({ updateUser });

    const result = await updatePassword(
      { password: "123456789", passwordConfirmation: "123456789" },
      client,
    );

    expect(result).toMatchObject({ ok: false });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates a valid matching password", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const client = authClient({ updateUser });

    await expect(
      updatePassword({ password: "abcdefghij", passwordConfirmation: "abcdefghij" }, client),
    ).resolves.toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledExactlyOnceWith({ password: "abcdefghij" });
  });
});
