import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PageReveal } from "@/components/page-reveal";
import { CenterDashboard } from "@/modules/access/components/center-dashboard";
import { AuthorizationError, requireCenterMembership } from "@/modules/access/server/authorization";

const centerIdSchema = z.uuid();

export default async function CenterPage({ params }: { params: Promise<{ centerId: string }> }) {
  const parsedCenterId = centerIdSchema.safeParse((await params).centerId);
  if (!parsedCenterId.success) notFound();

  let context;
  try {
    context = await requireCenterMembership(parsedCenterId.data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "CENTER_ACCESS_DENIED") notFound();
      redirect(error.redirectTo);
    }
    throw error;
  }

  return (
    <PageReveal>
      <CenterDashboard centerId={context.center.id} role={context.membership.role} />
    </PageReveal>
  );
}
