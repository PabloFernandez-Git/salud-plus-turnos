import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPatientAction,
  linkPatientAction,
  reactivatePatientAction,
  resolvePatientAction,
  updatePatientAction,
  deactivatePatientAction,
} from "../actions/patient-actions";
import { PatientWorkspace } from "./patient-workspace";

vi.mock("../actions/patient-appointment-actions", () => ({
  loadPatientAppointmentSectionsAction: vi.fn(async () => ({
    status: "success",
    data: {
      asOf: "2026-10-22T12:00:00.000Z",
      upcoming: { rows: [], hasMore: false, nextCursor: null },
      history: { rows: [], hasMore: false, nextCursor: null },
    },
  })),
  loadPatientAppointmentPageAction: vi.fn(),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../actions/patient-actions", () => ({
  createPatientAction: vi.fn(),
  linkPatientAction: vi.fn(),
  reactivatePatientAction: vi.fn(),
  resolvePatientAction: vi.fn(),
  updatePatientAction: vi.fn(),
  deactivatePatientAction: vi.fn(),
}));
const centerId = "11111111-1111-4111-8111-111111111111";
const patientCenterId = "22222222-2222-4222-8222-222222222222";
const personId = "33333333-3333-4333-8333-333333333333";
const updatedAt = "2026-10-14T12:00:00+00:00";
const filters = { query: "Ana", state: "ALL" as const, page: 2 };
const notFound = {
  identity_status: "NOT_FOUND",
  first_name: null,
  last_name: null,
  birth_date_matches: null,
  relationship_state: null,
  person_id: null,
  patient_center_id: null,
  patient_center_updated_at: null,
};
const found = (state: "NOT_LINKED" | "ACTIVE" | "INACTIVE", matches = true) => ({
  identity_status: "FOUND",
  first_name: "Ana",
  last_name: "Pérez",
  birth_date_matches: matches,
  relationship_state: state,
  person_id: matches ? personId : null,
  patient_center_id: matches && state !== "NOT_LINKED" ? patientCenterId : null,
  patient_center_updated_at: matches && state !== "NOT_LINKED" ? updatedAt : null,
});
const detail = {
  patientCenterId,
  phone: "555",
  email: null,
  insuranceName: null,
  administrativeNotes: "Privada",
  isActive: true,
  updatedAt,
  firstName: "Ana",
  lastName: "Pérez",
  birthDate: "2000-01-02",
  nationalityCode: "AR",
  documentNumber: "123",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function openRegistrationDialog() {
  render(
    <PatientWorkspace centerId={centerId} filters={filters} detail={null} detailFailed={false} />,
  );
  const trigger = screen.getByRole("button", { name: "Registrar paciente" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Registrar paciente" }) as HTMLDialogElement;
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 400,
    right: 900,
    top: 0,
    bottom: 800,
  } as DOMRect);
  return { dialog, trigger };
}
function requestRegistrationClose(
  dialog: HTMLDialogElement,
  method: "Cerrar" | "Fondo" | "Escape",
) {
  if (method === "Cerrar") fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  else if (method === "Fondo") fireEvent.click(dialog, { clientX: 100, clientY: 100 });
  else fireEvent(dialog, new Event("cancel", { cancelable: true }));
}
function renderRegistration() {
  render(
    <PatientWorkspace centerId={centerId} filters={filters} detail={null} detailFailed={false} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Registrar paciente" }));
  fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
    target: { value: "02/01/2000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
}

function renderAdministration() {
  const view = render(
    <PatientWorkspace centerId={centerId} filters={filters} detail={detail} detailFailed={false} />,
  );
  const dialog = screen.getByRole("dialog", { name: "Administrar paciente" }) as HTMLDialogElement;
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 400,
    right: 900,
    top: 0,
    bottom: 800,
  } as DOMRect);
  return { dialog, ...view };
}

describe("patient staged dialogs", () => {
  it("uses inline validation, focuses the first invalid identity field and clears errors on correction", () => {
    openRegistrationDialog();
    const document = screen.getByRole("textbox", { name: "Documento" });
    const birthDate = screen.getByRole("textbox", { name: "Fecha de nacimiento" });
    expect(document.closest("form")).toHaveAttribute("novalidate");
    expect(birthDate).toHaveAttribute("type", "text");
    expect(birthDate).toHaveAttribute("inputmode", "numeric");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    expect(document).toHaveFocus();
    expect(document).toHaveAttribute("aria-invalid", "true");
    expect(document).toHaveClass("border-red-700", "border-2");
    expect(screen.getByText("Ingresá el documento.")).toBeVisible();
    expect(screen.queryByText(/No pudimos comprobar la identidad/)).not.toBeInTheDocument();
    expect(resolvePatientAction).not.toHaveBeenCalled();

    fireEvent.change(document, { target: { value: "123" } });
    expect(document).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText("Ingresá el documento.")).not.toBeInTheDocument();
    fireEvent.change(birthDate, { target: { value: "29022023" } });
    expect(birthDate).toHaveValue("29/02/2023");
    fireEvent.blur(birthDate);
    expect(birthDate).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Ingresá una fecha válida en formato DD/MM/AAAA.")).toBeVisible();
    fireEvent.change(birthDate, { target: { value: "29022024" } });
    expect(birthDate).toHaveValue("29/02/2024");
    expect(birthDate).toHaveAttribute("aria-invalid", "false");
    expect(
      screen.queryByText("Ingresá una fecha válida en formato DD/MM/AAAA."),
    ).not.toBeInTheDocument();
  });

  it("validates the center's civil date and does not resolve a future birth date", () => {
    openRegistrationDialog();
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    const birthDate = screen.getByRole("textbox", { name: "Fecha de nacimiento" });
    fireEvent.change(birthDate, { target: { value: "01/01/9999" } });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    expect(birthDate).toHaveFocus();
    expect(screen.getByText("La fecha de nacimiento no puede ser futura.")).toBeVisible();
    expect(resolvePatientAction).not.toHaveBeenCalled();
  });

  it("validates details inline before review and focuses the first invalid field", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: notFound,
    } as never);
    renderRegistration();
    await screen.findByText("2. Datos del nuevo paciente");
    expect(screen.queryByText(/No pudimos comprobar la identidad/)).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Revisar alta" });
    const name = screen.getByRole("textbox", { name: /^Nombre$/ });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("3. Revisión y confirmación")).not.toBeInTheDocument();
    fireEvent.change(name, { target: { value: "Ana" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Apellido" }), {
      target: { value: "Pérez" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: "555" },
    });
    const email = screen.getByRole("textbox", { name: "Email (opcional)" });
    fireEvent.change(email, { target: { value: "correo-inválido" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Ingresá un email válido.")).toBeVisible();
    fireEvent.change(email, { target: { value: "ANA@EXAMPLE.TEST" } });
    expect(email).toHaveAttribute("aria-invalid", "false");
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    expect(await screen.findByRole("region", { name: "Revisión y confirmación" })).toBeVisible();
  });

  it("guards unsaved registration data on the backdrop and restores focus after discard", async () => {
    const { dialog, trigger } = openRegistrationDialog();
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "123" } });
    requestRegistrationClose(dialog, "Fondo");
    const discardDialog = screen.getByRole("dialog", { name: "Descartar cambios" });
    expect(discardDialog).toBeVisible();
    expect(discardDialog).toHaveAttribute("aria-describedby", "patient-discard-description");
    expect(screen.getByRole("heading", { name: "¿Descartar cambios?" })).toBeVisible();
    expect(
      screen.getByText("Hay datos sin guardar. Si salís ahora, perderás los cambios realizados."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByLabelText("Documento")).toHaveValue("123");
    requestRegistrationClose(dialog, "Fondo");
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.queryByRole("dialog", { name: "Registrar paciente" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each(["Cerrar", "Escape"] as const)(
    "guards unsaved registration data on %s",
    async (method) => {
      const { dialog, trigger } = openRegistrationDialog();
      fireEvent.change(screen.getByLabelText("Nacionalidad"), {
        target: { value: "UY" },
      });
      requestRegistrationClose(dialog, method);
      expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
      expect(screen.getByLabelText("Nacionalidad")).toHaveValue("UY");
      requestRegistrationClose(dialog, method);
      fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );

  it("keeps registration open for clicks inside the panel and closes with Cerrar", async () => {
    const { dialog, trigger } = openRegistrationDialog();

    fireEvent.click(screen.getByRole("heading", { name: "Registrar paciente" }));
    fireEvent.click(dialog, { clientX: 500, clientY: 100 });
    expect(dialog).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Cerrar" });
    expect(closeButton).toHaveAttribute("aria-label", "Cerrar");
    expect(closeButton.textContent).toBe("");
    expect(closeButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    fireEvent.click(closeButton);
    expect(screen.queryByRole("dialog", { name: "Registrar paciente" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps the native Escape cancel path and restores focus", async () => {
    const { dialog, trigger } = openRegistrationDialog();

    const cancelEvent = new Event("cancel", { cancelable: true });
    if (dialog.dispatchEvent(cancelEvent)) dialog.close();

    expect(screen.queryByRole("dialog", { name: "Registrar paciente" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps Tab and Shift+Tab inside the centered registration dialog", () => {
    const { dialog } = openRegistrationDialog();
    const close = screen.getByRole("button", { name: "Cerrar" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Comprobar identidad" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
  });

  it("blocks all registration close paths while identity resolution is pending", async () => {
    const pendingResolve = deferred<Awaited<ReturnType<typeof resolvePatientAction>>>();
    vi.mocked(resolvePatientAction).mockReturnValueOnce(pendingResolve.promise);
    const { dialog } = openRegistrationDialog();
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "02/01/2000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    await waitFor(() => expect(resolvePatientAction).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    requestRegistrationClose(dialog, "Fondo");
    requestRegistrationClose(dialog, "Escape");
    expect(screen.getByRole("dialog", { name: "Registrar paciente" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Descartar cambios" })).not.toBeInTheDocument();
    await act(async () => pendingResolve.resolve({ status: "success", data: notFound } as never));
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeEnabled();
  });

  it("keeps registration open while a confirmed creation has an uncertain result", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: notFound,
    } as never);
    const pendingCreate = deferred<Awaited<ReturnType<typeof createPatientAction>>>();
    vi.mocked(createPatientAction).mockReturnValueOnce(pendingCreate.promise);
    renderRegistration();
    await screen.findByText("2. Datos del nuevo paciente");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Paciente" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    const confirm = await screen.findByRole("button", { name: "Confirmar" });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(createPatientAction).toHaveBeenCalledOnce());
    const dialog = screen.getByRole("dialog", { name: "Registrar paciente" }) as HTMLDialogElement;
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    requestRegistrationClose(dialog, "Fondo");
    requestRegistrationClose(dialog, "Escape");
    expect(dialog).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Descartar cambios" })).not.toBeInTheDocument();
    await act(async () =>
      pendingCreate.resolve({
        status: "success",
        data: { outcome: "CREATED", patient_center_id: patientCenterId },
      } as never),
    );
    expect(screen.queryByRole("dialog", { name: "Registrar paciente" })).not.toBeInTheDocument();
  });

  it("requires a second explicit confirmation before atomic creation", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: notFound,
    } as never);
    vi.mocked(createPatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "CREATED", patient_center_id: patientCenterId },
    } as never);
    renderRegistration();
    await screen.findByText("2. Datos del nuevo paciente");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Pérez" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    expect(createPatientAction).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(createPatientAction).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Paciente registrado correctamente"),
    );
    expect(screen.queryByRole("dialog", { name: "Administrar paciente" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("reviews normalized creation values and returns to editing without losing the draft", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: notFound,
    } as never);
    vi.mocked(createPatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "CREATED", patient_center_id: patientCenterId },
    } as never);
    openRegistrationDialog();
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "UY" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: " 123 " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Fecha de nacimiento" }), {
      target: { value: "02012000" },
    });
    expect(screen.getByRole("textbox", { name: "Fecha de nacimiento" })).toHaveValue("02/01/2000");
    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    await screen.findByText("2. Datos del nuevo paciente");
    fireEvent.change(screen.getByRole("textbox", { name: /^Nombre$/ }), {
      target: { value: " Ana " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Apellido" }), {
      target: { value: " Pérez " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: " 555 " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Email (opcional)" }), {
      target: { value: " ANA@EXAMPLE.TEST " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    const review = await screen.findByRole("region", { name: "Revisión y confirmación" });
    expect(within(review).getByText("Revisá los datos antes de crear el paciente.")).toBeVisible();
    expect(within(review).getByText("Ana Pérez")).toBeVisible();
    expect(within(review).getByText("Uruguay")).toBeVisible();
    expect(within(review).getByText("123")).toBeVisible();
    expect(within(review).getByText("02/01/2000")).toBeVisible();
    expect(within(review).getByText("ana@example.test")).toBeVisible();
    expect(within(review).getByText("Sin notas")).toBeVisible();
    expect(within(review).getAllByText("—")).toHaveLength(1);
    expect(createPatientAction).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "Corregir datos" }));
    expect(
      screen.queryByRole("region", { name: "Revisión y confirmación" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Teléfono" })).toHaveValue(" 555 ");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Teléfono" })).toHaveFocus());
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: " 777 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    const corrected = await screen.findByRole("region", { name: "Revisión y confirmación" });
    expect(within(corrected).getByText("777")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(createPatientAction).toHaveBeenCalledWith({
        centerId,
        nationalityCode: "UY",
        documentNumber: "123",
        birthDate: "2000-01-02",
        firstName: "Ana",
        lastName: "Pérez",
        phone: "777",
        email: "ana@example.test",
        insuranceName: null,
        administrativeNotes: null,
      }),
    );
  });
  it("keeps the existing appointment destination after creating from that flow", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: notFound,
    } as never);
    vi.mocked(createPatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "CREATED", patient_center_id: patientCenterId },
    } as never);
    render(
      <PatientWorkspace
        centerId={centerId}
        filters={filters}
        detail={null}
        detailFailed={false}
        returnToAppointments
      />,
    );
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "02/01/2000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    await screen.findByText("2. Datos del nuevo paciente");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Pérez" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/centers/${centerId}/appointments/new?patientCenterId=${patientCenterId}`,
      ),
    );
    expect(screen.queryByRole("dialog", { name: "Administrar paciente" })).not.toBeInTheDocument();
  });
  it.each([
    ["Nacionalidad", "UY", "nationalityCode"],
    ["Documento", "456", "documentNumber"],
    ["Fecha de nacimiento", "02/01/2001", "birthDate"],
  ])("discards a late NOT_FOUND after %s changes", async (label, value, changedField) => {
    const first = deferred<Awaited<ReturnType<typeof resolvePatientAction>>>();
    vi.mocked(resolvePatientAction)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ status: "success", data: notFound } as never);

    renderRegistration();
    await waitFor(() => expect(resolvePatientAction).toHaveBeenCalledOnce());
    expect(vi.mocked(resolvePatientAction).mock.calls[0][0]).toEqual({
      centerId,
      nationalityCode: "AR",
      documentNumber: "123",
      birthDate: "2000-01-02",
    });
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByRole("button", { name: "Comprobar identidad" })).toBeDisabled();
    expect(resolvePatientAction).toHaveBeenCalledOnce();
    await act(async () => first.resolve({ status: "success", data: notFound } as never));

    expect(screen.queryByText("2. Datos del nuevo paciente")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar alta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(createPatientAction).not.toHaveBeenCalled();
    expect(linkPatientAction).not.toHaveBeenCalled();
    expect(reactivatePatientAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    await screen.findByText("2. Datos del nuevo paciente");
    expect(resolvePatientAction).toHaveBeenCalledTimes(2);
    expect(vi.mocked(resolvePatientAction).mock.calls[1][0]).toEqual({
      centerId,
      nationalityCode: changedField === "nationalityCode" ? value : "AR",
      documentNumber: changedField === "documentNumber" ? value : "123",
      birthDate: changedField === "birthDate" ? "2001-01-02" : "2000-01-02",
    });
    expect(createPatientAction).not.toHaveBeenCalled();
  });
  it("blocks mutation and stored DOB disclosure on mismatch", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: {
        ...found("NOT_LINKED", false),
        first_name: "NombreInterno",
        last_name: "ApellidoInterno",
      },
    } as never);
    renderRegistration();
    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent(
      "No pudimos comprobar la identidad con los datos ingresados. Revisá el documento y la fecha de nacimiento.",
    );
    expect(warning).toHaveClass("bg-amber-50");
    expect(screen.getByRole("textbox", { name: "Documento" })).toHaveValue("123");
    expect(screen.getByRole("textbox", { name: "Fecha de nacimiento" })).toHaveValue("02/01/2000");
    expect(
      screen.queryByText(/NombreInterno|ApellidoInterno|2000-01-02|33333333/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Vincular|Reactivar|Revisar alta/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Revisión y confirmación" }),
    ).not.toBeInTheDocument();
    expect(linkPatientAction).not.toHaveBeenCalled();
    expect(createPatientAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Fecha de nacimiento" }), {
      target: { value: "03/01/2000" },
    });
    expect(screen.queryByText(/No pudimos comprobar la identidad/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Documento" })).toHaveValue("123");
    expect(screen.getByRole("textbox", { name: "Fecha de nacimiento" })).toHaveValue("03/01/2000");
  });
  it.each([
    ["denied", "No tenés permiso para esta acción."],
    ["invalid", "Revisá los datos ingresados."],
    ["unexpected", "No pudimos completar la operación."],
  ])("keeps the %s resolve error distinct from identity mismatch", async (code, message) => {
    vi.mocked(resolvePatientAction).mockResolvedValue({ status: "error", code, message } as never);
    renderRegistration();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/No pudimos comprobar la identidad/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Vincular|Reactivar|Revisar alta/ }),
    ).not.toBeInTheDocument();
    expect(createPatientAction).not.toHaveBeenCalled();
    expect(linkPatientAction).not.toHaveBeenCalled();
  });
  it("links only after confirmation and never displays the person ID", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("NOT_LINKED"),
    } as never);
    vi.mocked(linkPatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "ALREADY_ACTIVE", patient_center_id: patientCenterId },
    } as never);
    renderRegistration();
    await screen.findByText(/Identidad encontrada:/);
    expect(screen.queryByText(personId)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular a este centro" }));
    expect(linkPatientAction).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(linkPatientAction).toHaveBeenCalledWith(
        expect.objectContaining({ personId, confirmed: true }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("El paciente ya estaba vinculado"),
    );
    expect(push).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
    expect(createPatientAction).not.toHaveBeenCalled();
  });
  it("reviews the readonly shared identity and normalized center details before linking", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("NOT_LINKED"),
    } as never);
    vi.mocked(linkPatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "LINKED", patient_center_id: patientCenterId },
    } as never);
    renderRegistration();
    await screen.findByText(/Identidad encontrada:/);
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: " 555 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vincular a este centro" }));
    const review = await screen.findByRole("region", { name: "Revisión y confirmación" });
    expect(
      within(review).getByText("Revisá los datos antes de vincular el paciente con este centro."),
    ).toBeVisible();
    expect(within(review).getByText("Ana Pérez")).toBeVisible();
    expect(within(review).getByText("Argentina")).toBeVisible();
    expect(within(review).getByText("02/01/2000")).toBeVisible();
    expect(within(review).getByText("555")).toBeVisible();
    expect(within(review).getAllByText("—")).toHaveLength(2);
    expect(within(review).getByText("Sin notas")).toBeVisible();
    expect(screen.queryByText(personId)).not.toBeInTheDocument();
    expect(createPatientAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(linkPatientAction).toHaveBeenCalledWith({
        centerId,
        nationalityCode: "AR",
        documentNumber: "123",
        birthDate: "2000-01-02",
        personId,
        phone: "555",
        email: null,
        insuranceName: null,
        administrativeNotes: null,
        confirmed: true,
      }),
    );
  });
  it("confirms a new center link without opening administration or changing filters", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("NOT_LINKED"),
    } as never);
    vi.mocked(linkPatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "LINKED", patient_center_id: patientCenterId },
    } as never);
    renderRegistration();
    await screen.findByText(/Identidad encontrada:/);
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular a este centro" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Paciente vinculado correctamente"),
    );
    expect(createPatientAction).not.toHaveBeenCalled();
    expect(linkPatientAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("keeps the country code and registration fields when creation fails", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: notFound,
    } as never);
    vi.mocked(createPatientAction).mockResolvedValue({
      status: "error",
      code: "invalid",
      message: "Revisá los datos ingresados.",
      fields: { phone: "Revisá este campo." },
    } as never);
    openRegistrationDialog();
    expect(screen.getByRole("combobox", { name: "Nacionalidad" })).toHaveValue("AR");
    expect(screen.getByRole("option", { name: "Argentina" })).toHaveValue("AR");
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "UY" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "02/01/2000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    await screen.findByText("2. Datos del nuevo paciente");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Pérez" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar alta" }));
    expect(await screen.findByText("3. Revisión y confirmación")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await screen.findByText("Revisá los datos ingresados.");
    expect(screen.getByRole("combobox", { name: "Nacionalidad" })).toHaveValue("UY");
    expect(screen.getByRole("textbox", { name: "Teléfono" })).toHaveValue("555");
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
  it("reuses ACTIVE without a mutation", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("ACTIVE"),
    } as never);
    renderRegistration();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir panel" }));
    expect(createPatientAction).not.toHaveBeenCalled();
    expect(linkPatientAction).not.toHaveBeenCalled();
    expect(reactivatePatientAction).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(expect.stringContaining(`patient=${patientCenterId}`));
  });
  it("returns an ACTIVE patient to same-Center appointment creation only from the validated intent", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("ACTIVE"),
    } as never);
    render(
      <PatientWorkspace
        centerId={centerId}
        filters={filters}
        detail={null}
        detailFailed={false}
        returnToAppointments
      />,
    );
    expect(await screen.findByRole("dialog", { name: "Registrar paciente" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nacionalidad"), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "02/01/2000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abrir panel" }));
    expect(push).toHaveBeenCalledWith(
      `/centers/${centerId}/appointments/new?patientCenterId=${patientCenterId}`,
    );
    expect(createPatientAction).not.toHaveBeenCalled();
  });
  it("reactivates with identity and CAS token, without administrative fields", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("INACTIVE"),
    } as never);
    vi.mocked(reactivatePatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "REACTIVATED", patient_center_id: patientCenterId },
    } as never);
    renderRegistration();
    fireEvent.click(await screen.findByRole("button", { name: "Reactivar en este centro" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(reactivatePatientAction).toHaveBeenCalledWith(
        expect.objectContaining({ patientCenterId, expectedUpdatedAt: updatedAt, confirmed: true }),
      ),
    );
    expect(vi.mocked(reactivatePatientAction).mock.calls[0][0]).not.toHaveProperty("phone");
  });
  it("keeps identity read only and notes inside the administration panel", () => {
    render(
      <PatientWorkspace
        centerId={centerId}
        filters={filters}
        detail={detail}
        detailFailed={false}
      />,
    );
    expect(screen.getByText("Privada")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Documento" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notas administrativas" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver en listado" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desactivar paciente" })).toHaveClass(
      "border",
      "border-rose-300",
      "bg-white",
    );
    expect(updatePatientAction).not.toHaveBeenCalled();
    expect(deactivatePatientAction).not.toHaveBeenCalled();
  });
  it("opens administration as a centered modal with two keyboard operable tabs", async () => {
    const { dialog, rerender } = renderAdministration();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.className).toContain("max-w-2xl");
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    const dataTab = screen.getByRole("tab", { name: "Datos del paciente" });
    const appointmentsTab = screen.getByRole("tab", { name: "Turnos" });
    expect(dataTab).toHaveAttribute("aria-selected", "true");
    expect(appointmentsTab).toHaveAttribute("aria-selected", "false");
    const dataPanel = screen.getByRole("tabpanel", { name: "Datos del paciente" });
    expect(dataPanel).toBeVisible();
    expect(within(dataPanel).getByText("Ana Pérez", { exact: true })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Turnos" })).not.toBeInTheDocument();
    fireEvent.keyDown(dataTab, { key: "ArrowRight" });
    expect(appointmentsTab).toHaveFocus();
    expect(appointmentsTab).toHaveAttribute("aria-selected", "true");
    expect(dataPanel).not.toBeVisible();
    expect(within(dataPanel).getByText("Ana Pérez", { exact: true })).not.toBeVisible();
    expect(screen.getByRole("tabpanel", { name: "Turnos" })).toBeVisible();
    expect(await screen.findByText("No hay próximos turnos para este paciente.")).toBeVisible();
    expect(
      screen.getByText("Este paciente todavía no tiene turnos en el historial."),
    ).toBeVisible();
    fireEvent.keyDown(appointmentsTab, { key: "Home" });
    expect(dataTab).toHaveFocus();
    rerender(
      <PatientWorkspace centerId={centerId} filters={filters} detail={null} detailFailed={false} />,
    );
    expect(document.body.style.overflow).toBe("");
  });
  it.each(["Cerrar", "Escape", "Fondo"] as const)(
    "guards unsaved administration data on %s and preserves edits across tabs",
    (method) => {
      const { dialog } = renderAdministration();
      fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
        target: { value: "999" },
      });
      fireEvent.click(screen.getByRole("tab", { name: "Turnos" }));
      fireEvent.click(screen.getByRole("tab", { name: "Datos del paciente" }));
      expect(screen.getByRole("textbox", { name: "Teléfono" })).toHaveValue("999");
      if (method === "Cerrar") fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      else if (method === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
      else fireEvent.click(dialog, { clientX: 100, clientY: 100 });
      expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
      expect(screen.getByRole("textbox", { name: "Teléfono" })).toHaveValue("999");
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
      expect(push).toHaveBeenCalledWith(`/centers/${centerId}/patients?q=Ana&state=ALL&page=2`);
    },
  );
  it("blocks administration close while a save is pending, then clears the dirty prompt on success", async () => {
    const pendingUpdate = deferred<Awaited<ReturnType<typeof updatePatientAction>>>();
    vi.mocked(updatePatientAction).mockReturnValueOnce(pendingUpdate.promise);
    const { dialog } = renderAdministration();
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(updatePatientAction).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Teléfono" })).toBeDisabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    expect(screen.queryByRole("dialog", { name: "Descartar cambios" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await act(async () =>
      pendingUpdate.resolve({
        status: "success",
        data: { outcome: "UPDATED", patient_center_id: patientCenterId },
      } as never),
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Teléfono" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog", { name: "Descartar cambios" })).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledOnce();
  });
  it("saves only valid real changes and disables save after reverting or success", async () => {
    vi.mocked(updatePatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "UPDATED", patient_center_id: patientCenterId },
    } as never);
    renderAdministration();
    const save = screen.getByRole("button", { name: "Guardar cambios" });
    const phone = screen.getByRole("textbox", { name: "Teléfono" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(updatePatientAction).not.toHaveBeenCalled();
    fireEvent.change(phone, { target: { value: " 555 " } });
    expect(save).toBeDisabled();
    fireEvent.change(phone, { target: { value: "999" } });
    expect(save).toBeEnabled();
    fireEvent.change(phone, { target: { value: "555" } });
    expect(save).toBeDisabled();
    fireEvent.change(phone, { target: { value: "" } });
    expect(save).toBeDisabled();
    fireEvent.change(phone, { target: { value: "999" } });
    fireEvent.click(save);
    await waitFor(() => expect(updatePatientAction).toHaveBeenCalledOnce());
    await waitFor(() => expect(save).toBeDisabled());
    expect(screen.getByRole("status")).toHaveTextContent("Datos administrativos guardados.");
    expect(screen.queryByText("No había cambios para guardar.")).not.toBeInTheDocument();
  });
  it("keeps administrative edits and shows an error when save fails", async () => {
    vi.mocked(updatePatientAction).mockResolvedValue({
      status: "error",
      code: "invalid",
      message: "No pudimos guardar los datos.",
    } as never);
    renderAdministration();
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText("No pudimos guardar los datos.");
    expect(screen.getByRole("textbox", { name: "Teléfono" })).toHaveValue("999");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled(),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
  it("reactivates an inactive detail only after identity resolve and confirmation", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("INACTIVE"),
    } as never);
    vi.mocked(reactivatePatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "REACTIVATED", patient_center_id: patientCenterId },
    } as never);
    render(
      <PatientWorkspace
        centerId={centerId}
        filters={filters}
        detail={{ ...detail, isActive: false }}
        detailFailed={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Confirmar fecha de nacimiento"), {
      target: { value: "2000-01-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar para reactivar" }));
    expect(reactivatePatientAction).not.toHaveBeenCalled();
    const confirmReactivation = await screen.findByRole("button", {
      name: "Confirmar reactivación",
    });
    await waitFor(() => expect(confirmReactivation).toBeEnabled());
    fireEvent.click(confirmReactivation);
    await waitFor(() =>
      expect(reactivatePatientAction).toHaveBeenCalledWith(
        expect.objectContaining({ patientCenterId, expectedUpdatedAt: updatedAt, confirmed: true }),
      ),
    );
  });
  it("returns to appointment creation after reactivating from a detail opened with intent", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("INACTIVE"),
    } as never);
    vi.mocked(reactivatePatientAction).mockResolvedValue({
      status: "success",
      data: { outcome: "REACTIVATED", patient_center_id: patientCenterId },
    } as never);
    render(
      <PatientWorkspace
        centerId={centerId}
        filters={filters}
        detail={{ ...detail, isActive: false }}
        detailFailed={false}
        returnToAppointments
      />,
    );
    fireEvent.change(screen.getByLabelText("Confirmar fecha de nacimiento"), {
      target: { value: "2000-01-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comprobar para reactivar" }));
    const confirmReactivation = await screen.findByRole("button", {
      name: "Confirmar reactivación",
    });
    await waitFor(() => expect(confirmReactivation).toBeEnabled());
    fireEvent.click(confirmReactivation);
    await waitFor(() =>
      expect(reactivatePatientAction).toHaveBeenCalledWith(
        expect.objectContaining({ patientCenterId, expectedUpdatedAt: updatedAt, confirmed: true }),
      ),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/centers/${centerId}/appointments/new?patientCenterId=${patientCenterId}`,
      ),
    );
  });
  it("blocks another edit after stale until detail is reloaded", async () => {
    vi.mocked(updatePatientAction).mockResolvedValue({
      status: "error",
      code: "stale",
      message: "Los datos cambiaron desde que abriste este formulario.",
    } as never);
    render(
      <PatientWorkspace
        centerId={centerId}
        filters={filters}
        detail={detail}
        detailFailed={false}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(
      await screen.findByText("Los datos cambiaron desde que abriste este formulario."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Recargar datos" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(updatePatientAction).toHaveBeenCalledOnce();
  });
  it("does not retry a stale deactivation", async () => {
    vi.mocked(deactivatePatientAction).mockResolvedValue({
      status: "error",
      code: "stale",
      message: "Los datos cambiaron desde que abriste este formulario.",
    } as never);
    render(
      <PatientWorkspace
        centerId={centerId}
        filters={filters}
        detail={detail}
        detailFailed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Desactivar paciente" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar desactivación" }));
    await screen.findByText("Los datos cambiaron desde que abriste este formulario.");
    expect(screen.getByRole("button", { name: "Confirmar desactivación" })).toBeDisabled();
    expect(deactivatePatientAction).toHaveBeenCalledOnce();
  });
  it("shows the three confirmation sentences separately with the patient name", () => {
    renderAdministration();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar paciente" }));
    const confirmation = screen.getByRole("group", { name: "Confirmar desactivación" });
    expect(
      Array.from(confirmation.querySelectorAll("p"), (paragraph) => paragraph.textContent),
    ).toEqual([
      "¿Estás seguro que querés desactivar a Ana Pérez?",
      "Dejará de aparecer como paciente activo.",
      "El registro no se elimina.",
    ]);
    expect(confirmation.firstElementChild).toHaveClass("space-y-1.5");
    expect(screen.getByRole("button", { name: "Confirmar desactivación" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("group", { name: "Confirmar desactivación" }),
    ).not.toBeInTheDocument();
  });
});
