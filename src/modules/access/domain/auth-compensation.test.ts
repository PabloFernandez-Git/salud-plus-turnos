import { describe, expect, it, vi } from "vitest";

import { persistWithAuthReconciliation, ProvisioningFailure } from "./auth-compensation";

const operationId = "11111111-1111-4111-8111-111111111111";

describe("persistWithAuthReconciliation", () => {
  it("reconstructs success after a committed response is lost", async () => {
    const deleteCreatedAuthUser = vi.fn();
    const result = { center_id: "center", membership_id: "membership" };

    await expect(
      persistWithAuthReconciliation({
        operationId,
        authUserId: "created-user",
        authUserWasCreated: true,
        deleteCreatedAuthUser,
        markCompensation: vi.fn(),
        persist: () => Promise.reject(new Error("response lost")),
        reconcile: () =>
          Promise.resolve({
            status: "SUCCEEDED",
            authUserId: "created-user",
            authUserWasCreated: true,
            result,
          }),
      }),
    ).resolves.toEqual(result);

    expect(deleteCreatedAuthUser).not.toHaveBeenCalled();
  });

  it("never deletes a pre-existing Auth identity after confirmed rollback", async () => {
    const deleteCreatedAuthUser = vi.fn();

    await expect(
      persistWithAuthReconciliation({
        operationId,
        authUserId: "existing-user",
        authUserWasCreated: false,
        deleteCreatedAuthUser,
        markCompensation: vi.fn(),
        persist: () => Promise.reject(new Error("database failure")),
        reconcile: () =>
          Promise.resolve({
            status: "AUTH_READY",
            authUserId: "existing-user",
            authUserWasCreated: false,
            result: null,
          }),
      }),
    ).rejects.toMatchObject<Partial<ProvisioningFailure>>({
      operationId,
      authUserId: "existing-user",
      code: "DATABASE_PROVISIONING_FAILED",
    });

    expect(deleteCreatedAuthUser).not.toHaveBeenCalled();
  });

  it("compensates only after reconciliation confirms no commit", async () => {
    const deleteCreatedAuthUser = vi.fn().mockResolvedValue(undefined);
    const markCompensation = vi.fn().mockResolvedValue(undefined);

    await expect(
      persistWithAuthReconciliation({
        operationId,
        authUserId: "created-user",
        authUserWasCreated: true,
        deleteCreatedAuthUser,
        markCompensation,
        persist: () => Promise.reject(new Error("database failure")),
        reconcile: () =>
          Promise.resolve({
            status: "AUTH_READY",
            authUserId: "created-user",
            authUserWasCreated: true,
            result: null,
          }),
      }),
    ).rejects.toMatchObject<Partial<ProvisioningFailure>>({
      operationId,
      code: "DATABASE_PROVISIONING_FAILED",
    });

    expect(deleteCreatedAuthUser).toHaveBeenCalledExactlyOnceWith("created-user");
    expect(markCompensation).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("preserves Auth when reconciliation is indeterminate", async () => {
    const deleteCreatedAuthUser = vi.fn();

    await expect(
      persistWithAuthReconciliation({
        operationId,
        authUserId: "created-user",
        authUserWasCreated: true,
        deleteCreatedAuthUser,
        markCompensation: vi.fn(),
        persist: () => Promise.reject(new Error("transport failure")),
        reconcile: () => Promise.reject(new Error("reconciliation unavailable")),
      }),
    ).rejects.toMatchObject<Partial<ProvisioningFailure>>({
      operationId,
      code: "PROVISIONING_RECONCILIATION_REQUIRED",
    });

    expect(deleteCreatedAuthUser).not.toHaveBeenCalled();
  });

  it("marks an orphan explicitly when Auth compensation fails", async () => {
    const markCompensation = vi.fn().mockResolvedValue(undefined);

    await expect(
      persistWithAuthReconciliation({
        operationId,
        authUserId: "orphan-user",
        authUserWasCreated: true,
        deleteCreatedAuthUser: () => Promise.reject(new Error("delete failed")),
        markCompensation,
        persist: () => Promise.reject(new Error("database failure")),
        reconcile: () =>
          Promise.resolve({
            status: "AUTH_READY",
            authUserId: "orphan-user",
            authUserWasCreated: true,
            result: null,
          }),
      }),
    ).rejects.toMatchObject<Partial<ProvisioningFailure>>({
      operationId,
      authUserId: "orphan-user",
      code: "COMPENSATION_REQUIRED",
    });

    expect(markCompensation).toHaveBeenCalledExactlyOnceWith(false);
  });
});
