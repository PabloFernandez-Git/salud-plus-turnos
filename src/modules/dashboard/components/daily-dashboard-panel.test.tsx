import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshDailyDashboardAction } from "../actions/daily-dashboard-actions";
import {
  centerDateAt,
  centerFriendlyDate,
  DailyDashboardPanel,
  millisecondsUntilNextCenterDay,
} from "./daily-dashboard-panel";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../actions/daily-dashboard-actions", () => ({ refreshDailyDashboardAction: vi.fn() }));
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const snapshot = (scope: "staff" | "professional", activeTotal = 1) => ({
  status: "success" as const,
  data: {
    scope,
    role: scope === "staff" ? ("ADMIN" as const) : ("PROFESSIONAL" as const),
    membershipId: "membership-a",
    activeTotal,
    toAttend: activeTotal,
    row: {
      as_of: "2026-11-01T05:20:00+00:00",
      local_date: "2026-11-01",
      timezone: "America/New_York",
      pending_count: activeTotal,
      confirmed_count: 0,
      attended_count: 0,
      no_show_count: 0,
      cancelled_count: 0,
      ...(scope === "staff" ? { professional_centers_with_appointments_count: activeTotal } : {}),
      upcoming: activeTotal
        ? [
            {
              appointment_id: "33333333-3333-4333-8333-333333333333",
              starts_at: "2026-11-01T06:30:00+00:00",
              ends_at: "2026-11-01T07:00:00+00:00",
              status: "PENDING" as const,
              patient_first_name: "Eva",
              patient_last_name: "López",
              specialty_name: "Clínica",
              ...(scope === "staff"
                ? {
                    professional_center_id: "44444444-4444-4444-8444-444444444444",
                    professional_first_name: "Ana",
                    professional_last_name: "García",
                  }
                : {}),
            },
          ]
        : [],
    },
  },
});
const props = { centerId: a, membershipId: "membership-a", role: "ADMIN" as const };
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("daily dashboard panel", () => {
  it("replaces the initial loader with an error when the activity request fails", async () => {
    vi.mocked(refreshDailyDashboardAction).mockRejectedValueOnce(new Error("network failure"));
    render(
      <DailyDashboardPanel {...props}>
        <Link href="/centers/test/agenda">Ir a módulo</Link>
      </DailyDashboardPanel>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Salud Plus, cargando");
    expect(screen.queryByRole("heading", { name: "Actividad de hoy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ir a módulo" })).not.toBeInTheDocument();
    await screen.findByText("No pudimos cargar la actividad. Intentá de nuevo.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a módulo" })).toBeVisible();
  });

  it("loads staff data, preserves detail navigation and refreshes without stale numbers", async () => {
    vi.mocked(refreshDailyDashboardAction)
      .mockResolvedValueOnce(snapshot("staff") as never)
      .mockResolvedValueOnce({ status: "error", message: "failure" });
    render(<DailyDashboardPanel {...props} />);
    expect(screen.getByText("Salud Plus, cargando")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Actividad de hoy" })).not.toBeInTheDocument();
    await screen.findByText(/Profesionales con turnos hoy/);
    expect(screen.queryByText("Salud Plus, cargando")).not.toBeInTheDocument();
    expect(screen.getByText(/Ana García/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Eva López/ })).toHaveAttribute(
      "href",
      `/centers/${a}/appointments/33333333-3333-4333-8333-333333333333`,
    );
    expect(screen.getByText(/01:30 UTC-5/)).toBeInTheDocument();
    expect(
      screen.getByText("Domingo 1 de noviembre · Actualizado a las 01:20 (hora del centro)"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(screen.getByText("Salud Plus, cargando")).toBeInTheDocument();
    await screen.findByText("No pudimos cargar la actividad. Intentá de nuevo.");
    expect(screen.queryByText("Salud Plus, cargando")).not.toBeInTheDocument();
    expect(screen.queryByText(/Profesionales con turnos hoy/)).not.toBeInTheDocument();
    expect(screen.queryByText("Fecha y hora del centro al cargar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualizar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("uses the minimal professional projection and distinguishes empty states", async () => {
    vi.mocked(refreshDailyDashboardAction).mockResolvedValueOnce(
      snapshot("professional", 0) as never,
    );
    render(<DailyDashboardPanel {...props} role="PROFESSIONAL" />);
    await screen.findByText("No hay turnos vigentes para hoy.");
    expect(screen.getByRole("heading", { name: "Mi actividad de hoy" })).toBeInTheDocument();
    expect(screen.queryByText(/Profesionales con turnos hoy/)).not.toBeInTheDocument();
    expect(screen.getByText("No hay próximos turnos de hoy.")).toBeInTheDocument();
  });

  it("shows recorded activity without remaining upcoming appointments", async () => {
    const data = snapshot("staff", 1);
    data.data.row.upcoming = [];
    vi.mocked(refreshDailyDashboardAction).mockResolvedValueOnce(data as never);
    render(<DailyDashboardPanel {...props} />);
    await screen.findByText("No quedan próximos turnos de hoy.");
    expect(screen.queryByText("No hay turnos vigentes para hoy.")).not.toBeInTheDocument();
  });

  it("clears activity and refreshes the route on membership denial", async () => {
    vi.mocked(refreshDailyDashboardAction)
      .mockResolvedValueOnce(snapshot("staff") as never)
      .mockResolvedValueOnce({ status: "denied", message: "Acceso cambiado" });
    render(<DailyDashboardPanel {...props} />);
    await screen.findByText(/Profesionales con turnos hoy/);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await screen.findByText("Tu acceso a este centro cambió. Actualizá la página.");
    expect(screen.queryByText(/Profesionales con turnos hoy/)).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });
  it("ignores a late response from another Center", async () => {
    let resolveA!: (value: ReturnType<typeof snapshot>) => void;
    vi.mocked(refreshDailyDashboardAction)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve as typeof resolveA;
          }) as never,
      )
      .mockResolvedValueOnce(snapshot("staff", 0) as never);
    const { rerender } = render(<DailyDashboardPanel {...props} />);
    rerender(<DailyDashboardPanel {...props} centerId={b} />);
    await screen.findByText("No hay turnos vigentes para hoy.");
    await act(async () => resolveA(snapshot("staff", 1)));
    expect(screen.getByText("No hay turnos vigentes para hoy.")).toBeInTheDocument();
    expect(refreshDailyDashboardAction).toHaveBeenCalledWith(b);
  });

  it("re-reads when a response crosses the Center's midnight", async () => {
    let now = Date.parse("2026-11-02T04:59:59Z");
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let resolveFirst!: (value: ReturnType<typeof snapshot>) => void;
    const second = snapshot("staff", 0);
    second.data.row.local_date = "2026-11-02";
    second.data.row.as_of = "2026-11-02T05:00:01+00:00";
    vi.mocked(refreshDailyDashboardAction)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve as typeof resolveFirst;
          }) as never,
      )
      .mockResolvedValueOnce(second as never);
    render(<DailyDashboardPanel {...props} />);
    now = Date.parse("2026-11-02T05:00:01Z");
    await act(async () => resolveFirst(snapshot("staff", 1)));
    await waitFor(() => expect(refreshDailyDashboardAction).toHaveBeenCalledTimes(2));
    await screen.findByText("No hay turnos vigentes para hoy.");
    expect(screen.getByText(/Lunes 2 de noviembre · Actualizado a las 00:00/)).toBeInTheDocument();
    expect(screen.queryByText(/Ana García/)).not.toBeInTheDocument();
  });
  it("refreshes when the tab becomes visible", async () => {
    vi.mocked(refreshDailyDashboardAction).mockResolvedValue(snapshot("staff") as never);
    render(<DailyDashboardPanel {...props} />);
    await screen.findByText(/Profesionales con turnos hoy/);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(refreshDailyDashboardAction).toHaveBeenCalledTimes(2));
  });
});

describe("center calendar refresh", () => {
  it("formats the Center's civil date in its own timezone", () => {
    const instant = "2026-10-22T23:30:00Z";
    expect(centerFriendlyDate(instant, "America/Argentina/Buenos_Aires")).toBe(
      "Jueves 22 de octubre",
    );
    expect(centerFriendlyDate(instant, "Asia/Tokyo")).toBe("Viernes 23 de octubre");
  });
  it("finds midnight after 23 and 25 hour DST days", () => {
    const spring = Date.parse("2026-03-08T05:00:00Z");
    const fall = Date.parse("2026-11-01T04:00:00Z");
    expect(centerDateAt(spring, "America/New_York")).toBe("2026-03-08");
    expect(millisecondsUntilNextCenterDay(spring, "America/New_York")).toBeGreaterThan(
      22 * 3600000,
    );
    expect(millisecondsUntilNextCenterDay(spring, "America/New_York")).toBeLessThan(24 * 3600000);
    expect(millisecondsUntilNextCenterDay(fall, "America/New_York")).toBeGreaterThan(24 * 3600000);
    expect(millisecondsUntilNextCenterDay(fall, "America/New_York")).toBeLessThan(26 * 3600000);
  });
});
