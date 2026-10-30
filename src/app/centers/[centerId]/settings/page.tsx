import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PageReveal } from "@/components/page-reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CenterSettingsScreen } from "@/modules/access/components/center-settings-screen";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { getCenterSettings } from "@/modules/access/server/center-settings";

export default async function CenterSettingsPage({
  params,
}: {
  params: Promise<{ centerId: string }>;
}) {
  const centerId = z.uuid().safeParse((await params).centerId);
  if (!centerId.success) notFound();

  const client = await createSupabaseServerClient();
  try {
    await requireRole(centerId.data, ["ADMIN"], client);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (["CENTER_ACCESS_DENIED", "ROLE_FORBIDDEN"].includes(error.code)) notFound();
      redirect(error.redirectTo);
    }
    throw error;
  }

  const settings = await getCenterSettings(centerId.data, client);
  return (
    <PageReveal>
      <CenterSettingsScreen key={settings.id} settings={settings} />
    </PageReveal>
  );
}
