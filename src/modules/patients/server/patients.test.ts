import { beforeEach, describe, expect, it, vi } from "vitest";
import { callPatientRpc } from "../api/patient-rpc-adapter";
import { listPatientCenters } from "./patients";

vi.mock("../api/patient-rpc-adapter", () => ({ callPatientRpc: vi.fn() }));
const centerId = "11111111-1111-4111-8111-111111111111";
const client = {} as Parameters<typeof listPatientCenters>[2];
const row = {
  patient_center_id: "22222222-2222-4222-8222-222222222222",
  person_id: "33333333-3333-4333-8333-333333333333",
  first_name: "Ana",
  last_name: "Pérez",
  nationality_code: "AR",
  document_number: "123",
  birth_date: "2000-01-02",
  phone: "123",
  email: null,
  insurance_name: null,
  is_active: true,
  updated_at: "2026-10-14T12:00:00+00:00",
};
beforeEach(() => vi.mocked(callPatientRpc).mockReset());

describe("tenant patient listing", () => {
  it.each([
    [1, 0, false],
    [2, 25, true],
    [401, 10000, true],
  ])("requests page %i at offset %i", async (page, offset, hasPrevious) => {
    vi.mocked(callPatientRpc).mockResolvedValueOnce([]);
    const result = await listPatientCenters(centerId, { query: "", state: "ACTIVE", page }, client);
    expect(callPatientRpc).toHaveBeenCalledWith(client, "staff_search_patient_centers", {
      p_center_id: centerId,
      p_query: null,
      p_state: "ACTIVE",
      p_limit: 26,
      p_offset: offset,
    });
    expect(result.hasPrevious).toBe(hasPrevious);
    expect(result.hasNext).toBe(false);
  });

  it("uses one lookahead row and exposes only 25", async () => {
    vi.mocked(callPatientRpc).mockResolvedValueOnce(Array(26).fill(row));
    const result = await listPatientCenters(
      centerId,
      { query: " Ana ", state: "ALL", page: 2 },
      client,
    );
    expect(callPatientRpc).toHaveBeenCalledWith(client, "staff_search_patient_centers", {
      p_center_id: centerId,
      p_query: "Ana",
      p_state: "ALL",
      p_limit: 26,
      p_offset: 25,
    });
    expect(result.rows).toHaveLength(25);
    expect(result.hasNext).toBe(true);
  });

  it("does not show Next for 25 rows or beyond page 401", async () => {
    vi.mocked(callPatientRpc)
      .mockResolvedValueOnce(Array(25).fill(row))
      .mockResolvedValueOnce(Array(26).fill(row));
    expect(
      (await listPatientCenters(centerId, { query: "", state: "ACTIVE", page: 1 }, client)).hasNext,
    ).toBe(false);
    expect(
      await listPatientCenters(centerId, { query: "", state: "ACTIVE", page: 401 }, client),
    ).toMatchObject({
      hasNext: false,
      atOffsetCeiling: true,
    });
  });

  it("turns RPC access denial into an authorization error", async () => {
    vi.mocked(callPatientRpc).mockRejectedValueOnce({
      code: "42501",
      message: "PATIENT_ACCESS_DENIED",
    });
    await expect(
      listPatientCenters(centerId, { query: "", state: "ACTIVE", page: 1 }, client),
    ).rejects.toMatchObject({ code: "CENTER_ACCESS_DENIED" });
  });
});
