import type { z } from "zod";

import {
  loginSchema,
  recoverySchema,
  updatePasswordSchema,
  type LoginInput,
} from "../schemas/auth";

export const INVALID_LOGIN_MESSAGE = "No pudimos iniciar sesión con esos datos.";
export const RECOVERY_RESULT_MESSAGE =
  "Si existe una cuenta asociada, recibirás instrucciones para restablecer tu contraseña.";
export const UPDATE_PASSWORD_ERROR_MESSAGE = "No pudimos actualizar la contraseña.";
export const LOGOUT_ERROR_MESSAGE = "No pudimos cerrar la sesión. Intentá nuevamente.";

type AuthError = { message?: string } | null;

export type AuthOperationsClient = {
  signInWithPassword(credentials: LoginInput): Promise<{ error: AuthError }>;
  resetPasswordForEmail(
    email: string,
    options: { redirectTo: string },
  ): Promise<{ error: AuthError }>;
  updateUser(attributes: { password: string }): Promise<{ error: AuthError }>;
  signOut(options: { scope: "local" }): Promise<{ error: AuthError }>;
};

export type AuthOperationResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

function validationFailure(error: z.ZodError): AuthOperationResult {
  return {
    ok: false,
    message: "Revisá los datos ingresados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

export async function signInWithPassword(
  input: unknown,
  auth: AuthOperationsClient,
): Promise<AuthOperationResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { error } = await auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: INVALID_LOGIN_MESSAGE };

  return { ok: true };
}

export async function requestPasswordRecovery(
  input: unknown,
  auth: AuthOperationsClient,
  redirectTo: string,
): Promise<AuthOperationResult> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  // The same public result is returned for existing, missing and provider-rejected emails.
  await auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  return { ok: true, message: RECOVERY_RESULT_MESSAGE };
}

export async function updatePassword(
  input: unknown,
  auth: AuthOperationsClient,
): Promise<AuthOperationResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { error } = await auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: UPDATE_PASSWORD_ERROR_MESSAGE };

  return { ok: true };
}

export async function signOutLocally(auth: AuthOperationsClient): Promise<AuthOperationResult> {
  const { error } = await auth.signOut({ scope: "local" });
  if (error) return { ok: false, message: LOGOUT_ERROR_MESSAGE };

  return { ok: true };
}
