"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  requestPasswordRecovery,
  signInWithPassword,
  signOutLocally,
  updatePassword,
  type AuthOperationResult,
} from "../domain/auth-operations";
import { getPostLoginDestination } from "../server/access";
import { AuthorizationError, requireAuthenticatedIdentity } from "../server/authorization";

export type AuthActionState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
  status: "idle" | "error" | "success";
};

const recoveryCallbackUrl = "http://localhost:3000/auth/callback";

function actionState(result: AuthOperationResult): AuthActionState {
  return result.ok
    ? { status: "success", message: result.message }
    : {
        status: "error",
        message: result.message,
        fieldErrors: result.fieldErrors,
      };
}

async function postLoginDestination() {
  try {
    return await getPostLoginDestination();
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "PROFILE_NOT_PROVISIONED") {
      return "/no-access";
    }

    throw error;
  }
}

export async function loginAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  void previousState;
  const supabase = await createSupabaseServerClient();
  const result = await signInWithPassword(
    {
      email: formData.get("email"),
      password: formData.get("password"),
    },
    supabase.auth,
  );

  if (!result.ok) return actionState(result);

  redirect(await postLoginDestination());
}

export async function recoveryAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  void previousState;
  const supabase = await createSupabaseServerClient();
  const result = await requestPasswordRecovery(
    { email: formData.get("email") },
    supabase.auth,
    recoveryCallbackUrl,
  );

  return actionState(result);
}

export async function updatePasswordAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  void previousState;
  const supabase = await createSupabaseServerClient();

  try {
    await requireAuthenticatedIdentity(supabase);
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "UNAUTHENTICATED") {
      return {
        status: "error",
        message: "El enlace de recuperación no es válido o venció.",
      };
    }
    throw error;
  }

  const result = await updatePassword(
    {
      password: formData.get("password"),
      passwordConfirmation: formData.get("passwordConfirmation"),
    },
    supabase.auth,
  );

  if (!result.ok) return actionState(result);

  redirect(await postLoginDestination());
}

export async function logoutAction(previousState: AuthActionState): Promise<AuthActionState> {
  void previousState;
  const supabase = await createSupabaseServerClient();
  const result = await signOutLocally(supabase.auth);

  if (!result.ok) return actionState(result);

  redirect("/login");
}
