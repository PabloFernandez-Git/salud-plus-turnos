import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CenterUsersScreen } from "@/modules/access/components/center-users-screen";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { listCenterUsers, type CenterUserListItem } from "@/modules/access/server/center-users";

const centerIdSchema = z.uuid();

export default async function CenterUsersPage({
  params,
}: {
  params: Promise<{ centerId: string }>;
}) {
  const parsedCenterId = centerIdSchema.safeParse((await params).centerId);
  if (!parsedCenterId.success) notFound();

  const supabase = await createSupabaseServerClient();
  let context;

  try {
    context = await requireRole(parsedCenterId.data, ["ADMIN"], supabase);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (["CENTER_ACCESS_DENIED", "ROLE_FORBIDDEN"].includes(error.code)) notFound();
      redirect(error.redirectTo);
    }
    throw error;
  }

  let users: CenterUserListItem[] = [];
  let loadFailed = false;

  try {
    users = await listCenterUsers(parsedCenterId.data, supabase);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (["CENTER_ACCESS_DENIED", "ROLE_FORBIDDEN"].includes(error.code)) notFound();
      redirect(error.redirectTo);
    }
    loadFailed = true;
  }

  return (
    <CenterUsersScreen
      centerId={context.center.id}
      centerName={context.center.name}
      loadFailed={loadFailed}
      users={users}
    />
  );
}
