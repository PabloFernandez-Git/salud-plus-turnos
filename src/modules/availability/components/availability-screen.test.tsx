import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityInterval } from "../server/availability";
import { AvailabilityScreen } from "./availability-screen";

const refresh = vi.fn();
const create = vi.fn();
const update = vi.fn();
const deactivate = vi.fn();
const updateDuration = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions/availability-actions", () => ({
  createAvailabilityAction: (data: FormData) => create(data),
  updateAvailabilityAction: (data: FormData) => update(data),
  deactivateAvailabilityAction: (data: FormData) => deactivate(data),
  updateAppointmentDurationAction: (data: FormData) => updateDuration(data),
}));

const centerId = "11111111-1111-4111-8111-111111111111";
const professional = {
  id: "22222222-2222-4222-8222-222222222222",
  firstName: "Ana",
  lastName: "Pérez",
  usualAppointmentDurationMinutes: 30,
  updatedAt: "2026-10-16T12:00:00+00:00",
};
const intervals: AvailabilityInterval[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    weekday: 1,
    startTime: "09:00",
    endTime: "13:00",
    updatedAt: "2026-10-16T12:00:00+00:00",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    weekday: 1,
    startTime: "13:00",
    endTime: "17:00",
    updatedAt: "2026-10-16T12:00:01+00:00",
  },
];
function show(rows: AvailabilityInterval[] = intervals, canEdit = true) {
  return render(
    <AvailabilityScreen
      centerId={centerId}
      centerName="Centro Salud"
      timezone="America/Argentina/Buenos_Aires"
      professional={professional}
      intervals={rows}
      canEdit={canEdit}
      canViewProfessionals={canEdit}
    />,
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AvailabilityScreen", () => {
  it("shows seven vertical days, empty week/day, timezone and duration", () => {
    show([]);
    expect(screen.getByRole("heading", { name: "Disponibilidad", level: 1 })).toBeVisible();
    expect(screen.getByText(/America\/Argentina\/Buenos_Aires/)).toBeVisible();
    expect(screen.getByText(/Todavía no hay horarios/)).toBeVisible();
    expect(screen.getAllByText("Sin disponibilidad")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
    expect(screen.getByRole("spinbutton", { name: "Minutos" })).toHaveValue(30);
  });
  it("shows multiple adjacent intervals and keeps PROFESSIONAL read-only", () => {
    show(intervals, false);
    expect(screen.getByText("09:00–13:00")).toBeVisible();
    expect(screen.getByText("13:00–17:00")).toBeVisible();
    expect(screen.getAllByText("Sin disponibilidad")).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /Agregar horario/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar duración" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Profesionales" })).not.toBeInTheDocument();
    expect(screen.getByText("30 minutos")).toBeVisible();
  });
  it("adds a weekday interval, focuses the first input and shows warning", async () => {
    create.mockResolvedValueOnce({
      status: "success",
      message: "Horario guardado.",
      warning: true,
    });
    show([]);
    const monday = screen.getByRole("region", { name: "Lunes" });
    fireEvent.click(within(monday).getByRole("button", { name: /Agregar horario/ }));
    expect(screen.getByLabelText("Hora desde")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Hora desde"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "13:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0].get("weekday")).toBe("1");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(/turnos futuros fuera/);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("edits inline, cancels without saving, and sends CAS on save", async () => {
    update.mockResolvedValueOnce({ status: "success", message: "Horario guardado." });
    show([intervals[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByText(/Editar horario/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0].get("expectedUpdatedAt")).toBe(intervals[0].updatedAt);
  });
  it("confirms removal, handles stale and refreshes", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    deactivate.mockResolvedValueOnce({ status: "stale", message: "Los datos cambiaron." });
    show([intervals[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar horario" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledOnce());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Lunes de 09:00 a 13:00"));
    expect(deactivate.mock.calls[0][0].get("availabilityId")).toBe(intervals[0].id);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("alert")).toHaveTextContent(/Los datos cambiaron/);
  });
  it("updates duration using ProfessionalCenter CAS and reports errors", async () => {
    updateDuration.mockResolvedValueOnce({ status: "error", message: "Revisá la duración." });
    show([]);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minutos" }), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar duración" }));
    await waitFor(() => expect(updateDuration).toHaveBeenCalledOnce());
    expect(updateDuration.mock.calls[0][0].get("expectedUpdatedAt")).toBe(professional.updatedAt);
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá la duración.");
  });
});
