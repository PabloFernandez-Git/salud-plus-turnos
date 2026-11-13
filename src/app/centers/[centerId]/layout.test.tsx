import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, requireCenterMembership } from "@/modules/access/server/authorization";
import { hasOptionalPlatformNavigation } from "@/modules/access/server/access";
import CenterLayout from "./layout";

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: pathname,
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireCenterMembership: vi.fn() };
});
vi.mock("@/modules/access/server/access", () => ({ hasOptionalPlatformNavigation: vi.fn() }));
vi.mock("@/modules/access/components/logout-button", () => ({
  LogoutButton: () => <button type="button">Cerrar sesión</button>,
}));

const centerId = "11111111-1111-4111-8111-111111111111";
const root = `/centers/${centerId}`;

function mockContext(role: "ADMIN" | "RECEPTION" | "PROFESSIONAL" = "ADMIN") {
  vi.mocked(requireCenterMembership).mockResolvedValueOnce({
    center: { id: centerId, name: "Centro Norte", timezone: "UTC" },
    user: { id: "user", firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
    membership: { id: "member", role, professionalCenterId: null },
  });
}

describe("center layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname.mockReturnValue(root);
    vi.mocked(hasOptionalPlatformNavigation).mockResolvedValue(false);
  });
  afterEach(cleanup);

  it("keeps center identity and navigation around every module", async () => {
    pathname.mockReturnValue(`${root}/patients`);
    mockContext("RECEPTION");
    render(
      await CenterLayout({
        params: Promise.resolve({ centerId }),
        children: <main>Pacientes</main>,
      }),
    );
    expect(screen.getByText("Centro Norte")).toBeVisible();
    const header = screen.getByRole("banner");
    const brand = within(header).getByRole("link", { name: "Salud Plus" });
    expect(brand).toHaveAttribute("href", root);
    expect(brand.querySelector("svg")).toBeInTheDocument();
    brand.focus();
    expect(brand).toHaveFocus();
    expect(
      within(header).getByRole("button", { name: "Abrir menú de navegación" }),
    ).toBeInTheDocument();
    expect(header.nextElementSibling?.querySelector("main")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez · ana@example.test · Recepción")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    const nav = screen.getByRole("navigation", { name: "Navegación del centro" });
    expect(within(nav).getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Agenda" })).toHaveAttribute(
      "href",
      `${root}/agenda`,
    );
    expect(within(nav).queryByRole("link", { name: "Profesionales" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Volver al inicio" })).not.toBeInTheDocument();
    expect(screen.getByText("Pacientes", { selector: "main" })).toBeVisible();
  });

  it("shows platform navigation only with global permission", async () => {
    vi.mocked(hasOptionalPlatformNavigation).mockResolvedValueOnce(true);
    mockContext("RECEPTION");
    render(await CenterLayout({ params: Promise.resolve({ centerId }), children: null }));
    const platform = screen.getByRole("link", { name: "Administrar plataforma" });
    expect(platform).toHaveAttribute("href", "/platform");
    expect(platform.querySelector("svg")).toBeInTheDocument();
    expect(within(platform).getByText("Administrar plataforma")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(hasOptionalPlatformNavigation).toHaveBeenCalledWith("user");
  });

  it("does not infer platform permission from center ADMIN", async () => {
    mockContext();
    render(await CenterLayout({ params: Promise.resolve({ centerId }), children: null }));
    expect(screen.queryByRole("link", { name: "Administrar plataforma" })).not.toBeInTheDocument();
  });

  it("preserves denied and unauthenticated access", async () => {
    vi.mocked(requireCenterMembership).mockRejectedValueOnce(
      new AuthorizationError("CENTER_ACCESS_DENIED"),
    );
    await expect(
      CenterLayout({ params: Promise.resolve({ centerId }), children: null }),
    ).rejects.toThrow("NOT_FOUND");
    vi.mocked(requireCenterMembership).mockRejectedValueOnce(
      new AuthorizationError("UNAUTHENTICATED"),
    );
    await expect(
      CenterLayout({ params: Promise.resolve({ centerId }), children: null }),
    ).rejects.toThrow("REDIRECT:/login");
    expect(hasOptionalPlatformNavigation).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs before querying membership", async () => {
    await expect(
      CenterLayout({ params: Promise.resolve({ centerId: "invalid" }), children: null }),
    ).rejects.toThrow("NOT_FOUND");
    expect(requireCenterMembership).not.toHaveBeenCalled();
  });
});
