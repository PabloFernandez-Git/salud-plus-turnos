import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCenterSettingsAction,
  updateCenterSettingsAction,
} from "../actions/center-settings-actions";
import { CenterSettingsScreen } from "./center-settings-screen";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../actions/center-settings-actions", () => ({
  loadCenterSettingsAction: vi.fn(),
  updateCenterSettingsAction: vi.fn(),
}));

const settings = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Centro A",
  phone: null,
  email: null,
  address: null,
  timezone: "America/Argentina/Buenos_Aires",
  updatedAt: "2026-10-30T10:00:00.123456+00:00",
};

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.mocked(updateCenterSettingsAction).mockReset();
  vi.mocked(loadCenterSettingsAction).mockReset();
});
afterEach(cleanup);

describe("center settings screen", () => {
  it("shows center settings as non-editable in portfolio mode", () => {
    render(<CenterSettingsScreen settings={settings} isPortfolioDemo />);
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue("Centro A");
    expect(screen.getByLabelText("Nombre del centro")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    expect(screen.getByText(/Buenos Aires, Argentina/)).toBeVisible();
  });

  it("renders current data and disables redundant updates after whitespace changes", () => {
    render(<CenterSettingsScreen settings={settings} />);
    expect(screen.getByRole("heading", { name: "Configuración del centro" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toHaveTextContent(
      "Inicio/Configuración del centro",
    );
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue("Centro A");
    expect(screen.getByText(/Buenos Aires, Argentina/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre del centro"), {
      target: { value: "  Centro A  " },
    });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(updateCenterSettingsAction).not.toHaveBeenCalled();
  });

  it("guards Cancelar, retains a draft and then discards it", () => {
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Nombre del centro"), { target: { value: "Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialog = screen.getByRole("dialog", { name: "¿Descartar cambios?" });
    expect(dialog).toBeVisible();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.getByRole("button", { name: "Seguir editando" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue("Nuevo");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(push).toHaveBeenCalledWith(`/centers/${settings.id}`);
  });

  it("does not submit invalid input", () => {
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Nombre del centro"), { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre del centro"), { target: { value: "Centro" } });
    fireEvent.change(screen.getByLabelText("Email institucional"), { target: { value: "mal" } });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(updateCenterSettingsAction).not.toHaveBeenCalled();
  });

  it("shows field errors without clearing the draft", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "invalid",
      fieldErrors: { centerEmail: ["Ingresá un email válido."] },
    });
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Email institucional"), {
      target: { value: "valid@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Ingresá un email válido.")).toBeVisible();
    expect(screen.getByLabelText("Email institucional")).toHaveValue("valid@example.test");
  });

  it("keeps the draft and shows a safe message after a confirmed persistence failure", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "error",
      message: "No pudimos guardar los cambios en este momento. Intentá de nuevo más tarde.",
    });
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Teléfono de contacto"), {
      target: { value: "555" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar los cambios en este momento. Intentá de nuevo más tarde.",
    );
    expect(screen.getByLabelText("Teléfono de contacto")).toHaveValue("555");
  });

  it("requires loading current data before retrying an uncertain save", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "uncertain",
      message:
        "No pudimos confirmar si se guardaron los cambios. Recargá los datos antes de volver a guardar.",
    });
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Teléfono de contacto"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar");
    expect(screen.getByLabelText("Teléfono de contacto")).toHaveValue("555");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(),
    );
    fireEvent.change(screen.getByLabelText("Teléfono de contacto"), { target: { value: "556" } });
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Recargá los datos");

    vi.mocked(loadCenterSettingsAction).mockResolvedValueOnce({
      ...settings,
      phone: "555",
      updatedAt: "2026-10-30T10:01:00.654321+00:00",
    });
    fireEvent.click(screen.getByRole("button", { name: "Recargar datos del centro" }));
    expect(screen.getByRole("dialog", { name: "¿Descartar cambios?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(screen.getByLabelText("Teléfono de contacto")).toHaveValue("555"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(),
    );
  });

  it("treats a rejected action response as uncertain without showing success", async () => {
    vi.mocked(updateCenterSettingsAction).mockRejectedValueOnce(new Error("response lost"));
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Teléfono de contacto"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar");
    expect(screen.getByRole("button", { name: "Recargar datos del centro" })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(),
    );
    expect(screen.queryByText("Configuración guardada.")).not.toBeInTheDocument();
  });

  it("keeps another save blocked when verification reload fails", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "uncertain",
      message: "No pudimos confirmar si se guardaron los cambios.",
    });
    vi.mocked(loadCenterSettingsAction).mockRejectedValueOnce(new Error("read unavailable"));
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Teléfono de contacto"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar");
    fireEvent.click(screen.getByRole("button", { name: "Recargar datos del centro" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No pudimos recargar"));
    expect(screen.getByLabelText("Teléfono de contacto")).toHaveValue("555");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(),
    );
  });

  it("uses persisted values as its new base and refreshes the header", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "success",
      settings: {
        id: settings.id,
        name: "Centro nuevo",
        phone: null,
        email: null,
        address: null,
        updatedAt: "2026-10-30T10:01:00.654321+00:00",
      },
    });
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Nombre del centro"), {
      target: { value: "  Centro nuevo  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.getByText("Configuración guardada.")).toBeVisible());
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue("Centro nuevo");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reports a confirmed save when server revalidation failed", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "success",
      refreshPending: true,
      settings: {
        id: settings.id,
        name: "Centro nuevo",
        phone: null,
        email: null,
        address: null,
        updatedAt: "2026-10-30T10:01:00.654321+00:00",
      },
    });
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Nombre del centro"), {
      target: { value: "Centro nuevo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Configuración guardada.");
    expect(screen.getByRole("status")).toHaveTextContent("La vista puede estar desactualizada");
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue("Centro nuevo");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(),
    );
    expect(refresh).toHaveBeenCalledOnce();
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "success",
      settings: {
        id: settings.id,
        name: "Centro nuevo",
        phone: "555",
        email: null,
        address: null,
        updatedAt: "2026-10-30T10:02:00.654321+00:00",
      },
    });
    fireEvent.change(screen.getByLabelText("Teléfono de contacto"), { target: { value: "555" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(updateCenterSettingsAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updateCenterSettingsAction).mock.calls[1]?.[0].get("expectedUpdatedAt")).toBe(
      "2026-10-30T10:01:00.654321+00:00",
    );
  });

  it("does not turn a confirmed save into uncertainty if client refresh throws", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "success",
      settings: {
        id: settings.id,
        name: "Centro nuevo",
        phone: null,
        email: null,
        address: null,
        updatedAt: "2026-10-30T10:01:00.654321+00:00",
      },
    });
    refresh.mockImplementationOnce(() => {
      throw new Error("refresh failed");
    });
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Nombre del centro"), {
      target: { value: "Centro nuevo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Configuración guardada.");
    expect(screen.getByRole("status")).toHaveTextContent("La vista puede estar desactualizada");
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue("Centro nuevo");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps edits on conflict and asks before loading the current version", async () => {
    vi.mocked(updateCenterSettingsAction).mockResolvedValueOnce({
      status: "conflict",
      message: "Los datos cambiaron.",
    });
    render(<CenterSettingsScreen settings={settings} />);
    fireEvent.change(screen.getByLabelText("Nombre del centro"), { target: { value: "Borrador" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Los datos cambiaron.")).toBeVisible();
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue("Borrador");
    fireEvent.click(screen.getByRole("button", { name: "Recargar datos del centro" }));
    expect(screen.getByRole("dialog", { name: "¿Descartar cambios?" })).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
    vi.mocked(loadCenterSettingsAction).mockResolvedValueOnce({
      ...settings,
      name: "Centro actualizado por otra persona",
      updatedAt: "2026-10-30T10:02:00.000001+00:00",
    });
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Nombre del centro")).toHaveValue(
      "Centro actualizado por otra persona",
    );
  });
});
