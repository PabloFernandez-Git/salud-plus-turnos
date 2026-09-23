import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  persistWithAuthReconciliation,
  ProvisioningFailure,
  type ProvisioningOperationStatus,
  type ProvisioningReconciliation,
} from "@/modules/access/domain/auth-compensation";

import { requirePlatformAdmin, requireRole } from "./authorization";

type ServerClient = SupabaseClient<Database>;
type MembershipRole = Database["public"]["Enums"]["membership_role"];
type BusinessOperationType = "PLATFORM_CREATE_CENTER" | "TENANT_PROVISION_USER";

type OperationRow = {
  operation_status: ProvisioningOperationStatus;
  auth_user_id: string | null;
  auth_user_was_created: boolean | null;
  result_user_id: string | null;
  result_center_id: string | null;
  result_membership_id: string | null;
  result_application_user_created: boolean | null;
};

type PreparedOperationRow = OperationRow & {
  payload_hash: string;
};

type ProvisioningTestHooks = {
  adminClient?: ServerClient;
  afterPersistCommit?: (
    operationType: BusinessOperationType,
    operationId: string,
  ) => Promise<void> | void;
  beforeReconcile?: (operationId: string) => Promise<void> | void;
  deleteCreatedAuthUser?: (authUserId: string) => Promise<void>;
};

type ProvisioningRuntime = {
  admin: ServerClient;
  hooks?: ProvisioningTestHooks;
};

type CenterProvisioningResult = {
  center_id: string;
  membership_id: string;
  application_user_created: boolean;
};

type UserProvisioningResult = {
  user_id: string;
  membership_id: string;
  application_user_created: boolean;
};

const normalizedEmailSchema = z.string().trim().toLowerCase().pipe(z.email());
const nameSchema = z.string().trim().min(1);
const optionalTextSchema = z.string().trim().optional().default("");
const initialPasswordSchema = z.string().min(10);

const identitySchema = z.object({
  email: normalizedEmailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  initialPassword: initialPasswordSchema.optional(),
});

const createCenterSchema = z.object({
  operationId: z.uuid(),
  center: z.object({
    name: nameSchema,
    phone: optionalTextSchema,
    email: optionalTextSchema,
    address: optionalTextSchema,
    timezone: nameSchema,
  }),
  admin: identitySchema,
});

const provisionCenterUserSchema = z.object({
  operationId: z.uuid(),
  centerId: z.uuid(),
  identity: identitySchema,
  role: z.enum(["ADMIN", "RECEPTION", "PROFESSIONAL"]),
  professionalCenterId: z.uuid().nullable().default(null),
});

export type CreateCenterWithFirstAdminInput = z.input<typeof createCenterSchema>;
export type ProvisionCenterUserInput = z.input<typeof provisionCenterUserSchema>;

export class IdentityProvisioningError extends Error {
  readonly code: "AUTH_CREATE_FAILED" | "IDENTITY_RECONCILIATION_REQUIRED";

  constructor(code: IdentityProvisioningError["code"], options?: ErrorOptions) {
    super(code, options);
    this.name = "IdentityProvisioningError";
    this.code = code;
  }
}

function productionRuntime(): ProvisioningRuntime {
  return { admin: createSupabaseAdminClient() };
}

function testRuntime(hooks: ProvisioningTestHooks): ProvisioningRuntime {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Provisioning fault injection is available only under the test runtime.");
  }
  return { admin: hooks.adminClient ?? createSupabaseAdminClient(), hooks };
}

async function prepareCenterOperation(
  runtime: ProvisioningRuntime,
  options: {
    operationId: string;
    actorUserId: string;
    center: z.output<typeof createCenterSchema>["center"];
    admin: z.output<typeof identitySchema>;
  },
) {
  const { data, error } = await runtime.admin
    .rpc("prepare_platform_center_provisioning_operation", {
      p_actor_user_id: options.actorUserId,
      p_admin_email: options.admin.email,
      p_admin_first_name: options.admin.firstName,
      p_admin_last_name: options.admin.lastName,
      p_center_address: options.center.address,
      p_center_email: options.center.email,
      p_center_name: options.center.name,
      p_center_phone: options.center.phone,
      p_center_timezone: options.center.timezone,
      p_operation_id: options.operationId,
    })
    .single();
  if (error) throw error;
  return data as PreparedOperationRow;
}

async function prepareTenantOperation(
  runtime: ProvisioningRuntime,
  options: {
    operationId: string;
    actorUserId: string;
    centerId: string;
    identity: z.output<typeof identitySchema>;
    role: MembershipRole;
    professionalCenterId: string | null;
  },
) {
  const { data, error } = await runtime.admin
    .rpc("prepare_tenant_user_provisioning_operation", {
      p_actor_user_id: options.actorUserId,
      p_center_id: options.centerId,
      p_first_name: options.identity.firstName,
      p_last_name: options.identity.lastName,
      p_operation_id: options.operationId,
      p_professional_center_id: options.professionalCenterId as string,
      p_role: options.role,
      p_user_email: options.identity.email,
    })
    .single();
  if (error) throw error;
  return data as PreparedOperationRow;
}

async function bindOperation(
  runtime: ProvisioningRuntime,
  options: {
    operationId: string;
    payloadHash: string;
    authUserId: string;
    authUserWasCreated: boolean;
  },
) {
  const { data, error } = await runtime.admin
    .rpc("bind_auth_provisioning_operation", {
      p_auth_user_id: options.authUserId,
      p_auth_user_was_created: options.authUserWasCreated,
      p_operation_id: options.operationId,
      p_payload_hash: options.payloadHash,
    })
    .single();
  if (error) throw error;
  return data as OperationRow;
}

async function reconcileOperation(runtime: ProvisioningRuntime, operationId: string, hash: string) {
  await runtime.hooks?.beforeReconcile?.(operationId);
  const { data, error } = await runtime.admin
    .rpc("reconcile_auth_provisioning_operation", {
      p_operation_id: operationId,
      p_payload_hash: hash,
    })
    .single();
  if (error) throw error;
  return data as OperationRow;
}

async function markCompensation(
  runtime: ProvisioningRuntime,
  options: {
    operationId: string;
    payloadHash: string;
    authUserId: string;
    compensated: boolean;
  },
) {
  const { error } = await runtime.admin.rpc("mark_auth_provisioning_compensation", {
    p_auth_user_id: options.authUserId,
    p_compensated: options.compensated,
    p_operation_id: options.operationId,
    p_payload_hash: options.payloadHash,
  });
  if (error) throw error;
}

async function deleteCreatedAuthUser(runtime: ProvisioningRuntime, authUserId: string) {
  if (runtime.hooks?.deleteCreatedAuthUser) {
    await runtime.hooks.deleteCreatedAuthUser(authUserId);
    return;
  }
  const { error } = await runtime.admin.auth.admin.deleteUser(authUserId);
  if (error) throw error;
}

async function resolveOrCreateIdentity(options: {
  runtime: ProvisioningRuntime;
  operation: OperationRow;
  operationId: string;
  payloadHash: string;
  email: string;
  firstName: string;
  lastName: string;
  initialPassword?: string;
  resolve: () => Promise<{ identityExists: boolean; userId: string | null }>;
}) {
  if (options.operation.auth_user_id) {
    const { data, error } = await options.runtime.admin.auth.admin.getUserById(
      options.operation.auth_user_id,
    );
    if (
      error ||
      !data.user?.email ||
      data.user.email.trim().toLowerCase() !== options.email ||
      options.operation.auth_user_was_created === null
    ) {
      throw new IdentityProvisioningError("IDENTITY_RECONCILIATION_REQUIRED", { cause: error });
    }
    return {
      authUserId: data.user.id,
      authUserWasCreated: options.operation.auth_user_was_created,
    };
  }

  const resolved = await options.resolve();
  let identity: { authUserId: string; authUserWasCreated: boolean };

  if (resolved.identityExists) {
    if (!resolved.userId) {
      throw new IdentityProvisioningError("IDENTITY_RECONCILIATION_REQUIRED");
    }
    identity = { authUserId: resolved.userId, authUserWasCreated: false };
  } else {
    if (!options.initialPassword) {
      throw new IdentityProvisioningError("AUTH_CREATE_FAILED");
    }

    const { data, error } = await options.runtime.admin.auth.admin.createUser({
      email: options.email,
      password: options.initialPassword,
      email_confirm: true,
      app_metadata: { provisioning_operation_id: options.operationId },
    });

    if (error || !data.user) {
      throw new IdentityProvisioningError(
        error?.code === "email_exists" ? "IDENTITY_RECONCILIATION_REQUIRED" : "AUTH_CREATE_FAILED",
        { cause: error },
      );
    }
    identity = { authUserId: data.user.id, authUserWasCreated: true };
  }

  try {
    await bindOperation(options.runtime, {
      operationId: options.operationId,
      payloadHash: options.payloadHash,
      ...identity,
    });
  } catch (databaseCause) {
    let reconciled: OperationRow;
    try {
      reconciled = await reconcileOperation(
        options.runtime,
        options.operationId,
        options.payloadHash,
      );
    } catch (reconciliationCause) {
      throw new ProvisioningFailure({
        operationId: options.operationId,
        authUserId: identity.authUserId,
        code: "PROVISIONING_RECONCILIATION_REQUIRED",
        databaseCause,
        reconciliationCause,
      });
    }

    if (
      reconciled.auth_user_id === identity.authUserId &&
      reconciled.auth_user_was_created === identity.authUserWasCreated
    ) {
      return identity;
    }

    if (identity.authUserWasCreated && reconciled.operation_status === "PENDING") {
      try {
        await deleteCreatedAuthUser(options.runtime, identity.authUserId);
      } catch (compensationCause) {
        try {
          await markCompensation(options.runtime, {
            operationId: options.operationId,
            payloadHash: options.payloadHash,
            authUserId: identity.authUserId,
            compensated: false,
          });
        } catch (reconciliationCause) {
          throw new ProvisioningFailure({
            operationId: options.operationId,
            authUserId: identity.authUserId,
            code: "PROVISIONING_RECONCILIATION_REQUIRED",
            databaseCause,
            reconciliationCause,
            compensationCause,
          });
        }
        throw new ProvisioningFailure({
          operationId: options.operationId,
          authUserId: identity.authUserId,
          code: "COMPENSATION_REQUIRED",
          databaseCause,
          compensationCause,
        });
      }
      try {
        await markCompensation(options.runtime, {
          operationId: options.operationId,
          payloadHash: options.payloadHash,
          authUserId: identity.authUserId,
          compensated: true,
        });
      } catch (reconciliationCause) {
        throw new ProvisioningFailure({
          operationId: options.operationId,
          authUserId: identity.authUserId,
          code: "PROVISIONING_RECONCILIATION_REQUIRED",
          databaseCause,
          reconciliationCause,
        });
      }
    }

    throw new ProvisioningFailure({
      operationId: options.operationId,
      authUserId: identity.authUserId,
      code: "DATABASE_PROVISIONING_FAILED",
      databaseCause,
    });
  }

  return identity;
}

function centerResult(operation: OperationRow): CenterProvisioningResult | null {
  if (
    !operation.result_center_id ||
    !operation.result_membership_id ||
    operation.result_application_user_created === null
  ) {
    return null;
  }
  return {
    center_id: operation.result_center_id,
    membership_id: operation.result_membership_id,
    application_user_created: operation.result_application_user_created,
  };
}

function userResult(operation: OperationRow): UserProvisioningResult | null {
  if (
    !operation.result_user_id ||
    !operation.result_membership_id ||
    operation.result_application_user_created === null
  ) {
    return null;
  }
  return {
    user_id: operation.result_user_id,
    membership_id: operation.result_membership_id,
    application_user_created: operation.result_application_user_created,
  };
}

function reconciliation<Result>(
  operation: OperationRow,
  result: Result | null,
): ProvisioningReconciliation<Result> {
  return {
    status: operation.operation_status,
    authUserId: operation.auth_user_id,
    authUserWasCreated: operation.auth_user_was_created,
    result,
  };
}

async function createCenterWithFirstAdminWithRuntime(
  input: CreateCenterWithFirstAdminInput,
  runtime: ProvisioningRuntime,
  client?: ServerClient,
) {
  const parsed = createCenterSchema.parse(input);
  const supabase = client ?? (await createSupabaseServerClient());
  const actor = await requirePlatformAdmin(supabase);
  const operation = await prepareCenterOperation(runtime, {
    operationId: parsed.operationId,
    actorUserId: actor.id,
    center: parsed.center,
    admin: parsed.admin,
  });
  const completed = centerResult(operation);
  if (operation.operation_status === "SUCCEEDED" && completed) return completed;

  const identity = await resolveOrCreateIdentity({
    runtime,
    operation,
    operationId: parsed.operationId,
    payloadHash: operation.payload_hash,
    ...parsed.admin,
    resolve: async () => {
      const { data, error } = await supabase
        .rpc("platform_resolve_user_by_email", { p_email: parsed.admin.email })
        .single();
      if (error) throw error;
      return { identityExists: data.identity_exists, userId: data.user_id || null };
    },
  });

  return persistWithAuthReconciliation<CenterProvisioningResult>({
    operationId: parsed.operationId,
    authUserId: identity.authUserId,
    authUserWasCreated: identity.authUserWasCreated,
    deleteCreatedAuthUser: (authUserId) => deleteCreatedAuthUser(runtime, authUserId),
    markCompensation: (compensated) =>
      markCompensation(runtime, {
        operationId: parsed.operationId,
        payloadHash: operation.payload_hash,
        authUserId: identity.authUserId,
        compensated,
      }),
    persist: async () => {
      const { data, error } = await supabase
        .rpc("platform_create_center_with_admin", {
          p_admin_auth_user_id: identity.authUserId,
          p_admin_first_name: parsed.admin.firstName,
          p_admin_last_name: parsed.admin.lastName,
          p_center_address: parsed.center.address,
          p_center_email: parsed.center.email,
          p_center_name: parsed.center.name,
          p_center_phone: parsed.center.phone,
          p_center_timezone: parsed.center.timezone,
          p_operation_id: parsed.operationId,
        })
        .single();
      if (error) throw error;
      await runtime.hooks?.afterPersistCommit?.("PLATFORM_CREATE_CENTER", parsed.operationId);
      return data;
    },
    reconcile: async () => {
      const current = await reconcileOperation(runtime, parsed.operationId, operation.payload_hash);
      return reconciliation(current, centerResult(current));
    },
  });
}

async function provisionCenterUserWithRuntime(
  input: ProvisionCenterUserInput,
  runtime: ProvisioningRuntime,
  client?: ServerClient,
) {
  const parsed = provisionCenterUserSchema.parse(input);
  const supabase = client ?? (await createSupabaseServerClient());
  const context = await requireRole(parsed.centerId, ["ADMIN"], supabase);
  const operation = await prepareTenantOperation(runtime, {
    operationId: parsed.operationId,
    actorUserId: context.user.id,
    centerId: parsed.centerId,
    identity: parsed.identity,
    role: parsed.role as MembershipRole,
    professionalCenterId: parsed.professionalCenterId,
  });
  const completed = userResult(operation);
  if (operation.operation_status === "SUCCEEDED" && completed) return completed;

  const identity = await resolveOrCreateIdentity({
    runtime,
    operation,
    operationId: parsed.operationId,
    payloadHash: operation.payload_hash,
    ...parsed.identity,
    resolve: async () => {
      const { data, error } = await supabase
        .rpc("admin_resolve_user_by_email", {
          p_center_id: parsed.centerId,
          p_email: parsed.identity.email,
        })
        .single();
      if (error) throw error;
      if (data.center_membership_exists) {
        throw new IdentityProvisioningError("IDENTITY_RECONCILIATION_REQUIRED");
      }
      return { identityExists: data.identity_exists, userId: data.user_id || null };
    },
  });

  return persistWithAuthReconciliation<UserProvisioningResult>({
    operationId: parsed.operationId,
    authUserId: identity.authUserId,
    authUserWasCreated: identity.authUserWasCreated,
    deleteCreatedAuthUser: (authUserId) => deleteCreatedAuthUser(runtime, authUserId),
    markCompensation: (compensated) =>
      markCompensation(runtime, {
        operationId: parsed.operationId,
        payloadHash: operation.payload_hash,
        authUserId: identity.authUserId,
        compensated,
      }),
    persist: async () => {
      const { data, error } = await supabase
        .rpc("admin_provision_center_user", {
          p_auth_user_id: identity.authUserId,
          p_center_id: parsed.centerId,
          p_first_name: parsed.identity.firstName,
          p_last_name: parsed.identity.lastName,
          p_operation_id: parsed.operationId,
          p_professional_center_id: parsed.professionalCenterId as string,
          p_role: parsed.role as MembershipRole,
        })
        .single();
      if (error) throw error;
      await runtime.hooks?.afterPersistCommit?.("TENANT_PROVISION_USER", parsed.operationId);
      return data;
    },
    reconcile: async () => {
      const current = await reconcileOperation(runtime, parsed.operationId, operation.payload_hash);
      return reconciliation(current, userResult(current));
    },
  });
}

export async function createCenterWithFirstAdmin(
  input: CreateCenterWithFirstAdminInput,
  client?: ServerClient,
) {
  return createCenterWithFirstAdminWithRuntime(input, productionRuntime(), client);
}

export async function provisionCenterUser(input: ProvisionCenterUserInput, client?: ServerClient) {
  return provisionCenterUserWithRuntime(input, productionRuntime(), client);
}

export const provisioningTestOnly = {
  createCenterWithFirstAdmin(
    input: CreateCenterWithFirstAdminInput,
    client: ServerClient,
    hooks: ProvisioningTestHooks,
  ) {
    return createCenterWithFirstAdminWithRuntime(input, testRuntime(hooks), client);
  },
  provisionCenterUser(
    input: ProvisionCenterUserInput,
    client: ServerClient,
    hooks: ProvisioningTestHooks,
  ) {
    return provisionCenterUserWithRuntime(input, testRuntime(hooks), client);
  },
};
