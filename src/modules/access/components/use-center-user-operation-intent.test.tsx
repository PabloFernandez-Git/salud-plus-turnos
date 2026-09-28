import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CenterUserIntentPayload } from "../schemas/center-user-provisioning";
import {
  CENTER_USER_OPERATION_INTENT_STORAGE_PREFIX,
  centerUserOperationIntentStorageKey,
  readCenterUserOperationIntent,
  useCenterUserOperationIntent,
} from "./use-center-user-operation-intent";

const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const centerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const firstOperationId = "11111111-1111-4111-8111-111111111111";
const secondOperationId = "22222222-2222-4222-8222-222222222222";
const password = "password-that-must-not-be-stored";
const payload: CenterUserIntentPayload = {
  email: "new-user@example.test",
  identityExists: false,
  firstName: "Ana",
  lastName: "Pérez",
  role: "RECEPTION",
  professionalCenterId: null,
};
const payloadWithPassword = { ...payload, initialPassword: password };
const validIntent = {
  version: 1 as const,
  scope: "tenant-provision-user" as const,
  actorUserId,
  centerId,
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
  } = useCenterUserOperationIntent(actorUserId, centerId, createOperationId);

  return (
    <>
      <output data-testid="operation-id">{operationId}</output>
      <output data-testid="hydrated">{String(isHydrated)}</output>
      <output data-testid="recovered">{String(wasRecovered)}</output>
      <output data-testid="recovery-status">{recoveryStatus}</output>
      <output data-testid="pending">{pendingIntent?.payload.email ?? ""}</output>
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
        Abandonar e iniciar otra alta
      </button>
    </>
  );
}

function storedIntentValues() {
  return Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith(CENTER_USER_OPERATION_INTENT_STORAGE_PREFIX))
    .map(([, value]) => value);
}

describe("useCenterUserOperationIntent", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Abandonar e iniciar otra alta" }));
    expect(screen.getByTestId("operation-id")).toHaveTextContent(secondOperationId);
  });

  it("restores the same id and payload after an unmount/refresh boundary", async () => {
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
    expect(screen.getByTestId("operation-id")).toHaveTextContent(firstOperationId);
    expect(screen.getByTestId("pending")).toHaveTextContent(payload.email);
    expect(createOperationId).toHaveBeenCalledOnce();
  });

  it("stores only non-secret metadata and clears it after success", async () => {
    render(<IntentHarness createOperationId={() => firstOperationId} />);
    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));

    fireEvent.click(screen.getByRole("button", { name: "Intentar persistir password" }));
    expect(storedIntentValues()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /^Persistir$/ }));
    const stored = storedIntentValues();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toContain(firstOperationId);
    expect(stored[0]).toContain(payload.email);
    expect(stored[0]).not.toContain(password);
    expect(stored[0]).not.toContain("initialPassword");

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(storedIntentValues()).toHaveLength(0);
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["unknown root property", JSON.stringify({ ...validIntent, extraField: "unexpected" })],
    [
      "unknown payload property",
      JSON.stringify({ ...validIntent, payload: { ...payload, initialPassword: password } }),
    ],
    [
      "another Center",
      JSON.stringify({
        ...validIntent,
        centerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    ],
  ])(
    "keeps an invalid snapshot with %s blocked until explicit abandonment",
    async (_label, value) => {
      const key = centerUserOperationIntentStorageKey(actorUserId, centerId);
      sessionStorage.setItem(key, value);
      const createOperationId = vi.fn(() => secondOperationId);

      render(<IntentHarness createOperationId={createOperationId} />);
      expect(screen.getByTestId("recovery-status")).toHaveTextContent("invalid");
      expect(screen.getByTestId("operation-id")).toHaveTextContent("");
      expect(createOperationId).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(key)).toBe(value);

      fireEvent.click(screen.getByRole("button", { name: "Abandonar e iniciar otra alta" }));
      expect(sessionStorage.getItem(key)).toBeNull();
      expect(screen.getByTestId("operation-id")).toHaveTextContent(secondOperationId);
    },
  );
});

describe("readCenterUserOperationIntent", () => {
  it("distinguishes an absent key from a valid snapshot", () => {
    expect(readCenterUserOperationIntent({ getItem: () => null }, actorUserId, centerId)).toEqual({
      status: "absent",
    });
    expect(
      readCenterUserOperationIntent(
        { getItem: () => JSON.stringify(validIntent) },
        actorUserId,
        centerId,
      ),
    ).toEqual({ status: "valid", intent: validIntent });
  });

  it("fails closed when storage cannot be read", () => {
    const storage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
    };
    expect(readCenterUserOperationIntent(storage, actorUserId, centerId)).toEqual({
      status: "invalid",
    });
  });
});
