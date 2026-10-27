import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  BookingSelector: ({
    onChange,
    onInteraction,
  }: {
    onChange: (value: unknown) => void;
    onInteraction?: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onInteraction?.();
        onChange({
          specialtyId: "55555555-5555-4555-8555-555555555555",
          professionalCenterId: "66666666-6666-4666-8666-666666666666",
          localDate: "2026-10-21",
          localStartTime: "10:00",
          localEndDate: "2026-10-21",
          localEndTime: "10:30",
          displayOffset: "UTC−04:00",
          startsAt: "2026-10-21T13:00:00+00:00",
          endsAt: "2026-10-21T13:30:00+00:00",
          duration: 30,
        });
      }}
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
const beforeStart = Date.parse("2026-10-20T11:00:00+00:00");
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
function renderStaff(appointment: StaffAppointment = staff, serverNow = beforeStart) {
  render(
    <AppointmentDetailScreen
      centerId={centerId}
      centerName="Centro"
      timezone="America/Argentina/Buenos_Aires"
      serverNow={serverNow}
      detail={{ kind: "STAFF", appointment }}
      outsideAvailability
    />,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("appointment detail flow", () => {
  it("lays out four staff actions as two mobile columns without changing their order", () => {
    renderStaff();
    const buttons = ["Confirmar", "Marcar atendido", "Marcar ausente", "Cancelar turno"].map(
      (name) => screen.getByRole("button", { name }),
    );
    expect(buttons[0].parentElement).toHaveClass("grid-cols-2", "sm:flex");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Confirmar",
      "Marcar atendido",
      "Marcar ausente",
      "Cancelar turno",
    ]);
    expect(buttons.every((button) => button.className.includes("min-h-11"))).toBe(true);
    expect(buttons[0]).not.toHaveClass("col-span-2");
  });
  it("makes the leading action full width when three are visible", () => {
    renderStaff({ ...staff, status: "CONFIRMED" });
    const attended = screen.getByRole("button", { name: "Marcar atendido" });
    expect(attended).toHaveClass("col-span-2", "sm:col-auto");
    expect(screen.getByRole("button", { name: "Marcar ausente" })).not.toHaveClass("col-span-2");
    expect(screen.getByRole("button", { name: "Cancelar turno" })).not.toHaveClass("col-span-2");
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });
  it("shows a direct return action to the same center and hides deletion for an empty note", () => {
    renderStaff({ ...staff, administrative_note: "" });
    expect(screen.getByRole("link", { name: "Volver a turnos" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/appointments`,
    );
    expect(screen.getByText("Sin nota administrativa.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar nota" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar nota" })).not.toBeInTheDocument();
  });
  it("uses the same empty presentation for NULL while preserving its edit value", () => {
    renderStaff();
    expect(screen.getByText("Sin nota administrativa.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar nota" }));
    expect(screen.getByRole("textbox", { name: "Editar nota" })).toHaveValue("");
  });
  it("offers deletion only for saved nonempty text", () => {
    renderStaff({ ...staff, administrative_note: "Aviso administrativo" });
    expect(screen.getByText("Aviso administrativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar nota" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar nota" })).toBeInTheDocument();
  });
  it("shows an indeterminate Availability check explicitly", () => {
    render(
      <AppointmentDetailScreen
        centerId={centerId}
        centerName="Centro"
        timezone="UTC"
        serverNow={beforeStart}
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
        serverNow={beforeStart}
        detail={{
          kind: "PROFESSIONAL",
          appointment: {
            ...base,
            starts_at: "2026-10-19T10:00:00+00:00",
            ends_at: "2026-10-19T10:30:00+00:00",
          },
        }}
        outsideAvailability={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Marcar atendido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar ausente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar atendido" }).parentElement).toHaveClass(
      "grid-cols-2",
    );
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
    expect(screen.queryByRole("button", { name: "Marcar atendido" })).not.toBeInTheDocument();
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
        serverNow={Date.parse("2026-10-20T13:00:00Z")}
        detail={{ kind: "PROFESSIONAL", appointment: base }}
        outsideAvailability={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Marcar atendido" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Marcar turno como atendido" })).getByRole(
        "button",
        { name: "Marcar atendido" },
      ),
    );
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
    renderStaff({ ...staff, administrative_note: "Texto previo" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar nota" }));
    await waitFor(() =>
      expect(updateAppointmentNoteAction).toHaveBeenCalledWith({
        centerId,
        appointmentId,
        expectedUpdatedAt: token,
        administrativeNote: null,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agregar nota" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Editar nota" }), {
      target: { value: "" },
    });
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
    expect(screen.getByText(/Nuevo horario:.*UTC−04:00/)).toBeInTheDocument();
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
    vi.mocked(transitionAppointmentStatusAction).mockResolvedValue({
      status: "UNKNOWN_RESULT",
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
    });
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
    expect(transitionAppointmentStatusAction).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Cancelar turno" })).getByRole("button", {
        name: "Volver",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Cancelar turno" })).getByRole("button", {
        name: "Cancelar turno",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("pudo haberse completado");
    expect(
      within(screen.getByRole("dialog", { name: "Cancelar turno" })).getByRole("button", {
        name: "Volver",
      }),
    ).toBeDisabled();
    expect(transitionAppointmentStatusAction).toHaveBeenCalledTimes(1);
  });
  it("protects an unsaved note before changing status or leaving", () => {
    vi.spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Agregar nota" }));
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Elegir nuevo horario" })).toBeDisabled();
    const shellLink = document.createElement("a");
    shellLink.href = "/centers";
    shellLink.textContent = "Volver al inicio";
    document.body.append(shellLink);
    expect(fireEvent.click(shellLink)).toBe(false);
    shellLink.remove();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar edición" }));
    expect(screen.getByRole("textbox", { name: "Editar nota" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar edición" }));
    expect(screen.queryByRole("textbox", { name: "Editar nota" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });
  it("confirms discarding a reprogramming selection and restores the trigger", () => {
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Elegir nuevo horario" }));
    const dialog = screen.getByRole("dialog", { name: "Reprogramar turno" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir nuevo slot" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(
      within(dialog).getByRole("heading", { name: "¿Descartar cambios?" }),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    expect(within(dialog).getByRole("heading", { name: "Reprogramar turno" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Descartar cambios" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir nuevo horario" })).toHaveFocus();
  });
  it("keeps recovery available inside the modal after an uncertain reprogramming result", async () => {
    vi.mocked(rescheduleAppointmentAction).mockResolvedValue({
      status: "UNKNOWN_RESULT",
      reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY",
    });
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Elegir nuevo horario" }));
    const dialog = screen.getByRole("dialog", { name: "Reprogramar turno" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir nuevo slot" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar reprogramación" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("pudo haberse completado");
    expect(
      within(dialog).getByRole("button", { name: "Recargar y verificar el turno" }),
    ).toBeEnabled();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
  it.each([
    ["2026-10-20T11:59:59.999Z", false, true, true],
    ["2026-10-20T12:00:00.000Z", true, false, true],
    ["2026-10-20T12:30:00.000Z", true, false, false],
  ])(
    "applies exact presentation limits at %s",
    (instant, confirmBlocked, attendedBlocked, absentBlocked) => {
      renderStaff(staff, Date.parse(instant));
      expect(screen.getByRole("button", { name: "Confirmar" }).hasAttribute("disabled")).toBe(
        confirmBlocked,
      );
      expect(screen.getByRole("button", { name: "Marcar atendido" }).hasAttribute("disabled")).toBe(
        attendedBlocked,
      );
      expect(screen.getByRole("button", { name: "Marcar ausente" }).hasAttribute("disabled")).toBe(
        absentBlocked,
      );
      expect(screen.getByRole("button", { name: "Cancelar turno" })).toBeEnabled();
    },
  );
  it("spaces and associates only the messages for actions blocked by time", () => {
    renderStaff(staff, beforeStart);
    const attended = screen.getByRole("button", { name: "Marcar atendido" });
    const absent = screen.getByRole("button", { name: "Marcar ausente" });
    const attendedHint = screen
      .getByText("Podés marcar el turno como atendido desde su hora de inicio.")
      .closest("p")!;
    const absentHint = screen
      .getByText("Podés registrar la ausencia cuando finalice el turno.")
      .closest("p")!;
    expect(attendedHint.parentElement).toHaveClass("mt-5", "space-y-2", "text-sm");
    for (const hint of [attendedHint, absentHint]) {
      expect(hint).toHaveClass("flex", "items-start", "gap-2");
      const icon = hint.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("width", "17");
      expect(icon).toHaveAttribute("height", "17");
      expect(icon).toHaveAttribute("stroke", "currentColor");
    }
    expect(attended).toHaveAttribute("aria-describedby", attendedHint.id);
    expect(absent).toHaveAttribute("aria-describedby", absentHint.id);
    expect(attended).toHaveAccessibleDescription(
      "Podés marcar el turno como atendido desde su hora de inicio.",
    );
    expect(absent).toHaveAccessibleDescription(
      "Podés registrar la ausencia cuando finalice el turno.",
    );
    expect(screen.getByRole("button", { name: "Confirmar" })).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.getByRole("button", { name: "Cancelar turno" })).not.toHaveAttribute(
      "aria-describedby",
    );
  });
  it("removes temporal explanations as actions become available", () => {
    renderStaff(staff, Date.parse(staff.ends_at));
    expect(screen.getByText("El turno ya comenzó; no se puede confirmar.")).toBeInTheDocument();
    expect(screen.queryByText(/Podés marcar el turno como atendido/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Podés registrar la ausencia/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar ausente" })).not.toHaveAttribute(
      "aria-describedby",
    );
  });
  it.each([
    ["Confirmar", "Confirmar turno", beforeStart],
    ["Marcar atendido", "Marcar turno como atendido", Date.parse("2026-10-20T13:00:00Z")],
    ["Marcar ausente", "Registrar ausencia", Date.parse("2026-10-20T13:00:00Z")],
    ["Cancelar turno", "Cancelar turno", beforeStart],
  ])("centers the %s footer while preserving action order", (label, title, at) => {
    renderStaff(staff, at);
    fireEvent.click(screen.getByRole("button", { name: label }));
    const dialog = screen.getByRole("dialog", { name: title });
    const back = within(dialog).getByRole("button", { name: "Volver" });
    const confirm = within(dialog).getByRole("button", { name: label });
    expect(back.parentElement).toHaveClass("justify-center", "gap-3");
    expect(back.parentElement?.children[0]).toBe(back);
    expect(back.parentElement?.children[1]).toBe(confirm);
    expect(back).toHaveClass("min-h-11");
    expect(confirm).toHaveClass("min-h-11");
    if (label === "Cancelar turno") expect(confirm).toHaveClass("bg-red-700");
  });
  it("shows appointment identity and closes without mutation, restoring trigger focus", () => {
    renderStaff(staff, Date.parse("2026-10-20T13:00:00Z"));
    const trigger = screen.getByRole("button", { name: "Marcar atendido" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Marcar turno como atendido" });
    expect(within(dialog).getByText("Ana Paz")).toBeInTheDocument();
    expect(within(dialog).getByText("20/10/2026")).toBeInTheDocument();
    expect(within(dialog).getByText("09:00–09:30")).toBeInTheDocument();
    expect(transitionAppointmentStatusAction).not.toHaveBeenCalled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(transitionAppointmentStatusAction).not.toHaveBeenCalled();
  });
  it("prevents double submit and keeps an uncertain result open for recovery", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof transitionAppointmentStatusAction>>) => void;
    vi.mocked(transitionAppointmentStatusAction).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
    const dialog = screen.getByRole("dialog", { name: "Cancelar turno" });
    const confirm = within(dialog).getByRole("button", { name: "Cancelar turno" });
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Volver" })).toBeDisabled();
    fireEvent.click(confirm);
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(transitionAppointmentStatusAction).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument();
    await act(async () =>
      resolve({ status: "UNKNOWN_RESULT", reconcile: "RELOAD_APPOINTMENTS_BEFORE_RETRY" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent("pudo haberse completado");
    expect(
      within(dialog).getByRole("button", { name: "Recargar y verificar el turno" }),
    ).toBeEnabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).toBeInTheDocument();
  });
  it("does not allow an expired Confirmar action to start a mutation", () => {
    renderStaff(staff, Date.parse(staff.starts_at));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.queryByRole("dialog", { name: "Confirmar turno" })).not.toBeInTheDocument();
    expect(transitionAppointmentStatusAction).not.toHaveBeenCalled();
  });
  it("updates availability while open and refreshes the server reference on focus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T11:59:59Z"));
    renderStaff(staff, Date.now());
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    const attended = screen.getByRole("button", { name: "Marcar atendido" });
    expect(confirm).toBeEnabled();
    expect(attended).toBeDisabled();
    fireEvent.click(confirm);
    const dialog = screen.getByRole("dialog", { name: "Confirmar turno" });
    act(() => vi.advanceTimersByTime(1000));
    expect(confirm).toBeDisabled();
    expect(attended).toBeEnabled();
    expect(
      within(dialog).getByText(/El turno ya comenzó; no se puede confirmar/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar" })).toBeDisabled();
    fireEvent.focus(window);
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Volver" }));
    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(transitionAppointmentStatusAction).not.toHaveBeenCalled();
  });
  it("shows a temporal server rejection inside the dialogue with safe recovery", async () => {
    vi.mocked(transitionAppointmentStatusAction).mockResolvedValue({
      status: "BUSINESS_ERROR",
      code: "APPOINTMENT_TIME_RESTRICTION",
      reload: true,
    });
    renderStaff();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    const dialog = screen.getByRole("dialog", { name: "Confirmar turno" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Todavía no se puede");
    expect(
      within(dialog).getByRole("button", { name: "Recargar y verificar el turno" }),
    ).toBeEnabled();
    expect(transitionAppointmentStatusAction).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["Confirmar", "Confirmar turno", "CONFIRMED", beforeStart],
    ["Marcar ausente", "Registrar ausencia", "NO_SHOW", Date.parse("2026-10-20T13:00:00Z")],
  ] as const)(
    "executes only %s after explicit modal confirmation",
    async (label, title, status, at) => {
      vi.mocked(transitionAppointmentStatusAction).mockResolvedValue({
        status: "SUCCESS",
        data: { appointment_id: appointmentId, status, updated_at: "2026-10-20T13:01:00Z" },
      });
      renderStaff(staff, at);
      fireEvent.click(screen.getByRole("button", { name: label }));
      const dialog = screen.getByRole("dialog", { name: title });
      expect(transitionAppointmentStatusAction).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: label }));
      await waitFor(() => expect(transitionAppointmentStatusAction).toHaveBeenCalledTimes(1));
      expect(transitionAppointmentStatusAction).toHaveBeenCalledWith({
        centerId,
        appointmentId,
        expectedUpdatedAt: token,
        requestedStatus: status,
      });
    },
  );
});
