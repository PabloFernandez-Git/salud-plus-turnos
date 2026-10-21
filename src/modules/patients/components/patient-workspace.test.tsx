import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    target: { value: "2000-01-02" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Comprobar identidad" }));
}

describe("patient staged dialogs", () => {
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
      fireEvent.change(screen.getByLabelText("Nacionalidad (código ISO de dos letras)"), {
        target: { value: "UY" },
      });
      requestRegistrationClose(dialog, method);
      expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
      expect(screen.getByLabelText("Nacionalidad (código ISO de dos letras)")).toHaveValue("UY");
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
      target: { value: "2000-01-02" },
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
    expect(push).toHaveBeenCalledWith(
      `/centers/${centerId}/patients?q=Ana&state=ALL&page=2&patient=${patientCenterId}`,
    );
  });
  it.each([
    ["Nacionalidad (código ISO de dos letras)", "UY", "nationalityCode"],
    ["Documento", "456", "documentNumber"],
    ["Fecha de nacimiento", "2001-01-02", "birthDate"],
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
      birthDate: changedField === "birthDate" ? value : "2000-01-02",
    });
    expect(createPatientAction).not.toHaveBeenCalled();
  });
  it("blocks mutation and stored DOB disclosure on mismatch", async () => {
    vi.mocked(resolvePatientAction).mockResolvedValue({
      status: "success",
      data: found("NOT_LINKED", false),
    } as never);
    renderRegistration();
    expect(
      await screen.findByText("Los datos ingresados no coinciden con la identidad registrada."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Vincular|Reactivar|Revisar alta/ }),
    ).not.toBeInTheDocument();
    expect(linkPatientAction).not.toHaveBeenCalled();
    expect(createPatientAction).not.toHaveBeenCalled();
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
    fireEvent.change(screen.getByLabelText("Nacionalidad (código ISO de dos letras)"), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), {
      target: { value: "2000-01-02" },
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
    expect(updatePatientAction).not.toHaveBeenCalled();
    expect(deactivatePatientAction).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar desactivación" }));
    await screen.findByText("Los datos cambiaron desde que abriste este formulario.");
    expect(screen.getByRole("button", { name: "Confirmar desactivación" })).toBeDisabled();
    expect(deactivatePatientAction).toHaveBeenCalledOnce();
  });
});
