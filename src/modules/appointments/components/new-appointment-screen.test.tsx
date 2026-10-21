import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAppointmentAction,
  reconcileAppointmentCreateAction,
  searchAppointmentPatientsAction,
} from "../actions/appointment-actions";
import { NewAppointmentScreen } from "./new-appointment-screen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../actions/appointment-actions", () => ({
  createAppointmentAction: vi.fn(),
  reconcileAppointmentCreateAction: vi.fn(),
  searchAppointmentPatientsAction: vi.fn(),
}));
vi.mock("./booking-selector", () => ({
  BookingSelector: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          specialtyId: "22222222-2222-4222-8222-222222222222",
          specialtyName: "Clínica",
          professionalCenterId: "33333333-3333-4333-8333-333333333333",
          professionalName: "Dr Sol",
          duration: 30,
          localDate: "2026-12-20",
          localStartTime: "09:00",
          localEndDate: "2026-12-20",
          localEndTime: "09:30",
          startsAt: "2026-12-20T12:00:00+00:00",
          endsAt: "2026-12-20T12:30:00+00:00",
        })
      }
    >
      Elegir slot de prueba
    </button>
  ),
}));
const centerId = "11111111-1111-4111-8111-111111111111";
const patientCenterId = "44444444-4444-4444-8444-444444444444";
const appointmentId = "55555555-5555-4555-8555-555555555555";
function screenWithPatient() {
  render(
    <NewAppointmentScreen
      centerId={centerId}
      centerName="Centro"
      timezone="America/Argentina/Buenos_Aires"
      initialPatient={{ patientCenterId, firstName: "Ana", lastName: "Paz" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Elegir slot de prueba" }));
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("new appointment flow", () => {
  it("shows patient, Specialty, local slot, duration and note before creating PENDING once", async () => {
    vi.mocked(createAppointmentAction).mockResolvedValue({
      status: "SUCCESS",
      data: {
        appointment_id: appointmentId,
        status: "PENDING",
        updated_at: "2026-10-19T12:00:00.123456+00:00",
      },
    });
    screenWithPatient();
    expect(
      screen.getByText("Seleccioná el paciente, el profesional y un horario disponible."),
    ).toBeVisible();
    expect(screen.queryByText(/America\/Argentina\/Buenos_Aires/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Nota" }), {
      target: { value: "Control" },
    });
    expect(screen.getByRole("textbox", { name: /^Nota$/ })).toHaveValue("Control");
    expect(screen.getByText("09:00–09:30")).toBeInTheDocument();
    expect(screen.getByText("30 minutos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y crear turno" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/centers/${centerId}/appointments/${appointmentId}`),
    );
    expect(createAppointmentAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Turno creado" }));
    expect(createAppointmentAction).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Turno creado" })).toBeDisabled();
    expect(createAppointmentAction).toHaveBeenCalledWith(
      expect.objectContaining({
        centerId,
        patientCenterId,
        localStartTime: "09:00",
        administrativeNote: "Control",
      }),
    );
  });
  it("blocks duplicate submit and requires reconciliation after UNKNOWN_RESULT", async () => {
    let finish!: (value: {
      status: "UNKNOWN_RESULT";
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY";
    }) => void;
    vi.mocked(createAppointmentAction).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    screenWithPatient();
    const submit = screen.getByRole("button", { name: "Confirmar y crear turno" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(createAppointmentAction).toHaveBeenCalledTimes(1);
    finish({ status: "UNKNOWN_RESULT", reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La operación pudo haberse completado",
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getByRole("button", { name: "Confirmar y crear turno" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verificar turno propuesto" })).toBeEnabled();
    expect(sessionStorage.getItem(`appointment-create-uncertain:${centerId}`)).toContain(
      patientCenterId,
    );
    expect(push).not.toHaveBeenCalled();
  });
  it("checks the exact proposed future slot and keeps CREATE blocked when inconclusive", async () => {
    vi.mocked(createAppointmentAction).mockResolvedValue({
      status: "UNKNOWN_RESULT",
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
    });
    vi.mocked(reconcileAppointmentCreateAction).mockResolvedValue({
      status: "SUCCESS",
      data: { kind: "INCONCLUSIVE" },
    });
    screenWithPatient();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y crear turno" }));
    fireEvent.click(await screen.findByRole("button", { name: "Verificar turno propuesto" }));
    await waitFor(() =>
      expect(reconcileAppointmentCreateAction).toHaveBeenCalledWith(
        expect.objectContaining({
          centerId,
          patientCenterId,
          professionalCenterId: "33333333-3333-4333-8333-333333333333",
          localDate: "2026-12-20",
          startsAt: "2026-12-20T12:00:00+00:00",
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "Confirmar y crear turno" })).toBeDisabled();
    expect(createAppointmentAction).toHaveBeenCalledTimes(1);
  });
  it("links a matching appointment without another CREATE", async () => {
    vi.mocked(createAppointmentAction).mockResolvedValue({
      status: "UNKNOWN_RESULT",
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
    });
    vi.mocked(reconcileAppointmentCreateAction).mockResolvedValue({
      status: "SUCCESS",
      data: { kind: "MATCH", appointmentId },
    });
    screenWithPatient();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y crear turno" }));
    fireEvent.click(await screen.findByRole("button", { name: "Verificar turno propuesto" }));
    expect(await screen.findByRole("link", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/appointments/${appointmentId}`,
    );
    expect(createAppointmentAction).toHaveBeenCalledTimes(1);
  });
  it("discards patient results when query changes before a response", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof searchAppointmentPatientsAction>>) => void;
    vi.mocked(searchAppointmentPatientsAction).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(
      <NewAppointmentScreen
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        initialPatient={null}
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Buscar paciente activo" });
    fireEvent.change(input, { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.change(input, { target: { value: "Eva" } });
    resolve({
      status: "SUCCESS",
      data: {
        rows: [{ patientCenterId, firstName: "Ana", lastName: "Paz" }],
        page: 1,
        hasNext: false,
      },
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Seleccionar" })).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue("Eva");
  });
  it("discards an old page after a newer patient search starts", async () => {
    let finishOld!: (value: Awaited<ReturnType<typeof searchAppointmentPatientsAction>>) => void;
    vi.mocked(searchAppointmentPatientsAction)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValueOnce({
        status: "SUCCESS",
        data: {
          rows: [{ patientCenterId: appointmentId, firstName: "Eva", lastName: "Sol" }],
          page: 1,
          hasNext: false,
        },
      });
    render(
      <NewAppointmentScreen
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        initialPatient={null}
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Buscar paciente activo" });
    fireEvent.change(input, { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.change(input, { target: { value: "Eva" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("Eva Sol")).toBeInTheDocument();
    finishOld({
      status: "SUCCESS",
      data: {
        rows: [{ patientCenterId, firstName: "Ana", lastName: "Paz" }],
        page: 1,
        hasNext: false,
      },
    });
    await waitFor(() => expect(screen.queryByText("Ana Paz")).not.toBeInTheDocument());
    expect(screen.getByText("Eva Sol")).toBeInTheDocument();
  });
  it("restores an unresolved CREATE lock after remount", async () => {
    sessionStorage.setItem(
      `appointment-create-uncertain:${centerId}`,
      JSON.stringify({
        centerId,
        patientCenterId,
        professionalCenterId: "33333333-3333-4333-8333-333333333333",
        specialtyId: "22222222-2222-4222-8222-222222222222",
        localDate: "2026-12-20",
        startsAt: "2026-12-20T12:00:00+00:00",
        endsAt: "2026-12-20T12:30:00+00:00",
      }),
    );
    screenWithPatient();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verificar turno propuesto" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Confirmar y crear turno" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y crear turno" }));
    expect(createAppointmentAction).not.toHaveBeenCalled();
  });
  it("offers the existing Patients registration when the search is empty", async () => {
    vi.mocked(searchAppointmentPatientsAction).mockResolvedValue({
      status: "SUCCESS",
      data: { rows: [], page: 1, hasNext: false },
    });
    render(
      <NewAppointmentScreen
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        initialPatient={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("No encontramos pacientes activos.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Registrar o reactivar paciente" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/patients?from=appointment`,
    );
    expect(screen.getByRole("button", { name: "Confirmar y crear turno" })).toBeDisabled();
  });
});
