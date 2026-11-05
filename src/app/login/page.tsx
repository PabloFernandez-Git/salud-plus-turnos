import { redirect } from "next/navigation";

import { LoginForm } from "@/modules/access/components/login-form";
import { LoginShell } from "@/modules/access/components/login-shell";
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
    <LoginShell>
      <LoginForm callbackError={params.error === "invalid_callback"} />
    </LoginShell>
  );
}
