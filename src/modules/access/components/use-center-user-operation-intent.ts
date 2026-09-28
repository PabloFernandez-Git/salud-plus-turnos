"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  persistedCenterUserOperationIntentSchema,
  type CenterUserIntentPayload,
  type PersistedCenterUserOperationIntent,
} from "../schemas/center-user-provisioning";

export type CenterUserOperationIdFactory = () => string;

const browserOperationId: CenterUserOperationIdFactory = () => crypto.randomUUID();
const subscribeToHydration = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

export const CENTER_USER_OPERATION_INTENT_STORAGE_PREFIX =
  "salud-plus:center:provision-user-intent:v1";

export function centerUserOperationIntentStorageKey(actorUserId: string, centerId: string) {
  return `${CENTER_USER_OPERATION_INTENT_STORAGE_PREFIX}:${actorUserId}:${centerId}`;
}

export type CenterUserOperationIntentReadResult =
  | { status: "absent" }
  | { status: "valid"; intent: PersistedCenterUserOperationIntent }
  | { status: "invalid" };

export function readCenterUserOperationIntent(
  storage: Pick<Storage, "getItem">,
  actorUserId: string,
  centerId: string,
): CenterUserOperationIntentReadResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(centerUserOperationIntentStorageKey(actorUserId, centerId));
  } catch {
    return { status: "invalid" };
  }

  if (serialized === null) return { status: "absent" };

  try {
    const parsed = persistedCenterUserOperationIntentSchema.safeParse(JSON.parse(serialized));
    if (
      parsed.success &&
      parsed.data.actorUserId === actorUserId &&
      parsed.data.centerId === centerId &&
      parsed.data.scope === "tenant-provision-user"
    ) {
      return { status: "valid", intent: parsed.data };
    }
  } catch {
    // Untrusted persisted content is never partially recovered.
  }

  return { status: "invalid" };
}

export function writeCenterUserOperationIntent(
  storage: Pick<Storage, "setItem">,
  actorUserId: string,
  centerId: string,
  intent: PersistedCenterUserOperationIntent,
) {
  storage.setItem(
    centerUserOperationIntentStorageKey(actorUserId, centerId),
    JSON.stringify(intent),
  );
}

export function removeCenterUserOperationIntent(
  storage: Pick<Storage, "removeItem">,
  actorUserId: string,
  centerId: string,
) {
  storage.removeItem(centerUserOperationIntentStorageKey(actorUserId, centerId));
}

export function useCenterUserOperationIntent(
  actorUserId: string,
  centerId: string,
  createOperationId: CenterUserOperationIdFactory = browserOperationId,
) {
  const [intentState, setIntentState] = useState<{
    operationId: string | null;
    pendingIntent: PersistedCenterUserOperationIntent | null;
    recoveryStatus: CenterUserOperationIntentReadResult["status"];
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

    const recovered = readCenterUserOperationIntent(window.sessionStorage, actorUserId, centerId);
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
    (payload: CenterUserIntentPayload) => {
      if (!operationId) return false;
      const intent = {
        version: 1 as const,
        scope: "tenant-provision-user" as const,
        actorUserId,
        centerId,
        operationId,
        payload,
      };
      const parsed = persistedCenterUserOperationIntentSchema.safeParse(intent);
      if (!parsed.success) return false;

      try {
        writeCenterUserOperationIntent(window.sessionStorage, actorUserId, centerId, parsed.data);
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
    [actorUserId, centerId, operationId],
  );

  const clearPendingIntent = useCallback(() => {
    removeCenterUserOperationIntent(window.sessionStorage, actorUserId, centerId);
  }, [actorUserId, centerId]);

  const startNewIntent = useCallback(() => {
    try {
      removeCenterUserOperationIntent(window.sessionStorage, actorUserId, centerId);
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
  }, [actorUserId, centerId, createOperationId]);

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
