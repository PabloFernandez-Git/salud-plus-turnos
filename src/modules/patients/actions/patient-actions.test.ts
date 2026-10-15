import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireRole, AuthorizationError } from "@/modules/access/server/authorization";
import { runPatientOperation } from "../server/patient-management";
import {
  createPatientAction,
  linkPatientAction,
  resolvePatientAction,
  updatePatientAction,
} from "./patient-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: {} })),
}));
vi.mock("@/modules/access/server/authorization", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/access/server/authorization")>();
  return { ...original, requireRole: vi.fn() };
});
vi.mock("../server/patient-management", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/patient-management")>();
  return { ...original, runPatientOperation: vi.fn() };
});
const centerId = "11111111-1111-4111-8111-111111111111";
const base = { centerId, nationalityCode: "AR", documentNumber: "123", birthDate: "2000-01-02" };

beforeEach(() => vi.clearAllMocks());

describe("patient server actions", () => {
  it("rejects invalid input without a DB operation", async () => {
    const result = await resolvePatientAction({ ...base, birthDate: "bad" });
    expect(result).toMatchObject({ status: "error", code: "invalid" });
    expect(runPatientOperation).not.toHaveBeenCalled();
  });
  it("reauthorizes resolve and does not revalidate a read", async () => {
    vi.mocked(runPatientOperation).mockResolvedValue({
      identity_status: "NOT_FOUND",
      first_name: null,
      last_name: null,
      birth_date_matches: null,
      relationship_state: null,
      person_id: null,
      patient_center_id: null,
      patient_center_updated_at: null,
    });
    const result = await resolvePatientAction(base);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN", "RECEPTION"], expect.anything());
    expect(runPatientOperation).toHaveBeenCalledWith("resolve", base, expect.anything());
    expect(result).toMatchObject({ status: "success", data: { identity_status: "NOT_FOUND" } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("blocks a revoked membership before the RPC and hides SQL", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("ROLE_FORBIDDEN"));
    const result = await createPatientAction({
      ...base,
      firstName: "Ana",
      lastName: "Pérez",
      phone: "555",
      email: null,
      insuranceName: null,
      administrativeNotes: null,
    });
    expect(result).toMatchObject({ status: "error", code: "denied" });
    expect(runPatientOperation).not.toHaveBeenCalled();
  });
  it("revalidates a successful mutation and preserves an idempotent result", async () => {
    vi.mocked(runPatientOperation).mockResolvedValue({
      outcome: "ALREADY_ACTIVE",
      patient_center_id: "22222222-2222-4222-8222-222222222222",
      person_id: "33333333-3333-4333-8333-333333333333",
      updated_at: "2026-10-14T12:00:00+00:00",
    });
    const result = await linkPatientAction({
      ...base,
      personId: "33333333-3333-4333-8333-333333333333",
      phone: "555",
      email: null,
      insuranceName: null,
      administrativeNotes: null,
      confirmed: true,
    });
    expect(result).toMatchObject({ status: "success", data: { outcome: "ALREADY_ACTIVE" } });
    expect(revalidatePath).toHaveBeenCalledWith(`/centers/${centerId}/patients`);
  });
  it("maps stale without retrying or leaking the DB message", async () => {
    vi.mocked(runPatientOperation).mockRejectedValueOnce({
      code: "P0001",
      message: "STALE_PATIENT_CENTER_STATE",
    });
    const result = await updatePatientAction({
      centerId,
      patientCenterId: "22222222-2222-4222-8222-222222222222",
      expectedUpdatedAt: "2026-10-14T12:00:00+00:00",
      phone: "555",
      email: null,
      insuranceName: null,
      administrativeNotes: null,
    });
    expect(result).toMatchObject({ status: "error", code: "stale" });
    expect(JSON.stringify(result)).not.toContain("P0001");
    expect(runPatientOperation).toHaveBeenCalledTimes(1);
  });
});
