import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAppointments } from "@/modules/appointments/server/appointments";
import { listAgendaAppointments } from "./agenda-appointments";

vi.mock("@/modules/appointments/server/appointments", () => ({ listAppointments: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const row = (id: string, status: "PENDING" | "CANCELLED" = "PENDING") => ({
  appointment_id: id,
  starts_at: "2026-10-21T12:00:00+00:00",
  ends_at: "2026-10-21T12:30:00+00:00",
  status,
  updated_at: "2026-10-01T00:00:00+00:00",
  patient_first_name: "Ana",
  patient_last_name: "Paz",
  specialty_name: "Clínica",
  professional_center_id: professionalId,
  professional_first_name: "Luisa",
  professional_last_name: "Vega",
  has_more: false,
});
beforeEach(() => vi.clearAllMocks());

describe("agenda paginated read", () => {
  it("reads every page and excludes cancelled appointments from the active view", async () => {
    vi.mocked(listAppointments)
      .mockResolvedValueOnce({
        kind: "STAFF",
        rows: [row("a"), row("b", "CANCELLED")],
        hasMore: true,
        nextCursor: { id: "b", startsAt: "2026-10-21T12:00:00+00:00" },
      } as never)
      .mockResolvedValueOnce({
        kind: "STAFF",
        rows: [row("c")],
        hasMore: false,
        nextCursor: null,
      } as never);
    const result = await listAgendaAppointments(
      centerId,
      { date: "2026-10-21", view: "day" },
      null,
      {} as never,
    );
    expect(result.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result[0].professionalCenterId).toBe(professionalId);
    expect(listAppointments).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        centerId,
        limit: 50,
        cursor: { id: "b", startsAt: "2026-10-21T12:00:00+00:00" },
      }),
      expect.anything(),
    );
  });

  it("does not expose a partial calendar when pagination fails", async () => {
    vi.mocked(listAppointments)
      .mockResolvedValueOnce({
        kind: "STAFF",
        rows: [row("a")],
        hasMore: true,
        nextCursor: { id: "a", startsAt: "2026-10-21T12:00:00+00:00" },
      } as never)
      .mockRejectedValueOnce(new Error("network"));
    await expect(
      listAgendaAppointments(centerId, { date: "2026-10-21", view: "day" }, null, {} as never),
    ).rejects.toThrow("network");
  });

  it("filters by the server-resolved specialty across every page", async () => {
    vi.mocked(listAppointments)
      .mockResolvedValueOnce({
        kind: "STAFF",
        rows: [{ ...row("a"), specialty_name: "Otra" }],
        hasMore: true,
        nextCursor: { id: "a", startsAt: "2026-10-21T12:00:00+00:00" },
      } as never)
      .mockResolvedValueOnce({
        kind: "STAFF",
        rows: [row("b")],
        hasMore: false,
        nextCursor: null,
      } as never);
    const result = await listAgendaAppointments(
      centerId,
      { date: "2026-10-21", view: "day", specialtyId: "id" },
      null,
      {} as never,
      "Clínica",
    );
    expect(result.map((item) => item.id)).toEqual(["b"]);
  });

  it("keeps the Professional projection limited to own context", async () => {
    const minimal = {
      appointment_id: "a",
      starts_at: "2026-10-21T12:00:00+00:00",
      ends_at: "2026-10-21T12:30:00+00:00",
      status: "PENDING" as const,
      updated_at: "2026-10-01T00:00:00+00:00",
      patient_first_name: "Ana",
      patient_last_name: "Paz",
      specialty_name: "Clínica",
      has_more: false,
    };
    vi.mocked(listAppointments).mockResolvedValue({
      kind: "PROFESSIONAL",
      rows: [minimal],
      hasMore: false,
      nextCursor: null,
    } as never);
    const result = await listAgendaAppointments(
      centerId,
      { date: "2026-10-21", view: "day", professionalCenterId: "other" },
      professionalId,
      {} as never,
    );
    expect(result[0]).toMatchObject({
      professionalCenterId: professionalId,
      professionalName: "Mi agenda",
    });
    expect(listAppointments).toHaveBeenCalledWith(
      expect.not.objectContaining({ professionalCenterId: "other" }),
      expect.anything(),
    );
  });
});
