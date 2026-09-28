import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CenterUsersScreen } from "@/modules/access/components/center-users-screen";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import {
  listAvailableProfessionalCenters,
  listCenterUsers,
  listManageableProfessionalCenters,
  type AvailableProfessionalCenter,
  type CenterUserListItem,
  type ManageableProfessionalCenter,
} from "@/modules/access/server/center-users";

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
  let professionalCenters: AvailableProfessionalCenter[] = [];
  let manageableProfessionalCenters: ManageableProfessionalCenter[] = [];
  let loadFailed = false;

  try {
    [users, professionalCenters, manageableProfessionalCenters] = await Promise.all([
      listCenterUsers(parsedCenterId.data, supabase),
      listAvailableProfessionalCenters(parsedCenterId.data, supabase),
      listManageableProfessionalCenters(parsedCenterId.data, supabase),
    ]);
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
      actorUserId={context.user.id}
      centerId={context.center.id}
      centerName={context.center.name}
      loadFailed={loadFailed}
      manageableProfessionalCenters={manageableProfessionalCenters}
      professionalCenters={professionalCenters}
      users={users}
    />
  );
}
