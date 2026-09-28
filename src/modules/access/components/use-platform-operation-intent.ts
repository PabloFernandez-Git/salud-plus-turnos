"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  persistedPlatformOperationIntentSchema,
  type PersistedPlatformOperationIntent,
  type PlatformCenterIntentPayload,
} from "../schemas/platform";

export type OperationIdFactory = () => string;

const browserOperationId: OperationIdFactory = () => crypto.randomUUID();
const subscribeToHydration = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;
export const PLATFORM_OPERATION_INTENT_STORAGE_PREFIX =
  "salud-plus:platform:create-center-intent:v1";

export function platformOperationIntentStorageKey(actorUserId: string) {
  return `${PLATFORM_OPERATION_INTENT_STORAGE_PREFIX}:${actorUserId}`;
}

export type PlatformOperationIntentReadResult =
  | { status: "absent" }
  | { status: "valid"; intent: PersistedPlatformOperationIntent }
  | { status: "invalid" };

export function readPlatformOperationIntent(
  storage: Pick<Storage, "getItem">,
  actorUserId: string,
): PlatformOperationIntentReadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(platformOperationIntentStorageKey(actorUserId));
  } catch {
    return { status: "invalid" };
  }

  if (serialized === null) return { status: "absent" };

  try {
    const parsed = persistedPlatformOperationIntentSchema.safeParse(JSON.parse(serialized));
    if (
      parsed.success &&
      parsed.data.actorUserId === actorUserId &&
      parsed.data.scope === "platform-create-center"
    ) {
      return { status: "valid", intent: parsed.data };
    }
  } catch {
    // Presence is preserved as INVALID; no field is recovered from untrusted content.
  }

  return { status: "invalid" };
}

export function writePlatformOperationIntent(
  storage: Pick<Storage, "setItem">,
  actorUserId: string,
  intent: PersistedPlatformOperationIntent,
) {
  storage.setItem(platformOperationIntentStorageKey(actorUserId), JSON.stringify(intent));
}

export function removePlatformOperationIntent(
  storage: Pick<Storage, "removeItem">,
  actorUserId: string,
) {
  storage.removeItem(platformOperationIntentStorageKey(actorUserId));
}

export function usePlatformOperationIntent(
  actorUserId: string,
  createOperationId: OperationIdFactory = browserOperationId,
) {
  const [intentState, setIntentState] = useState<{
    operationId: string | null;
    pendingIntent: PersistedPlatformOperationIntent | null;
    recoveryStatus: PlatformOperationIntentReadResult["status"];
    wasRecovered: boolean;
  }>(() => {
    if (typeof window === "undefined") {
      return {
        operationId: null,
        pendingIntent: null,
        recoveryStatus: "absent",
        wasRecovered: false,
      };
    }
    const recovered = readPlatformOperationIntent(window.sessionStorage, actorUserId);
    if (recovered.status === "valid") {
      return {
        operationId: recovered.intent.operationId,
        pendingIntent: recovered.intent,
        recoveryStatus: "valid",
        wasRecovered: true,
      };
    }
    if (recovered.status === "invalid") {
      return {
        operationId: null,
        pendingIntent: null,
        recoveryStatus: "invalid",
        wasRecovered: false,
      };
    }
    return {
      operationId: createOperationId(),
      pendingIntent: null,
      recoveryStatus: "absent",
      wasRecovered: false,
    };
  });
  const [abandonError, setAbandonError] = useState<string | null>(null);
  const isHydrated = useSyncExternalStore(subscribeToHydration, browserSnapshot, serverSnapshot);
  const { operationId, pendingIntent, recoveryStatus, wasRecovered } = intentState;

  const persistPendingIntent = useCallback(
    (payload: PlatformCenterIntentPayload) => {
      if (!operationId) return false;
      const intent = {
        version: 1 as const,
        scope: "platform-create-center" as const,
        actorUserId,
        operationId,
        payload,
      };
      const parsed = persistedPlatformOperationIntentSchema.safeParse(intent);
      if (!parsed.success) return false;

      try {
        writePlatformOperationIntent(window.sessionStorage, actorUserId, parsed.data);
        setIntentState((current) => ({
          ...current,
          pendingIntent: parsed.data,
          recoveryStatus: "valid",
        }));
        return true;
      } catch {
        return false;
      }
    },
    [actorUserId, operationId],
  );

  const clearPendingIntent = useCallback(() => {
    removePlatformOperationIntent(window.sessionStorage, actorUserId);
  }, [actorUserId]);

  const startNewIntent = useCallback(() => {
    try {
      removePlatformOperationIntent(window.sessionStorage, actorUserId);
    } catch {
      setAbandonError(
        "No pudimos abandonar la intención pendiente. No se inició una operación nueva.",
      );
      return;
    }
    setAbandonError(null);
    setIntentState({
      operationId: createOperationId(),
      pendingIntent: null,
      recoveryStatus: "absent",
      wasRecovered: false,
    });
  }, [actorUserId, createOperationId]);

  return {
    abandonError,
    clearPendingIntent,
    isHydrated,
    operationId,
    pendingIntent,
    persistPendingIntent,
    recoveryStatus,
    startNewIntent,
    wasRecovered,
  };
}
