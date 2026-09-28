"use server";

import { revalidatePath } from "next/cache";

import type {
  CenterUserActionState,
  CenterUserIdentityActionState,
} from "../domain/center-user-action-state";
import {
  performProvisionCenterUserAction,
  performResolveCenterIdentityAction,
} from "../server/center-user-actions";

export async function resolveCenterIdentityAction(
  centerId: string,
  email: string,
): Promise<CenterUserIdentityActionState> {
  return performResolveCenterIdentityAction(centerId, email);
}

export async function provisionCenterUserAction(
  previousState: CenterUserActionState,
  formData: FormData,
): Promise<CenterUserActionState> {
  return performProvisionCenterUserAction(previousState, formData, {
    revalidateUsers: (centerId) => revalidatePath(`/centers/${centerId}/users`),
  });
}
