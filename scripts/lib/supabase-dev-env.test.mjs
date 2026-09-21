// @vitest-environment node

import { describe, expect, it } from "vitest";
import { APPROVED_SUPABASE_DEV_PROJECT } from "../config/approved-supabase-dev.mjs";
import { validateLinkedSupabaseProject, validateSupabaseDevEnv } from "./supabase-dev-env.mjs";

const alternativeProjectRef = "zyxwvutsrqponmlkjihg";

const validEnv = {
  APP_ENV: "development",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_SUPABASE_DEV_PROJECT.projectRef}.supabase.co`,
  SUPABASE_DEV_PROJECT_REF: APPROVED_SUPABASE_DEV_PROJECT.projectRef,
};

describe("validateSupabaseDevEnv", () => {
  it("acepta una configuración DEV coherente", () => {
    expect(validateSupabaseDevEnv(validEnv)).toEqual({
      appEnv: "development",
      projectRef: APPROVED_SUPABASE_DEV_PROJECT.projectRef,
      publishableKey: "synthetic-publishable-key",
      region: APPROVED_SUPABASE_DEV_PROJECT.region,
      url: `https://${APPROVED_SUPABASE_DEV_PROJECT.projectRef}.supabase.co`,
    });
  });

  it("bloquea cualquier entorno que no sea development", () => {
    expect(() => validateSupabaseDevEnv({ ...validEnv, APP_ENV: "production" })).toThrow(
      "APP_ENV debe ser development",
    );
  });

  it("rechaza una URL cuyo host no coincide con el project ref", () => {
    expect(() =>
      validateSupabaseDevEnv({
        ...validEnv,
        NEXT_PUBLIC_SUPABASE_URL: `https://${alternativeProjectRef}.supabase.co`,
      }),
    ).toThrow("no coincide exactamente");
  });

  it("rechaza un project ref de entorno distinto del aprobado", () => {
    expect(() =>
      validateSupabaseDevEnv({
        ...validEnv,
        SUPABASE_DEV_PROJECT_REF: alternativeProjectRef,
      }),
    ).toThrow("no coincide con el proyecto DEV aprobado");
  });

  it("rechaza un proyecto linkeado distinto del aprobado", () => {
    expect(() => validateLinkedSupabaseProject(alternativeProjectRef)).toThrow(
      "no coincide con el proyecto DEV aprobado",
    );
  });

  it("rechaza env, URL y link coherentes entre sí cuando pertenecen a otro proyecto", () => {
    const coherentAlternativeEnv = {
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_URL: `https://${alternativeProjectRef}.supabase.co`,
      SUPABASE_DEV_PROJECT_REF: alternativeProjectRef,
    };

    expect(() => validateSupabaseDevEnv(coherentAlternativeEnv)).toThrow(
      "no coincide con el proyecto DEV aprobado",
    );
    expect(() => validateLinkedSupabaseProject(alternativeProjectRef)).toThrow(
      "no coincide con el proyecto DEV aprobado",
    );
  });

  it("rechaza componentes adicionales en la URL", () => {
    expect(() =>
      validateSupabaseDevEnv({
        ...validEnv,
        NEXT_PUBLIC_SUPABASE_URL: `${validEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`,
      }),
    ).toThrow("no coincide exactamente");
  });
});
