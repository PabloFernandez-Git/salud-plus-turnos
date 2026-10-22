import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPatientAppointmentPageAction,
  loadPatientAppointmentSectionsAction,
} from "../actions/patient-appointment-actions";
import type { PatientAppointmentRow } from "../api/patient-appointment-rpc";
import { PatientAppointments, patientAppointmentTime } from "./patient-appointments";

vi.mock("../actions/patient-appointment-actions", () => ({
  loadPatientAppointmentSectionsAction: vi.fn(),
  loadPatientAppointmentPageAction: vi.fn(),
}));

const centerId = "11111111-1111-4111-8111-111111111111";
const patientCenterId = "22222222-2222-4222-8222-222222222222";
const otherPatientId = "44444444-4444-4444-8444-444444444444";
const asOf = "2026-10-22T10:00:00.000Z";
const row: PatientAppointmentRow = {
  appointment_id: "33333333-3333-4333-8333-333333333333",
  starts_at: "2026-10-22T12:00:00+00:00",
  ends_at: "2026-10-22T12:30:00+00:00",
  status: "CONFIRMED",
  professional_first_name: "Ana",
  professional_last_name: "Pérez",
  specialty_name: "Clínica",
  has_more: true,
};
const page = (rows: PatientAppointmentRow[], hasMore = false) => ({
  rows,
  hasMore,
  nextCursor: rows.length
    ? { startsAt: rows.at(-1)!.starts_at, id: rows.at(-1)!.appointment_id }
    : null,
});
const initial = (
  upcoming: ReturnType<typeof page> | null,
  history: ReturnType<typeof page> | null,
) => ({
  status: "success" as const,
  data: { asOf, upcoming, history },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadPatientAppointmentSectionsAction).mockResolvedValue(initial(page([]), page([])));
});
afterEach(cleanup);

describe("patient appointment sections", () => {
  it("shows upcoming and history rows, localized time, status, and authorized detail URL", async () => {
    const history = {
      ...row,
      appointment_id: "55555555-5555-4555-8555-555555555555",
      status: "CANCELLED" as const,
    };
    vi.mocked(loadPatientAppointmentSectionsAction).mockResolvedValue(
      initial(page([row]), page([history])),
    );
    render(
      <PatientAppointments
        centerId={centerId}
        patientCenterId={patientCenterId}
        timezone="America/Argentina/Buenos_Aires"
      />,
    );
    const upcoming = await screen.findByRole("region", { name: "Próximos turnos" });
    const historical = screen.getByRole("region", { name: "Historial" });
    expect(within(upcoming).getByText("Confirmado")).toBeVisible();
    expect(within(historical).getByText("Cancelado")).toBeVisible();
    expect(within(upcoming).getByText(/09:00–09:30 GMT-3/)).toBeVisible();
    expect(within(upcoming).getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/appointments/${row.appointment_id}`,
    );
  });

  it("distinguishes both occurrences of a repeated DST hour by offset", () => {
    const before = patientAppointmentTime(
      "2026-11-01T05:30:00Z",
      "2026-11-01T05:45:00Z",
      "America/New_York",
    );
    const after = patientAppointmentTime(
      "2026-11-01T06:30:00Z",
      "2026-11-01T06:45:00Z",
      "America/New_York",
    );
    expect(before).toContain("01:30–01:45 GMT-4");
    expect(after).toContain("01:30–01:45 GMT-5");
  });

  it("shows empty sections and independent read errors with retry", async () => {
    vi.mocked(loadPatientAppointmentSectionsAction).mockResolvedValue(initial(null, page([])));
    vi.mocked(loadPatientAppointmentPageAction).mockResolvedValue({
      status: "success",
      data: page([row]),
    });
    render(
      <PatientAppointments centerId={centerId} patientCenterId={patientCenterId} timezone="UTC" />,
    );
    const upcoming = await screen.findByRole("region", { name: "Próximos turnos" });
    expect(within(upcoming).getByRole("alert")).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Historial" })).getByText(/todavía no tiene/),
    ).toBeVisible();
    fireEvent.click(within(upcoming).getByRole("button", { name: "Reintentar carga" }));
    await waitFor(() => expect(within(upcoming).getByText("Confirmado")).toBeVisible());
    expect(loadPatientAppointmentPageAction).toHaveBeenCalledWith({
      centerId,
      patientCenterId,
      section: "UPCOMING",
      asOf,
      cursor: null,
    });
  });

  it("shows a recoverable error if the initial authorized read fails", async () => {
    vi.mocked(loadPatientAppointmentSectionsAction)
      .mockResolvedValueOnce({ status: "error", message: "No pudimos cargar los turnos." })
      .mockResolvedValueOnce(initial(page([]), page([])));
    render(
      <PatientAppointments centerId={centerId} patientCenterId={patientCenterId} timezone="UTC" />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los turnos");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay próximos turnos para este paciente.")).toBeVisible();
  });

  it("shows the secondary refresh action and a loading state without issuing duplicate reads", async () => {
    const refreshing = deferred<ReturnType<typeof initial>>();
    vi.mocked(loadPatientAppointmentSectionsAction)
      .mockResolvedValueOnce(initial(page([]), page([])))
      .mockReturnValueOnce(refreshing.promise);
    render(
      <PatientAppointments centerId={centerId} patientCenterId={patientCenterId} timezone="UTC" />,
    );
    const refresh = await screen.findByRole("button", { name: "Actualizar turnos" });
    expect(refresh).toHaveClass("border", "border-sky-300", "bg-white");
    fireEvent.click(refresh);
    await waitFor(() => expect(loadPatientAppointmentSectionsAction).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Cargando turnos…")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Actualizar turnos" })).not.toBeInTheDocument();
    await act(async () => refreshing.resolve(initial(page([]), page([]))));
    expect(await screen.findByRole("button", { name: "Actualizar turnos" })).toBeEnabled();
    expect(loadPatientAppointmentSectionsAction).toHaveBeenCalledTimes(2);
  });

  it("loads the next page with the exact tuple and same cut without duplicating the first row", async () => {
    const next = { ...row, appointment_id: "66666666-6666-4666-8666-666666666666" };
    vi.mocked(loadPatientAppointmentSectionsAction).mockResolvedValue(
      initial(page([row], true), page([])),
    );
    vi.mocked(loadPatientAppointmentPageAction).mockResolvedValue({
      status: "success",
      data: page([next]),
    });
    render(
      <PatientAppointments centerId={centerId} patientCenterId={patientCenterId} timezone="UTC" />,
    );
    const upcoming = await screen.findByRole("region", { name: "Próximos turnos" });
    fireEvent.click(within(upcoming).getByRole("button", { name: "Cargar más" }));
    await waitFor(() =>
      expect(within(upcoming).getAllByRole("link", { name: "Ver detalle" })).toHaveLength(2),
    );
    expect(loadPatientAppointmentPageAction).toHaveBeenCalledWith({
      centerId,
      patientCenterId,
      section: "UPCOMING",
      asOf,
      cursor: { startsAt: row.starts_at, id: row.appointment_id },
    });
  });

  it("ignores a late response after changing PatientCenter", async () => {
    const old = deferred<ReturnType<typeof initial>>();
    vi.mocked(loadPatientAppointmentSectionsAction)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(initial(page([]), page([])));
    const view = render(
      <PatientAppointments centerId={centerId} patientCenterId={patientCenterId} timezone="UTC" />,
    );
    view.rerender(
      <PatientAppointments centerId={centerId} patientCenterId={otherPatientId} timezone="UTC" />,
    );
    await screen.findByText("No hay próximos turnos para este paciente.");
    await act(async () => {
      old.resolve(initial(page([row]), page([])));
      await old.promise;
    });
    expect(screen.queryByText("Confirmado")).not.toBeInTheDocument();
    expect(loadPatientAppointmentSectionsAction).toHaveBeenLastCalledWith({
      centerId,
      patientCenterId: otherPatientId,
    });
  });
});
