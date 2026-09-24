"use server";

import { revalidatePath } from "next/cache";

import type {
  PlatformActionState,
  PlatformIdentityActionState,
} from "../domain/platform-action-state";
import {
  performCreatePlatformCenterAction,
  performResolvePlatformIdentityAction,
  performSetPlatformCenterActiveAction,
} from "../server/platform-actions";

export async function resolvePlatformIdentityAction(
  email: string,
): Promise<PlatformIdentityActionState> {
  return performResolvePlatformIdentityAction(email);
}

export async function createPlatformCenterAction(
  previousState: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  return performCreatePlatformCenterAction(previousState, formData, {
    revalidatePlatform: () => revalidatePath("/platform"),
  });
}

export async function setPlatformCenterActiveAction(
  previousState: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  return performSetPlatformCenterActiveAction(previousState, formData, {
    revalidatePlatform: () => revalidatePath("/platform"),
  });
}
