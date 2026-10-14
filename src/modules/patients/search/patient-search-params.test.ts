import { describe, expect, it } from "vitest";
import { parsePatientSearchParams, patientSearchUrl } from "./patient-search-params";

const id = "11111111-1111-4111-8111-111111111111";
const base = `/centers/${id}/patients`;

describe("patient search URL", () => {
  it("uses omitted defaults and does not redirect its own canonical URL", () => {
    expect(parsePatientSearchParams(id, {})).toEqual({
      query: "",
      state: "ACTIVE",
      page: 1,
      canonicalUrl: base,
      needsRedirect: false,
    });
    expect(parsePatientSearchParams(id, { q: "Ana", state: "ALL", page: "2" })).toEqual({
      query: "Ana",
      state: "ALL",
      page: 2,
      canonicalUrl: `${base}?q=Ana&state=ALL&page=2`,
      needsRedirect: false,
    });
    expect(patientSearchUrl(id, { query: "Ana", state: "INACTIVE", page: 1 })).toBe(
      `${base}?q=Ana&state=INACTIVE`,
    );
  });

  it.each([
    [{ foo: "bar" }, "", "ACTIVE", 1, base],
    [{ q: ["a", "b"], page: "2" }, "", "ACTIVE", 1, base],
    [{ state: ["ALL", "ACTIVE"], page: "2" }, "", "ACTIVE", 1, base],
    [{ page: ["2", "3"] }, "", "ACTIVE", 1, base],
    [{ q: " \t\n\v\f\r " }, "", "ACTIVE", 1, base],
    [{ q: " Ana ", page: "2" }, "Ana", "ACTIVE", 2, `${base}?q=Ana&page=2`],
    [{ q: "a".repeat(101), page: "2" }, "", "ACTIVE", 1, base],
    [{ state: "" }, "", "ACTIVE", 1, base],
    [{ state: "active" }, "", "ACTIVE", 1, base],
    [{ state: "foo", q: "Ana", page: "2" }, "Ana", "ACTIVE", 1, `${base}?q=Ana`],
    [{ page: "0" }, "", "ACTIVE", 1, base],
    [{ page: "-1" }, "", "ACTIVE", 1, base],
    [{ page: "1.5" }, "", "ACTIVE", 1, base],
    [{ page: "abc" }, "", "ACTIVE", 1, base],
    [{ page: "0002" }, "", "ACTIVE", 1, base],
    [{ page: "402" }, "", "ACTIVE", 1, base],
    [{ page: "99999999999999999999999999" }, "", "ACTIVE", 1, base],
    [{ page: "1" }, "", "ACTIVE", 1, base],
    [{ state: "ACTIVE" }, "", "ACTIVE", 1, base],
  ] as const)("canonicalizes %o", (input, query, state, page, url) => {
    expect(parsePatientSearchParams(id, input)).toEqual({
      query,
      state,
      page,
      canonicalUrl: url,
      needsRedirect: true,
    });
  });

  it("accepts 100 code points and the three states and page boundary", () => {
    expect(parsePatientSearchParams(id, { q: "x".repeat(100) })).toMatchObject({
      query: "x".repeat(100),
      needsRedirect: false,
    });
    expect(parsePatientSearchParams(id, { state: "INACTIVE" })).toMatchObject({
      state: "INACTIVE",
      needsRedirect: false,
    });
    expect(parsePatientSearchParams(id, { state: "ALL" })).toMatchObject({
      state: "ALL",
      needsRedirect: false,
    });
    expect(parsePatientSearchParams(id, { page: "2" })).toMatchObject({
      page: 2,
      needsRedirect: false,
    });
    expect(parsePatientSearchParams(id, { page: "401" })).toMatchObject({
      page: 401,
      needsRedirect: false,
    });
  });
});
