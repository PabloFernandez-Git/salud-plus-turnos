import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAppointmentAvailabilityAction,
  listBookableProfessionalsAction,
  listBookableSpecialtiesAction,
  searchAppointmentSlotsAction,
} from "../actions/appointment-actions";
import { BookingSelector } from "./booking-selector";

vi.mock("../actions/appointment-actions", () => ({
  getAppointmentAvailabilityAction: vi.fn(),
  listBookableProfessionalsAction: vi.fn(),
  listBookableSpecialtiesAction: vi.fn(),
  searchAppointmentSlotsAction: vi.fn(),
}));
const centerId = "11111111-1111-4111-8111-111111111111";
const specialtyId = "22222222-2222-4222-8222-222222222222";
const professionalCenterId = "33333333-3333-4333-8333-333333333333";
const onChange = vi.fn();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  vi.clearAllMocks();
  vi.mocked(listBookableSpecialtiesAction).mockResolvedValue({
    status: "SUCCESS",
    data: [{ specialty_id: specialtyId, specialty_name: "Clínica" }],
  });
  vi.mocked(listBookableProfessionalsAction).mockResolvedValue({
    status: "SUCCESS",
    data: [
      {
        professional_center_id: professionalCenterId,
        professional_first_name: "Ana",
        professional_last_name: "Sol",
        usual_appointment_duration_minutes: 30,
      },
    ],
  });
  vi.mocked(searchAppointmentSlotsAction).mockResolvedValue({
    status: "SUCCESS",
    data: [
      {
        starts_at: "2026-10-20T12:00:00+00:00",
        ends_at: "2026-10-20T12:30:00+00:00",
        local_date: "2026-10-20",
        local_start_time: "09:00",
        local_end_date: "2026-10-20",
        local_end_time: "09:30",
      },
    ],
  });
  vi.mocked(getAppointmentAvailabilityAction).mockResolvedValue({
    status: "SUCCESS",
    data: {
      intervals: [{ weekday: 2, startTime: "09:00", endTime: "12:00", id: "a", updatedAt: "u" }],
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("booking selector", () => {
  it("disables all booking controls until the patient is selected", async () => {
    render(
      <BookingSelector
        centerId={centerId}
        timezone="UTC"
        onChange={onChange}
        disabled
        initial={{
          specialtyId,
          professionalCenterId,
          localDate: "2026-10-20",
          startsAt: "2026-10-20T12:00:00+00:00",
        }}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Especialidad" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Profesional" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Fecha local del centro/ })).toBeDisabled();
    const slot = await screen.findByRole("button", { name: "09:00–09:30" });
    expect(slot).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("keeps initial reschedule fields behind a stable loading state", async () => {
    let finishSpecialties!: (
      value: Awaited<ReturnType<typeof listBookableSpecialtiesAction>>,
    ) => void;
    vi.mocked(listBookableSpecialtiesAction).mockReturnValue(
      new Promise((resolve) => {
        finishSpecialties = resolve;
      }),
    );
    render(
      <BookingSelector
        centerId={centerId}
        timezone="UTC"
        onChange={onChange}
        stabilizeInitialLoad
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Preparando opciones para reprogramar");
    expect(screen.queryByRole("combobox", { name: "Especialidad" })).not.toBeInTheDocument();
    finishSpecialties({
      status: "SUCCESS",
      data: [{ specialty_id: specialtyId, specialty_name: "Clínica" }],
    });
    expect(await screen.findByRole("combobox", { name: "Especialidad" })).toBeEnabled();
  });
  it("renders missing intervals as disabled references and never sends them as choices", async () => {
    render(
      <BookingSelector
        centerId={centerId}
        timezone="UTC"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    const offered = await screen.findByRole("button", { name: "09:00–09:30" });
    await waitFor(() => expect(offered).toBeEnabled());
    const missing = screen.getByRole("button", { name: "09:30–10:00, no disponible" });
    expect(missing).toBeDisabled();
    fireEvent.click(missing);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(offered);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ startsAt: "2026-10-20T12:00:00+00:00" }),
    );
  });
  it("retains offered slots if the availability read fails", async () => {
    vi.mocked(getAppointmentAvailabilityAction).mockRejectedValue(new Error("unavailable"));
    render(
      <BookingSelector
        centerId={centerId}
        timezone="UTC"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    expect(await screen.findByRole("button", { name: "09:00–09:30" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /no disponible/ })).not.toBeInTheDocument();
  });
  it("preselects only the exact PostgreSQL slot handed off from Agenda", async () => {
    render(
      <BookingSelector
        centerId={centerId}
        timezone="America/Argentina/Buenos_Aires"
        onChange={onChange}
        initial={{
          specialtyId,
          professionalCenterId,
          localDate: "2026-10-20",
          startsAt: "2026-10-20T12:00:00+00:00",
        }}
      />,
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          specialtyId,
          professionalCenterId,
          localDate: "2026-10-20",
          localStartTime: "09:00",
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "09:00–09:30" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Especialidad" }), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it("waits for the initial catalogs before accepting a fetched reschedule slot", async () => {
    let finishSpecialties!: (
      value: Awaited<ReturnType<typeof listBookableSpecialtiesAction>>,
    ) => void;
    let finishProfessionals!: (
      value: Awaited<ReturnType<typeof listBookableProfessionalsAction>>,
    ) => void;
    vi.mocked(listBookableSpecialtiesAction).mockReturnValue(
      new Promise((resolve) => {
        finishSpecialties = resolve;
      }),
    );
    vi.mocked(listBookableProfessionalsAction).mockReturnValue(
      new Promise((resolve) => {
        finishProfessionals = resolve;
      }),
    );
    render(
      <BookingSelector
        centerId={centerId}
        timezone="America/Argentina/Buenos_Aires"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    const slot = await screen.findByRole("button", { name: "09:00–09:30" });
    expect(slot).toBeDisabled();
    finishSpecialties({
      status: "SUCCESS",
      data: [{ specialty_id: specialtyId, specialty_name: "Clínica" }],
    });
    finishProfessionals({
      status: "SUCCESS",
      data: [
        {
          professional_center_id: professionalCenterId,
          professional_first_name: "Ana",
          professional_last_name: "Sol",
          usual_appointment_duration_minutes: 30,
        },
      ],
    });
    await waitFor(() => expect(slot).toBeEnabled());
    fireEvent.click(slot);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ localStartTime: "09:00" }));
  });
  it("loads PostgreSQL choices and sends only a selected server slot", async () => {
    render(
      <BookingSelector
        centerId={centerId}
        timezone="America/Argentina/Buenos_Aires"
        onChange={onChange}
      />,
    );
    fireEvent.change(await screen.findByRole("combobox", { name: "Especialidad" }), {
      target: { value: specialtyId },
    });
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Profesional" })).toBeEnabled(),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Profesional" }), {
      target: { value: professionalCenterId },
    });
    fireEvent.click(screen.getByRole("button", { name: /Fecha local del centro/ }));
    fireEvent.click(screen.getByRole("button", { name: "martes 20 de octubre de 2026" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "09:00–09:30" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "09:00–09:30" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        specialtyId,
        professionalCenterId,
        localDate: "2026-10-20",
        localStartTime: "09:00",
        duration: 30,
      }),
    );
    expect(searchAppointmentSlotsAction).toHaveBeenCalledWith({
      centerId,
      specialtyId,
      professionalCenterId,
      localDate: "2026-10-20",
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Especialidad" }), {
      target: { value: "" },
    });
    expect(screen.getByRole("combobox", { name: "Profesional" })).toHaveValue("");
    expect(screen.getByRole("button", { name: /Fecha local del centro/ })).toHaveTextContent(
      "Elegí una fecha",
    );
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it("distinguishes missing Availability, no free slots and load failure", async () => {
    vi.mocked(searchAppointmentSlotsAction).mockResolvedValue({ status: "SUCCESS", data: [] });
    vi.mocked(getAppointmentAvailabilityAction).mockResolvedValue({
      status: "SUCCESS",
      data: { intervals: [] },
    });
    const { rerender } = render(
      <BookingSelector
        centerId={centerId}
        timezone="UTC"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    expect(
      await screen.findByText("El profesional no tiene disponibilidad ese día."),
    ).toBeInTheDocument();
    vi.mocked(getAppointmentAvailabilityAction).mockResolvedValue({
      status: "SUCCESS",
      data: {
        intervals: [{ weekday: 2, startTime: "09:00", endTime: "10:00", id: "a", updatedAt: "u" }],
      },
    });
    rerender(
      <BookingSelector
        key="another"
        centerId={centerId}
        timezone="UTC"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    expect(await screen.findByText("No quedan horarios libres ese día.")).toBeInTheDocument();
    vi.mocked(searchAppointmentSlotsAction).mockResolvedValue({ status: "UNEXPECTED_ERROR" });
    rerender(
      <BookingSelector
        key="error"
        centerId={centerId}
        timezone="UTC"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar horarios");
  });
  it("uses PostgreSQL civil time despite ICU drift and blocks a mismatched date", async () => {
    vi.mocked(searchAppointmentSlotsAction).mockResolvedValue({
      status: "SUCCESS",
      data: [
        {
          starts_at: "2026-10-20T12:00:00+00:00",
          ends_at: "2026-10-20T12:30:00+00:00",
          local_date: "2026-10-20",
          local_start_time: "10:00",
          local_end_date: "2026-10-20",
          local_end_time: "10:30",
        },
        {
          starts_at: "2026-10-22T02:30:00+00:00",
          ends_at: "2026-10-22T03:00:00+00:00",
          local_date: "2026-10-21",
          local_start_time: "23:30",
          local_end_date: "2026-10-22",
          local_end_time: "00:00",
        },
      ],
    });
    render(
      <BookingSelector
        centerId={centerId}
        timezone="America/Argentina/Buenos_Aires"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-10-20" }}
      />,
    );
    const slot = await screen.findByRole("button", { name: "10:00–10:30" });
    await waitFor(() => expect(slot).toBeEnabled());
    expect(screen.queryByRole("button", { name: /23:30–00:00/ })).not.toBeInTheDocument();
    fireEvent.click(slot);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        localDate: "2026-10-20",
        localStartTime: "10:00",
        localEndTime: "10:30",
      }),
    );
    expect(slot).toHaveAttribute("aria-pressed", "true");
  });
  it("distinguishes repeated DST hours by offset while retaining each exact slot instant", async () => {
    vi.mocked(searchAppointmentSlotsAction).mockResolvedValue({
      status: "SUCCESS",
      data: [
        {
          starts_at: "2026-11-01T05:15:00+00:00",
          ends_at: "2026-11-01T05:45:00+00:00",
          local_date: "2026-11-01",
          local_start_time: "01:15",
          local_end_date: "2026-11-01",
          local_end_time: "01:45",
        },
        {
          starts_at: "2026-11-01T06:15:00+00:00",
          ends_at: "2026-11-01T06:45:00+00:00",
          local_date: "2026-11-01",
          local_start_time: "01:15",
          local_end_date: "2026-11-01",
          local_end_time: "01:45",
        },
      ],
    });
    render(
      <BookingSelector
        centerId={centerId}
        timezone="America/New_York"
        onChange={onChange}
        initial={{ specialtyId, professionalCenterId, localDate: "2026-11-01" }}
      />,
    );
    const first = await screen.findByRole("button", { name: "01:15–01:45 UTC−04:00" });
    const second = screen.getByRole("button", { name: "01:15–01:45 UTC−05:00" });
    await waitFor(() => expect(first).toBeEnabled());
    fireEvent.click(first);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startsAt: "2026-11-01T05:15:00+00:00",
        localDate: "2026-11-01",
        localStartTime: "01:15",
        displayOffset: "UTC−04:00",
      }),
    );
    fireEvent.click(second);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startsAt: "2026-11-01T06:15:00+00:00",
        localDate: "2026-11-01",
        localStartTime: "01:15",
        displayOffset: "UTC−05:00",
      }),
    );
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });
});
