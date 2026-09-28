import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("../actions/platform-actions", () => ({
  createPlatformCenterAction: actions.create,
  resolvePlatformIdentityAction: actions.resolve,
}));

import { CreateCenterPanel } from "./create-center-panel";
import { PLATFORM_OPERATION_INTENT_STORAGE_PREFIX } from "./use-platform-operation-intent";

const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function renderPanel() {
  return render(<CreateCenterPanel actorUserId={actorUserId} />);
}

async function openNewIdentity(email = "new-admin@example.test") {
  const emailInput = await screen.findByLabelText("Email del primer ADMIN");
  fireEvent.change(emailInput, { target: { value: email } });
  fireEvent.submit(emailInput.closest("form")!);
  await screen.findByText("Identidad nueva:", { exact: false });
}

function changeNamedInput(name: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`No se encontró el input ${name}.`);
  fireEvent.change(input, { target: { value } });
}

async function completeCenter(password: string) {
  changeNamedInput("centerName", "Centro Seguro");
  changeNamedInput("centerAddress", "Calle Uno 123");
  changeNamedInput("centerPhone", "+54 11 4444 5555");
  changeNamedInput("centerEmail", "centro-seguro@example.test");
  changeNamedInput("adminFirstName", "Ana");
  changeNamedInput("adminLastName", "Administradora");
  changeNamedInput("adminInitialPassword", password);
  return screen.getByRole("button", { name: "Crear centro" }).closest("form")!;
}

function storedPlatformIntent() {
  return Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith(PLATFORM_OPERATION_INTENT_STORAGE_PREFIX))
    .map(([, value]) => value)
    .join("\n");
}

describe("CreateCenterPanel password lifecycle", () => {
  beforeEach(() => {
    sessionStorage.clear();
    actions.create.mockReset();
    actions.resolve.mockReset();
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new-admin@example.test",
      identityExists: false,
      message: "La identidad es nueva.",
    });
  });
  afterEach(cleanup);

  it("clears React state, the DOM input and submitted FormData after success", async () => {
    const password = "success-password";
    let submittedFormData: FormData | undefined;
    actions.create.mockImplementationOnce(async (_previousState, formData: FormData) => {
      expect(formData.get("adminInitialPassword")).toBe(password);
      submittedFormData = formData;
      return { status: "success", message: "Centro creado con su primer administrador." };
    });
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter(password);
    const passwordInput = document.querySelector<HTMLInputElement>(
      'input[name="adminInitialPassword"]',
    )!;

    fireEvent.submit(form);

    await screen.findByText("Centro creado con su primer administrador.");
    expect(passwordInput).toHaveValue("");
    expect(submittedFormData?.has("adminInitialPassword")).toBe(false);
    expect(storedPlatformIntent()).not.toContain(password);
  });

  it("clears the password after a functional error and keeps the same operation id", async () => {
    const password = "functional-error-password";
    let submittedFormData: FormData | undefined;
    actions.create.mockImplementationOnce(async (_previousState, formData: FormData) => {
      submittedFormData = formData;
      return {
        status: "error",
        retryMode: "same-operation",
        fieldErrors: {
          adminInitialPassword: [
            "Volvé a ingresar la contraseña inicial para continuar con esta misma intención.",
          ],
        },
        message: "La operación todavía necesita preparar la identidad.",
      };
    });
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter(password);
    const operationId = String(new FormData(form).get("operationId"));

    fireEvent.submit(form);

    await screen.findByText(/Volvé a ingresar la contraseña inicial/);
    expect(document.querySelector('input[name="adminInitialPassword"]')).toHaveValue("");
    expect(new FormData(form).get("operationId")).toBe(operationId);
    expect(submittedFormData?.has("adminInitialPassword")).toBe(false);
    expect(storedPlatformIntent()).not.toContain(password);
  });

  it("clears the password and exposes a same-operation retry when the action throws", async () => {
    const password = "timeout-password";
    actions.create.mockRejectedValueOnce(new Error("network timeout"));
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter(password);
    const operationId = String(new FormData(form).get("operationId"));

    fireEvent.submit(form);

    await screen.findByText("No pudimos confirmar el resultado. Reintentá esta misma operación.");
    expect(document.querySelector('input[name="adminInitialPassword"]')).toHaveValue("");
    expect(new FormData(form).get("operationId")).toBe(operationId);
    expect(storedPlatformIntent()).not.toContain(password);
  });

  it("reconciles an ambiguous result with the same operation id and no preserved password", async () => {
    const password = "response-loss-password";
    const submissions: Array<{ operationId: string; password: string }> = [];
    actions.create
      .mockImplementationOnce(async (_previousState, formData: FormData) => {
        submissions.push({
          operationId: String(formData.get("operationId")),
          password: String(formData.get("adminInitialPassword")),
        });
        return {
          status: "error",
          retryMode: "same-operation",
          message: "No pudimos confirmar el resultado. Reintentá la misma operación.",
        };
      })
      .mockImplementationOnce(async (_previousState, formData: FormData) => {
        submissions.push({
          operationId: String(formData.get("operationId")),
          password: String(formData.get("adminInitialPassword")),
        });
        return {
          status: "confirmed",
          message: "La operación quedó confirmada al reintentar, sin duplicar el centro.",
        };
      });
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter(password);

    fireEvent.submit(form);
    await screen.findByText("No pudimos confirmar el resultado. Reintentá la misma operación.");
    expect(document.querySelector('input[name="adminInitialPassword"]')).toHaveValue("");
    expect(storedPlatformIntent()).not.toContain(password);

    fireEvent.submit(form);
    await screen.findByText(/quedó confirmada al reintentar/);

    expect(submissions).toHaveLength(2);
    expect(submissions[0]).toEqual(expect.objectContaining({ password }));
    expect(submissions[1]).toEqual({
      operationId: submissions[0]?.operationId,
      password: "",
    });
    await waitFor(() => expect(storedPlatformIntent()).toBe(""));
  });
});
