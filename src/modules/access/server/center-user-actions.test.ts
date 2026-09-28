import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { ProvisioningFailure } from "@/modules/access/domain/auth-compensation";

import { AuthorizationError } from "./authorization";
import {
  performProvisionCenterUserAction,
  performResolveCenterIdentityAction,
} from "./center-user-actions";
import type { CenterIdentityResolution } from "./center-users";
import { IdentityProvisioningError, type ProvisionCenterUserInput } from "./provisioning";

const centerId = "11111111-1111-4111-8111-111111111111";
const operationId = "22222222-2222-4222-8222-222222222222";
const professionalCenterId = "33333333-3333-4333-8333-333333333333";
const client = {} as SupabaseClient<Database>;

const newIdentity: CenterIdentityResolution = {
  identity_exists: false,
  user_id: null,
  email: null,
  first_name: null,
  last_name: null,
  center_membership_exists: false,
  center_membership_is_active: null,
};

const existingIdentity: CenterIdentityResolution = {
  identity_exists: true,
  user_id: "44444444-4444-4444-8444-444444444444",
  email: "existing@example.test",
  first_name: "Nombre conservado",
  last_name: "Apellido conservado",
  center_membership_exists: false,
  center_membership_is_active: null,
};

function provisionForm(overrides: Record<string, string> = {}) {
  const values = {
    operationId,
    centerId,
    isRetryingOperation: "false",
    email: "new@example.test",
    firstName: "Nueva",
    lastName: "Cuenta",
    initialPassword: "password-10",
    role: "RECEPTION",
    professionalCenterId: "",
    ...overrides,
  };
  const formData = new FormData();
  for (const [name, value] of Object.entries(values)) formData.set(name, value);
  return formData;
}

function dependencies(resolution: CenterIdentityResolution = newIdentity) {
  return {
    createServerClient: vi.fn(async () => client),
    requireCenterAdmin: vi.fn(async () => ({})),
    resolveIdentity: vi.fn(async () => resolution),
    provisionUser: vi.fn(async (...args: [ProvisionCenterUserInput, SupabaseClient<Database>?]) => {
      void args;
      return {
        user_id: "user-id",
        membership_id: "membership-id",
        application_user_created: !resolution.identity_exists,
      };
    }),
    revalidateUsers: vi.fn(),
  };
}

describe("performResolveCenterIdentityAction", () => {
  it("reauthorizes before parsing or resolving", async () => {
    const deps = dependencies();
    deps.requireCenterAdmin.mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));

    const state = await performResolveCenterIdentityAction(centerId, "not-an-email", deps);

    expect(state).toMatchObject({ status: "error", message: expect.stringContaining("permiso") });
    expect(deps.resolveIdentity).not.toHaveBeenCalled();
  });

  it("returns the minimum existing-identity contract without external roles or memberships", async () => {
    const deps = dependencies(existingIdentity);

    const state = await performResolveCenterIdentityAction(
      centerId,
      " EXISTING@EXAMPLE.TEST ",
      deps,
    );

    expect(state).toEqual({
      status: "success",
      email: "existing@example.test",
      identityExists: true,
      firstName: "Nombre conservado",
      lastName: "Apellido conservado",
      membershipExists: false,
      membershipIsActive: undefined,
      message: "La identidad ya existe. Conservaremos sus datos y credenciales actuales.",
    });
  });

  it("reports an existing membership in this Center without exposing its role", async () => {
    const deps = dependencies({
      ...existingIdentity,
      center_membership_exists: true,
      center_membership_is_active: false,
    });

    const state = await performResolveCenterIdentityAction(centerId, "existing@example.test", deps);

    expect(state).toMatchObject({
      status: "success",
      membershipExists: true,
      membershipIsActive: false,
      message: expect.stringContaining("inactivo"),
    });
    expect(state).not.toHaveProperty("role");
  });
});

describe("performProvisionCenterUserAction", () => {
  it("reauthorizes before parsing or provisioning", async () => {
    const deps = dependencies();
    deps.requireCenterAdmin.mockRejectedValueOnce(new AuthorizationError("CENTER_ACCESS_DENIED"));

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ operationId: "invalid" }),
      deps,
    );

    expect(state).toMatchObject({ status: "error", message: expect.stringContaining("permiso") });
    expect(deps.resolveIdentity).not.toHaveBeenCalled();
    expect(deps.provisionUser).not.toHaveBeenCalled();
  });

  it("creates a new identity and initial RECEPTION membership", async () => {
    const deps = dependencies();

    const state = await performProvisionCenterUserAction({ status: "idle" }, provisionForm(), deps);

    expect(state).toMatchObject({ status: "success" });
    expect(deps.provisionUser).toHaveBeenCalledWith(
      {
        operationId,
        centerId,
        identity: {
          email: "new@example.test",
          firstName: "Nueva",
          lastName: "Cuenta",
          initialPassword: "password-10",
        },
        role: "RECEPTION",
        professionalCenterId: null,
      },
      client,
    );
    expect(deps.revalidateUsers).toHaveBeenCalledWith(centerId);
  });

  it("reuses canonical existing identity data and never forwards a submitted password", async () => {
    const deps = dependencies(existingIdentity);

    await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({
        email: "existing@example.test",
        firstName: "Nombre atacante",
        lastName: "Apellido atacante",
        initialPassword: "password-atacante",
        role: "ADMIN",
      }),
      deps,
    );

    expect(deps.provisionUser).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: {
          email: "existing@example.test",
          firstName: "Nombre conservado",
          lastName: "Apellido conservado",
        },
        role: "ADMIN",
      }),
      client,
    );
  });

  it("stops when the identity already has a membership in this Center", async () => {
    const deps = dependencies({
      ...existingIdentity,
      center_membership_exists: true,
      center_membership_is_active: true,
    });

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ email: "existing@example.test" }),
      deps,
    );

    expect(state).toMatchObject({
      status: "error",
      message: expect.stringContaining("ya pertenece"),
    });
    expect(deps.provisionUser).not.toHaveBeenCalled();
  });

  it("detects a membership created concurrently after the initial exact resolution", async () => {
    const deps = dependencies(existingIdentity);
    deps.resolveIdentity.mockResolvedValueOnce(existingIdentity).mockResolvedValueOnce({
      ...existingIdentity,
      center_membership_exists: true,
      center_membership_is_active: true,
    });
    deps.provisionUser.mockRejectedValueOnce(
      new ProvisioningFailure({
        operationId,
        authUserId: existingIdentity.user_id!,
        code: "DATABASE_PROVISIONING_FAILED",
        databaseCause: { code: "23505", message: "The user already has active center access." },
      }),
    );

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ email: "existing@example.test" }),
      deps,
    );

    expect(state).toMatchObject({
      status: "error",
      message: expect.stringContaining("ya pertenece"),
    });
    expect(deps.resolveIdentity).toHaveBeenCalledTimes(2);
  });

  it("lets a recovered same-operation retry reach provisioning despite the resulting membership", async () => {
    const deps = dependencies({
      ...existingIdentity,
      center_membership_exists: true,
      center_membership_is_active: true,
    });

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({
        isRetryingOperation: "true",
        email: "existing@example.test",
        firstName: "Nombre conservado",
        lastName: "Apellido conservado",
        initialPassword: "",
      }),
      deps,
    );

    expect(state).toMatchObject({
      status: "confirmed",
      message: expect.stringContaining("sin duplicar"),
    });
    expect(deps.provisionUser).toHaveBeenCalledOnce();
  });

  it("rejects a short new-identity password", async () => {
    const deps = dependencies();

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ initialPassword: "123456789" }),
      deps,
    );

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { initialPassword: [expect.stringContaining("10")] },
    });
    expect(deps.provisionUser).not.toHaveBeenCalled();
  });

  it("reconciles a recovered new identity without a persisted password", async () => {
    const deps = dependencies();

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ isRetryingOperation: "true", initialPassword: "" }),
      deps,
    );

    expect(state).toMatchObject({ status: "confirmed" });
    expect(deps.provisionUser).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId,
        identity: expect.objectContaining({ initialPassword: undefined }),
      }),
      client,
    );
  });

  it("keeps the same operation and requests the password when Auth still needs it", async () => {
    const deps = dependencies();
    deps.provisionUser.mockRejectedValueOnce(new IdentityProvisioningError("AUTH_CREATE_FAILED"));

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ isRetryingOperation: "true", initialPassword: "" }),
      deps,
    );

    expect(state).toMatchObject({
      status: "error",
      retryMode: "same-operation",
      fieldErrors: { initialPassword: [expect.stringContaining("Volvé a ingresar")] },
    });
  });

  it("validates the role and ProfessionalCenter relationship before provisioning", async () => {
    const deps = dependencies();

    const missingProfessionalCenter = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ role: "PROFESSIONAL", professionalCenterId: "" }),
      deps,
    );
    const unexpectedProfessionalCenter = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({ role: "ADMIN", professionalCenterId }),
      deps,
    );

    expect(missingProfessionalCenter).toMatchObject({
      status: "error",
      fieldErrors: { professionalCenterId: [expect.any(String)] },
    });
    expect(unexpectedProfessionalCenter).toMatchObject({
      status: "error",
      fieldErrors: { professionalCenterId: [expect.any(String)] },
    });
    expect(deps.provisionUser).not.toHaveBeenCalled();
  });

  it("ends an impossible PROFESSIONAL retry safely when the selected link is unavailable", async () => {
    const deps = dependencies(existingIdentity);
    deps.provisionUser.mockRejectedValueOnce(
      new ProvisioningFailure({
        operationId,
        authUserId: existingIdentity.user_id!,
        code: "DATABASE_PROVISIONING_FAILED",
        databaseCause: {
          code: "23505",
          message: "The ProfessionalCenter already has an active PROFESSIONAL membership.",
        },
      }),
    );

    const state = await performProvisionCenterUserAction(
      { status: "idle" },
      provisionForm({
        email: "existing@example.test",
        role: "PROFESSIONAL",
        professionalCenterId,
      }),
      deps,
    );

    expect(state).toMatchObject({
      status: "error",
      retryMode: "new-operation",
      message: expect.stringContaining("activo y disponible"),
    });
    expect(state.message).not.toContain("ProfessionalCenter");
  });
});
