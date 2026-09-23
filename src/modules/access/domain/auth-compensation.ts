export type ProvisioningOperationStatus =
  "PENDING" | "AUTH_READY" | "SUCCEEDED" | "COMPENSATION_REQUIRED" | "COMPENSATED";

export type ProvisioningFailureCode =
  "DATABASE_PROVISIONING_FAILED" | "COMPENSATION_REQUIRED" | "PROVISIONING_RECONCILIATION_REQUIRED";

export type ProvisioningReconciliation<Result> = {
  status: ProvisioningOperationStatus;
  authUserId: string | null;
  authUserWasCreated: boolean | null;
  result: Result | null;
};

export class ProvisioningFailure extends Error {
  readonly operationId: string;
  readonly authUserId: string;
  readonly code: ProvisioningFailureCode;
  readonly databaseCause: unknown;
  readonly reconciliationCause?: unknown;
  readonly compensationCause?: unknown;

  constructor(options: {
    operationId: string;
    authUserId: string;
    code: ProvisioningFailureCode;
    databaseCause: unknown;
    reconciliationCause?: unknown;
    compensationCause?: unknown;
  }) {
    super(`${options.code}:${options.operationId}`);
    this.name = "ProvisioningFailure";
    this.operationId = options.operationId;
    this.authUserId = options.authUserId;
    this.code = options.code;
    this.databaseCause = options.databaseCause;
    this.reconciliationCause = options.reconciliationCause;
    this.compensationCause = options.compensationCause;
  }
}

export async function persistWithAuthReconciliation<Result>(options: {
  operationId: string;
  authUserId: string;
  authUserWasCreated: boolean;
  deleteCreatedAuthUser: (authUserId: string) => Promise<void>;
  markCompensation: (compensated: boolean) => Promise<void>;
  persist: () => Promise<Result>;
  reconcile: () => Promise<ProvisioningReconciliation<Result>>;
}): Promise<Result> {
  try {
    return await options.persist();
  } catch (databaseCause) {
    let reconciliation: ProvisioningReconciliation<Result>;
    try {
      reconciliation = await options.reconcile();
    } catch (reconciliationCause) {
      throw new ProvisioningFailure({
        operationId: options.operationId,
        authUserId: options.authUserId,
        code: "PROVISIONING_RECONCILIATION_REQUIRED",
        databaseCause,
        reconciliationCause,
      });
    }

    if (reconciliation.status === "SUCCEEDED") {
      if (!reconciliation.result) {
        throw new ProvisioningFailure({
          operationId: options.operationId,
          authUserId: options.authUserId,
          code: "PROVISIONING_RECONCILIATION_REQUIRED",
          databaseCause,
        });
      }
      return reconciliation.result;
    }

    if (!options.authUserWasCreated) {
      throw new ProvisioningFailure({
        operationId: options.operationId,
        authUserId: options.authUserId,
        code: "DATABASE_PROVISIONING_FAILED",
        databaseCause,
      });
    }

    const bindingMatches =
      reconciliation.authUserId === null ||
      (reconciliation.authUserId === options.authUserId &&
        reconciliation.authUserWasCreated === true);
    const absenceConfirmed = ["PENDING", "AUTH_READY", "COMPENSATION_REQUIRED"].includes(
      reconciliation.status,
    );

    if (!bindingMatches || !absenceConfirmed) {
      throw new ProvisioningFailure({
        operationId: options.operationId,
        authUserId: options.authUserId,
        code: "PROVISIONING_RECONCILIATION_REQUIRED",
        databaseCause,
      });
    }

    try {
      await options.deleteCreatedAuthUser(options.authUserId);
    } catch (compensationCause) {
      try {
        await options.markCompensation(false);
      } catch (reconciliationCause) {
        throw new ProvisioningFailure({
          operationId: options.operationId,
          authUserId: options.authUserId,
          code: "PROVISIONING_RECONCILIATION_REQUIRED",
          databaseCause,
          reconciliationCause,
          compensationCause,
        });
      }
      throw new ProvisioningFailure({
        operationId: options.operationId,
        authUserId: options.authUserId,
        code: "COMPENSATION_REQUIRED",
        databaseCause,
        compensationCause,
      });
    }

    try {
      await options.markCompensation(true);
    } catch (reconciliationCause) {
      throw new ProvisioningFailure({
        operationId: options.operationId,
        authUserId: options.authUserId,
        code: "PROVISIONING_RECONCILIATION_REQUIRED",
        databaseCause,
        reconciliationCause,
      });
    }

    throw new ProvisioningFailure({
      operationId: options.operationId,
      authUserId: options.authUserId,
      code: "DATABASE_PROVISIONING_FAILED",
      databaseCause,
    });
  }
}
