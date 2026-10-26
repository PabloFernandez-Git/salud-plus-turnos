import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});
function show(
  rows: AvailabilityInterval[] = intervals,
  canEdit = true,
  canViewProfessionals = canEdit,
) {
  return render(
    <AvailabilityScreen
      centerId={centerId}
      centerName="Centro Salud"
      timezone="America/Argentina/Buenos_Aires"
      professional={professional}
      intervals={rows}
      canEdit={canEdit}
      canViewProfessionals={canViewProfessionals}
    />,
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AvailabilityScreen", () => {
  it("shows seven vertical days, no redundant notice, and duration", () => {
    show([]);
    expect(screen.getByRole("heading", { name: "Disponibilidad", level: 1 })).toBeVisible();
    expect(screen.getByText("Horarios semanales de Ana Pérez.")).toBeVisible();
    expect(screen.queryByText(/America\/Argentina\/Buenos_Aires/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay horarios/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Sin disponibilidad")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
    expect(screen.getByRole("spinbutton", { name: "Minutos" })).toHaveValue(30);
    expect(screen.getByRole("button", { name: "Guardar duración" })).toBeDisabled();
  });
  it("shows multiple adjacent intervals and keeps PROFESSIONAL read-only", () => {
    show(intervals, false);
    expect(screen.getByText("09:00 – 13:00")).toBeVisible();
    expect(screen.getByText("13:00 – 17:00")).toBeVisible();
    expect(screen.getAllByText("4 h")).toHaveLength(2);
    expect(screen.getAllByText("Sin disponibilidad")).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /Agregar horario/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar duración" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Volver a disponibilidad" })).not.toBeInTheDocument();
    expect(screen.getByText("30 minutos")).toBeVisible();
  });
  it("shows compact rows with local hour and minute durations and both actions", () => {
    show([
      { ...intervals[0], startTime: "09:30" },
      intervals[1],
      {
        ...intervals[1],
        id: "55555555-5555-4555-8555-555555555555",
        startTime: "17:00",
        endTime: "17:30",
      },
    ]);
    const monday = screen.getByRole("region", { name: "Lunes" });
    const rows = within(monday).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("09:30 – 13:00");
    expect(rows[0]).toHaveTextContent("3 h 30 min");
    expect(rows[1]).toHaveTextContent("13:00 – 17:00");
    expect(rows[1]).toHaveTextContent("4 h");
    expect(rows[2]).toHaveTextContent("17:00 – 17:30");
    expect(rows[2]).toHaveTextContent("30 min");
    for (const row of rows) {
      expect(within(row).getByRole("button", { name: "Editar" })).toBeEnabled();
      expect(within(row).getByRole("button", { name: "Quitar" })).toBeEnabled();
      expect(row.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    }
    expect(within(monday).getByRole("button", { name: "+ Agregar horario" })).toBeEnabled();
  });
  it("returns to the availability list of the same center for ADMIN and RECEPTION", () => {
    const { rerender } = show([], true, true);
    expect(screen.getByRole("link", { name: "Volver a disponibilidad" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/availability`,
    );
    rerender(
      <AvailabilityScreen
        centerId={centerId}
        centerName="Centro Salud"
        timezone="America/Argentina/Buenos_Aires"
        professional={professional}
        intervals={[]}
        canEdit
        canViewProfessionals={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Volver a disponibilidad" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/availability`,
    );
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
    expect(screen.getByRole("dialog", { name: "Agregar horario · Lunes" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByLabelText("Hora desde")).toHaveFocus();
    expect(screen.getByLabelText("Hora desde")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Hora hasta")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Hora desde")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText("Hora hasta")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText(/Formato de 24 horas: escribí 0900 o 09:00/)).toBeVisible();
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
  it("edits in a modal, guards dirty cancellation, and sends CAS on save", async () => {
    update.mockResolvedValueOnce({ status: "success", message: "Horario guardado." });
    show([intervals[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("dialog", { name: "Editar horario · Lunes" })).toBeVisible();
    expect(screen.getByLabelText("Hora hasta")).toHaveAttribute("type", "text");
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByLabelText("Hora hasta")).toHaveValue("12:00");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Hora desde")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0].get("expectedUpdatedAt")).toBe(intervals[0].updatedAt);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Horario actualizado correctamente."),
    );
  });
  it("confirms removal visually, handles stale and refreshes", async () => {
    deactivate.mockResolvedValueOnce({ status: "stale", message: "Los datos cambiaron." });
    show([intervals[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(screen.getByRole("dialog", { name: "Quitar horario · Lunes" })).toHaveTextContent(
      "Lunes de 09:00 a 13:00",
    );
    expect(deactivate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledOnce());
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
    expect(screen.getByRole("spinbutton", { name: "Minutos" })).toHaveValue(45);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar duración" })).toBeEnabled(),
    );
  });

  it("keeps duration disabled for equal or invalid values and disables it after success", async () => {
    updateDuration.mockResolvedValueOnce({
      status: "success",
      message: "Duración habitual actualizada.",
    });
    show([]);
    const input = screen.getByRole("spinbutton", { name: "Minutos" });
    const save = screen.getByRole("button", { name: "Guardar duración" });
    fireEvent.change(input, { target: { value: "31" } });
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: "480" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(updateDuration).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar duración" })).toBeDisabled(),
    );
    expect(input).toHaveValue(480);
  });

  it.each(["Cancelar", "Cerrar", "Escape", "fondo"])("closes a clean editor with %s", (method) => {
    show([]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Martes" })).getByRole("button", {
        name: /Agregar horario/,
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Agregar horario · Martes" });
    if (method === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
    else if (method === "fondo") fireEvent.click(dialog, { clientX: -10, clientY: -10 });
    else fireEvent.click(within(dialog).getByRole("button", { name: method }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["Cerrar", "Escape", "fondo"])("asks before discarding changes through %s", (method) => {
    show([]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Martes" })).getByRole("button", {
        name: /Agregar horario/,
      }),
    );
    fireEvent.change(screen.getByLabelText("Hora desde"), { target: { value: "09:00" } });
    const dialog = screen.getByRole("dialog", { name: "Agregar horario · Martes" });
    if (method === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
    else if (method === "fondo") fireEvent.click(dialog, { clientX: -10, clientY: -10 });
    else fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });

  it("blocks duplicate submissions and closing while a save is pending", async () => {
    let finish!: (value: { status: "success"; message: string }) => void;
    create.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    show([]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Martes" })).getByRole("button", {
        name: /Agregar horario/,
      }),
    );
    fireEvent.change(screen.getByLabelText("Hora desde"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "13:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    const dialog = screen.getByRole("dialog", { name: "Agregar horario · Martes" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Guardando…" })).toBeDisabled();
    finish({ status: "success", message: "Horario guardado." });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Horario agregado correctamente.");
  });

  it("shows server field validation next to the time and preserves values on error", async () => {
    create.mockResolvedValueOnce({
      status: "error",
      message: "Revisá los datos.",
      fieldErrors: { endTime: "La franja se solapa con otro horario." },
    });
    show([]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Martes" })).getByRole("button", {
        name: /Agregar horario/,
      }),
    );
    fireEvent.change(screen.getByLabelText("Hora desde"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "13:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog", { name: "Agregar horario · Martes" })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Hora hasta")).toHaveAttribute("aria-invalid", "true"),
    );
    const error = screen.getByText("La franja se solapa con otro horario.");
    expect(error).toHaveAttribute("id");
    expect(screen.getByLabelText("Hora hasta").getAttribute("aria-describedby")).toContain(
      error.id,
    );
    expect(screen.getByLabelText("Hora desde")).toHaveValue("09:00");
  });

  it("cancels removal without calling the action", () => {
    show([intervals[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deactivate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["", "9:00", "24:00", "12:60", "12:00:00", "abcd"])(
    "rejects invalid start time %j before calling the Action",
    (value) => {
      show([]);
      fireEvent.click(
        within(screen.getByRole("region", { name: "Lunes" })).getByRole("button", {
          name: /Agregar horario/,
        }),
      );
      fireEvent.change(screen.getByLabelText("Hora desde"), { target: { value } });
      fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "13:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
      expect(create).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Hora desde")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Hora desde")).toHaveFocus();
      expect(screen.getByText("Ingresá una hora válida en formato HH:mm.")).toBeVisible();
    },
  );

  it.each(["09:00", "23:60"])("rejects invalid end time %j in Editar", (value) => {
    show([intervals[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Hora hasta")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Hora hasta")).toHaveFocus();
  });

  it("keeps partial text editable and guards it as unsaved", () => {
    show([]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Lunes" })).getByRole("button", {
        name: /Agregar horario/,
      }),
    );
    const start = screen.getByLabelText("Hora desde");
    fireEvent.change(start, { target: { value: "0" } });
    expect(start).toHaveValue("0");
    expect(start).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(start, { target: { value: "09" } });
    expect(start).toHaveValue("09:");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
  });

  it.each([
    ["create", "0900", "1800"],
    ["update", "0930", "1800"],
  ])("formats direct digits in %s and sends HH:mm to the Action", async (mode, start, end) => {
    const action = mode === "create" ? create : update;
    action.mockResolvedValueOnce({ status: "success", message: "Horario guardado." });
    show(mode === "create" ? [] : [intervals[0]]);
    if (mode === "create") {
      fireEvent.click(
        within(screen.getByRole("region", { name: "Lunes" })).getByRole("button", {
          name: /Agregar horario/,
        }),
      );
    } else fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const from = screen.getByLabelText("Hora desde");
    const to = screen.getByLabelText("Hora hasta");
    fireEvent.change(from, { target: { value: start } });
    fireEvent.change(to, { target: { value: end } });
    expect(from).toHaveValue(start === "0900" ? "09:00" : "09:30");
    expect(to).toHaveValue("18:00");
    expect(from).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0][0].get("startTime")).toBe(start === "0900" ? "09:00" : "09:30");
    expect(action.mock.calls[0][0].get("endTime")).toBe("18:00");
  });

  it("accepts pasted times with a separator and validates incomplete and corrected input on blur", () => {
    show([]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Lunes" })).getByRole("button", {
        name: /Agregar horario/,
      }),
    );
    const from = screen.getByLabelText("Hora desde");
    const to = screen.getByLabelText("Hora hasta");
    fireEvent.change(from, { target: { value: "09:30" } });
    expect(from).toHaveValue("09:30");
    fireEvent.change(to, { target: { value: "2" } });
    expect(to).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(to);
    expect(to).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Ingresá una hora válida en formato HH:mm.")).toBeVisible();
    fireEvent.change(to, { target: { value: "18:00" } });
    expect(to).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(to);
    expect(to).toHaveValue("18:00");
    expect(screen.queryByText("Ingresá una hora válida en formato HH:mm.")).not.toBeInTheDocument();
  });

  it("accepts the existing minute boundaries and sends HH:mm unchanged", async () => {
    create.mockResolvedValueOnce({ status: "success", message: "Horario guardado." });
    show([]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Lunes" })).getByRole("button", {
        name: /Agregar horario/,
      }),
    );
    fireEvent.change(screen.getByLabelText("Hora desde"), { target: { value: "00:00" } });
    fireEvent.change(screen.getByLabelText("Hora hasta"), { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0].get("startTime")).toBe("00:00");
    expect(create.mock.calls[0][0].get("endTime")).toBe("23:59");
  });

  it("shows a specific confirmation after removing", async () => {
    deactivate.mockResolvedValueOnce({ status: "success", message: "Horario guardado." });
    show([intervals[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Horario quitado correctamente."),
    );
  });
});
