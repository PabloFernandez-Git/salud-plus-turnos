import { describe, expect, test } from "vitest";
import { assertBootstrapPlatformPreflightResponse } from "./bootstrap-platform-preflight.mjs";

const validResponse = Object.freeze({
  platform_is_empty: true,
  auth_users_empty: true,
  public_users_empty: true,
  platform_admins_empty: true,
  centers_empty: true,
  center_memberships_empty: true,
});

describe("bootstrap platform preflight response", () => {
  test("acepta exclusivamente el objeto exacto con seis booleanos", () => {
    expect(assertBootstrapPlatformPreflightResponse({ ...validResponse })).toEqual(validResponse);
  });

  test("rechaza una propiedad adicional", () => {
    expect(() =>
      assertBootstrapPlatformPreflightResponse({ ...validResponse, unexpected: true }),
    ).toThrow("respuesta inválida");
  });

  test("rechaza una propiedad faltante", () => {
    const incomplete = { ...validResponse };
    delete incomplete.center_memberships_empty;
    expect(() => assertBootstrapPlatformPreflightResponse(incomplete)).toThrow(
      "respuesta inválida",
    );
  });

  test("rechaza un tipo no booleano", () => {
    expect(() =>
      assertBootstrapPlatformPreflightResponse({
        ...validResponse,
        auth_users_empty: "true",
      }),
    ).toThrow("respuesta inválida");
  });

  test("rechaza un number en una propiedad esperada", () => {
    expect(() =>
      assertBootstrapPlatformPreflightResponse({
        ...validResponse,
        auth_users_empty: 1,
      }),
    ).toThrow("respuesta inválida");
  });

  test("rechaza null", () => {
    expect(() => assertBootstrapPlatformPreflightResponse(null)).toThrow("respuesta inválida");
  });

  test("rechaza arrays", () => {
    expect(() => assertBootstrapPlatformPreflightResponse(Object.values(validResponse))).toThrow(
      "respuesta inválida",
    );
  });
});
