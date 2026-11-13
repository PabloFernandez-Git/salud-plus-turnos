import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";

import { CenterHeader } from "@/modules/access/components/center-header";
import { CenterSidebar } from "@/modules/access/components/center-sidebar";
import { hasOptionalPlatformNavigation } from "@/modules/access/server/access";
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

  const isPlatformAdmin = await hasOptionalPlatformNavigation(context.user.id);
  const isPortfolioDemo = process.env.PORTFOLIO_DEMO_MODE === "true";

  return (
    <div
      className={`center-layout grid min-h-dvh bg-slate-100/80 ${isPortfolioDemo ? "grid-rows-[auto_auto_minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)]"}`}
    >
      {isPortfolioDemo ? (
        <div className="border-b border-sky-200 bg-sky-50 px-5 py-2 text-center text-sm font-medium text-sky-900">
          Estás explorando una versión de demostración con datos ficticios. Las funciones de
          creación y edición están deshabilitadas.
        </div>
      ) : null}
      <CenterHeader
        centerId={parsedCenterId.data}
        centerName={context.center.name}
        user={context.user}
        role={context.membership.role}
        isPlatformAdmin={isPlatformAdmin}
        isPortfolioDemo={isPortfolioDemo}
      />
      <div className="min-w-0 md:flex">
        <CenterSidebar centerId={parsedCenterId.data} role={context.membership.role} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
