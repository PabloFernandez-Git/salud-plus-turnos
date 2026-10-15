import { describe, expect, it } from "vitest";
import {
  parsePatientSearchParams,
  patientSearchUrl,
  type PatientSearchParams,
} from "./patient-search-params";

const id = "11111111-1111-4111-8111-111111111111";
const base = `/centers/${id}/patients`;

function parse(input: PatientSearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  return parsePatientSearchParams(id, input, params.size ? `?${params}` : "");
}

function parseOriginal(originalSearch: string) {
  const input: PatientSearchParams = {};
  for (const key of new URLSearchParams(originalSearch).keys()) {
    const values = new URLSearchParams(originalSearch).getAll(key);
    input[key] = values.length === 1 ? values[0] : values;
  }
  return parsePatientSearchParams(id, input, originalSearch);
}

describe("patient search URL", () => {
  it.each([
    ["?q=Ana", "Ana", `${base}?q=Ana`, false],
    ["?q=%41na", "Ana", `${base}?q=Ana`, true],
    ["?q=%61na", "ana", `${base}?q=ana`, true],
    ["?q=%20Ana%20", "Ana", `${base}?q=Ana`, true],
    ["?q=Ana%20Maria", "Ana Maria", `${base}?q=Ana+Maria`, true],
    ["?state=%41CTIVE", "", base, true],
    ["?page=%31", "", base, true],
    ["?unknown=1", "", base, true],
    ["?q=Ana&q=Eva&page=2", "", base, true],
    ["?q=&state=ACTIVE&page=1", "", base, true],
    ["?q=A%26B%3FC", "A&B?C", `${base}?q=A%26B%3FC`, false],
    ["?q=Jos%C3%A9", "José", `${base}?q=Jos%C3%A9`, false],
    ["?q=Jos%c3%a9", "José", `${base}?q=Jos%C3%A9`, true],
  ] as const)("compares the original encoding of %s", (raw, query, canonicalUrl, needsRedirect) => {
    expect(parseOriginal(raw)).toMatchObject({ query, canonicalUrl, needsRedirect });
    expect(parseOriginal(canonicalUrl.slice(base.length)).needsRedirect).toBe(false);
  });

  it("uses omitted defaults and does not redirect its own canonical URL", () => {
    expect(parse({})).toEqual({
      query: "",
      state: "ACTIVE",
      page: 1,
      canonicalUrl: base,
      needsRedirect: false,
    });
    expect(parse({ q: "Ana", state: "ALL", page: "2" })).toEqual({
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
    expect(parse(input)).toEqual({
      query,
      state,
      page,
      canonicalUrl: url,
      needsRedirect: true,
    });
  });

  it("accepts 100 code points and the three states and page boundary", () => {
    expect(parse({ q: "x".repeat(100) })).toMatchObject({
      query: "x".repeat(100),
      needsRedirect: false,
    });
    expect(parse({ state: "INACTIVE" })).toMatchObject({
      state: "INACTIVE",
      needsRedirect: false,
    });
    expect(parse({ state: "ALL" })).toMatchObject({
      state: "ALL",
      needsRedirect: false,
    });
    expect(parse({ page: "2" })).toMatchObject({
      page: 2,
      needsRedirect: false,
    });
    expect(parse({ page: "401" })).toMatchObject({
      page: 401,
      needsRedirect: false,
    });
  });
  it("keeps one valid selected patient across filters and drops invalid IDs", () => {
    const patient = "22222222-2222-4222-8222-222222222222";
    expect(parse({ q: "Ana", state: "ALL", page: "2", patient })).toMatchObject({
      patientId: patient,
      canonicalUrl: `${base}?q=Ana&state=ALL&page=2&patient=${patient}`,
      needsRedirect: false,
    });
    expect(parse({ patient: "invalid" })).toMatchObject({
      canonicalUrl: base,
      needsRedirect: true,
    });
    expect(parse({ patient: [patient, patient] })).toMatchObject({
      canonicalUrl: base,
      needsRedirect: true,
    });
  });
});
