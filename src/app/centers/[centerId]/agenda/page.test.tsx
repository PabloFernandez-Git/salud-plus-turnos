import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  requireProfessionalContext,
  requireRole,
} from "@/modules/access/server/authorization";
import { listAvailabilityProfessionalCenters } from "@/modules/availability/server/availability";
import { getBookableSpecialties } from "@/modules/appointments/server/appointments";
import { listAgendaAppointments } from "@/modules/agenda/server/agenda-appointments";
import AgendaPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn(), requireProfessionalContext: vi.fn() };
});
vi.mock("@/modules/availability/server/availability", () => ({
  listAvailabilityProfessionalCenters: vi.fn(),
}));
vi.mock("@/modules/agenda/server/agenda-appointments", () => ({ listAgendaAppointments: vi.fn() }));
vi.mock("@/modules/appointments/server/appointments", () => ({ getBookableSpecialties: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const specialtyId = "33333333-3333-4333-8333-333333333333";
const page = (id = centerId, search: Record<string, string> = {}) =>
  AgendaPage({
    params: Promise.resolve({ centerId: id }),
    searchParams: Promise.resolve({ view: "month", date: "2026-10-21", ...search }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    center: { id: centerId, name: "Centro", timezone: "America/Argentina/Buenos_Aires" },
    membership: { role: "ADMIN" },
  } as never);
  vi.mocked(requireProfessionalContext).mockResolvedValue({
    professional: { professionalCenterId: professionalId },
  } as never);
  vi.mocked(listAgendaAppointments).mockResolvedValue([]);
  vi.mocked(listAvailabilityProfessionalCenters).mockResolvedValue([]);
  vi.mocked(getBookableSpecialties).mockResolvedValue([
    { specialty_id: specialtyId, specialty_name: "Clínica" },
  ]);
});

describe("agenda tenant route", () => {
  it("reads staff data for its Center and active professional catalog", async () => {
    await page();
    expect(listAgendaAppointments).toHaveBeenCalledWith(
      centerId,
      { date: "2026-10-21", view: "month" },
      null,
      expect.anything(),
      undefined,
    );
    expect(listAvailabilityProfessionalCenters).toHaveBeenCalledWith(centerId, expect.anything());
  });

  it("uses the own ProfessionalCenter and never fetches the staff catalog", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      center: { id: centerId, name: "Centro", timezone: "UTC" },
      membership: { role: "PROFESSIONAL" },
    } as never);
    await page();
    expect(requireProfessionalContext).toHaveBeenCalledWith(centerId, expect.anything());
    expect(listAgendaAppointments).toHaveBeenCalledWith(
      centerId,
      expect.anything(),
      professionalId,
      expect.anything(),
      undefined,
    );
    expect(listAvailabilityProfessionalCenters).not.toHaveBeenCalled();
  });

  it("resolves a Center specialty ID before filtering the complete list", async () => {
    const result = await page(centerId, { specialty: specialtyId });
    expect(listAgendaAppointments).toHaveBeenCalledWith(
      centerId,
      expect.objectContaining({ specialtyId }),
      null,
      expect.anything(),
      "Clínica",
    );
    expect(result.props.children.props.specialtyUnavailable).toBe(false);
    vi.mocked(listAgendaAppointments).mockClear();
    const missing = await page(centerId, { specialty: professionalId });
    expect(listAgendaAppointments).not.toHaveBeenCalled();
    expect(missing.props.children.props.specialtyUnavailable).toBe(true);
  });

  it("denies invalid IDs and unauthorized membership before reading appointments", async () => {
    await expect(page("invalid")).rejects.toThrow("NOT_FOUND");
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("CENTER_ACCESS_DENIED"));
    await expect(page()).rejects.toThrow("NOT_FOUND");
    expect(listAgendaAppointments).not.toHaveBeenCalled();
  });

  it("returns a failed state instead of partial appointments", async () => {
    vi.mocked(listAgendaAppointments).mockRejectedValueOnce(new Error("network"));
    const result = await page();
    expect(result.props.children.props.loadFailed).toBe(true);
    expect(result.props.children.props.appointments).toEqual([]);
  });
});
