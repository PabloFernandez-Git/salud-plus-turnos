import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, requireCenterMembership } from "@/modules/access/server/authorization";
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
vi.mock("@/modules/access/components/logout-button", () => ({
  LogoutButton: () => <button type="button">Cerrar sesión</button>,
}));

const centerId = "11111111-1111-4111-8111-111111111111";

describe("center layout", () => {
  beforeEach(() => pathname.mockReturnValue(`/centers/${centerId}`));
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
    expect(screen.getByText("Contenido del módulo")).toBeVisible();
    expect(requireCenterMembership).toHaveBeenCalledWith(centerId);
  });

  it("links an internal page to the active center without a logout action", async () => {
    pathname.mockReturnValue(`/centers/${centerId}/appointments/new`);
    vi.mocked(requireCenterMembership).mockResolvedValueOnce({
      center: { id: centerId, name: "Centro Norte", timezone: "UTC" },
      user: { id: "user", firstName: "Ana", lastName: "Pérez", email: "ana@example.test" },
      membership: { id: "member", role: "RECEPTION", professionalCenterId: null },
    });
    render(
      await CenterLayout({
        params: Promise.resolve({ centerId }),
        children: <main>Crear turno</main>,
      }),
    );
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute(
      "href",
      `/centers/${centerId}`,
    );
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
    expect(screen.getByText("Ana Pérez · ana@example.test · Recepción")).toBeVisible();
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
