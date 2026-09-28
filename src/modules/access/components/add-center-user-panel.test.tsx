import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  provision: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("../actions/center-user-actions", () => ({
  provisionCenterUserAction: actions.provision,
  resolveCenterIdentityAction: actions.resolve,
}));

import { AddCenterUserPanel } from "./add-center-user-panel";
import { CENTER_USER_OPERATION_INTENT_STORAGE_PREFIX } from "./use-center-user-operation-intent";

const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const centerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const professionalCenter = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  firstName: "Paula",
  lastName: "Médica",
  licenseNumber: "MP 1234",
};

function renderPanel(professionalCenters = [professionalCenter]) {
  return render(
    <AddCenterUserPanel
      actorUserId={actorUserId}
      centerId={centerId}
      professionalCenters={professionalCenters}
    />,
  );
}

async function openAndResolve(email: string) {
  fireEvent.click(screen.getByRole("button", { name: "Agregar usuario" }));
  await waitFor(() => expect(screen.getByLabelText("Email")).toBeVisible());
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
}

async function completeNewIdentity(password: string) {
  await screen.findByLabelText("Nombre");
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nueva" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Cuenta" } });
  fireEvent.change(screen.getByLabelText(/Contraseña inicial/), {
    target: { value: password },
  });
  return screen.getByRole("button", { name: "Agregar al centro" }).closest("form")!;
}

function storedCenterUserIntent() {
  return Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith(CENTER_USER_OPERATION_INTENT_STORAGE_PREFIX))
    .map(([, value]) => value)
    .join("\n");
}

describe("AddCenterUserPanel", () => {
  beforeEach(() => {
    sessionStorage.clear();
    actions.provision.mockReset();
    actions.resolve.mockReset();
    actions.provision.mockResolvedValue({
      status: "success",
      message: "Usuario agregado al centro.",
    });
  });
  afterEach(cleanup);

  it("stages a new identity with names and an in-memory password", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
      message: "La identidad es nueva.",
    });
    renderPanel();

    await openAndResolve("new@example.test");

    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeVisible());
    expect(screen.getByLabelText("Apellido")).toBeVisible();
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveAttribute("minlength", "10");
    expect(screen.getByRole("button", { name: "Agregar al centro" })).toBeVisible();
  });

  it("shows only minimum immutable data for an existing identity", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "existing@example.test",
      identityExists: true,
      firstName: "Nombre",
      lastName: "Conservado",
      membershipExists: false,
      message: "La identidad ya existe.",
    });
    renderPanel();

    await openAndResolve("existing@example.test");

    await waitFor(() => expect(screen.getByText(/Nombre Conservado/)).toBeVisible());
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Apellido")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Contraseña inicial/)).not.toBeInTheDocument();
    expect(screen.getByText(/sin cambiar sus datos ni credenciales/i)).toBeVisible();
  });

  it.each([
    [true, "acceso activo"],
    [false, "acceso inactivo"],
  ])(
    "does not offer provisioning for an existing same-Center membership",
    async (isActive, text) => {
      actions.resolve.mockResolvedValue({
        status: "success",
        email: "member@example.test",
        identityExists: true,
        firstName: "Ya",
        lastName: "Miembro",
        membershipExists: true,
        membershipIsActive: isActive,
        message: `Esta cuenta ya pertenece al centro con ${text}.`,
      });
      renderPanel();

      await openAndResolve("member@example.test");

      await waitFor(() => expect(screen.getByText(new RegExp(text))).toBeVisible());
      expect(screen.queryByRole("button", { name: "Agregar al centro" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Buscar otro email" })).toBeVisible();
    },
  );

  it("blocks PROFESSIONAL when no active free ProfessionalCenter exists", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel([]);

    await openAndResolve("new@example.test");

    const role = await screen.findByLabelText(/Rol/);
    expect(within(role).getByRole("option", { name: /Profesional/ })).toBeDisabled();
    expect(screen.getByText(/no está disponible/)).toBeVisible();
  });

  it("offers only the supplied eligible ProfessionalCenter options", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();

    await openAndResolve("new@example.test");
    const role = await screen.findByLabelText(/Rol/);
    fireEvent.change(role, { target: { value: "PROFESSIONAL" } });

    expect(screen.getByLabelText("Profesional asociado")).toHaveTextContent(
      "Médica, Paula · MP 1234",
    );
  });

  it("latches synchronous double submit before the action can run twice", async () => {
    let finish!: (value: { status: "success"; message: string }) => void;
    actions.provision.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("password-10");

    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(actions.provision).toHaveBeenCalledOnce());
    finish({ status: "success", message: "Usuario agregado al centro." });
    await waitFor(() => expect(screen.getByText("Usuario agregado al centro.")).toBeVisible());
  });

  it("releases the latch after consecutive equivalent validation responses", async () => {
    const validationError = {
      status: "error" as const,
      fieldErrors: { initialPassword: ["La contraseña debe tener al menos 10 caracteres."] },
    };
    actions.provision
      .mockImplementationOnce(async () => ({
        ...validationError,
        fieldErrors: { ...validationError.fieldErrors },
      }))
      .mockImplementationOnce(async () => ({
        ...validationError,
        fieldErrors: { ...validationError.fieldErrors },
      }))
      .mockResolvedValueOnce({ status: "success", message: "Usuario agregado al centro." });
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("password-10");

    fireEvent.submit(form);
    await waitFor(() => expect(actions.provision).toHaveBeenCalledTimes(1));
    await screen.findByText("La contraseña debe tener al menos 10 caracteres.");
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");

    fireEvent.change(screen.getByLabelText(/Contraseña inicial/), {
      target: { value: "password-11" },
    });
    fireEvent.submit(form);
    await waitFor(() => expect(actions.provision).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");

    fireEvent.change(screen.getByLabelText(/Contraseña inicial/), {
      target: { value: "password-12" },
    });
    fireEvent.submit(form);
    await waitFor(() => expect(actions.provision).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByText("Usuario agregado al centro.")).toBeVisible());
  });

  it("clears the password state and submitted FormData after a successful provisioning", async () => {
    const password = "success-password";
    let submittedPassword = "";
    actions.provision.mockImplementationOnce(async (_previousState, formData: FormData) => {
      submittedPassword = String(formData.get("initialPassword"));
      return { status: "success", message: "Usuario agregado al centro." };
    });
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity(password);
    const passwordInput = screen.getByLabelText(/Contraseña inicial/);

    fireEvent.submit(form);

    await screen.findByText("Usuario agregado al centro.");
    expect(submittedPassword).toBe(password);
    expect(passwordInput).toHaveValue("");
    expect(storedCenterUserIntent()).not.toContain(password);
  });

  it("clears the password after a functional server error and requests it again empty", async () => {
    const password = "server-error-password";
    actions.provision.mockResolvedValueOnce({
      status: "error",
      retryMode: "same-operation",
      fieldErrors: {
        initialPassword: [
          "Volvé a ingresar la contraseña inicial para continuar con esta misma intención.",
        ],
      },
      message: "La operación todavía necesita preparar la identidad.",
    });
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity(password);
    const operationId = String(new FormData(form).get("operationId"));

    fireEvent.submit(form);

    await screen.findByText(/Volvé a ingresar la contraseña inicial/);
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(new FormData(form).get("operationId")).toBe(operationId);
    expect(storedCenterUserIntent()).not.toContain(password);
  });

  it("clears the password when the provisioning action throws", async () => {
    const password = "timeout-password";
    actions.provision.mockRejectedValueOnce(new Error("network timeout"));
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity(password);

    fireEvent.submit(form);

    await screen.findByText("No pudimos confirmar el resultado. Reintentá esta misma operación.");
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(storedCenterUserIntent()).not.toContain(password);
  });

  it("keeps the operation id but not the password after an ambiguous result and response-loss retry", async () => {
    const password = "response-loss-password";
    const submissions: Array<{ operationId: string; password: string }> = [];
    actions.provision
      .mockImplementationOnce(async (_previousState, formData: FormData) => {
        submissions.push({
          operationId: String(formData.get("operationId")),
          password: String(formData.get("initialPassword")),
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
          password: String(formData.get("initialPassword")),
        });
        return {
          status: "confirmed",
          message: "La operación quedó confirmada al reintentar, sin duplicar el acceso.",
        };
      });
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity(password);

    fireEvent.submit(form);
    await screen.findByText("No pudimos confirmar el resultado. Reintentá la misma operación.");
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(storedCenterUserIntent()).not.toContain(password);

    fireEvent.submit(form);
    await screen.findByText(/quedó confirmada al reintentar/);

    expect(submissions).toHaveLength(2);
    expect(submissions[0]).toEqual(expect.objectContaining({ password }));
    expect(submissions[1]).toEqual({
      operationId: submissions[0]?.operationId,
      password: "",
    });
  });
});
