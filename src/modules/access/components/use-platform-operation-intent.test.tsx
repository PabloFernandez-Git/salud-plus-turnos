import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformCenterIntentPayload } from "../schemas/platform";
import {
  PLATFORM_OPERATION_INTENT_STORAGE_PREFIX,
  platformOperationIntentStorageKey,
  readPlatformOperationIntent,
  usePlatformOperationIntent,
} from "./use-platform-operation-intent";

const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const firstOperationId = "11111111-1111-4111-8111-111111111111";
const secondOperationId = "22222222-2222-4222-8222-222222222222";
const password = "password-that-must-not-be-stored";
const payload: PlatformCenterIntentPayload = {
  centerName: "Centro Norte",
  centerAddress: "Av. Salud 123",
  centerPhone: "+54 11 4444 5555",
  centerEmail: "centro@example.test",
  centerTimezone: "America/Argentina/Buenos_Aires",
  adminEmail: "admin@example.test",
  adminFirstName: "Ana",
  adminLastName: "Pérez",
  identityExists: false,
};
const payloadWithPassword = { ...payload, adminInitialPassword: password };
const validIntent = {
  version: 1 as const,
  scope: "platform-create-center" as const,
  actorUserId,
  operationId: firstOperationId,
  payload,
};

function IntentHarness({ createOperationId }: { createOperationId: () => string }) {
  const {
    clearPendingIntent,
    isHydrated,
    operationId,
    pendingIntent,
    persistPendingIntent,
    recoveryStatus,
    startNewIntent,
    wasRecovered,
  } = usePlatformOperationIntent(actorUserId, createOperationId);

  return (
    <>
      <output data-testid="operation-id">{operationId}</output>
      <output data-testid="hydrated">{String(isHydrated)}</output>
      <output data-testid="recovered">{String(wasRecovered)}</output>
      <output data-testid="recovery-status">{recoveryStatus}</output>
      <output data-testid="pending">{pendingIntent?.payload.centerName ?? ""}</output>
      <button onClick={() => persistPendingIntent(payload)} type="button">
        Persistir
      </button>
      <button onClick={() => persistPendingIntent(payloadWithPassword)} type="button">
        Intentar persistir password
      </button>
      <button onClick={clearPendingIntent} type="button">
        Confirmar
      </button>
      <button onClick={startNewIntent} type="button">
        Abandonar e iniciar nueva alta
      </button>
    </>
  );
}

function storedIntentValues() {
  return Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith(PLATFORM_OPERATION_INTENT_STORAGE_PREFIX))
    .map(([, value]) => value);
}

describe("usePlatformOperationIntent", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  it("keeps the id across rerenders and replaces it only for a deliberate new intent", async () => {
    const createOperationId = vi
      .fn<() => string>()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId);
    const view = render(<IntentHarness createOperationId={createOperationId} />);

    await waitFor(() =>
      expect(screen.getByTestId("operation-id")).toHaveTextContent(firstOperationId),
    );
    view.rerender(<IntentHarness createOperationId={createOperationId} />);
    expect(screen.getByTestId("operation-id")).toHaveTextContent(firstOperationId);
    expect(createOperationId).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Abandonar e iniciar nueva alta" }));
    expect(screen.getByTestId("operation-id")).toHaveTextContent(secondOperationId);
    expect(createOperationId).toHaveBeenCalledTimes(2);
  });

  it("restores the same id and material payload after an unmount/refresh boundary", async () => {
    const createOperationId = vi
      .fn<() => string>()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId);
    const firstMount = render(<IntentHarness createOperationId={createOperationId} />);
    await waitFor(() =>
      expect(screen.getByTestId("operation-id")).toHaveTextContent(firstOperationId),
    );
    fireEvent.click(screen.getByRole("button", { name: "Persistir" }));
    expect(screen.getByTestId("pending")).toHaveTextContent(payload.centerName);
    firstMount.unmount();

    render(<IntentHarness createOperationId={createOperationId} />);
    await waitFor(() => expect(screen.getByTestId("recovered")).toHaveTextContent("true"));
    expect(screen.getByTestId("operation-id")).toHaveTextContent(firstOperationId);
    expect(screen.getByTestId("pending")).toHaveTextContent(payload.centerName);
    expect(createOperationId).toHaveBeenCalledOnce();
  });

  it("stores only non-secret metadata and clears it after unequivocal success", async () => {
    const createOperationId = vi.fn(() => firstOperationId);
    render(<IntentHarness createOperationId={createOperationId} />);
    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));

    fireEvent.click(screen.getByRole("button", { name: "Intentar persistir password" }));
    expect(storedIntentValues()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /^Persistir$/ }));
    const stored = storedIntentValues();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toContain(firstOperationId);
    expect(stored[0]).toContain(payload.centerName);
    expect(stored[0]).not.toContain(password);
    expect(stored[0]).not.toContain("adminInitialPassword");

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(storedIntentValues()).toHaveLength(0);
  });

  it("abandons a recovered intent explicitly and issues a different id", async () => {
    const createOperationId = vi
      .fn<() => string>()
      .mockReturnValueOnce(firstOperationId)
      .mockReturnValueOnce(secondOperationId);
    const firstMount = render(<IntentHarness createOperationId={createOperationId} />);
    await waitFor(() =>
      expect(screen.getByTestId("operation-id")).toHaveTextContent(firstOperationId),
    );
    fireEvent.click(screen.getByRole("button", { name: "Persistir" }));
    firstMount.unmount();

    render(<IntentHarness createOperationId={createOperationId} />);
    await waitFor(() => expect(screen.getByTestId("recovered")).toHaveTextContent("true"));
    fireEvent.click(screen.getByRole("button", { name: "Abandonar e iniciar nueva alta" }));

    expect(screen.getByTestId("operation-id")).toHaveTextContent(secondOperationId);
    expect(screen.getByTestId("recovered")).toHaveTextContent("false");
    expect(storedIntentValues()).toHaveLength(0);
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["an unknown root property", JSON.stringify({ ...validIntent, extraField: "unexpected" })],
    [
      "an unknown nested payload property",
      JSON.stringify({
        ...validIntent,
        payload: { ...payload, extraField: "unexpected" },
      }),
    ],
  ])(
    "keeps an invalid snapshot with %s blocked across remounts until explicit abandonment",
    async (_description, invalidSnapshot) => {
      const key = platformOperationIntentStorageKey(actorUserId);
      sessionStorage.setItem(key, invalidSnapshot);
      const createOperationId = vi.fn(() => secondOperationId);

      const firstMount = render(<IntentHarness createOperationId={createOperationId} />);
      expect(screen.getByTestId("recovery-status")).toHaveTextContent("invalid");
      expect(screen.getByTestId("operation-id")).toHaveTextContent("");
      expect(createOperationId).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(key)).toBe(invalidSnapshot);
      firstMount.unmount();

      render(<IntentHarness createOperationId={createOperationId} />);
      expect(screen.getByTestId("recovery-status")).toHaveTextContent("invalid");
      expect(screen.getByTestId("operation-id")).toHaveTextContent("");
      expect(createOperationId).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(key)).toBe(invalidSnapshot);

      fireEvent.click(screen.getByRole("button", { name: "Abandonar e iniciar nueva alta" }));
      expect(sessionStorage.getItem(key)).toBeNull();
      expect(screen.getByTestId("recovery-status")).toHaveTextContent("absent");
      expect(screen.getByTestId("operation-id")).toHaveTextContent(secondOperationId);
      expect(createOperationId).toHaveBeenCalledOnce();
    },
  );
});

describe("readPlatformOperationIntent", () => {
  it("distinguishes an absent key from a valid snapshot", () => {
    expect(readPlatformOperationIntent({ getItem: () => null }, actorUserId)).toEqual({
      status: "absent",
    });
    expect(
      readPlatformOperationIntent({ getItem: () => JSON.stringify(validIntent) }, actorUserId),
    ).toEqual({ status: "valid", intent: validIntent });
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["unknown schema version", JSON.stringify({ ...validIntent, version: 2 })],
    ["missing fields", JSON.stringify({ version: 1, operationId: firstOperationId })],
    ["invalid UUID", JSON.stringify({ ...validIntent, operationId: "not-a-uuid" })],
    [
      "inconsistent actor",
      JSON.stringify({
        ...validIntent,
        actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ],
    ["inconsistent scope", JSON.stringify({ ...validIntent, scope: "tenant" })],
    ["unknown root property", JSON.stringify({ ...validIntent, extraField: "unexpected" })],
    [
      "unknown nested payload property",
      JSON.stringify({
        ...validIntent,
        payload: { ...payload, extraField: "unexpected" },
      }),
    ],
    [
      "invalid payload",
      JSON.stringify({
        ...validIntent,
        payload: { ...payload, centerTimezone: "Mars/Olympus" },
      }),
    ],
  ])("returns INVALID without mutating storage for %s", (_description, serialized) => {
    const getItem = vi.fn(() => serialized);

    expect(readPlatformOperationIntent({ getItem }, actorUserId)).toEqual({ status: "invalid" });
    expect(getItem).toHaveBeenCalledOnce();
  });

  it("fails closed when storage cannot be read", () => {
    const storage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
    };

    expect(readPlatformOperationIntent(storage, actorUserId)).toEqual({ status: "invalid" });
  });
});
