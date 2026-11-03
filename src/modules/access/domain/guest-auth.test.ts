import { describe, expect, it, vi } from "vitest";

import { enterPortfolioDemoAsGuest, type GuestAuthClient } from "./guest-auth";

function authClient(existingId: string | null, newId: string): GuestAuthClient {
  return {
    getSession: vi.fn().mockResolvedValue({
      data: { session: existingId ? { user: { id: existingId } } : null },
      error: null,
    }),
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: existingId ? { id: existingId } : null }, error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: newId } }, error: null }),
  };
}

describe("portfolio guest sign in", () => {
  it("reuses an existing browser session without creating another Auth user", async () => {
    const client = authClient("guest-a", "unused");
    await expect(enterPortfolioDemoAsGuest(client)).resolves.toBe("reused");
    expect(client.signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates separate sessions for independent visitors and forwards CAPTCHA", async () => {
    const first = authClient(null, "guest-a");
    const second = authClient(null, "guest-b");
    await expect(enterPortfolioDemoAsGuest(first, "challenge-a")).resolves.toBe("created");
    await expect(enterPortfolioDemoAsGuest(second, "challenge-b")).resolves.toBe("created");
    expect(first.signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: "challenge-a" },
    });
    expect(second.signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: "challenge-b" },
    });
  });

  it("does not navigate after a failed Auth signup", async () => {
    const client = authClient(null, "unused");
    vi.mocked(client.signInAnonymously).mockResolvedValue({
      data: { user: null },
      error: new Error("blocked"),
    });
    await expect(enterPortfolioDemoAsGuest(client)).rejects.toThrow("GUEST_SIGN_IN_FAILED");
  });

  it("does not create a duplicate when an existing session cannot be verified", async () => {
    const client = authClient("guest-a", "unused");
    vi.mocked(client.getUser).mockResolvedValue({
      data: { user: null },
      error: new Error("network"),
    });
    await expect(enterPortfolioDemoAsGuest(client)).rejects.toThrow("GUEST_SESSION_CHECK_FAILED");
    expect(client.signInAnonymously).not.toHaveBeenCalled();
  });
});
