import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

// This file is a read-only capture tool. It never selects Auth credentials or tokens.
const baselineVersion = "TASK-007A-DEV-STABLE-DATA-V2";
const manifestPath = resolve(".harness/tasks/active/TASK-007/baseline-v2-manifest.json");
const verifierSha256 = sha(readFileSync(fileURLToPath(import.meta.url)));
const expectedCenterId = "76dcbe41-38be-475d-a590-f4ae6619c1e8";
const expectedOperationIds = [
  "352a309e-f137-488e-b6e7-4b53e2cdb7b2",
  "964ec4bf-eeba-4f4f-914a-d2a8ca101934",
];

const auth = {
  "auth.users": {
    included: [
      "instance_id",
      "id",
      "aud",
      "role",
      "email",
      "email_confirmed_at",
      "invited_at",
      "raw_app_meta_data",
      "raw_user_meta_data",
      "is_super_admin",
      "created_at",
      "phone",
      "phone_confirmed_at",
      "phone_change",
      "confirmed_at",
      "email_change",
      "email_change_confirm_status",
      "banned_until",
      "is_sso_user",
      "deleted_at",
      "is_anonymous",
    ],
    excluded: {
      encrypted_password: [
        "Password verifier",
        "Credential material; a password rotation does not change account identity.",
      ],
      confirmation_token: [
        "Email confirmation token",
        "One-time credential; renewal does not change account identity.",
      ],
      confirmation_sent_at: [
        "Confirmation delivery timestamp",
        "Auth delivery activity; does not change confirmation state or identity.",
      ],
      recovery_token: [
        "Password recovery token",
        "One-time credential; renewal does not change account identity.",
      ],
      recovery_sent_at: [
        "Recovery delivery timestamp",
        "Auth delivery activity; does not change account identity.",
      ],
      email_change_token_new: [
        "Pending email change token",
        "One-time credential; the pending address and state are included separately.",
      ],
      email_change_sent_at: [
        "Email change delivery timestamp",
        "Auth delivery activity; pending address/state remain included.",
      ],
      last_sign_in_at: [
        "Last successful sign-in timestamp",
        "Login activity; does not change persistent user identity or product role.",
      ],
      updated_at: [
        "Auth row maintenance timestamp",
        "Auth service writes can advance it without changing included identity/state fields.",
      ],
      phone_change_token: [
        "Pending phone change token",
        "One-time credential; pending phone value is included separately.",
      ],
      phone_change_sent_at: [
        "Phone change delivery timestamp",
        "Auth delivery activity; pending phone value remains included.",
      ],
      email_change_token_current: [
        "Current email change token",
        "One-time credential; pending address/state remain included.",
      ],
      reauthentication_token: [
        "Reauthentication token",
        "One-time credential; renewal does not change account identity.",
      ],
      reauthentication_sent_at: [
        "Reauthentication delivery timestamp",
        "Auth delivery activity; does not change account identity.",
      ],
    },
    key: ["id"],
  },
  "auth.identities": {
    included: ["id", "provider_id", "user_id", "provider", "created_at", "email"],
    excluded: {
      identity_data: [
        "Provider supplied profile/claim payload",
        "Provider profile claims can refresh independently; provider_id, user_id, provider and email preserve identity topology.",
      ],
      last_sign_in_at: [
        "Last provider sign-in timestamp",
        "Login activity; does not change identity association or provider.",
      ],
      updated_at: [
        "Provider identity maintenance timestamp",
        "Auth service writes can advance it without changing included topology fields.",
      ],
    },
    key: ["id"],
  },
};

const components = [
  "auth.users",
  "auth.identities",
  "public.users",
  "public.platform_admins",
  "public.centers",
  "public.center_memberships",
  "public.professionals",
  "public.professional_centers",
  "public.specialties",
  "public.professional_center_specialties",
  "public.persons",
  "public.patient_centers",
  "public.availabilities",
  "public.appointments",
  "private.provisioning_operations",
];
const compoundKeys = {
  "public.platform_admins": ["user_id"],
  "public.professional_center_specialties": ["professional_center_id", "specialty_id"],
};

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function serialized(value) {
  return JSON.stringify(canonical(value)); // UTF-8 bytes are hashed by node:crypto.
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function quote(identifier) {
  assert(/^[a-z_][a-z0-9_]*$/.test(identifier), "Unexpected catalog identifier");
  return `"${identifier}"`;
}

const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
const cli = resolve("node_modules/supabase/dist/supabase.js");
const output = execFileSync(
  process.execPath,
  [cli, "db", "dump", "--linked", "--dry-run", "--schema", "public"],
  {
    encoding: "utf8",
    env: { ...process.env, CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
const config = Object.fromEntries(
  [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
);
const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
assert(
  config.PGHOST === `db.${dev.projectRef}.supabase.co` ||
    (config.PGHOST === pooler.hostname && config.PGUSER?.endsWith(`.${dev.projectRef}`)),
  "Database target is not approved DEV.",
);

function clientForRead() {
  return new pg.Client({
    host: config.PGHOST,
    port: Number(config.PGPORT),
    database: config.PGDATABASE,
    user: config.PGUSER,
    password: config.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    application_name: "task007a-baseline-v2-readonly",
  });
}

async function capture() {
  const client = clientForRead();
  const sourceRows = {};
  const evidence = {};
  try {
    await client.connect();
    await client.query("begin transaction isolation level repeatable read read only");
    await client.query("set local role postgres");
    await client.query("set local time zone 'UTC'");
    for (const component of components) {
      const [schema, table] = component.split(".");
      const catalog = await client.query(
        `
        select column_name, data_type from information_schema.columns
        where table_schema = $1 and table_name = $2 order by ordinal_position`,
        [schema, table],
      );
      const allFields = catalog.rows.map((row) => row.column_name);
      assert(allFields.length > 0, `${component}: no catalog columns`);
      const included = auth[component]?.included ?? allFields;
      const excluded = auth[component]?.excluded ?? {};
      assert(
        serialized([...included, ...Object.keys(excluded)].sort()) ===
          serialized([...allFields].sort()),
        `${component}: unclassified, duplicate or missing fields`,
      );
      const key = auth[component]?.key ?? compoundKeys[component] ?? ["id"];
      assert(
        key.every((field) => included.includes(field)),
        `${component}: key not included`,
      );
      const result = await client.query(
        `select to_jsonb(record) as value from (select ${included.map(quote).join(", ")} from ${quote(schema)}.${quote(table)}) as record`,
      );
      sourceRows[component] = result.rows.map((item) => item.value);
      const rows = sourceRows[component]
        .map((row) => {
          const rowKey = sha(serialized(key.map((field) => [field, row[field] ?? null])));
          const fieldHashes = Object.fromEntries(
            included.map((field) => {
              assert(Object.hasOwn(row, field), `${component}: selected field missing`);
              const dataType = catalog.rows.find((item) => item.column_name === field).data_type;
              return [field, sha(serialized({ data_type: dataType, value: row[field] }))];
            }),
          );
          return { row_key_sha256: rowKey, field_sha256: fieldHashes };
        })
        .sort((a, b) => a.row_key_sha256.localeCompare(b.row_key_sha256, "en"));
      assert(
        new Set(rows.map((row) => row.row_key_sha256)).size === rows.length,
        `${component}: duplicate row key`,
      );
      evidence[component] = {
        row_count: rows.length,
        included_fields: included,
        excluded_fields: Object.fromEntries(
          Object.entries(excluded).map(([field, [semantic_purpose, exclusion_justification]]) => [
            field,
            { semantic_purpose, exclusion_justification },
          ]),
        ),
        field_types: Object.fromEntries(
          catalog.rows
            .filter((item) => included.includes(item.column_name))
            .map((item) => [item.column_name, item.data_type]),
        ),
        row_key_fields: key,
        rows,
        component_sha256: sha(serialized(rows)),
      };
    }
    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
  const globalSha256 = sha(
    serialized(
      components.map((name) => [name, evidence[name].row_count, evidence[name].component_sha256]),
    ),
  );
  return { sourceRows, evidence, globalSha256 };
}

function verifyDomain(rows) {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const one = (name) => rows[name][0];
  for (const name of components) {
    const expected =
      name === "private.provisioning_operations"
        ? 2
        : [
              "auth.users",
              "auth.identities",
              "public.users",
              "public.platform_admins",
              "public.centers",
              "public.center_memberships",
            ].includes(name)
          ? 1
          : 0;
    check(rows[name].length === expected, `${name}: expected ${expected} rows`);
  }
  const authUser = one("auth.users");
  const identity = one("auth.identities");
  const appUser = one("public.users");
  const admin = one("public.platform_admins");
  const center = one("public.centers");
  const membership = one("public.center_memberships");
  const operations = rows["private.provisioning_operations"];
  check(
    Boolean(authUser?.id && appUser?.id === authUser.id && admin?.user_id === authUser.id),
    "bootstrap Auth/User/PLATFORM_ADMIN identity linkage",
  );
  check(
    Boolean(
      identity?.user_id === authUser?.id &&
      identity?.provider === "email" &&
      identity?.provider_id === authUser?.id,
    ),
    "Auth identity-to-user/provider topology",
  );
  check(
    Boolean(
      authUser?.email &&
      identity?.email?.toLowerCase() === authUser.email.toLowerCase() &&
      appUser?.email === authUser.email.toLowerCase(),
    ),
    "bootstrap email projection/topology",
  );
  check(
    Boolean(
      center?.id === expectedCenterId &&
      center?.name === "Centro Médico Salud Plus" &&
      center?.timezone === "America/Argentina/Buenos_Aires" &&
      center?.is_active === true,
    ),
    "approved Center identity/state",
  );
  check(
    Boolean(
      membership?.center_id === center?.id &&
      membership?.user_id === authUser?.id &&
      membership?.role === "ADMIN" &&
      membership?.is_active === true &&
      membership?.professional_center_id === null,
    ),
    "active ADMIN membership linkage",
  );
  check(
    serialized(operations.map((row) => row.id).sort()) ===
      serialized(expectedOperationIds.slice().sort()),
    "approved provisioning operation IDs",
  );
  check(
    operations.every((row) => row.status === "SUCCEEDED"),
    "provisioning succeeded state",
  );
  const bootstrap = operations.find((row) => row.id === expectedOperationIds[0]);
  const centerCreate = operations.find((row) => row.id === expectedOperationIds[1]);
  check(
    Boolean(
      bootstrap?.operation_type === "BOOTSTRAP_PLATFORM_ADMIN" &&
      bootstrap?.result_user_id === authUser?.id &&
      bootstrap?.auth_user_id === authUser?.id,
    ),
    "bootstrap operation ownership/result",
  );
  check(
    Boolean(
      centerCreate?.operation_type === "PLATFORM_CREATE_CENTER" &&
      centerCreate?.result_center_id === center?.id &&
      centerCreate?.result_membership_id === membership?.id &&
      centerCreate?.result_user_id === authUser?.id &&
      centerCreate?.auth_user_id === authUser?.id &&
      centerCreate?.auth_user_was_created === false,
    ),
    "Center provisioning ownership/result",
  );
  return errors;
}

const read1 = await capture();
const read2 = await capture();
const mismatches = components.filter(
  (name) =>
    read1.evidence[name].component_sha256 !== read2.evidence[name].component_sha256 ||
    read1.evidence[name].row_count !== read2.evidence[name].row_count,
);
const stable = read1.globalSha256 === read2.globalSha256 && mismatches.length === 0;
const domainErrors = [...verifyDomain(read1.sourceRows), ...verifyDomain(read2.sourceRows)];
const result = {
  baseline_version: baselineVersion,
  generated_at: new Date().toISOString(),
  dev_project_ref: dev.projectRef,
  verifier_script_sha256: verifierSha256,
  serialization:
    "Fixed component and included-field order; rows sorted by SHA-256 of ordered key tuple; JSONB scalars and recursively key-sorted objects; explicit null marker; timestamptz rendered by PostgreSQL JSONB in UTC with its full stored precision; JSON.stringify UTF-8; SHA-256 lowercase hex. generated_at is outside stable digest.",
  stable_data: {
    components: read1.evidence,
    global_sha256: read1.globalSha256,
    read_1: Object.fromEntries(
      components.map((name) => [
        name,
        {
          row_count: read1.evidence[name].row_count,
          component_sha256: read1.evidence[name].component_sha256,
        },
      ]),
    ),
    read_2: Object.fromEntries(
      components.map((name) => [
        name,
        {
          row_count: read2.evidence[name].row_count,
          component_sha256: read2.evidence[name].component_sha256,
        },
      ]),
    ),
  },
  verification: {
    stable,
    mismatched_components: mismatches,
    domain_invariants_pass: domainErrors.length === 0,
    domain_errors: domainErrors,
    task007a_residual_fixtures: domainErrors.length === 0 ? 0 : "not established",
  },
};
if (stable && domainErrors.length === 0)
  writeFileSync(manifestPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
console.log(
  JSON.stringify(
    {
      manifest: stable && domainErrors.length === 0 ? manifestPath : null,
      verifier_script_sha256: verifierSha256,
      global_sha256: read1.globalSha256,
      stable,
      mismatched_components: mismatches,
      domain_errors: domainErrors,
      read_1: result.stable_data.read_1,
      read_2: result.stable_data.read_2,
    },
    null,
    2,
  ),
);
if (!stable || domainErrors.length > 0) process.exitCode = 1;
