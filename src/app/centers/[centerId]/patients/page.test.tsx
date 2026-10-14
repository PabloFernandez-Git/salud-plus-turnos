import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, requireRole } from "@/modules/access/server/authorization";
import { listPatientCenters } from "@/modules/patients/server/patients";
import PatientsPage from "./page";

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
  return { ...original, requireRole: vi.fn() };
});
vi.mock("@/modules/patients/server/patients", () => ({ listPatientCenters: vi.fn() }));

const centerId = "11111111-1111-4111-8111-111111111111";
const page = (searchParams: Record<string, string | string[]> = {}, id = centerId) =>
  PatientsPage({
    params: Promise.resolve({ centerId: id }),
    searchParams: Promise.resolve(searchParams),
  });

beforeEach(() => {
  vi.mocked(requireRole).mockReset();
  vi.mocked(listPatientCenters).mockReset();
  vi.mocked(requireRole).mockResolvedValue({ center: { id: centerId, name: "Centro" } } as never);
  vi.mocked(listPatientCenters).mockResolvedValue({
    rows: [],
    page: 1,
    hasPrevious: false,
    hasNext: false,
    atOffsetCeiling: false,
  });
});

describe("patients route", () => {
  it.each(["ADMIN", "RECEPTION"])("uses the tenant guard for %s", async () => {
    const result = await page();
    expect(result.props.centerId).toBe(centerId);
    expect(requireRole).toHaveBeenCalledWith(centerId, ["ADMIN", "RECEPTION"], expect.anything());
    expect(listPatientCenters).toHaveBeenCalledWith(
      centerId,
      { query: "", state: "ACTIVE", page: 1 },
      expect.anything(),
    );
  });
  it.each(["ROLE_FORBIDDEN", "CENTER_ACCESS_DENIED"] as const)(
    "hides %s before parsing filters",
    async (code) => {
      vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError(code));
      await expect(page({ page: "402" })).rejects.toThrow("NOT_FOUND");
      expect(listPatientCenters).not.toHaveBeenCalled();
    },
  );
  it("sends unauthenticated users to login", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthorizationError("UNAUTHENTICATED"));
    await expect(page()).rejects.toThrow("REDIRECT:/login");
  });
  it("rejects invalid center IDs before authorization", async () => {
    await expect(page({}, "invalid")).rejects.toThrow("NOT_FOUND");
    expect(requireRole).not.toHaveBeenCalled();
  });
  it("canonicalizes after authorization and before search", async () => {
    await expect(page({ q: " Ana ", foo: "bar" })).rejects.toThrow(
      `REDIRECT:/centers/${centerId}/patients?q=Ana`,
    );
    expect(requireRole).toHaveBeenCalledOnce();
    expect(listPatientCenters).not.toHaveBeenCalled();
  });
  it("redirects an empty higher page to page one preserving filters", async () => {
    await expect(page({ q: "Ana", state: "ALL", page: "2" })).rejects.toThrow(
      `REDIRECT:/centers/${centerId}/patients?q=Ana&state=ALL`,
    );
    expect(listPatientCenters).toHaveBeenCalledOnce();
  });
  it("hides RPC revocation and shows ordinary load errors", async () => {
    vi.mocked(listPatientCenters).mockRejectedValueOnce(
      new AuthorizationError("CENTER_ACCESS_DENIED"),
    );
    await expect(page()).rejects.toThrow("NOT_FOUND");
    vi.mocked(listPatientCenters).mockRejectedValueOnce(new Error("transport"));
    const result = await page();
    expect(result.props.loadFailed).toBe(true);
  });
});
