type GuestAuthUser = { id: string };

export type GuestAuthClient = {
  getSession(): Promise<{ data: { session: unknown | null }; error: unknown }>;
  getUser(): Promise<{ data: { user: GuestAuthUser | null }; error: unknown }>;
  signInAnonymously(credentials?: {
    options?: { captchaToken?: string };
  }): Promise<{ data: { user: GuestAuthUser | null }; error: unknown }>;
};

/** Reuse any valid session before asking Auth to create a new anonymous user. */
export async function enterPortfolioDemoAsGuest(
  auth: GuestAuthClient,
  captchaToken?: string,
): Promise<"reused" | "created"> {
  const existingSession = await auth.getSession();
  if (existingSession.error) throw new Error("GUEST_SESSION_CHECK_FAILED");
  if (existingSession.data.session) {
    const existingUser = await auth.getUser();
    if (existingUser.error || !existingUser.data.user) {
      throw new Error("GUEST_SESSION_CHECK_FAILED");
    }
    return "reused";
  }

  const result = await auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined,
  );
  if (result.error || !result.data.user) {
    throw new Error("GUEST_SIGN_IN_FAILED");
  }
  return "created";
}
