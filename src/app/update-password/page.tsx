import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/modules/access/components/auth-card";
import { UpdatePasswordForm } from "@/modules/access/components/update-password-form";
import {
  AuthorizationError,
  requireAuthenticatedIdentity,
} from "@/modules/access/server/authorization";

export default async function UpdatePasswordPage() {
  if (process.env.PORTFOLIO_DEMO_MODE === "true") {
    return (
      <AuthCard title="Actualizar contraseña" description="Demo de solo lectura">
        <p>Disponible en la versión completa. Esta demo es de solo lectura.</p>
        <Link className="mt-4 inline-block font-medium text-sky-700 underline" href="/login">
          Volver al login
        </Link>
      </AuthCard>
    );
  }
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
