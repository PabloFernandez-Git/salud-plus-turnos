import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

function requestClose(
  dialog: HTMLDialogElement,
  method: "Cancelar" | "Cerrar" | "Escape" | "Fondo",
) {
  if (method === "Escape") fireEvent(dialog, new Event("cancel", { cancelable: true }));
  else if (method === "Fondo") fireEvent.click(dialog, { clientX: 100, clientY: 100 });
  else fireEvent.click(screen.getByRole("button", { name: method }));
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SpecialtiesScreen", () => {
  it("shows title, list, empty and failed states", () => {
    const view = show([{ ...specialty, description: "Atención de adultos" }]);
    expect(screen.getByRole("heading", { level: 1, name: "Especialidades" })).toBeVisible();
    expect(screen.getByText("Administrá las especialidades del centro")).toHaveClass(
      "mt-2",
      "max-w-3xl",
      "text-sm",
      "leading-6",
      "text-slate-600",
    );
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

  it("shows the scroll hint only while the table overflows", () => {
    show();
    const scroller = screen.getByRole("region", { name: "Listado de especialidades" });
    const hint = "Deslizá horizontalmente para ver todas las columnas";
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 390 });
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 640 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByText(hint)).toHaveClass("text-xs", "text-slate-500");
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 640 });
    fireEvent(window, new Event("resize"));
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it.each([
    [true, "Desactivar"],
    [false, "Activar"],
  ])("keeps actions in one row for active=%s", (isActive, stateAction) => {
    show([{ ...specialty, is_active: isActive }]);
    const row = screen.getByRole("row", { name: /Cardiología/ });
    const edit = within(row).getByRole("button", { name: "Editar" });
    const state = within(row).getByRole("button", { name: stateAction });
    expect(screen.getByRole("table")).toHaveClass("min-w-[40rem]");
    expect(edit.parentElement).toHaveClass("flex", "w-max", "flex-nowrap", "gap-2");
    expect(edit.parentElement?.parentElement).toHaveClass("min-w-max", "whitespace-nowrap");
    for (const action of [edit, state])
      expect(action).toHaveClass(
        "inline-flex",
        "min-h-11",
        "items-center",
        "justify-center",
        "px-3",
        "py-2",
        "text-sm",
        "leading-5",
        "enabled:cursor-pointer",
        "focus-visible:outline-sky-700",
        "disabled:cursor-not-allowed",
        "disabled:opacity-50",
      );
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

  it.each(["create", "edit"] as const)(
    "shows an accessible custom required error, focuses and clears it in %s",
    async (mode) => {
      const action = mode === "create" ? create : update;
      action.mockResolvedValue({ status: "success", message: "Especialidad guardada." });
      show();
      fireEvent.click(
        screen.getByRole("button", { name: mode === "create" ? "Nueva especialidad" : "Editar" }),
      );
      const input = screen.getByRole("textbox", { name: "Nombre" }) as HTMLInputElement;
      expect(input.className).toBe(
        screen.getByRole("textbox", { name: "Descripción (opcional)" }).className,
      );
      expect(input).toBeRequired();
      expect(input).toHaveAttribute("maxlength", "120");
      expect(input.closest("form")).not.toHaveAttribute("novalidate");
      if (mode === "edit") fireEvent.change(input, { target: { value: "" } });
      const invalidEvent = new Event("invalid", { cancelable: true });
      fireEvent(input, invalidEvent);
      expect(invalidEvent.defaultPrevented).toBe(true);
      const error = screen.getByText("Ingresá el nombre de la especialidad.");
      expect(error).toBeVisible();
      expect(input).toHaveClass("border-2", "border-red-700", "focus:border-red-700");
      expect(input).toHaveClass("focus:outline-none");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", error.id);
      expect(input).toHaveFocus();
      expect(action).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: "Dermatología" } });
      expect(screen.queryByText("Ingresá el nombre de la especialidad.")).not.toBeInTheDocument();
      expect(input).toHaveClass("border-slate-300");
      expect(input).toHaveClass("focus:border-sky-700", "focus:outline-none");
      expect(input).toHaveAttribute("aria-invalid", "false");
      expect(input).not.toHaveAttribute("aria-describedby");
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(action).toHaveBeenCalledOnce());
      expect(action.mock.calls[0][0].get("name")).toBe("Dermatología");
    },
  );

  it("treats whitespace-only names as empty without sending an action", () => {
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nueva especialidad" }));
    const input = screen.getByRole("textbox", { name: "Nombre" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Ingresá el nombre de la especialidad.")).toBeVisible();
    expect(input).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: " Neurología " } });
    expect(screen.queryByText("Ingresá el nombre de la especialidad.")).not.toBeInTheDocument();
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
    const description = screen.getByRole("textbox", { name: /Descripción \(opcional\)/ });
    expect(description).toHaveClass("border-2", "border-red-700", "focus:border-red-700");
    expect(description).toHaveClass("focus:outline-none");
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

  it.each(["Cancelar", "Cerrar", "Escape", "Fondo"] as const)(
    "guards changed create and edit forms on %s, then preserves or discards data",
    async (method) => {
      for (const mode of ["create", "edit"] as const) {
        const view = show();
        const trigger = screen.getByRole("button", {
          name: mode === "create" ? "Nueva especialidad" : "Editar",
        });
        fireEvent.click(trigger);
        const dialog = screen.getByRole("dialog") as HTMLDialogElement;
        vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
          left: 400,
          right: 900,
          top: 0,
          bottom: 800,
        } as DOMRect);
        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
          target: { value: "Neurología" },
        });
        requestClose(dialog, method);
        expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
        expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Neurología");
        requestClose(dialog, method);
        fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
        view.unmount();
      }
    },
  );

  it.each(["Cancelar", "Cerrar", "Escape", "Fondo"] as const)(
    "closes unchanged forms directly on %s",
    (method) => {
      show();
      fireEvent.click(screen.getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog") as HTMLDialogElement;
      vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
        left: 400,
        right: 900,
        top: 0,
        bottom: 800,
      } as DOMRect);
      requestClose(dialog, method);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("keeps keyboard focus inside the dialog and closes discard confirmation with Escape", () => {
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nueva especialidad" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveFocus();
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Neurología" },
    });
    requestClose(dialog, "Escape");
    expect(screen.getByRole("button", { name: "Seguir editando" })).toHaveFocus();
    requestClose(dialog, "Escape");
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Neurología");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });

  it("blocks duplicate submits and every close path while saving", async () => {
    const pending = deferred<{ status: "success"; message: string }>();
    create.mockReturnValue(pending.promise);
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Nueva especialidad" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      left: 400,
      right: 900,
      top: 0,
      bottom: 800,
    } as DOMRect);
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
      target: { value: "Neurología" },
    });
    const form = screen.getByRole("button", { name: "Guardar" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    for (const method of ["Cancelar", "Cerrar", "Escape", "Fondo"] as const) {
      requestClose(dialog, method);
    }
    expect(create).toHaveBeenCalledOnce();
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Descartar cambios" })).not.toBeInTheDocument();
    pending.resolve({ status: "success", message: "Especialidad creada." });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("uses a red confirmation for deactivation and keeps activation available", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    const dialog = screen.getByRole("dialog", { name: /Desactivar Cardiología/ });
    expect(dialog).toHaveClass("max-w-[28rem]");
    expect(screen.getByRole("button", { name: "Confirmar desactivación" })).toHaveClass(
      "bg-red-700",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
