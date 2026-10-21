import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";

import { CenterHeader } from "@/modules/access/components/center-header";
import { AuthorizationError, requireCenterMembership } from "@/modules/access/server/authorization";

export default async function CenterLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ centerId: string }>;
}) {
  const parsedCenterId = z.uuid().safeParse((await params).centerId);
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
    <div className="min-h-screen bg-slate-100/80">
      <CenterHeader
        centerId={parsedCenterId.data}
        centerName={context.center.name}
        user={context.user}
        role={context.membership.role}
      />
      {children}
    </div>
  );
}
