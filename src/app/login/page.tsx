import { redirect } from "next/navigation";

import { AuthCard } from "@/modules/access/components/auth-card";
import { DemoLoginShell } from "@/modules/access/components/demo-login-shell";
import { LoginForm } from "@/modules/access/components/login-form";
import { getPostLoginDestination } from "@/modules/access/server/access";
import { AuthorizationError } from "@/modules/access/server/authorization";
import { getPortfolioGuestLoginConfig } from "@/modules/access/server/portfolio-demo";

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
  const guest = getPortfolioGuestLoginConfig();
  const isPortfolioDemo = process.env.PORTFOLIO_DEMO_MODE === "true";
  const form = (
    <LoginForm
      callbackError={params.error === "invalid_callback"}
      isPortfolioDemo={isPortfolioDemo}
      guestAccessEnabled={guest.enabled}
      captchaRequired={guest.captchaRequired}
      turnstileSiteKey={guest.siteKey}
    />
  );

  if (isPortfolioDemo) return <DemoLoginShell>{form}</DemoLoginShell>;

  return (
    <AuthCard
      description="Ingresá con la cuenta que te asignó tu centro. No hay registro público."
      title="Iniciar sesión"
    >
      {form}
    </AuthCard>
  );
}
