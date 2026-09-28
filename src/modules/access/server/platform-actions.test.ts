import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import { AuthorizationError } from "./authorization";
import { performCreatePlatformCenterAction } from "./platform-actions";
import { IdentityProvisioningError, type CreateCenterWithFirstAdminInput } from "./provisioning";

const operationId = "11111111-1111-4111-8111-111111111111";
const client = {} as SupabaseClient<Database>;

function centerForm(overrides: Record<string, string> = {}) {
  const values = {
    operationId,
    isRetryingOperation: "false",
    centerName: "Centro Norte",
    centerAddress: "Av. Salud 123",
    centerPhone: "+54 11 4444 5555",
    centerEmail: "centro@example.test",
    centerTimezone: "America/Argentina/Buenos_Aires",
    adminEmail: "admin@example.test",
    adminFirstName: "Ana",
    adminLastName: "Pérez",
    adminInitialPassword: "password-10",
    ...overrides,
  };
  const formData = new FormData();
  for (const [name, value] of Object.entries(values)) formData.set(name, value);
  return formData;
}

function dependencies() {
  return {
    createServerClient: vi.fn(async () => client),
    requirePlatform: vi.fn(async () => ({
      id: "platform-user",
      email: "platform@example.test",
      firstName: "Platform",
      lastName: "Admin",
    })),
    resolveIdentity: vi.fn(async () => ({
      identity_exists: false,
      user_id: "",
      email: "",
      first_name: "",
      last_name: "",
    })),
    createCenter: vi.fn(
      async (...args: [CreateCenterWithFirstAdminInput, SupabaseClient<Database>?]) => {
        void args;
        return {
          center_id: "center-id",
          membership_id: "membership-id",
          application_user_created: true,
        };
      },
    ),
    updateCenterStatus: vi.fn(),
    revalidatePlatform: vi.fn(),
  };
}

describe("performCreatePlatformCenterAction", () => {
  it("reauthorizes before parsing or provisioning", async () => {
    const deps = dependencies();
    deps.requirePlatform.mockRejectedValueOnce(new AuthorizationError("PLATFORM_FORBIDDEN"));

    const state = await performCreatePlatformCenterAction({ status: "idle" }, centerForm(), deps);

    expect(state).toMatchObject({ status: "error", message: expect.stringContaining("permiso") });
    expect(deps.resolveIdentity).not.toHaveBeenCalled();
    expect(deps.createCenter).not.toHaveBeenCalled();
  });

  it("creates a new Auth identity with the submitted names and initial password", async () => {
    const deps = dependencies();

    const state = await performCreatePlatformCenterAction({ status: "idle" }, centerForm(), deps);

    expect(state).toMatchObject({ status: "success" });
    expect(deps.createCenter).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId,
        admin: {
          email: "admin@example.test",
          firstName: "Ana",
          lastName: "Pérez",
          initialPassword: "password-10",
        },
      }),
      client,
    );
    expect(deps.revalidatePlatform).toHaveBeenCalledOnce();
  });

  it("reuses an existing identity without forwarding client names or password", async () => {
    const deps = dependencies();
    deps.resolveIdentity.mockResolvedValueOnce({
      identity_exists: true,
      user_id: "existing-user",
      email: "existing@example.test",
      first_name: "Nombre conservado",
      last_name: "Apellido conservado",
    });

    await performCreatePlatformCenterAction(
      { status: "idle" },
      centerForm({
        adminEmail: "existing@example.test",
        adminFirstName: "Nombre atacante",
        adminLastName: "Apellido atacante",
        adminInitialPassword: "password-atacante",
      }),
      deps,
    );

    expect(deps.createCenter).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: {
          email: "existing@example.test",
          firstName: "Nombre conservado",
          lastName: "Apellido conservado",
        },
      }),
      client,
    );
  });

  it("keeps the submitted operation id across a transient error and retry", async () => {
    const deps = dependencies();
    deps.createCenter.mockRejectedValueOnce(new Error("temporary transport failure"));

    const first = await performCreatePlatformCenterAction({ status: "idle" }, centerForm(), deps);
    const retry = await performCreatePlatformCenterAction(first, centerForm(), deps);

    expect(first).toMatchObject({ status: "error", retryMode: "same-operation" });
    expect(retry).toMatchObject({ status: "confirmed" });
    expect(deps.createCenter.mock.calls.map(([input]) => input.operationId)).toEqual([
      operationId,
      operationId,
    ]);
  });

  it("reports a confirmed retry without presenting it as a second Center", async () => {
    const deps = dependencies();
    deps.createCenter.mockResolvedValueOnce({
      center_id: "center-id",
      membership_id: "membership-id",
      application_user_created: true,
    });

    const state = await performCreatePlatformCenterAction(
      { status: "error", retryMode: "same-operation" },
      centerForm(),
      deps,
    );

    expect(state).toMatchObject({
      status: "confirmed",
      message: expect.stringContaining("sin duplicar"),
    });
  });

  it("reconciles a recovered new-admin intent without requiring a persisted password", async () => {
    const deps = dependencies();

    const state = await performCreatePlatformCenterAction(
      { status: "idle" },
      centerForm({ isRetryingOperation: "true", adminInitialPassword: "" }),
      deps,
    );

    expect(state).toMatchObject({ status: "confirmed" });
    expect(deps.createCenter).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId,
        admin: expect.objectContaining({ initialPassword: undefined }),
      }),
      client,
    );
  });

  it("keeps the same intent and requests the password again if Auth still needs it", async () => {
    const deps = dependencies();
    deps.createCenter.mockRejectedValueOnce(new IdentityProvisioningError("AUTH_CREATE_FAILED"));

    const state = await performCreatePlatformCenterAction(
      { status: "idle" },
      centerForm({ isRetryingOperation: "true", adminInitialPassword: "" }),
      deps,
    );

    expect(state).toMatchObject({
      status: "error",
      retryMode: "same-operation",
      fieldErrors: { adminInitialPassword: [expect.stringContaining("Volvé a ingresar")] },
    });
  });
});
