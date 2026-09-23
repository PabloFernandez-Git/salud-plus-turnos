import { createClient } from "@supabase/supabase-js";
import {
  assertLinkedSupabaseProject,
  loadLocalEnv,
  loadSupabaseDevConfig,
} from "./lib/supabase-dev-env.mjs";

const expectedConfirmation = "BOOTSTRAP_PLATFORM_ADMIN_ON_ehllxymqyzrofydrvtzo";

loadLocalEnv();
const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es requerida para el bootstrap manual.`);
  return value;
}

if (requireValue("SUPABASE_BOOTSTRAP_CONFIRMATION") !== expectedConfirmation) {
  throw new Error("La confirmación exacta del bootstrap de plataforma DEV no coincide.");
}

const secretKey = requireValue("SUPABASE_SECRET_KEY");
const operationId = requireValue("SUPABASE_BOOTSTRAP_OPERATION_ID");
const email = requireValue("BOOTSTRAP_PLATFORM_ADMIN_EMAIL").toLowerCase();
const password = requireValue("BOOTSTRAP_PLATFORM_ADMIN_PASSWORD");
const firstName = requireValue("BOOTSTRAP_PLATFORM_ADMIN_FIRST_NAME");
const lastName = requireValue("BOOTSTRAP_PLATFORM_ADMIN_LAST_NAME");

if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)
) {
  throw new Error("SUPABASE_BOOTSTRAP_OPERATION_ID debe ser un UUID estable para este intento.");
}
if (password.length < 10) {
  throw new Error("BOOTSTRAP_PLATFORM_ADMIN_PASSWORD debe tener al menos 10 caracteres.");
}

const admin = createClient(dev.url, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function prepareOperation() {
  const { data, error } = await admin
    .rpc("prepare_platform_admin_bootstrap_operation", {
      p_email: email,
      p_first_name: firstName,
      p_last_name: lastName,
      p_operation_id: operationId,
    })
    .single();
  if (error) throw error;
  return data;
}

async function reconcileOperation() {
  const { data, error } = await admin
    .rpc("reconcile_auth_provisioning_operation", {
      p_operation_id: operationId,
      p_payload_hash: payloadHash,
    })
    .single();
  if (error) throw error;
  return data;
}

async function markCompensation(authUserId, compensated) {
  const { error } = await admin.rpc("mark_auth_provisioning_compensation", {
    p_auth_user_id: authUserId,
    p_compensated: compensated,
    p_operation_id: operationId,
    p_payload_hash: payloadHash,
  });
  if (error) throw error;
}

const prepared = await prepareOperation();
const payloadHash = prepared.payload_hash;
if (prepared.operation_status === "SUCCEEDED") {
  console.log(`Bootstrap PLATFORM_ADMIN DEV ya confirmado. Operation ID: ${operationId}`);
  process.exit(0);
}

for (const table of ["platform_admins", "users", "centers", "center_memberships"]) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`No se pudo verificar la precondición de ${table}.`);
  if (count !== 0) throw new Error("La plataforma ya está inicializada; bootstrap rechazado.");
}

let authUserId = prepared.auth_user_id;
let authUserWasCreated = prepared.auth_user_was_created;

if (authUserId) {
  const { data, error } = await admin.auth.admin.getUserById(authUserId);
  if (error || data.user?.email?.trim().toLowerCase() !== email || authUserWasCreated !== true) {
    throw new Error(`Bootstrap requiere reconciliación. Operation ID: ${operationId}`, {
      cause: error,
    });
  }
} else {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provisioning_operation_id: operationId },
  });
  if (authError || !authData.user) {
    throw new Error("No se pudo crear la identidad Auth para el bootstrap.", { cause: authError });
  }
  authUserId = authData.user.id;
  authUserWasCreated = true;

  const { error: bindError } = await admin.rpc("bind_auth_provisioning_operation", {
    p_auth_user_id: authUserId,
    p_auth_user_was_created: true,
    p_operation_id: operationId,
    p_payload_hash: payloadHash,
  });
  if (bindError) {
    let reconciled;
    try {
      reconciled = await reconcileOperation();
    } catch (reconciliationError) {
      throw new Error(`Bootstrap indeterminado; Auth preservado. Operation ID: ${operationId}`, {
        cause: new AggregateError([bindError, reconciliationError]),
      });
    }
    if (reconciled.auth_user_id !== authUserId || reconciled.auth_user_was_created !== true) {
      throw new Error(`Bootstrap indeterminado; Auth preservado. Operation ID: ${operationId}`, {
        cause: bindError,
      });
    }
  }
}

try {
  const { data: bootstrapRows, error: bootstrapError } = await admin.rpc(
    "bootstrap_platform_admin",
    {
      p_auth_user_id: authUserId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_operation_id: operationId,
    },
  );
  if (bootstrapError || bootstrapRows?.length !== 1) {
    throw new Error("La llamada PostgreSQL de bootstrap no confirmó respuesta.", {
      cause: bootstrapError,
    });
  }

  console.log(`Bootstrap PLATFORM_ADMIN DEV completado. Operation ID: ${operationId}`);
} catch (databaseError) {
  let reconciled;
  try {
    reconciled = await reconcileOperation();
  } catch (reconciliationError) {
    throw new Error(`Bootstrap indeterminado; Auth preservado. Operation ID: ${operationId}`, {
      cause: new AggregateError([databaseError, reconciliationError]),
    });
  }

  if (reconciled.operation_status === "SUCCEEDED") {
    console.log(
      `Bootstrap PLATFORM_ADMIN DEV confirmado por reconciliación. Operation ID: ${operationId}`,
    );
    process.exit(0);
  }

  if (
    !authUserWasCreated ||
    reconciled.auth_user_id !== authUserId ||
    reconciled.auth_user_was_created !== true ||
    !["AUTH_READY", "COMPENSATION_REQUIRED"].includes(reconciled.operation_status)
  ) {
    throw new Error(
      `Bootstrap requiere reconciliación; Auth preservado. Operation ID: ${operationId}`,
      {
        cause: databaseError,
      },
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId);
  if (deleteError) {
    try {
      await markCompensation(authUserId, false);
    } catch (markError) {
      throw new Error(
        `Bootstrap indeterminado; Auth preservado y estado pendiente. Operation ID: ${operationId}`,
        { cause: new AggregateError([databaseError, deleteError, markError]) },
      );
    }
    throw new Error(
      `Bootstrap sin acceso DB pero con Auth huérfano reconciliable. Operation ID: ${operationId}`,
      { cause: new AggregateError([databaseError, deleteError]) },
    );
  }

  try {
    await markCompensation(authUserId, true);
  } catch (markError) {
    throw new Error(
      `Bootstrap compensado pero requiere reconciliación. Operation ID: ${operationId}`,
      {
        cause: new AggregateError([databaseError, markError]),
      },
    );
  }

  throw new Error(`Bootstrap revertido mediante compensación. Operation ID: ${operationId}`, {
    cause: databaseError,
  });
}
