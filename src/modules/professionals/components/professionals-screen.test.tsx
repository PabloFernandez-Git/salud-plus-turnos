import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CenterNavigation } from "@/modules/access/components/center-navigation";
import type { ProfessionalListItem } from "../server/professionals";
import { ProfessionalsScreen } from "./professionals-screen";

const refresh = vi.fn();
const resolve = vi.fn();
const create = vi.fn();
const link = vi.fn();
const update = vi.fn();
const setActive = vi.fn();
const saveSpecialties = vi.fn();
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions/professional-actions", () => ({
  resolveProfessionalAction: (data: FormData) => resolve(data),
  createProfessionalAction: (data: FormData) => create(data),
  linkProfessionalAction: (data: FormData) => link(data),
  updateProfessionalCenterAction: (data: FormData) => update(data),
  setProfessionalCenterActiveAction: (data: FormData) => setActive(data),
}));
vi.mock("../actions/professional-specialty-action", () => ({
  updateProfessionalSpecialtiesAction: (data: FormData) => saveSpecialties(data),
}));
const centerId = "11111111-1111-4111-8111-111111111111";
const professional: ProfessionalListItem = {
  id: "33333333-3333-4333-8333-333333333333",
  firstName: "Ana",
  lastName: "Pérez",
  licenseNumber: "M-1",
  usualAppointmentDurationMinutes: 30,
  isActive: true,
  updatedAt: "2026-10-09T12:00:00+00:00",
};
const specialty = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Cardiología",
  isActive: true,
};
const show = (professionals: ProfessionalListItem[] = [professional], loadFailed = false) =>
  render(
    <ProfessionalsScreen
      centerId={centerId}
      centerName="Centro"
      professionals={professionals}
      loadFailed={loadFailed}
    />,
  );
function closeConfiguration(method: string) {
  const dialog = screen.getByRole("dialog", { name: "Configurar Ana Pérez" });
  if (method === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
  else if (method === "fondo") {
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      left: 100,
      right: 500,
      top: 100,
      bottom: 500,
    } as DOMRect);
    fireEvent.click(dialog, { clientX: 0, clientY: 0 });
  } else if (method === "X") fireEvent.click(dialog.querySelector('button[aria-label="Cerrar"]')!);
  else fireEvent.click(within(dialog).getByText("Cerrar", { selector: "button" }));
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("ProfessionalsScreen", () => {
  it("enables configuration saving only for changes from the last successful save", async () => {
    update.mockResolvedValue({
      status: "success",
      message: "Configuración del profesional actualizada",
      updatedAt: "2026-10-09T12:01:00+00:00",
    });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    const save = screen.getByRole("button", { name: "Guardar configuración" });
    const license = screen.getByRole("textbox", { name: "Matrícula (opcional)" });
    const duration = screen.getByRole("spinbutton", { name: "Duración habitual (minutos)" });
    expect(save).toBeDisabled();
    fireEvent.change(license, { target: { value: "M-2" } });
    expect(save).toBeEnabled();
    fireEvent.change(license, { target: { value: "M-1" } });
    expect(save).toBeDisabled();
    fireEvent.change(duration, { target: { value: "45" } });
    expect(save).toBeEnabled();
    fireEvent.change(duration, { target: { value: "30" } });
    expect(save).toBeDisabled();
    fireEvent.change(license, { target: { value: " M-2 " } });
    fireEvent.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Configuración"));
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.change(license, { target: { value: "M-1" } });
    expect(save).toBeEnabled();
    fireEvent.change(license, { target: { value: "M-2" } });
    expect(save).toBeDisabled();
  });
  it("blocks duplicate configuration saves and keeps changes after a failed save", async () => {
    let finish: ((value: unknown) => void) | undefined;
    update.mockImplementation(
      () =>
        new Promise((resolveResult) => {
          finish = resolveResult;
        }),
    );
    show();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Matrícula (opcional)" }), {
      target: { value: "M-2" },
    });
    const save = screen.getByRole("button", { name: "Guardar configuración" });
    fireEvent.click(save);
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(update).toHaveBeenCalledOnce();
    await act(async () => finish?.({ status: "error", message: "No se pudo guardar" }));
    expect(save).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Matrícula (opcional)" })).toHaveValue("M-2");
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");
    fireEvent.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await act(async () => finish?.({ status: "error", message: "No se pudo guardar" }));
    expect(save).toBeEnabled();
  });
  it("shows minimal list, empty, error and ADMIN navigation", () => {
    const view = show();
    expect(screen.getByRole("heading", { level: 1, name: "Profesionales" })).toBeVisible();
    expect(screen.getByText("Administrá los profesionales del centro")).toHaveClass(
      "mt-2",
      "max-w-3xl",
      "text-sm",
      "leading-6",
      "text-slate-600",
    );
    expect(screen.getByText("Ana Pérez")).toBeVisible();
    expect(screen.getByText("M-1")).toBeVisible();
    expect(screen.getByRole("link", { name: "Disponibilidad" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/professionals/${professional.id}/availability`,
    );
    expect(screen.queryByText(/ana@example.com/)).not.toBeInTheDocument();
    view.rerender(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[]}
        loadFailed={false}
      />,
    );
    expect(screen.getByText(/Todavía no hay profesionales/)).toBeVisible();
    view.rerender(
      <ProfessionalsScreen centerId={centerId} centerName="Centro" professionals={[]} loadFailed />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/No pudimos cargar/);
    view.rerender(<CenterNavigation centerId={centerId} role="ADMIN" />);
    expect(screen.getByRole("link", { name: "Profesionales" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/professionals`,
    );
    expect(screen.getByRole("link", { name: "Gestión de usuarios" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Especialidades" })).toBeVisible();
    view.rerender(<CenterNavigation centerId={centerId} role="RECEPTION" />);
    expect(screen.queryByRole("link", { name: "Profesionales" })).not.toBeInTheDocument();
  });
  it("shows a readable specialties column and an empty state", () => {
    show();
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Profesional",
      "Especialidades",
      "Matrícula",
      "Duración habitual",
      "Estado",
      "Acciones",
    ]);
    expect(within(table).getByText("Sin especialidades")).toBeVisible();
    expect(table).toHaveClass("min-w-[64rem]");
    expect(table.parentElement).toHaveClass("overflow-x-auto");
    expect(within(table).getByRole("link", { name: "Disponibilidad" })).toBeVisible();
  });
  it("shows the scroll hint only while the table overflows", () => {
    show();
    const scroller = screen.getByRole("region", { name: "Listado de profesionales" });
    const hint = "Deslizá horizontalmente para ver todas las columnas";
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 390 });
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 1080 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByText(hint)).toHaveClass("text-xs", "text-slate-500");
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 1440 });
    fireEvent(window, new Event("resize"));
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });
  it("keeps active professional actions in a single horizontal row", () => {
    show();
    const row = screen.getByRole("row", { name: /Ana Pérez/ });
    const availability = within(row).getByRole("link", { name: "Disponibilidad" });
    const configure = within(row).getByRole("button", { name: "Configurar" });
    const deactivate = within(row).getByRole("button", { name: "Desactivar" });
    const actions = availability.parentElement;
    expect(actions).toHaveClass("flex", "w-max", "flex-nowrap", "gap-2");
    expect(actions?.parentElement).toHaveClass("min-w-max", "whitespace-nowrap");
    for (const control of [availability, configure, deactivate])
      expect(control).toHaveClass(
        "inline-flex",
        "min-h-11",
        "items-center",
        "px-3",
        "py-2",
        "text-sm",
        "leading-5",
      );
    expect(availability).toHaveClass("focus-visible:outline-sky-700");
    expect(configure).toHaveClass("disabled:opacity-50");
    expect(deactivate).toHaveClass("disabled:opacity-50");
  });
  it("lists one or several active specialty names without inactive associations", () => {
    const pediatrics = {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Pediatría y adolescencia",
      isActive: true,
    };
    const inactive = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Especialidad archivada",
      isActive: false,
    };
    const unlinked = {
      id: "77777777-7777-4777-8777-777777777777",
      name: "Dermatología",
      isActive: true,
    };
    const view = render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty, pediatrics, inactive, unlinked]}
        associations={[
          { professionalCenterId: professional.id, specialtyId: specialty.id, isActive: true },
        ]}
        loadFailed={false}
      />,
    );
    let table = screen.getByRole("table");
    expect(within(table).getByText("Cardiología")).toBeVisible();
    expect(within(table).queryByText("Pediatría y adolescencia")).not.toBeInTheDocument();
    view.rerender(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty, pediatrics, inactive, unlinked]}
        associations={[
          { professionalCenterId: professional.id, specialtyId: specialty.id, isActive: true },
          { professionalCenterId: professional.id, specialtyId: pediatrics.id, isActive: true },
          { professionalCenterId: professional.id, specialtyId: inactive.id, isActive: true },
          { professionalCenterId: professional.id, specialtyId: unlinked.id, isActive: false },
        ]}
        loadFailed={false}
      />,
    );
    table = screen.getByRole("table");
    expect(within(table).getByText("Cardiología")).toBeVisible();
    expect(within(table).getByText("Pediatría y adolescencia")).toBeVisible();
    expect(within(table).queryByText("Especialidad archivada")).not.toBeInTheDocument();
    expect(within(table).queryByText("Dermatología")).not.toBeInTheDocument();
    expect(within(table).queryByText("Sin especialidades")).not.toBeInTheDocument();
  });
  it("updates the table only after a specialty save and yields to refreshed server data", async () => {
    const pediatrics = {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Pediatría y adolescencia",
      isActive: true,
    };
    saveSpecialties.mockResolvedValue({
      status: "success",
      message: "Especialidades del profesional actualizadas",
      updatedAt: "2026-10-09T12:01:00+00:00",
    });
    const view = render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty, pediatrics]}
        associations={[]}
        loadFailed={false}
      />,
    );
    const table = screen.getByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    expect(within(table).getByText("Sin especialidades")).toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    });
    await waitFor(() => expect(saveSpecialties).toHaveBeenCalledOnce());
    expect(within(table).getByText("Cardiología")).toBeVisible();
    closeConfiguration("Cerrar");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(table).getByText("Cardiología")).toBeVisible();
    view.rerender(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[{ ...professional, updatedAt: "2026-10-09T12:01:00+00:00" }]}
        specialties={[specialty, pediatrics]}
        associations={[
          { professionalCenterId: professional.id, specialtyId: pediatrics.id, isActive: true },
        ]}
        loadFailed={false}
      />,
    );
    expect(within(table).queryByText("Cardiología")).not.toBeInTheDocument();
    expect(within(table).getByText("Pediatría y adolescencia")).toBeVisible();
  });
  it.each(["Cerrar", "X", "Escape", "fondo"])(
    "closes clean configuration directly with %s",
    (method) => {
      show();
      fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
      closeConfiguration(method);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    },
  );
  it.each(["Cerrar", "X", "Escape", "fondo"])(
    "asks to discard pending configuration changes with %s",
    (method) => {
      show();
      fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Matrícula (opcional)" }), {
        target: { value: "M-2" },
      });
      closeConfiguration(method);
      expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
      expect(update).not.toHaveBeenCalled();
    },
  );
  it("closes after saving configuration when no specialty draft remains", async () => {
    update.mockResolvedValue({
      status: "success",
      message: "Configuración del profesional actualizada",
      updatedAt: "2026-10-09T12:01:00+00:00",
    });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Duración habitual (minutos)" }), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Configuración"));
    await waitFor(() => expect(screen.getByText("Cerrar", { selector: "button" })).toBeEnabled());
    closeConfiguration("Cerrar");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(update).toHaveBeenCalledOnce();
  });
  it("discards only unsaved specialties after configuration was saved", async () => {
    update.mockResolvedValue({
      status: "success",
      message: "Configuración del profesional actualizada",
      updatedAt: "2026-10-09T12:01:00+00:00",
    });
    render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty]}
        associations={[]}
        loadFailed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Duración habitual (minutos)" }), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Configuración"));
    await waitFor(() => expect(screen.getByText("Cerrar", { selector: "button" })).toBeEnabled());
    closeConfiguration("X");
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(update).toHaveBeenCalledOnce();
    expect(saveSpecialties).not.toHaveBeenCalled();
    expect(within(screen.getByRole("table")).getByText("Sin especialidades")).toBeVisible();
  });
  it("resolves existing global identity with minimal disclosure, then confirms link", async () => {
    resolve.mockResolvedValue({
      status: "resolved",
      message: "ok",
      resolution: {
        resolution_status: "NOT_LINKED",
        professional_id: "22222222-2222-4222-8222-222222222222",
        first_name: "Elena",
        last_name: "Ruiz",
        professional_center_id: null,
        professional_center_updated_at: null,
      },
    });
    link.mockResolvedValue({ status: "success", message: "Vinculado" });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    await waitFor(() => expect(screen.getByText("Elena Ruiz")).toBeVisible());
    expect(screen.queryByText(/email|teléfono|otros centros/i)).not.toBeInTheDocument();
    expect(link).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Vincular profesional al centro" }));
    await waitFor(() => expect(link).toHaveBeenCalledTimes(1));
    expect(link.mock.calls[0][0].get("professionalId")).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });
  it("shows a clear invalid-document message after resolve", async () => {
    resolve.mockResolvedValue({ status: "error", message: "Ingresá un documento válido." });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "---" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    expect(screen.getByText("Ingresá un documento válido.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Documento" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(resolve).not.toHaveBeenCalled();
  });
  it("shows already linked active, without a link action", async () => {
    resolve.mockResolvedValue({
      status: "resolved",
      message: "ok",
      resolution: { resolution_status: "LINKED_ACTIVE", first_name: "Elena", last_name: "Ruiz" },
    });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    await waitFor(() => expect(screen.getByText(/ya pertenece al centro/)).toBeVisible());
    expect(
      screen.queryByRole("button", { name: "Vincular profesional al centro" }),
    ).not.toBeInTheDocument();
  });
  it("creates a new global Professional only after NOT_FOUND", async () => {
    resolve.mockResolvedValue({
      status: "resolved",
      message: "ok",
      resolution: { resolution_status: "NOT_FOUND" },
    });
    create.mockResolvedValue({ status: "success", message: "Creado" });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Nombre" }), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Apellido" }), {
      target: { value: "Pérez" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Crear y vincular al centro" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(link).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].get("documentNumber")).toBe("123");
  });
  it("confirms reactivation of the same inactive PC and preserves its CAS token", async () => {
    resolve.mockResolvedValue({
      status: "resolved",
      message: "ok",
      resolution: {
        resolution_status: "LINKED_INACTIVE",
        professional_id: "22222222-2222-4222-8222-222222222222",
        first_name: "Elena",
        last_name: "Ruiz",
        professional_center_id: professional.id,
        professional_center_updated_at: professional.updatedAt,
      },
    });
    link.mockResolvedValue({ status: "success", message: "Reactivado" });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar reactivación" }));
    await waitFor(() => expect(link).toHaveBeenCalledTimes(1));
    expect(link.mock.calls[0][0].get("expectedProfessionalCenterUpdatedAt")).toBe(
      professional.updatedAt,
    );
    expect(create).not.toHaveBeenCalled();
  });
  it("sends rendered CAS token and closes on stale", async () => {
    update.mockResolvedValue({ status: "stale", message: "Cambió en otra sesión" });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Matrícula (opcional)" }), {
      target: { value: "M-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0].get("expectedUpdatedAt")).toBe(professional.updatedAt);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Guardar configuración" })).not.toBeInTheDocument();
  });
  it("confirms deactivation and shows D4 link", async () => {
    setActive.mockResolvedValue({ status: "error", message: "Administrá primero desde Usuarios." });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(setActive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar desactivación" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Ir a Usuarios" })).toBeVisible());
    expect(setActive.mock.calls[0][0].get("expectedUpdatedAt")).toBe(professional.updatedAt);
  });
  it.each([
    [true, "Desactivar", "Confirmar desactivación", "Profesional desactivado correctamente"],
    [false, "Activar", "Confirmar activación", "Profesional activado correctamente"],
  ] as const)(
    "shows the %s state confirmation only after success",
    async (isActive, open, confirm, message) => {
      let finish: ((value: unknown) => void) | undefined;
      setActive.mockImplementation(
        () =>
          new Promise((resolveResult) => {
            finish = resolveResult;
          }),
      );
      show([{ ...professional, isActive }]);
      fireEvent.click(screen.getByRole("button", { name: open }));
      fireEvent.click(screen.getByRole("button", { name: confirm }));
      await waitFor(() => expect(setActive).toHaveBeenCalledOnce());
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      await act(async () => finish?.({ status: "success", message }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(
        screen.queryByText("Configuración del profesional actualizada"),
      ).not.toBeInTheDocument();
    },
  );
  it("does not show a success message when a state confirmation is cancelled", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(setActive).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("clears the previous configuration confirmation while specialties are saving", async () => {
    update.mockResolvedValue({
      status: "success",
      message: "Configuración del profesional actualizada",
      updatedAt: "2026-10-09T12:01:00+00:00",
    });
    let finish: ((value: unknown) => void) | undefined;
    saveSpecialties.mockImplementation(
      () =>
        new Promise((resolveResult) => {
          finish = resolveResult;
        }),
    );
    render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty]}
        associations={[]}
        loadFailed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Matrícula (opcional)" }), {
      target: { value: "M-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Configuración del profesional actualizada",
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
      expect(saveSpecialties).toHaveBeenCalledOnce();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      finish?.({
        status: "success",
        message: "Especialidades del profesional actualizadas",
        updatedAt: "2026-10-09T12:02:00+00:00",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Especialidades del profesional actualizadas",
    );
    expect(screen.queryByText("Configuración del profesional actualizada")).not.toBeInTheDocument();
  });
  it("refreshes after a successful specialty batch and discards the old aggregate token", async () => {
    saveSpecialties.mockResolvedValue({
      status: "success",
      message: "Guardado",
      updatedAt: "new-token",
    });
    const view = render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty]}
        associations={[]}
        loadFailed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect((saveSpecialties.mock.calls[0][0] as FormData).get("expectedUpdatedAt")).toBe(
      professional.updatedAt,
    );
    expect(
      screen.queryByRole("button", { name: "Guardar especialidades" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurar" })).toBeDisabled();
    const refreshed = { ...professional, updatedAt: "2026-10-09T12:01:00+00:00" };
    view.rerender(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[refreshed]}
        specialties={[specialty]}
        associations={[
          { professionalCenterId: professional.id, specialtyId: specialty.id, isActive: true },
        ]}
        loadFailed={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Configurar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    await waitFor(() => expect(saveSpecialties).toHaveBeenCalledTimes(2));
    expect((saveSpecialties.mock.calls[1][0] as FormData).get("expectedUpdatedAt")).toBe(
      refreshed.updatedAt,
    );
  });
  it("closes on stale specialty batch and cannot reuse the old token", async () => {
    saveSpecialties.mockResolvedValue({ status: "stale", message: "Cambió en otra sesión" });
    render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty]}
        associations={[]}
        loadFailed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole("button", { name: "Guardar especialidades" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Cambió en otra sesión");
    expect(screen.getByRole("button", { name: "Configurar" })).toBeDisabled();
  });
  it.each(["Cancelar", "Cerrar", "Escape", "fondo"])(
    "asks before closing a changed creation form with %s",
    (method) => {
      show([]);
      fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
      const dialog = screen.getByRole("dialog", { name: "Nuevo profesional" });
      fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
        target: { value: "AR" },
      });
      if (method === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
      else if (method === "fondo") {
        vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
          left: 100,
          right: 500,
          top: 100,
          bottom: 500,
        } as DOMRect);
        fireEvent.click(dialog, { clientX: 0, clientY: 0 });
      } else fireEvent.click(screen.getByRole("button", { name: method }));
      expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
      expect(screen.getByRole("combobox", { name: "Nacionalidad" })).toHaveValue("AR");
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
  it("closes a clean creation or state modal directly", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(screen.getByRole("dialog", { name: "Desactivar Ana Pérez" })).toHaveClass(
      "max-w-[28rem]",
    );
    expect(
      screen.getByText(/La configuración y las asociaciones existentes se conservan/),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar desactivación" })).toHaveClass(
      "bg-red-700",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("blocks closing while document verification is pending", async () => {
    let finish: ((value: unknown) => void) | undefined;
    resolve.mockImplementation(
      () =>
        new Promise((resolveResult) => {
          finish = resolveResult;
        }),
    );
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled());
    fireEvent(
      screen.getByRole("dialog", { name: "Nuevo profesional" }),
      new Event("cancel", { cancelable: true }),
    );
    expect(screen.getByRole("dialog", { name: "Nuevo profesional" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Descartar cambios" })).not.toBeInTheDocument();
    await act(async () => {
      finish?.({
        status: "resolved",
        message: "ok",
        resolution: { resolution_status: "NOT_FOUND" },
      });
    });
    expect(screen.getByRole("textbox", { name: "Nombre" })).toBeVisible();
  });
  it("shows accessible inline validation and sends ISO country codes", async () => {
    resolve.mockResolvedValue({
      status: "resolved",
      message: "ok",
      resolution: { resolution_status: "NOT_FOUND" },
    });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    expect(screen.getByText("Seleccioná un país.")).toBeVisible();
    const country = screen.getByRole("combobox", { name: "Nacionalidad" });
    expect(country).toHaveAttribute("aria-invalid", "true");
    expect(country).toHaveClass("border-red-700");
    expect(country).toHaveAttribute("aria-describedby");
    expect(country.closest("form")).toHaveAttribute("novalidate");
    fireEvent.change(country, { target: { value: "AR" } });
    expect(country).toHaveValue("AR");
    expect(screen.getByRole("option", { name: "Argentina" })).toHaveValue("AR");
    expect(country).toHaveAttribute("aria-invalid", "false");
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    await screen.findByRole("button", { name: "Crear y vincular al centro" });
    expect(resolve.mock.calls[0][0].get("nationalityCode")).toBe("AR");
    fireEvent.click(screen.getByRole("button", { name: "Crear y vincular al centro" }));
    expect(screen.getByText("Ingresá el nombre.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveClass("border-red-700");
    expect(create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Ana" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Apellido" }), {
      target: { value: "Pérez" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "mal" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Duración habitual (minutos)" }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear y vincular al centro" }));
    expect(screen.getByText("Ingresá un email válido.")).toBeVisible();
    expect(screen.getByText(/múltiplos de 5/)).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });
  it("clears a previous identity's draft before verifying another document", async () => {
    resolve.mockResolvedValue({
      status: "resolved",
      message: "ok",
      resolution: { resolution_status: "NOT_FOUND" },
    });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Nacionalidad" }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    await screen.findByRole("textbox", { name: "Nombre" });
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "456" },
    });
    expect(screen.queryByRole("textbox", { name: "Nombre" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verificar documento" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Verificar documento" }));
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue("");
  });
  it("keeps specialty edits after saving configuration and uses the new CAS token", async () => {
    update.mockResolvedValue({
      status: "success",
      message: "Configuración del profesional actualizada.",
      updatedAt: "2026-10-09T12:01:00+00:00",
    });
    saveSpecialties.mockResolvedValue({
      status: "success",
      message: "Especialidades actualizadas.",
      updatedAt: "2026-10-09T12:02:00+00:00",
    });
    render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty]}
        associations={[]}
        loadFailed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    expect(screen.getByRole("dialog", { name: "Configurar Ana Pérez" })).toHaveClass("max-w-3xl");
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Duración habitual (minutos)" }), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Configuración"));
    expect(screen.getByRole("checkbox", { name: "Cardiología" })).toBeChecked();
    await waitFor(() => expect(screen.getByText("Cerrar", { selector: "button" })).toBeEnabled());
    fireEvent.click(screen.getByText("Cerrar", { selector: "button" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar especialidades" })).toBeEnabled(),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    });
    await waitFor(() => expect(saveSpecialties).toHaveBeenCalledOnce());
    expect((saveSpecialties.mock.calls[0][0] as FormData).get("expectedUpdatedAt")).toBe(
      "2026-10-09T12:01:00+00:00",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar especialidades" })).toBeDisabled(),
    );
    await waitFor(() => expect(screen.getByText("Cerrar", { selector: "button" })).toBeEnabled());
    fireEvent.click(screen.getByText("Cerrar", { selector: "button" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps configuration edits after saving specialties and uses the new CAS token", async () => {
    saveSpecialties.mockResolvedValue({
      status: "success",
      message: "Especialidades actualizadas.",
      updatedAt: "2026-10-09T12:02:00+00:00",
    });
    update.mockResolvedValue({
      status: "success",
      message: "Configuración del profesional actualizada.",
      updatedAt: "2026-10-09T12:03:00+00:00",
    });
    render(
      <ProfessionalsScreen
        centerId={centerId}
        centerName="Centro"
        professionals={[professional]}
        specialties={[specialty]}
        associations={[]}
        loadFailed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Matrícula (opcional)" }), {
      target: { value: "M-2" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    });
    await waitFor(() => expect(saveSpecialties).toHaveBeenCalledOnce());
    expect(screen.getByRole("textbox", { name: "Matrícula (opcional)" })).toHaveValue("M-2");
    await waitFor(() => expect(screen.getByText("Cerrar", { selector: "button" })).toBeEnabled());
    fireEvent.click(screen.getByText("Cerrar", { selector: "button" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar configuración" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect((update.mock.calls[0][0] as FormData).get("expectedUpdatedAt")).toBe(
      "2026-10-09T12:02:00+00:00",
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Configuración"));
    await waitFor(() => expect(screen.getByText("Cerrar", { selector: "button" })).toBeEnabled());
    fireEvent.click(screen.getByText("Cerrar", { selector: "button" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
