import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  resolve: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("../actions/platform-actions", () => ({
  createPlatformCenterAction: actions.create,
  resolvePlatformIdentityAction: actions.resolve,
}));

import { CreateCenterPanel } from "./create-center-panel";
import {
  PLATFORM_OPERATION_INTENT_STORAGE_PREFIX,
  platformOperationIntentStorageKey,
} from "./use-platform-operation-intent";

const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function renderPanel() {
  return render(<CreateCenterPanel actorUserId={actorUserId} />);
}

async function openNewIdentity(email = "new-admin@example.test") {
  fireEvent.click(screen.getByRole("button", { name: "Crear centro" }));
  const emailInput = await screen.findByLabelText("Email del primer administrador");
  fireEvent.change(emailInput, { target: { value: email } });
  fireEvent.submit(emailInput.closest("form")!);
  await screen.findByText(/Identidad nueva:|Identidad existente:/);
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
  const confirmation = screen.getByLabelText("Confirmar contraseña");
  fireEvent.change(confirmation, { target: { value: password } });
  return (screen.getByRole("button", { name: "Revisar centro" }) as HTMLButtonElement).form!;
}

function submitReviewed(form: HTMLFormElement) {
  fireEvent.submit(form);
  expect(screen.getByText("Revisá los datos antes de continuar")).toBeVisible();
  expect(actions.create).not.toHaveBeenCalled();
  fireEvent.submit(form);
}

function storedPlatformIntent() {
  return Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith(PLATFORM_OPERATION_INTENT_STORAGE_PREFIX))
    .map(([, value]) => value)
    .join("\n");
}

describe("CreateCenterPanel password lifecycle", () => {
  beforeEach(() => {
    router.refresh.mockReset();
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
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
    expect(passwordInput).toHaveAttribute("type", "password");
    fireEvent.click(screen.getAllByRole("button", { name: "Mostrar contraseña" })[0]);
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(passwordInput).toHaveValue(password);

    submitReviewed(form);

    await screen.findByText(
      "El centro se creó correctamente y ya está disponible para su administración.",
    );
    expect(passwordInput).toHaveValue("");
    expect(submittedFormData?.has("adminInitialPassword")).toBe(false);
    expect(storedPlatformIntent()).not.toContain(password);
    fireEvent.click(screen.getAllByRole("button", { name: "Cerrar" }).at(-1)!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear centro" })).toHaveFocus();
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

    submitReviewed(form);

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

    submitReviewed(form);

    await screen.findByText("No pudimos confirmar el resultado. Reintentá esta misma operación.");
    expect(document.querySelector('input[name="adminInitialPassword"]')).toHaveValue("");
    expect(new FormData(form).get("operationId")).toBe(operationId);
    expect(storedPlatformIntent()).not.toContain(password);
  });

  it("reconciles an ambiguous result with the same operation id and no preserved password", async () => {
    const password = "response-loss-password";
    const submissions: Array<{ operationId: string; password: string; retrying: string }> = [];
    actions.create
      .mockImplementationOnce(async (_previousState, formData: FormData) => {
        submissions.push({
          operationId: String(formData.get("operationId")),
          password: String(formData.get("adminInitialPassword")),
          retrying: String(formData.get("isRetryingOperation")),
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
          retrying: String(formData.get("isRetryingOperation")),
        });
        return {
          status: "confirmed",
          message: "La operación quedó confirmada al reintentar, sin duplicar el centro.",
        };
      });
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter(password);

    submitReviewed(form);
    await screen.findByText("No pudimos confirmar el resultado. Reintentá la misma operación.");
    expect(document.querySelector('input[name="adminInitialPassword"]')).toHaveValue("");
    expect(storedPlatformIntent()).not.toContain(password);
    expect(
      screen.queryByRole("button", { name: /Abandonar e iniciar nueva alta/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar / verificar" })).toBeVisible();

    fireEvent.submit(form);
    await screen.findByText(/quedó confirmada sin crear un centro duplicado/);

    expect(submissions).toHaveLength(2);
    expect(submissions[0]).toEqual(expect.objectContaining({ password, retrying: "false" }));
    expect(submissions[1]).toEqual({
      operationId: submissions[0]?.operationId,
      password: "",
      retrying: "true",
    });
    await waitFor(() => expect(storedPlatformIntent()).toBe(""));
  });

  it("does not send the same reviewed form twice while creation is pending", async () => {
    let finish: (() => void) | undefined;
    actions.create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ status: "success", message: "Centro creado." });
        }),
    );
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter("pending-password");
    fireEvent.submit(form);
    expect(screen.queryByText(/Hay una creación pendiente de confirmar/)).not.toBeInTheDocument();
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(actions.create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Volver a editar" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Abandonar e iniciar nueva alta" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Hay una creación pendiente de confirmar/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Creando centro…").length).toBeGreaterThan(0);
    expect(storedPlatformIntent()).not.toContain("pending-password");
    expect(storedPlatformIntent()).toContain(String(new FormData(form).get("operationId")));
    finish?.();
    await screen.findByText(
      "El centro se creó correctamente y ya está disponible para su administración.",
    );
  });

  it("reopens an uncertain creation with the same operation id and no new-creation action", async () => {
    actions.create.mockResolvedValueOnce({
      status: "error",
      retryMode: "same-operation",
      message: "No pudimos confirmar el resultado. Reintentá esta misma operación.",
    });
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter("uncertain-password");
    const operationId = String(new FormData(form).get("operationId"));
    submitReviewed(form);
    await screen.findByText("No pudimos confirmar el resultado. Reintentá esta misma operación.");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByText("Cerrar alta pendiente")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar y conservar alta" }));
    expect(storedPlatformIntent()).toContain(operationId);
    expect(storedPlatformIntent()).not.toContain("uncertain-password");
    fireEvent.click(screen.getByRole("button", { name: "Crear centro" }));
    const recoveredForm = (
      (await screen.findByRole("button", { name: "Revisar centro" })) as HTMLButtonElement
    ).form!;
    expect(new FormData(recoveredForm).get("operationId")).toBe(operationId);
    expect(screen.queryByRole("button", { name: /Iniciar nueva alta/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email del primer administrador")).not.toBeInTheDocument();
  });

  it("keeps mismatched passwords on step 2 and never calls the create action", async () => {
    renderPanel();
    await openNewIdentity();
    await completeCenter("valid-password");
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar centro" }));
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeVisible();
    expect(screen.getByText("Paso 2 de 3 · Datos del centro")).toBeVisible();
    expect(actions.create).not.toHaveBeenCalled();
    expect(storedPlatformIntent()).not.toContain("valid-password");
  });

  it("offers IANA suggestions while preserving valid aliases outside the suggestions", async () => {
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter("valid-password");
    const timezone = screen.getByLabelText("Zona horaria") as HTMLInputElement;
    expect(timezone).toHaveValue("Buenos Aires, Argentina (GMT-3)");
    expect(new FormData(form).get("centerTimezone")).toBe("America/Argentina/Buenos_Aires");
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 500));
    vi.spyOn(timezone, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 200, 300, 44));
    fireEvent.focus(timezone);
    fireEvent.change(timezone, { target: { value: "Buenos" } });
    expect(screen.getByRole("listbox")).toHaveTextContent("Buenos Aires, Argentina (GMT-3)");
    fireEvent.keyDown(timezone, { key: "ArrowDown" });
    fireEvent.keyDown(timezone, { key: "Enter" });
    expect(timezone).toHaveValue("Buenos Aires, Argentina (GMT-3)");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar zonas horarias" }));
    expect(screen.getAllByRole("option").length).toBeGreaterThan(2);
    fireEvent.change(timezone, { target: { value: "Argentina" } });
    expect(screen.getByRole("listbox")).toHaveTextContent("Buenos Aires, Argentina");
    fireEvent.change(timezone, { target: { value: "Mars/Olympus" } });
    fireEvent.submit(form);
    expect(screen.getByText("Ingresá una zona horaria IANA válida.")).toBeVisible();
    expect(actions.create).not.toHaveBeenCalled();
    fireEvent.change(timezone, { target: { value: "US/Eastern" } });
    fireEvent.blur(timezone);
    expect((timezone as HTMLInputElement).value).toMatch(/^New York, Estados Unidos \(GMT-/);
    fireEvent.submit(form);
    expect(screen.getByText("US/Eastern")).toBeVisible();
    expect(new FormData(form).get("centerTimezone")).toBe("US/Eastern");
    expect(actions.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver a editar" }));
    expect((screen.getByLabelText("Zona horaria") as HTMLInputElement).value).toMatch(
      /^New York, Estados Unidos \(GMT-/,
    );
    fireEvent.submit(form);
    actions.create.mockResolvedValueOnce({ status: "success", message: "Centro creado." });
    fireEvent.submit(form);
    await screen.findByText(
      "El centro se creó correctamente y ya está disponible para su administración.",
    );
    expect((actions.create.mock.calls[0]?.[1] as FormData).get("centerTimezone")).toBe(
      "US/Eastern",
    );
  }, 15_000);

  it.each(["", "dfs", "dfs@asda"])(
    "shows a custom email error and blocks the first step for %s",
    async (value) => {
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Crear centro" }));
      const emailInput = screen.getByLabelText(
        "Email del primer administrador",
      ) as HTMLInputElement;
      const form = emailInput.closest("form")!;
      expect(form.noValidate).toBe(true);
      expect(emailInput).toHaveAttribute("type", "email");
      fireEvent.change(emailInput, { target: { value } });
      expect(screen.queryByText("Ingresá un email válido.")).not.toBeInTheDocument();
      fireEvent.submit(form);
      expect(screen.getByText("Ingresá un email válido.")).toBeVisible();
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
      expect(emailInput).toHaveAttribute("aria-describedby", "identity-email-error");
      expect(emailInput).toHaveFocus();
      expect(emailInput.className).toContain("border-red-500");
      expect(actions.resolve).not.toHaveBeenCalled();
      expect(screen.getByText("Paso 1 de 3 · Administrador inicial")).toBeVisible();
      fireEvent.change(emailInput, { target: { value: "usuario@gmail.com" } });
      expect(screen.queryByText("Ingresá un email válido.")).not.toBeInTheDocument();
    },
  );

  it.each(["usuario@gmail.com", "persona+turnos@sub.example.org"])(
    "accepts the existing email contract for %s",
    async (value) => {
      actions.resolve.mockResolvedValueOnce({
        status: "success",
        email: value,
        identityExists: false,
      });
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Crear centro" }));
      const emailInput = screen.getByLabelText("Email del primer administrador");
      fireEvent.change(emailInput, { target: { value } });
      fireEvent.submit(emailInput.closest("form")!);
      await screen.findByText(/Identidad nueva:/);
      expect(actions.resolve).toHaveBeenCalledWith(value);
    },
  );

  it("focuses a server-rejected email without advancing", async () => {
    actions.resolve.mockResolvedValueOnce({
      status: "error",
      fieldErrors: { email: ["Ingresá un email válido."] },
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Crear centro" }));
    const emailInput = screen.getByLabelText("Email del primer administrador");
    fireEvent.change(emailInput, { target: { value: "usuario@gmail.com" } });
    fireEvent.submit(emailInput.closest("form")!);
    await screen.findByText("Ingresá un email válido.");
    expect(emailInput).toHaveFocus();
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Paso 1 de 3 · Administrador inicial")).toBeVisible();
  });

  it("keeps actions outside the scroll area and focuses the first invalid field", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Crear centro" }));
    const continueButton = screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement;
    expect(
      screen.getByText("Ingresá el email de la persona que administrará inicialmente este centro."),
    ).toBeVisible();
    expect(continueButton.form).toBe(
      screen.getByLabelText("Email del primer administrador").closest("form"),
    );
    expect(continueButton.closest("[data-center-modal-scroll]")).toBeNull();

    const emailInput = screen.getByLabelText("Email del primer administrador");
    fireEvent.change(emailInput, { target: { value: "new-admin@example.test" } });
    fireEvent.submit(emailInput.closest("form")!);
    await screen.findByText(/Identidad nueva:/);
    const reviewButton = screen.getByRole("button", {
      name: "Revisar centro",
    }) as HTMLButtonElement;
    expect(reviewButton.closest("[data-center-modal-scroll]")).toBeNull();
    expect(reviewButton.form).toContainElement(screen.getByLabelText("Zona horaria"));
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: vi.fn(),
    });
    fireEvent.click(reviewButton);
    expect(screen.getByText("Ingresá el nombre del centro.")).toBeVisible();
    await waitFor(() => expect(document.querySelector('input[name="centerName"]')).toHaveFocus());
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("focuses the visible timezone combobox when the IANA value is invalid", async () => {
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter("valid-password");
    const timezone = screen.getByRole("combobox", { name: "Zona horaria" });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: vi.fn(),
    });
    fireEvent.change(timezone, { target: { value: "Mars/Olympus" } });
    fireEvent.submit(form);
    expect(screen.getByText("Ingresá una zona horaria IANA válida.")).toBeVisible();
    await waitFor(() => expect(timezone).toHaveFocus());
    expect(form.querySelector('input[name="centerTimezone"]')).not.toHaveFocus();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("reuses an existing account without asking for personal data or password", async () => {
    actions.resolve.mockResolvedValueOnce({
      status: "success",
      email: "existing@example.test",
      identityExists: true,
      message: "Usaremos esta cuenta.",
    });
    actions.create.mockResolvedValueOnce({ status: "success", message: "Centro creado." });
    renderPanel();
    await openNewIdentity("existing@example.test");
    expect(document.querySelector('input[name="adminInitialPassword"]')).toBeNull();
    changeNamedInput("centerName", "Centro Uno");
    const form = (screen.getByRole("button", { name: "Revisar centro" }) as HTMLButtonElement)
      .form!;
    fireEvent.submit(form);
    expect(screen.getByText("Cuenta existente")).toBeVisible();
    expect(actions.create).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await screen.findByText(
      "El centro se creó correctamente y ya está disponible para su administración.",
    );
    expect(actions.create).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding a draft and restores focus after closing", async () => {
    renderPanel();
    await openNewIdentity();
    await completeCenter("draft-password");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByText("¿Descartar alta?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByRole("button", { name: "Revisar centro" })).toBeVisible();
    expect(document.querySelector('input[name="centerName"]')).toHaveValue("Centro Seguro");
    expect(document.querySelector('input[name="adminInitialPassword"]')).toHaveValue(
      "draft-password",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar alta" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear centro" })).toHaveFocus();
    expect(storedPlatformIntent()).not.toContain("draft-password");
  });

  it("keeps success open and starts another center with a new operation id", async () => {
    actions.create.mockResolvedValueOnce({ status: "success", message: "Centro creado." });
    renderPanel();
    await openNewIdentity();
    const form = await completeCenter("success-password");
    const firstOperationId = String(new FormData(form).get("operationId"));
    submitReviewed(form);
    await screen.findByText(
      "El centro se creó correctamente y ya está disponible para su administración.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear otro centro" }));
    expect(screen.getByText("Paso 1 de 3 · Administrador inicial")).toBeVisible();
    expect(screen.getByLabelText("Email del primer administrador")).toHaveValue("");
    expect(document.querySelector('input[name="adminInitialPassword"]')).toBeNull();
    expect(storedPlatformIntent()).toBe("");
    const nextEmail = screen.getByLabelText("Email del primer administrador");
    fireEvent.change(nextEmail, { target: { value: "new-admin@example.test" } });
    fireEvent.submit(nextEmail.closest("form")!);
    const nextForm = await screen
      .findByRole("button", { name: "Revisar centro" })
      .then((button) => (button as HTMLButtonElement).form!);
    expect(String(new FormData(nextForm).get("operationId"))).not.toBe(firstOperationId);
  });

  it("keeps a recovered terminal failure visible until a new intent is explicitly started", async () => {
    const operationId = "33333333-3333-4333-8333-333333333333";
    sessionStorage.setItem(
      platformOperationIntentStorageKey(actorUserId),
      JSON.stringify({
        version: 1,
        scope: "platform-create-center",
        actorUserId,
        operationId,
        payload: {
          centerName: "Centro pendiente",
          centerAddress: "",
          centerPhone: "",
          centerEmail: "",
          centerTimezone: "America/Argentina/Buenos_Aires",
          adminEmail: "existing@example.test",
          adminFirstName: "",
          adminLastName: "",
          identityExists: true,
        },
      }),
    );
    actions.create.mockResolvedValueOnce({
      status: "error",
      retryMode: "new-operation",
      message: "El alta no se completó.",
    });
    renderPanel();
    const form = await screen
      .findByRole("button", { name: "Revisar centro" })
      .then((button) => (button as HTMLButtonElement).form!);
    submitReviewed(form);
    await screen.findByText("El alta no se completó.");
    expect(screen.getByRole("button", { name: "Iniciar una nueva alta" })).toBeVisible();
    expect(screen.queryByLabelText("Email del primer administrador")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar una nueva alta" }));
    expect(screen.getByLabelText("Email del primer administrador")).toBeVisible();
    expect(sessionStorage.getItem(platformOperationIntentStorageKey(actorUserId))).toBeNull();
  });

  it("blocks a new intent when a stored operation cannot be recovered safely", async () => {
    const key = platformOperationIntentStorageKey(actorUserId);
    sessionStorage.setItem(key, "{invalid-json");
    renderPanel();
    await screen.findByText(/Hay una creación de centro pendiente que no puede recuperarse/);
    expect(screen.getByText(/No es seguro iniciar otra alta/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Abandonar intención pendiente/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByText("Cerrar alta pendiente")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar y conservar alta" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(key)).toBe("{invalid-json");
    fireEvent.click(screen.getByRole("button", { name: "Crear centro" }));
    await screen.findByText(/Hay una creación de centro pendiente que no puede recuperarse/);
    expect(screen.queryByLabelText("Email del primer administrador")).not.toBeInTheDocument();
  });
});
