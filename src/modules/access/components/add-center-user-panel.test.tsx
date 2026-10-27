import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  provision: vi.fn(),
  refresh: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));

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
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
    target: { value: password },
  });
  return screen.getByRole("button", { name: "Revisar alta" }).closest("form")!;
}

function reviewAndConfirm(form: HTMLFormElement) {
  const previousCalls = actions.provision.mock.calls.length;
  fireEvent.submit(form);
  expect(
    screen.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
  ).toBeVisible();
  expect(actions.provision).toHaveBeenCalledTimes(previousCalls);
  fireEvent.submit(form);
}

function storedCenterUserIntent() {
  return Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith(CENTER_USER_OPERATION_INTENT_STORAGE_PREFIX))
    .map(([, value]) => value)
    .join("\n");
}

function resolveNewIdentity() {
  actions.resolve.mockResolvedValue({
    status: "success",
    email: "new@example.test",
    identityExists: false,
    membershipExists: false,
  });
}

describe("AddCenterUserPanel", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
    sessionStorage.clear();
    actions.provision.mockReset();
    actions.refresh.mockReset();
    actions.resolve.mockReset();
    actions.provision.mockResolvedValue({
      status: "success",
      message: "Usuario agregado al centro.",
    });
  });
  afterEach(cleanup);

  it("keeps the page card compact and restores focus after closing an untouched modal with Escape", () => {
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Agregar usuario" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Agregar usuario" });
    expect(dialog).toHaveTextContent("Paso 1 de 3 · Email");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(actions.resolve).not.toHaveBeenCalled();
  });

  it("confirms closing an edited email without nesting another dialog", () => {
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Agregar usuario" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "draft@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Cerrar alta" })).toHaveTextContent(
      "¿Descartar alta?",
    );
    expect(screen.getByRole("button", { name: "Seguir editando" })).toHaveFocus();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByLabelText("Email")).toHaveValue("draft@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar alta" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("keeps the review and draft intact when the administrator cancels discard", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    fireEvent.submit(form);
    expect(screen.getByRole("dialog", { name: "Agregar usuario" })).toHaveTextContent(
      "Paso 3 de 3 · Revisión",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog", { name: "Cerrar alta" })).toHaveTextContent(
      "¿Descartar alta?",
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog", { name: "Agregar usuario" })).toHaveTextContent(
      "Paso 3 de 3 · Revisión",
    );
    expect(
      screen.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Volver a editar" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Nueva");
    expect(screen.getByLabelText("Apellido")).toHaveValue("Cuenta");
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("safe-password-10");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("safe-password-10");
    expect(actions.provision).not.toHaveBeenCalled();
  });

  it("stages a new identity with names and an in-memory password", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
      message: "La identidad es nueva.",
    });
    renderPanel();

    expect(
      screen.getByText("Ingresá un email para agregar un usuario a este centro."),
    ).toBeVisible();

    await openAndResolve("new@example.test");

    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeVisible());
    expect(screen.getByRole("dialog", { name: "Agregar usuario" })).toHaveTextContent(
      "Paso 2 de 3 · Datos y acceso",
    );
    expect(screen.getByLabelText("Apellido")).toBeVisible();
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveAttribute("minlength", "10");
    expect(screen.getByLabelText("Confirmar contraseña")).toBeVisible();
    expect(screen.getByRole("button", { name: "Revisar alta" })).toBeVisible();
  });

  it("validates the exact confirmation only on review and lets either password be corrected", async () => {
    resolveNewIdentity();
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("valid-password");
    const initial = screen.getByLabelText("Contraseña inicial");
    const confirmation = screen.getByLabelText("Confirmar contraseña");

    fireEvent.change(confirmation, { target: { value: "valid-password " } });
    expect(screen.queryByText("Las contraseñas no coinciden.")).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeVisible();
    expect(confirmation).toHaveAttribute("aria-invalid", "true");
    expect(confirmation).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("center-user-confirm-password-error"),
    );
    expect(
      screen.queryByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).not.toBeInTheDocument();
    expect(actions.provision).not.toHaveBeenCalled();

    fireEvent.change(initial, { target: { value: "valid-password " } });
    expect(screen.queryByText("Las contraseñas no coinciden.")).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(
      screen.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
    expect(screen.getByText("Contraseña inicial configurada")).toBeVisible();
    expect(screen.queryByText("valid-password ")).not.toBeInTheDocument();
    expect(actions.provision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver a editar" }));
    expect(initial).toHaveValue("valid-password ");
    expect(confirmation).toHaveValue("valid-password ");
  });

  it("requires a nonempty confirmation and keeps the existing password minimum", async () => {
    resolveNewIdentity();
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("short");
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "" } });
    fireEvent.submit(form);
    expect(screen.getByText("La contraseña debe tener al menos 10 caracteres.")).toBeVisible();
    expect(screen.getByText("Confirmá la contraseña inicial.")).toBeVisible();
    expect(actions.provision).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), {
      target: { value: "long-enough-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "long-enough-password" },
    });
    expect(screen.queryByText("Confirmá la contraseña inicial.")).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(
      screen.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
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
    expect(screen.queryByLabelText("Confirmar contraseña")).not.toBeInTheDocument();
    expect(screen.getByText(/sin cambiar sus datos ni credenciales/i)).toBeVisible();
  });

  it("reviews an existing identity without mutating and confirms only after the final step", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "existing@example.test",
      identityExists: true,
      firstName: "Mario",
      lastName: "Existente",
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("existing@example.test");
    await screen.findByRole("button", { name: "Revisar alta" });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    expect(
      screen.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Agregar usuario" })).toHaveTextContent(
      "Paso 3 de 3 · Revisión",
    );
    expect(screen.getByText("Mario Existente")).toBeVisible();
    expect(screen.queryByText("Contraseña inicial configurada")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirmar contraseña")).not.toBeInTheDocument();
    expect(actions.provision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver a editar" }));
    expect(screen.getByRole("button", { name: "Revisar alta" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar incorporación" }));
    await waitFor(() => expect(actions.provision).toHaveBeenCalledOnce());
    await screen.findByRole("dialog", { name: "Usuario agregado" });
    expect(await screen.findByText("El usuario se agregó correctamente al centro.")).toBeVisible();
    expect(actions.refresh).toHaveBeenCalledOnce();
  });

  it("asks before discarding a reviewed password when changing email", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    fireEvent.submit(form);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar email" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "se descartarán también la contraseña inicial",
    );
    expect(actions.provision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(
      screen.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar email" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar y cambiar email" }));
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.queryByLabelText(/Contraseña inicial/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirmar contraseña")).not.toBeInTheDocument();
    expect(storedCenterUserIntent()).not.toContain("safe-password-10");
  });

  it("clears both password fields after discarding the modal draft", async () => {
    resolveNewIdentity();
    renderPanel();
    await openAndResolve("new@example.test");
    await completeNewIdentity("safe-password-10");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog", { name: "Cerrar alta" })).toHaveTextContent(
      "¿Descartar alta?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Descartar alta" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar usuario" }));
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.queryByLabelText("Contraseña inicial")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirmar contraseña")).not.toBeInTheDocument();
    expect(storedCenterUserIntent()).toBe("");
  });

  it("keeps the alta unsent when session storage rejects the intent", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    const storageFailure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    try {
      fireEvent.submit(form);
      fireEvent.submit(form);
      expect(screen.getByRole("alert")).toHaveTextContent("No se envió el alta");
      expect(actions.provision).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Confirmar creación" })).toBeVisible();
    } finally {
      storageFailure.mockRestore();
    }
  });

  it("closes an uncertain attempt while preserving its operation for a safe reopen", async () => {
    actions.resolve.mockResolvedValue({
      status: "success",
      email: "new@example.test",
      identityExists: false,
      membershipExists: false,
    });
    actions.provision.mockResolvedValueOnce({
      status: "error",
      retryMode: "same-operation",
      message: "Resultado pendiente de confirmar.",
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    const operationId = String(new FormData(form).get("operationId"));
    reviewAndConfirm(form);
    await screen.findByText("Resultado pendiente de confirmar.");
    expect(screen.queryByText("Operación completada")).not.toBeInTheDocument();
    expect(actions.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog", { name: "Cerrar alta" })).toHaveTextContent(
      "Cerrar alta pendiente",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar y conservar alta" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedCenterUserIntent()).not.toContain("safe-password-10");
    fireEvent.click(screen.getByRole("button", { name: "Agregar usuario" }));
    const reopenedForm = await screen.findByRole("button", { name: "Revisar alta" });
    expect(new FormData(reopenedForm.closest("form")!).get("operationId")).toBe(operationId);
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("");
    expect(actions.provision).toHaveBeenCalledOnce();
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
      expect(screen.queryByRole("button", { name: "Revisar alta" })).not.toBeInTheDocument();
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
    expect(actions.provision).not.toHaveBeenCalled();
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(actions.provision).toHaveBeenCalledOnce());
    finish({ status: "success", message: "Usuario agregado al centro." });
    await waitFor(() =>
      expect(
        screen.getByText("El usuario se creó correctamente y ya tiene acceso al centro."),
      ).toBeVisible(),
    );
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

    reviewAndConfirm(form);
    await waitFor(() => expect(actions.provision).toHaveBeenCalledTimes(1));
    await screen.findByText("La contraseña debe tener al menos 10 caracteres.");
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("");

    fireEvent.change(screen.getByLabelText(/Contraseña inicial/), {
      target: { value: "password-11" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "password-11" },
    });
    expect(
      screen.queryByText("La contraseña debe tener al menos 10 caracteres."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveAttribute("aria-invalid", "false");
    reviewAndConfirm(form);
    await waitFor(() => expect(actions.provision).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("");

    fireEvent.change(screen.getByLabelText(/Contraseña inicial/), {
      target: { value: "password-12" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "password-12" },
    });
    reviewAndConfirm(form);
    await waitFor(() => expect(actions.provision).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(
        screen.getByText("El usuario se creó correctamente y ya tiene acceso al centro."),
      ).toBeVisible(),
    );
  });

  it("clears the password state and submitted FormData after a successful provisioning", async () => {
    const password = "success-password";
    let submittedPassword = "";
    let sentConfirmation = true;
    let submittedFormData: FormData | null = null;
    actions.provision.mockImplementationOnce(async (_previousState, formData: FormData) => {
      submittedPassword = String(formData.get("initialPassword"));
      sentConfirmation = formData.has("confirmPassword");
      submittedFormData = formData;
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
    expect(passwordInput).toHaveAttribute("type", "password");
    fireEvent.click(passwordInput.parentElement!.querySelector("button")!);
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(passwordInput).toHaveValue(password);

    reviewAndConfirm(form);

    await screen.findByText("El usuario se creó correctamente y ya tiene acceso al centro.");
    expect(screen.getByRole("dialog", { name: "Usuario creado" })).toHaveTextContent(
      "Operación completada",
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    expect(actions.refresh).toHaveBeenCalledOnce();
    expect(submittedPassword).toBe(password);
    expect(sentConfirmation).toBe(false);
    expect(submittedFormData!.has("initialPassword")).toBe(false);
    expect(passwordInput).toHaveValue("");
    expect(screen.queryByLabelText("Confirmar contraseña")).not.toBeInTheDocument();
    expect(storedCenterUserIntent()).not.toContain(password);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar usuario" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Agregar usuario" }));
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.queryByText("¿Descartar alta?")).not.toBeInTheDocument();
  });

  it("starts a clean operation in the open modal after success", async () => {
    resolveNewIdentity();
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    const firstOperationId = String(new FormData(form).get("operationId"));
    reviewAndConfirm(form);
    await screen.findByRole("dialog", { name: "Usuario creado" });
    await screen.findByText("El usuario se creó correctamente y ya tiene acceso al centro.");
    fireEvent.click(screen.getByRole("button", { name: "Agregar otro usuario" }));
    expect(screen.getByRole("dialog", { name: "Agregar usuario" })).toHaveTextContent(
      "Paso 1 de 3 · Email",
    );
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.queryByLabelText("Contraseña inicial")).not.toBeInTheDocument();
    expect(storedCenterUserIntent()).toBe("");
    const nextOperationId = String(
      new FormData(screen.getByLabelText("Email").closest("form")!).get("operationId"),
    );
    expect(nextOperationId).not.toBe(firstOperationId);
    expect(actions.provision).toHaveBeenCalledOnce();
  });

  it("keeps the completed result when session storage prevents starting another operation", async () => {
    resolveNewIdentity();
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    reviewAndConfirm(form);
    await screen.findByRole("dialog", { name: "Usuario creado" });
    await screen.findByText("El usuario se creó correctamente y ya tiene acceso al centro.");
    const storageFailure = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Agregar otro usuario" }));
      expect(screen.getByRole("dialog", { name: "Usuario creado" })).toBeVisible();
      expect(screen.getByRole("alert")).toHaveTextContent("No se inició otra alta");
      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^Cerrar$/ }));
      expect(screen.getByRole("dialog", { name: "Usuario creado" })).toBeVisible();
    } finally {
      storageFailure.mockRestore();
    }
    fireEvent.click(screen.getByRole("button", { name: "Agregar otro usuario" }));
    expect(screen.getByRole("dialog", { name: "Agregar usuario" })).toHaveTextContent(
      "Paso 1 de 3 · Email",
    );
  });

  it("uses the actual creation result when an identity appears after the email check", async () => {
    resolveNewIdentity();
    actions.provision.mockResolvedValueOnce({
      status: "success",
      identityCreated: false,
      message: "Usuario agregado al centro.",
    });
    renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    reviewAndConfirm(form);
    await screen.findByRole("dialog", { name: "Usuario agregado" });
    expect(await screen.findByText("El usuario se agregó correctamente al centro.")).toBeVisible();
    expect(screen.queryByText("Usuario creado")).not.toBeInTheDocument();
  });

  it.each(["Escape", "X"])(
    "closes completed provisioning with %s without discard",
    async (method) => {
      resolveNewIdentity();
      renderPanel();
      await openAndResolve("new@example.test");
      const form = await completeNewIdentity("safe-password-10");
      reviewAndConfirm(form);
      const dialog = await screen.findByRole("dialog", { name: "Usuario creado" });
      await screen.findByText("El usuario se creó correctamente y ya tiene acceso al centro.");
      if (method === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
      else fireEvent.click(screen.getByRole("button", { name: "Cerrar ventana" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText("¿Descartar alta?")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Agregar usuario" })).toHaveFocus();
    },
  );

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

    reviewAndConfirm(form);

    await screen.findByText(/Volvé a ingresar la contraseña inicial/);
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("");
    expect(new FormData(form).get("operationId")).toBe(operationId);
    expect(storedCenterUserIntent()).not.toContain(password);
    fireEvent.submit(form);
    expect(screen.getByText("La contraseña debe tener al menos 10 caracteres.")).toBeVisible();
    expect(screen.getByText("Confirmá la contraseña inicial.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "short" } });
    fireEvent.submit(form);
    expect(screen.getByText("La contraseña debe tener al menos 10 caracteres.")).toBeVisible();
    expect(actions.provision).toHaveBeenCalledOnce();
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

    reviewAndConfirm(form);

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

    reviewAndConfirm(form);
    await screen.findByText("No pudimos confirmar el resultado. Reintentá la misma operación.");
    expect(screen.getByLabelText(/Contraseña inicial/)).toHaveValue("");
    expect(storedCenterUserIntent()).not.toContain(password);

    fireEvent.submit(form);
    await screen.findByText(/quedó confirmada al reintentar/);
    expect(screen.getByRole("dialog", { name: "Operación confirmada" })).toHaveTextContent(
      "Operación completada",
    );
    expect(
      screen.queryByText("El usuario se creó correctamente y ya tiene acceso al centro."),
    ).not.toBeInTheDocument();

    expect(submissions).toHaveLength(2);
    expect(submissions[0]).toEqual(expect.objectContaining({ password }));
    expect(submissions[1]).toEqual({
      operationId: submissions[0]?.operationId,
      password: "",
    });
  });

  it("keeps the completed screen after confirming an operation recovered from session storage", async () => {
    resolveNewIdentity();
    actions.provision
      .mockResolvedValueOnce({
        status: "error",
        retryMode: "same-operation",
        message: "Resultado pendiente de confirmar.",
      })
      .mockResolvedValueOnce({
        status: "confirmed",
        message: "La operación quedó confirmada al reintentar, sin duplicar el acceso.",
      });
    const firstView = renderPanel();
    await openAndResolve("new@example.test");
    const form = await completeNewIdentity("safe-password-10");
    const operationId = String(new FormData(form).get("operationId"));
    reviewAndConfirm(form);
    await screen.findByText("Resultado pendiente de confirmar.");
    firstView.unmount();

    renderPanel();
    const recoveredForm = (await screen.findByRole("button", { name: "Revisar alta" })).closest(
      "form",
    )!;
    expect(new FormData(recoveredForm).get("operationId")).toBe(operationId);
    expect(screen.getByLabelText("Contraseña inicial")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "short" } });
    fireEvent.submit(recoveredForm);
    expect(screen.getByText("La contraseña debe tener al menos 10 caracteres.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "" } });
    fireEvent.submit(recoveredForm);
    expect(
      screen.getByRole("heading", { name: "Revisá los datos antes de continuar" }),
    ).toBeVisible();
    fireEvent.submit(recoveredForm);

    const completed = await screen.findByRole("dialog", { name: "Operación confirmada" });
    expect(completed).toHaveTextContent("Operación completada");
    await waitFor(() =>
      expect(completed).toHaveTextContent("La operación quedó confirmada al reintentar"),
    );
    expect(screen.getByRole("button", { name: /^Cerrar$/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Agregar otro usuario" })).toBeVisible();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(actions.provision).toHaveBeenCalledTimes(2);
    expect(storedCenterUserIntent()).toBe("");
  });
});
