import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireRole } from "@/modules/access/server/authorization";
import { callPatientRpc } from "../api/patient-rpc-adapter";
import { getPatientCenter, runPatientOperation } from "./patient-management";

vi.mock("@/modules/access/server/authorization", () => ({ requireRole: vi.fn() }));
vi.mock("../api/patient-rpc-adapter", () => ({ callPatientRpc: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
const patientCenterId = "22222222-2222-4222-8222-222222222222";
const personId = "33333333-3333-4333-8333-333333333333";
const updatedAt = "2026-10-14T12:00:00+00:00";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tenant detail read", () => {
  it("reauthorizes and projects only the selected patient and linked identity", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: patientCenterId,
        person_id: personId,
        phone: "555",
        email: null,
        insurance_name: null,
        administrative_notes: "Recepción",
        is_active: true,
        updated_at: updatedAt,
        persons: {
          first_name: "Ana",
          last_name: "Pérez",
          birth_date: "2000-01-02",
          nationality_code: "AR",
          document_number: "123",
        },
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const result = await getPatientCenter(centerId, patientCenterId, { from } as never);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN", "RECEPTION"], expect.anything());
    expect(from).toHaveBeenCalledWith("patient_centers");
    expect(select).toHaveBeenCalledWith(expect.not.stringContaining("*"));
    expect(eq).toHaveBeenCalledWith("center_id", centerId);
    expect(result).toEqual({
      patientCenterId,
      phone: "555",
      email: null,
      insuranceName: null,
      administrativeNotes: "Recepción",
      isActive: true,
      updatedAt,
      firstName: "Ana",
      lastName: "Pérez",
      birthDate: "2000-01-02",
      nationalityCode: "AR",
      documentNumber: "123",
    });
    expect(JSON.stringify(result)).not.toContain(personId);
  });
  it("returns no detail for a cross-center or absent row", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      }),
    };
    expect(await getPatientCenter(centerId, patientCenterId, client as never)).toBeNull();
  });
  it("does not query detail after an authorization denial", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("denied"));
    const from = vi.fn();
    await expect(getPatientCenter(centerId, patientCenterId, { from } as never)).rejects.toThrow(
      "denied",
    );
    expect(from).not.toHaveBeenCalled();
  });
});

describe("operation routing", () => {
  it("sends nullable values and exact confirmation only through the adapter", async () => {
    vi.mocked(callPatientRpc).mockResolvedValue([
      {
        person_id: personId,
        patient_center_id: patientCenterId,
        updated_at: updatedAt,
        outcome: "LINKED",
      },
    ] as never);
    const result = await runPatientOperation(
      "link",
      {
        centerId,
        nationalityCode: "AR",
        documentNumber: "123",
        birthDate: "2000-01-02",
        personId,
        phone: "555",
        email: " ",
        insuranceName: "",
        administrativeNotes: null,
        confirmed: true,
      },
      {} as never,
    );
    expect(callPatientRpc).toHaveBeenCalledWith(expect.anything(), "staff_link_person_to_center", {
      p_center_id: centerId,
      p_nationality_code: "AR",
      p_document_number: "123",
      p_birth_date: "2000-01-02",
      p_person_id: personId,
      p_phone: "555",
      p_email: null,
      p_insurance_name: null,
      p_administrative_notes: null,
      p_confirmed: true,
    });
    expect(result).toMatchObject({ outcome: "LINKED" });
    await expect(
      runPatientOperation("link", { centerId, confirmed: false }, {} as never),
    ).rejects.toThrow();
  });
  it("does not send administrative edits on reactivation", async () => {
    vi.mocked(callPatientRpc).mockResolvedValue([
      { patient_center_id: patientCenterId, updated_at: updatedAt, outcome: "REACTIVATED" },
    ] as never);
    await runPatientOperation(
      "reactivate",
      {
        centerId,
        patientCenterId,
        expectedUpdatedAt: updatedAt,
        nationalityCode: "AR",
        documentNumber: "123",
        birthDate: "2000-01-02",
        confirmed: true,
      },
      {} as never,
    );
    const args = vi.mocked(callPatientRpc).mock.calls[0][2];
    expect(args).not.toHaveProperty("p_phone");
    expect(args).not.toHaveProperty("p_administrative_notes");
  });
});
