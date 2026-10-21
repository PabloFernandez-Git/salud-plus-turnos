import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("ProfessionalsScreen", () => {
  it("shows minimal list, empty, error and ADMIN navigation", () => {
    const view = show();
    expect(screen.getByRole("heading", { level: 1, name: "Profesionales" })).toBeVisible();
    expect(
      screen.getByText(
        "Consultá y administrá los profesionales vinculados a este centro, sus datos y las especialidades asociadas.",
      ),
    ).toHaveClass("mt-2", "max-w-3xl", "text-sm", "leading-6", "text-slate-600");
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
    expect(screen.getByRole("link", { name: "Usuarios" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Especialidades" })).toBeVisible();
    view.rerender(<CenterNavigation centerId={centerId} role="RECEPTION" />);
    expect(screen.queryByRole("link", { name: "Profesionales" })).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByRole("textbox", { name: /Nacionalidad/ }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver identidad" }));
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
    fireEvent.change(screen.getByRole("textbox", { name: /Nacionalidad/ }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "---" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver identidad" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Ingresá un documento válido."),
    );
  });
  it("shows already linked active, without a link action", async () => {
    resolve.mockResolvedValue({
      status: "resolved",
      message: "ok",
      resolution: { resolution_status: "LINKED_ACTIVE", first_name: "Elena", last_name: "Ruiz" },
    });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesional" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Nacionalidad/ }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver identidad" }));
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
    fireEvent.change(screen.getByRole("textbox", { name: /Nacionalidad/ }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver identidad" }));
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
    fireEvent.change(screen.getByRole("textbox", { name: /Nacionalidad/ }), {
      target: { value: "AR" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Documento" }), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver identidad" }));
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
});
