import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
afterEach(cleanup);
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
