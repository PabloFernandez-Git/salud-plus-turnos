import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  rescheduleAppointmentAction,
  transitionAppointmentStatusAction,
  updateAppointmentNoteAction,
} from "../actions/appointment-actions";
import { AppointmentDetailScreen } from "./appointment-detail-screen";
import type { StaffAppointment } from "../server/appointment-rpc";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions/appointment-actions", () => ({
  rescheduleAppointmentAction: vi.fn(),
  transitionAppointmentStatusAction: vi.fn(),
  updateAppointmentNoteAction: vi.fn(),
}));
vi.mock("./booking-selector", () => ({
  BookingSelector: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          specialtyId: "55555555-5555-4555-8555-555555555555",
          professionalCenterId: "66666666-6666-4666-8666-666666666666",
          localDate: "2026-10-21",
          localStartTime: "10:00",
          localEndDate: "2026-10-21",
          localEndTime: "10:30",
          startsAt: "2026-10-21T13:00:00+00:00",
          endsAt: "2026-10-21T13:30:00+00:00",
          duration: 30,
        })
      }
    >
      Elegir nuevo slot
    </button>
  ),
}));
const centerId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const patientCenterId = "33333333-3333-4333-8333-333333333333";
const professionalCenterId = "44444444-4444-4444-8444-444444444444";
const specialtyId = "55555555-5555-4555-8555-555555555555";
const token = "2026-10-19T12:00:00.123456+00:00";
const base = {
  appointment_id: appointmentId,
  starts_at: "2026-10-20T12:00:00+00:00",
  ends_at: "2026-10-20T12:30:00+00:00",
  status: "PENDING" as const,
  updated_at: token,
  patient_first_name: "Ana",
  patient_last_name: "Paz",
  specialty_name: "Clínica",
};
const staff = {
  ...base,
  patient_center_id: patientCenterId,
  professional_center_id: professionalCenterId,
  specialty_id: specialtyId,
  professional_first_name: "Dr",
  professional_last_name: "Sol",
  administrative_note: null,
};
function renderStaff(appointment: StaffAppointment = staff) {
  render(
    <AppointmentDetailScreen
      centerId={centerId}
      centerName="Centro"
      timezone="America/Argentina/Buenos_Aires"
      detail={{ kind: "STAFF", appointment }}
      outsideAvailability
    />,
  );
}
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("appointment detail flow", () => {
  it("shows an indeterminate Availability check explicitly", () => {
    render(
      <AppointmentDetailScreen
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        detail={{ kind: "STAFF", appointment: staff }}
        outsideAvailability={null}
      />,
    );
    expect(screen.getByText(/No pudimos verificar la disponibilidad actual/)).toBeInTheDocument();
    expect(screen.queryByText(/está fuera de la disponibilidad actual/)).not.toBeInTheDocument();
  });
  it("keeps Professional projection minimal and shows only own attendance actions", () => {
    render(
      <AppointmentDetailScreen
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        detail={{ kind: "PROFESSIONAL", appointment: base }}
        outsideAvailability={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Marcar atendido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar ausente" })).toBeInTheDocument();
    expect(screen.queryByText("Nota administrativa")).not.toBeInTheDocument();
    expect(screen.queryByText("Reprogramar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar turno" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(patientCenterId);
  });
  it("shows historical terminal status without mutation controls", () => {
    renderStaff({ ...staff, status: "CANCELLED" as const });
    expect(
      screen.getByText("El estado es terminal; no permite nuevas transiciones."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elegir nuevo horario" })).not.toBeInTheDocument();
  });
  it("updates Professional status and CAS from the returned result", async () => {
    const nextToken = "2026-10-19T12:00:01.123456+00:00";
    vi.mocked(transitionAppointmentStatusAction).mockResolvedValue({
      status: "SUCCESS",
      data: { appointment_id: appointmentId, status: "ATTENDED", updated_at: nextToken },
    });
    render(
      <AppointmentDetailScreen
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        detail={{ kind: "PROFESSIONAL", appointment: base }}
        outsideAvailability={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Marcar atendido" }));
    await waitFor(() =>
      expect(transitionAppointmentStatusAction).toHaveBeenCalledWith({
        centerId,
        appointmentId,
        expectedUpdatedAt: token,
        requestedStatus: "ATTENDED",
      }),
    );
    expect(
      screen.getByText("El estado es terminal; no permite nuevas transiciones."),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
  it("sends exact CAS, preserves NULL and empty note, and stops on stale", async () => {
    render(<div id="__next-route-announcer__" role="alert" aria-live="assertive" />);
    vi.mocked(updateAppointmentNoteAction).mockResolvedValueOnce({
      status: "SUCCESS",
      data: { appointment_id: appointmentId, updated_at: token },
    });
    vi.mocked(updateAppointmentNoteAction).mockResolvedValueOnce({
      status: "BUSINESS_ERROR",
      code: "STALE_APPOINTMENT_STATE",
      reload: true,
    });
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Quitar nota (NULL)" }));
    await waitFor(() =>
      expect(updateAppointmentNoteAction).toHaveBeenCalledWith({
        centerId,
        appointmentId,
        expectedUpdatedAt: token,
        administrativeNote: null,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    const conflict = await within(screen.getByRole("main")).findByRole("alert");
    expect(conflict.textContent).toBe("El turno cambió. Recargá el detalle antes de continuar.");
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(updateAppointmentNoteAction).toHaveBeenLastCalledWith({
      centerId,
      appointmentId,
      expectedUpdatedAt: token,
      administrativeNote: "",
    });
    expect(screen.getByRole("button", { name: "Guardar nota" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Recargar y verificar el turno" }),
    ).toBeInTheDocument();
  });
  it("reprograms only selected fields with the original CAS", async () => {
    vi.mocked(rescheduleAppointmentAction).mockResolvedValue({
      status: "SUCCESS",
      data: {
        appointment_id: appointmentId,
        professional_center_id: professionalCenterId,
        specialty_id: specialtyId,
        starts_at: "2026-10-21T13:00:00+00:00",
        ends_at: "2026-10-21T13:30:00+00:00",
        status: "PENDING",
        updated_at: "2026-10-19T12:00:01.123456+00:00",
      },
    });
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Elegir nuevo horario" }));
    fireEvent.click(screen.getByRole("button", { name: "Elegir nuevo slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar reprogramación" }));
    await waitFor(() => expect(rescheduleAppointmentAction).toHaveBeenCalledTimes(1));
    expect(rescheduleAppointmentAction).toHaveBeenCalledWith({
      centerId,
      appointmentId,
      expectedUpdatedAt: token,
      specialtyId,
      professionalCenterId: "66666666-6666-4666-8666-666666666666",
      localDate: "2026-10-21",
      localStartTime: "10:00",
    });
    expect(refresh).toHaveBeenCalled();
  });
  it("asks before cancellation and prevents another status mutation after UNKNOWN_RESULT", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(transitionAppointmentStatusAction).mockResolvedValue({
      status: "UNKNOWN_RESULT",
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
    });
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
    expect(transitionAppointmentStatusAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pudo haberse completado");
    fireEvent.click(screen.getByRole("button", { name: "Marcar atendido" }));
    expect(transitionAppointmentStatusAction).toHaveBeenCalledTimes(1);
  });
});
