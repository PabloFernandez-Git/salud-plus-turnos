import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAccessibleCentersForUser } from "@/modules/access/server/access";
import { listPlatformCenters } from "@/modules/access/server/administration";
import { AuthorizationError, requirePlatformAdmin } from "@/modules/access/server/authorization";
import PlatformPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/modules/access/server/access", () => ({ listAccessibleCentersForUser: vi.fn() }));
vi.mock("@/modules/access/server/administration", () => ({ listPlatformCenters: vi.fn() }));
vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requirePlatformAdmin: vi.fn() };
});
vi.mock("@/modules/access/components/create-center-panel", () => ({
  CreateCenterPanel: () => <button type="button">Crear centro</button>,
}));
vi.mock("@/modules/access/components/logout-button", () => ({
  LogoutButton: () => <button type="button">Cerrar sesión</button>,
}));
vi.mock("@/modules/access/components/center-status-form", () => ({
  CenterStatusForm: () => <button type="button">Desactivar</button>,
}));

const center = (id: string) => ({
  id,
  name: "Centro " + id,
  membershipId: id,
  professionalCenterId: null,
  role: "ADMIN" as const,
  timezone: "UTC",
});
const one = center("11111111-1111-4111-8111-111111111111");
const two = center("22222222-2222-4222-8222-222222222222");

describe("platform page navigation", () => {
  beforeEach(() => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      id: "platform",
      email: "admin@example.test",
      firstName: "Ana",
      lastName: "Admin",
    });
    vi.mocked(listPlatformCenters).mockResolvedValue([]);
    vi.mocked(listAccessibleCentersForUser).mockResolvedValue([]);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("links directly to the sole active accessible center", async () => {
    vi.mocked(listAccessibleCentersForUser).mockResolvedValueOnce([one]);
    render(await PlatformPage());
    const centerLink = screen.getByRole("link", { name: "Ir a mi centro" });
    expect(centerLink).toHaveAttribute("href", `/centers/${one.id}`);
    expect(centerLink).toHaveClass("gap-2");
    expect(centerLink.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(centerLink.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
    expect(centerLink.querySelector("svg")).toHaveClass("h-[17px]", "w-[17px]");
    expect(screen.queryByRole("link", { name: "Seleccionar centro" })).not.toBeInTheDocument();
    const header = screen.getByText("Administración de plataforma").closest("header");
    expect(header).toHaveClass("border-b", "bg-white");
    expect(header?.firstElementChild).toHaveClass("gap-4", "py-5");
    expect(screen.getByRole("heading", { name: "Centros" })).toHaveClass("mt-1.5");
    expect(header).toContainElement(centerLink);
    expect(header).toContainElement(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(header).not.toContainElement(screen.getByRole("button", { name: "Crear centro" }));
    const section = screen.getByRole("region", { name: "Centros registrados" });
    expect(section).toContainElement(screen.getByRole("button", { name: "Crear centro" }));
    expect(
      screen.getByText("Gestioná los centros, sus estados y sus administradores iniciales."),
    ).toBeVisible();
    expect(
      screen.getByText("Desde este panel no se accede a pacientes, agenda ni datos clínicos."),
    ).toBeVisible();
  });

  it("shows the selector only when multiple active centers are accessible", async () => {
    vi.mocked(listAccessibleCentersForUser).mockResolvedValueOnce([one, two]);
    render(await PlatformPage());
    expect(screen.getByRole("link", { name: "Seleccionar centro" })).toHaveAttribute(
      "href",
      "/select-center",
    );
    expect(
      screen.getByRole("link", { name: "Seleccionar centro" }).querySelector("svg"),
    ).toBeNull();
  });

  it("omits center navigation with no access and reports query failures", async () => {
    render(await PlatformPage());
    expect(screen.queryByRole("link", { name: /centro/ })).not.toBeInTheDocument();
    cleanup();
    vi.mocked(listAccessibleCentersForUser).mockRejectedValueOnce(new Error("query failed"));
    render(await PlatformPage());
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tus accesos a centros.");
    expect(screen.queryByRole("link", { name: /centro/ })).not.toBeInTheDocument();
  });

  it("exits loading with an error when the center list fails", async () => {
    vi.mocked(listPlatformCenters).mockRejectedValueOnce(new Error("query failed"));
    render(await PlatformPage());
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los centros.");
    expect(screen.queryByText("Todavía no hay centros creados.")).not.toBeInTheDocument();
  });

  it("keeps platform authorization enforced before rendering content", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(
      new AuthorizationError("PLATFORM_FORBIDDEN"),
    );
    await expect(PlatformPage()).rejects.toThrow("REDIRECT:/no-access");
    expect(listPlatformCenters).not.toHaveBeenCalled();
    expect(listAccessibleCentersForUser).not.toHaveBeenCalled();
  });

  it("does not grant platform access when the strict permission lookup fails", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("permission lookup failed"));
    await expect(PlatformPage()).rejects.toThrow("permission lookup failed");
    expect(listPlatformCenters).not.toHaveBeenCalled();
    expect(listAccessibleCentersForUser).not.toHaveBeenCalled();
  });
});
