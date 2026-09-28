import { redirect } from "next/navigation";

import { AuthCard } from "@/modules/access/components/auth-card";
import { LoginForm } from "@/modules/access/components/login-form";
import { getPostLoginDestination } from "@/modules/access/server/access";
import { AuthorizationError } from "@/modules/access/server/authorization";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  try {
    redirect(await getPostLoginDestination());
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "PROFILE_NOT_PROVISIONED") redirect("/no-access");
      if (error.code !== "UNAUTHENTICATED") throw error;
    } else {
      throw error;
    }
  }

  const params = await searchParams;

  return (
    <AuthCard
      description="Ingresá con la cuenta que te asignó tu centro. No hay registro público."
      title="Iniciar sesión"
    >
      <LoginForm callbackError={params.error === "invalid_callback"} />
    </AuthCard>
  );
}
