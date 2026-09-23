import { redirect } from "next/navigation";

import { AuthCard } from "@/modules/access/components/auth-card";
import { UpdatePasswordForm } from "@/modules/access/components/update-password-form";
import {
  AuthorizationError,
  requireAuthenticatedIdentity,
} from "@/modules/access/server/authorization";

export default async function UpdatePasswordPage() {
  try {
    await requireAuthenticatedIdentity();
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "UNAUTHENTICATED") {
      redirect("/login?error=invalid_callback");
    }
    throw error;
  }

  return (
    <AuthCard
      description="Elegí una nueva contraseña para tu cuenta."
      title="Actualizar contraseña"
    >
      <UpdatePasswordForm />
    </AuthCard>
  );
}
