"use server";

import { revalidatePath } from "next/cache";
import { assertPortfolioWriteAllowed } from "../server/portfolio-demo";

import type {
  CenterUserActionState,
  CenterUserIdentityActionState,
} from "../domain/center-user-action-state";
import {
  performProvisionCenterUserAction,
  performResolveCenterIdentityAction,
} from "../server/center-user-actions";
import { performUpdateCenterMembershipAction } from "../server/center-membership-actions";

export async function resolveCenterIdentityAction(
  centerId: string,
  email: string,
): Promise<CenterUserIdentityActionState> {
  assertPortfolioWriteAllowed();
  return performResolveCenterIdentityAction(centerId, email);
}

export async function provisionCenterUserAction(
  previousState: CenterUserActionState,
  formData: FormData,
): Promise<CenterUserActionState> {
  assertPortfolioWriteAllowed();
  return performProvisionCenterUserAction(previousState, formData, {
    revalidateUsers: (centerId) => revalidatePath(`/centers/${centerId}/users`),
  });
}

export async function updateCenterMembershipAction(formData: FormData) {
  assertPortfolioWriteAllowed();
  return performUpdateCenterMembershipAction(formData, {
    revalidateUsers: (centerId) => revalidatePath(`/centers/${centerId}/users`),
  });
}
