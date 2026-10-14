import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CenterNavigation } from "@/modules/access/components/center-navigation";
import type { SpecialtyListItem } from "../server/specialties";
import { SpecialtiesScreen } from "./specialties-screen";

const refresh = vi.fn();
const create = vi.fn();
const update = vi.fn();
const setActive = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../actions/specialty-actions", () => ({
  createSpecialtyAction: (formData: FormData) => create(formData),
  updateSpecialtyAction: (formData: FormData) => update(formData),
  setSpecialtyActiveAction: (formData: FormData) => setActive(formData),
}));

const centerId = "11111111-1111-4111-8111-111111111111";
const specialty: SpecialtyListItem = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Cardiología",
  description: null,
  is_active: true,
  updated_at: "2026-10-09T12:00:00+00:00",
};

function show(specialties: SpecialtyListItem[] = [specialty], loadFailed = false) {
  return render(
    <SpecialtiesScreen
      centerId={centerId}
      centerName="Centro Salud"
      loadFailed={loadFailed}
      specialties={specialties}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SpecialtiesScreen", () => {
  it("shows title, list, empty and failed states", () => {
    const view = show([{ ...specialty, description: "Atención de adultos" }]);
    expect(screen.getByRole("heading", { level: 1, name: "Especialidades" })).toBeVisible();
    expect(screen.getByText("Cardiología")).toBeVisible();
    expect(screen.getByText("Activa")).toBeVisible();
    expect(screen.getByText("Atención de adultos")).toBeVisible();
    view.rerender(
      <SpecialtiesScreen
        centerId={centerId}
        centerName="Centro Salud"
        loadFailed={false}
        specialties={[]}
      />,
    );
    expect(screen.getByText(/Todavía no hay especialidades/)).toBeVisible();
    view.rerender(
      <SpecialtiesScreen
        centerId={centerId}
        centerName="Centro Salud"
        loadFailed
        specialties={[]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/No pudimos cargar/);
  });

  it("creates, closes the form and refreshes", async () => {
    create.mockResolvedValue({ status: "success", message: "Especialidad creada." });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nueva especialidad" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Dermatología" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0].get("name")).toBe("Dermatología");
    expect(create.mock.calls[0][0].get("description")).toBe("");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("textbox", { name: "Nombre" })).not.toBeInTheDocument();
  });

  it("sends description on create and edit, and supports clearing it", async () => {
    create.mockResolvedValue({ status: "success", message: "Especialidad creada." });
    update.mockResolvedValue({ status: "success", message: "Especialidad actualizada." });
    const view = show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nueva especialidad" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Clínica" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Descripción (opcional)" }), {
      target: { value: "Adultos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(create.mock.calls[0][0].get("description")).toBe("Adultos"));
    view.rerender(
      <SpecialtiesScreen
        centerId={centerId}
        centerName="Centro Salud"
        loadFailed={false}
        specialties={[{ ...specialty, description: "Adultos" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("textbox", { name: "Descripción (opcional)" })).toHaveValue("Adultos");
    fireEvent.change(screen.getByRole("textbox", { name: "Descripción (opcional)" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(update.mock.calls[0][0].get("description")).toBe(""));
  });

  it("shows server validation feedback beside description", async () => {
    create.mockResolvedValue({
      status: "error",
      message: "Revisá los datos ingresados.",
      fieldErrors: { description: ["Descripción inválida."] },
    });
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nueva especialidad" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Clínica" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.getByText("Descripción inválida.")).toBeVisible());
  });

  it("edits with the row CAS token and refreshes after stale without retry", async () => {
    update.mockResolvedValue({
      status: "stale",
      message: "La especialidad cambió en otra sesión.",
    });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Clínica" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0].get("expectedUpdatedAt")).toBe(specialty.updated_at);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("otra sesión"));
    expect(refresh).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("requires a second confirmation step to deactivate and explains preserved associations", async () => {
    setActive.mockResolvedValue({ status: "success", message: "Especialidad actualizada." });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(screen.getByText(/Las asociaciones existentes se conservan/)).toBeVisible();
    expect(setActive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar desactivación" }));
    await waitFor(() => expect(setActive).toHaveBeenCalledOnce());
    expect(setActive.mock.calls[0][0].get("isActive")).toBe("false");
    expect(setActive.mock.calls[0][0].get("confirmed")).toBe("true");
  });

  it("offers activation for inactive rows", () => {
    show([{ ...specialty, is_active: false }]);
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    expect(screen.getByRole("button", { name: "Confirmar activación" })).toBeVisible();
  });
});

describe("tenant navigation", () => {
  it("shows Especialidades only to ADMIN", () => {
    const view = render(<CenterNavigation centerId={centerId} role="ADMIN" />);
    expect(
      within(screen.getByRole("navigation", { name: "Navegación del centro" })).getByRole("link", {
        name: "Especialidades",
      }),
    ).toHaveAttribute("href", `/centers/${centerId}/specialties`);
    for (const role of ["RECEPTION", "PROFESSIONAL"] as const) {
      view.rerender(<CenterNavigation centerId={centerId} role={role} />);
      expect(screen.queryByRole("link", { name: "Especialidades" })).not.toBeInTheDocument();
    }
  });
});
