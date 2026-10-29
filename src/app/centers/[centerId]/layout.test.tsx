import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, requireCenterMembership } from "@/modules/access/server/authorization";
import { hasPlatformAdminRole } from "@/modules/access/server/access";
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
vi.mock("@/modules/access/server/access", () => ({ hasPlatformAdminRole: vi.fn() }));
vi.mock("@/modules/access/components/logout-button", () => ({
  LogoutButton: () => <button type="button">Cerrar sesión</button>,
}));

const centerId = "11111111-1111-4111-8111-111111111111";

describe("center layout", () => {
  beforeEach(() => {
    pathname.mockReturnValue(`/centers/${centerId}`);
    vi.mocked(hasPlatformAdminRole).mockResolvedValue(false);
  });
  afterEach(cleanup);

  it("keeps logout on the Dashboard", async () => {
    vi.mocked(requireCenterMembership).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro Norte", timezone: "UTC" },
      user: { id: "user", firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
      membership: { id: "member", role: "RECEPTION", professionalCenterId: null },
    });
    render(
      await CenterLayout({
        params: Promise.resolve({ centerId }),
        children: <main>Contenido del módulo</main>,
      }),
    );
    expect(screen.getByText("Centro activo")).toBeVisible();
    expect(screen.getByText("Centro Norte")).toBeVisible();
    expect(screen.getByText("Ana Pérez · ana@example.test · Recepción")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Volver al inicio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administrar plataforma" })).not.toBeInTheDocument();
    expect(screen.getByText("Contenido del módulo")).toBeVisible();
    expect(requireCenterMembership).toHaveBeenCalledWith(centerId);
  });

  it("shows platform navigation only with the global permission, independently of center role", async () => {
    vi.mocked(hasPlatformAdminRole).mockResolvedValueOnce(true);
    vi.mocked(requireCenterMembership).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro Norte", timezone: "UTC" },
      user: { id: "platform-user", firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
      membership: { id: "member", role: "RECEPTION", professionalCenterId: null },
    });
    render(await CenterLayout({ params: Promise.resolve({ centerId }), children: null }));
    const platformLink = screen.getByRole("link", { name: "Administrar plataforma" });
    expect(platformLink).toHaveAttribute("href", "/platform");
    expect(platformLink).toHaveClass("gap-2");
    expect(platformLink.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(platformLink.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
    expect(platformLink.querySelector("svg")).toHaveClass("h-[17px]", "w-[17px]");
    expect(platformLink).toHaveClass("sm:w-[232px]", "min-h-11");
    expect(screen.getByRole("button", { name: "Cerrar sesión" }).parentElement).toHaveClass(
      "sm:w-[232px]",
    );
    expect(hasPlatformAdminRole).toHaveBeenCalledWith("platform-user");
  });

  it("does not infer platform permission from ADMIN of a center", async () => {
    vi.mocked(requireCenterMembership).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro Norte", timezone: "UTC" },
      user: { id: "center-admin", firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
      membership: { id: "member", role: "ADMIN", professionalCenterId: null },
    });
    render(await CenterLayout({ params: Promise.resolve({ centerId }), children: null }));
    expect(screen.queryByRole("link", { name: "Administrar plataforma" })).not.toBeInTheDocument();
    expect(hasPlatformAdminRole).toHaveBeenCalledWith("center-admin");
  });

  it.each([
    "agenda",
    "appointments",
    "patients",
    "professionals",
    "availability",
    "specialties",
    "users",
  ])("shows only return navigation within %s", async (module) => {
    pathname.mockReturnValue(`/centers/${centerId}/${module}`);
    vi.mocked(hasPlatformAdminRole).mockResolvedValueOnce(true);
    vi.mocked(requireCenterMembership).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro Norte", timezone: "UTC" },
      user: { id: "user", firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
      membership: { id: "member", role: "ADMIN", professionalCenterId: null },
    });
    render(await CenterLayout({ params: Promise.resolve({ centerId }), children: null }));
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute(
      "href",
      `/centers/${centerId}`,
    );
    expect(screen.queryByRole("link", { name: "Administrar plataforma" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });

  it("preserves denied center access", async () => {
    vi.mocked(requireCenterMembership).mockRejectedValueOnce(
      new AuthorizationError("CENTER_ACCESS_DENIED"),
    );
    await expect(
      CenterLayout({ params: Promise.resolve({ centerId }), children: null }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("returns not-found for an invalid center identifier before querying membership", async () => {
    await expect(
      CenterLayout({ params: Promise.resolve({ centerId: "invalid" }), children: null }),
    ).rejects.toThrow("NOT_FOUND");
    expect(requireCenterMembership).not.toHaveBeenCalledWith("invalid");
  });

  it("redirects an unauthenticated visitor to login", async () => {
    vi.mocked(requireCenterMembership).mockRejectedValueOnce(
      new AuthorizationError("UNAUTHENTICATED"),
    );
    await expect(
      CenterLayout({ params: Promise.resolve({ centerId }), children: null }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("propagates an internal query failure without turning it into a 404", async () => {
    const queryError = new Error("internal query failure");
    vi.mocked(requireCenterMembership).mockRejectedValueOnce(queryError);

    await expect(
      CenterLayout({ params: Promise.resolve({ centerId }), children: null }),
    ).rejects.toBe(queryError);
  });
});
