import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  assertLinkedSupabaseProject,
  loadLocalEnv,
  loadSupabaseDevConfig,
} from "./lib/supabase-dev-env.mjs";

const expectedSiteUrl = "http://localhost:3000";
const expectedRedirectUrls = [
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/update-password",
];

loadLocalEnv();
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY es requerida para verificar Auth DEV.");

const admin = createClient(dev.url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const anonymous = createClient(dev.url, dev.publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const createdUserIds = new Set();
const runId = randomUUID().replaceAll("-", "").slice(0, 16);

function lowercasePassword(length) {
  return [...randomBytes(length)].map((byte) => String.fromCharCode(97 + (byte % 26))).join("");
}

function normalizedUrl(value) {
  return value.replace(/\/$/, "");
}

function redirectFromActionLink(actionLink) {
  const redirect = new URL(actionLink).searchParams.get("redirect_to");
  if (!redirect) throw new Error("El link de recovery no contiene redirect_to.");
  return normalizedUrl(redirect);
}

async function createUser(email, password) {
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.data.user) createdUserIds.add(result.data.user.id);
  return result;
}

async function recoveryRedirect(email, redirectTo) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    ...(redirectTo ? { options: { redirectTo } } : {}),
  });
  if (error || !data.properties?.action_link) {
    throw new Error("No se pudo generar un link de recovery para verificar redirects.", {
      cause: error,
    });
  }
  return redirectFromActionLink(data.properties.action_link);
}

try {
  const settingsResponse = await fetch(new URL("/auth/v1/settings", dev.url), {
    headers: { apikey: dev.publishableKey },
  });
  if (!settingsResponse.ok) throw new Error("No se pudieron leer los settings públicos de Auth.");
  const settings = await settingsResponse.json();
  if (settings.disable_signup !== true) throw new Error("El signup público sigue habilitado.");
  if (settings.external?.email !== true) throw new Error("El proveedor email no está habilitado.");

  const signupEmail = `task005-${runId}-signup@example.test`;
  const signupResult = await anonymous.auth.signUp({
    email: signupEmail,
    password: lowercasePassword(10),
  });
  if (signupResult.data.user) createdUserIds.add(signupResult.data.user.id);
  if (!signupResult.error || signupResult.data.user) {
    throw new Error("El endpoint público de signup aceptó una identidad nueva.");
  }

  const shortPasswordResult = await createUser(
    `task005-${runId}-short@example.test`,
    lowercasePassword(9),
  );
  if (!shortPasswordResult.error || shortPasswordResult.data.user) {
    throw new Error("Supabase Auth aceptó una contraseña de 9 caracteres.");
  }

  const acceptedEmail = `task005-${runId}-accepted@example.test`;
  const acceptedPasswordResult = await createUser(acceptedEmail, lowercasePassword(10));
  if (acceptedPasswordResult.error || !acceptedPasswordResult.data.user) {
    throw new Error(
      "Supabase Auth rechazó una contraseña lowercase de 10 caracteres sin composición requerida.",
      { cause: acceptedPasswordResult.error },
    );
  }

  const defaultRedirect = await recoveryRedirect(acceptedEmail);
  if (defaultRedirect !== expectedSiteUrl) {
    throw new Error("La Site URL efectiva de Auth no coincide con localhost:3000.");
  }

  for (const expectedRedirect of expectedRedirectUrls) {
    const effectiveRedirect = await recoveryRedirect(acceptedEmail, expectedRedirect);
    if (effectiveRedirect !== normalizedUrl(expectedRedirect)) {
      throw new Error("Una Redirect URL requerida no está permitida efectivamente.");
    }
  }

  const disallowedRedirect = "https://invalid.example.test/auth/callback";
  const effectiveDisallowedRedirect = await recoveryRedirect(acceptedEmail, disallowedRedirect);
  if (effectiveDisallowedRedirect === normalizedUrl(disallowedRedirect)) {
    throw new Error("Auth aceptó una Redirect URL externa no configurada.");
  }

  console.log(
    "Configuración Auth DEV verificada: signup OFF, password mínimo 10 sin composición, Site URL y redirects exactos.",
  );
} finally {
  const cleanupErrors = [];
  for (const userId of [...createdUserIds].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && error.status !== 404) cleanupErrors.push(error);
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "El cleanup de verificación Auth DEV falló.");
  }
  console.log("Auth configuration fixtures cleanup verified.");
}
