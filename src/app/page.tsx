import { redirect } from "next/navigation";

import { getPostLoginDestination } from "@/modules/access/server/access";
import { AuthorizationError } from "@/modules/access/server/authorization";

export default async function HomePage() {
  try {
    redirect(await getPostLoginDestination());
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "PROFILE_NOT_PROVISIONED") redirect("/no-access");
    }

    throw error;
  }
}
