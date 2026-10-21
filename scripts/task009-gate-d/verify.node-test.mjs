import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  expectedMigrations,
  expectedAppointmentRpcs,
  expectedOutput,
  loadAppointmentAdapter,
  localChecks,
  loopbackConnection,
  verifyCatalog,
  verifyMigrationInventory,
  verifySqlBoundary,
  verifyTypescriptContract,
} from "./verify.mjs";

const sql = readFileSync(resolve("supabase/migrations", expectedMigrations.at(-1)), "utf8");
const types = readFileSync(resolve("src/lib/supabase/database.types.ts"), "utf8");
const adapter = readFileSync(resolve("src/modules/appointments/server/appointment-rpc.ts"), "utf8");
const selector = readFileSync(
  resolve("src/modules/appointments/components/booking-selector.tsx"),
  "utf8",
);

test("current 23 migrations and six-column consumers pass", async () => {
  assert.equal((await localChecks()).length, 23);
});

test("migration inventory fails on a missing, extra or reordered version", () => {
  for (const names of [
    expectedMigrations.slice(1),
    [...expectedMigrations, "20261019180000_unreviewed.sql"],
    expectedMigrations.map((name, i) => (i === 22 ? "20261019160000_wrong_order.sql" : name)),
  ]) {
    assert.throws(() => verifyMigrationInventory(names), /migration inventory\/order differs/);
  }
});

test("SQL boundary fails without explicit transaction or service_role revoke", () => {
  assert.throws(() => verifySqlBoundary(sql.replace("begin;", "")));
  assert.throws(() => verifySqlBoundary(sql.replace("commit;", "")));
  assert.throws(() =>
    verifySqlBoundary(sql.replace("authenticated, service_role", "authenticated")),
  );
});

test("TypeScript contract fails when a civil field is absent or wrongly typed", async () => {
  await assert.rejects(
    verifyTypescriptContract(types.replace("local_end_date: string;", ""), adapter, selector),
  );
  await assert.rejects(
    verifyTypescriptContract(
      types.replace("local_end_date: string;", "local_end_date: number;"),
      adapter,
      selector,
    ),
  );
  await assert.rejects(
    verifyTypescriptContract(
      types,
      adapter.replace("local_end_date: localDateSchema,", ""),
      selector,
    ),
  );
});

test("slot validator rejects reviewer z.any mutation and equivalent permissive schemas", async () => {
  for (const replacement of [
    "z.any()",
    "z.unknown()",
    "z.string()",
    "z.coerce.string()",
    "z.string().regex(/^\\d\\d:\\d\\d$/)",
  ]) {
    const mutated = adapter.replace(
      "local_start_time: localStartTimeSchema,",
      `local_start_time: ${replacement},`,
    );
    assert.notEqual(mutated, adapter);
    await assert.rejects(
      verifyTypescriptContract(types, mutated, selector),
      /local_start_time accepts invalid civil time/,
      replacement,
    );
  }
  const tooNarrow = adapter.replace(
    "local_start_time: localStartTimeSchema,",
    'local_start_time: z.literal("00:00"),',
  );
  await assert.rejects(
    verifyTypescriptContract(types, tooNarrow, selector),
    /local_start_time rejects/,
  );
  await assert.rejects(
    verifyTypescriptContract(
      types,
      adapter.replace("return rows(data, slotSchema);", "return rows(data, z.any());"),
      selector,
    ),
    /searchAppointmentSlots accepts invalid local_start_time/,
  );
  await assert.doesNotReject(verifyTypescriptContract(types, adapter, selector));
});

function withOptionalSlotSchema(value) {
  const mutated = adapter.replace(
    '  args: Args<"staff_search_appointment_slots">,\n) {',
    `  args: Args<"staff_search_appointment_slots">,\n  slotSchema = ${value},\n) {`,
  );
  assert.notEqual(mutated, adapter);
  return mutated;
}

test("normal two-argument slot search uses its real bindings and rejects optional shadowing", async () => {
  const malformed = [
    {
      starts_at: "2026-10-19T14:00:00+00:00",
      ends_at: "2026-10-19T14:30:00+00:00",
      local_date: "2026-10-19",
      local_start_time: "00:60",
      local_end_date: "2026-10-19",
      local_end_time: "00:30",
    },
  ];
  const client = { rpc: async () => ({ data: malformed, error: null }) };
  await assert.rejects(loadAppointmentAdapter(adapter).searchAppointmentSlots(client, {}));
  for (const replacement of ["z.any()", "z.unknown()", "z.object({})"]) {
    const mutated = withOptionalSlotSchema(replacement);
    await assert.doesNotReject(loadAppointmentAdapter(mutated).searchAppointmentSlots(client, {}));
    await assert.rejects(
      verifyTypescriptContract(types, mutated, selector),
      /searchAppointmentSlots (accepts invalid local_start_time|does not preserve the valid six-column slot)/,
      replacement,
    );
  }
  const destructured = withOptionalSlotSchema("z.any()").replace(
    "  slotSchema = z.any(),",
    "  { slotSchema } = { slotSchema: z.any() },",
  );
  await assert.doesNotReject(
    loadAppointmentAdapter(destructured).searchAppointmentSlots(client, {}),
  );
  await assert.rejects(
    verifyTypescriptContract(types, destructured, selector),
    /searchAppointmentSlots accepts invalid local_start_time/,
  );
  await assert.doesNotReject(verifyTypescriptContract(types, adapter, selector));
});

test("local rows bypass and direct return cannot pass the effective adapter contract", async () => {
  const malformed = [
    {
      starts_at: "2026-10-19T14:00:00+00:00",
      ends_at: "2026-10-19T14:30:00+00:00",
      local_date: "2026-10-19",
      local_start_time: "00:60",
      local_end_date: "2026-10-19",
      local_end_time: "00:30",
    },
  ];
  for (const replacement of [
    "function rows<T>(value: unknown, _schema: z.ZodType<T>): T[] { return value as T[]; }\n  return rows(data, slotSchema);",
    "return data;",
  ]) {
    const mutated = adapter.replace("return rows(data, slotSchema);", replacement);
    assert.notEqual(mutated, adapter);
    const accepted = await loadAppointmentAdapter(mutated).searchAppointmentSlots(
      { rpc: async () => ({ data: malformed, error: null }) },
      {},
    );
    assert.equal(accepted[0].local_start_time, "00:60");
    await assert.rejects(
      verifyTypescriptContract(types, mutated, selector),
      /searchAppointmentSlots accepts invalid local_start_time/,
    );
  }
});

function catalogClient({
  extraGrantee,
  inheritor,
  setter,
  infrastructureEdge,
  infrastructureRole,
  hosted = false,
  cliPresent = false,
  hostedEdge,
  hostedReachability,
  postgresPath,
  extraInfrastructureEdge,
  extraSuperuser,
  serviceCanSet = false,
  grantOption = false,
  defaultPublic = false,
} = {}) {
  const grantees = [
    "authenticated",
    "postgres",
    ...(extraGrantee ? [extraGrantee] : []),
    ...(defaultPublic ? ["PUBLIC"] : []),
  ].sort();
  const fn = {
    signature: "staff_search_appointment_slots(uuid,uuid,uuid,date)",
    prosecdef: true,
    proconfig: ['search_path=""'],
    owner: "postgres",
    result_type:
      "TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone, local_date date, local_start_time text, local_end_date date, local_end_time text)",
    acl: defaultPublic
      ? null
      : `{postgres=X/postgres,authenticated=X/postgres${extraGrantee ? `,${extraGrantee}=X/postgres` : ""}}`,
    execute_acl: grantees.map((grantee) => ({
      grantee,
      grantable: grantOption && grantee === "authenticated",
    })),
    authenticated_execute: true,
    anon_execute: false,
    service_role_execute: false,
    public_execute: false,
    output: expectedOutput,
  };
  const roles = [
    {
      rolname: "anon",
      rolsuper: false,
      inherited_by_service_role: false,
      inherits_authenticated: false,
      can_set_authenticated: false,
    },
    {
      rolname: "authenticated",
      rolsuper: false,
      inherited_by_service_role: false,
      inherits_authenticated: true,
      can_set_authenticated: true,
    },
    {
      rolname: "service_role",
      rolsuper: false,
      inherited_by_service_role: true,
      inherits_authenticated: false,
      can_set_authenticated: serviceCanSet,
    },
  ];
  const infrastructureRoles = [
    "authenticator",
    ...(hosted && cliPresent ? ["cli_login_postgres"] : []),
    ...(hosted ? ["supabase_realtime_admin"] : []),
    "supabase_storage_admin",
  ].map((rolname) => ({
    rolname,
    rolcanlogin: rolname !== "supabase_realtime_admin",
    rolsuper: false,
    rolbypassrls: false,
    rolinherit: false,
    inherits_authenticated: false,
    can_set_authenticated: true,
  }));
  if (infrastructureRole)
    Object.assign(
      infrastructureRoles.find((r) => r.rolname === infrastructureRole.rolname) ??
        infrastructureRoles.at(-1),
      infrastructureRole,
    );
  const infrastructureEdges = [
    { member: "authenticator", granted_role: "anon" },
    { member: "authenticator", granted_role: "authenticated" },
    { member: "authenticator", granted_role: "service_role" },
    ...(hosted && cliPresent ? [{ member: "cli_login_postgres", granted_role: "postgres" }] : []),
    ...(hosted
      ? [
          { member: "supabase_realtime_admin", granted_role: "anon" },
          { member: "supabase_realtime_admin", granted_role: "authenticated" },
          { member: "supabase_realtime_admin", granted_role: "service_role" },
        ]
      : []),
    { member: "supabase_storage_admin", granted_role: "authenticator" },
  ].map((edge) => ({
    ...edge,
    grantor: "supabase_admin",
    admin_option: false,
    inherit_option: false,
    set_option: true,
  }));
  if (infrastructureEdge) Object.assign(infrastructureEdges.at(-1), infrastructureEdge);
  if (hostedEdge)
    Object.assign(
      infrastructureEdges.find((e) => e.member === hostedEdge.member),
      hostedEdge,
    );
  if (extraInfrastructureEdge) infrastructureEdges.push(extraInfrastructureEdge);
  return {
    async query(sql) {
      if (sql.includes("select version from supabase_migrations")) {
        return { rows: expectedMigrations.map((name) => ({ version: name.slice(0, 14) })) };
      }
      if (
        sql.includes("select p.oid::regprocedure::text as signature") &&
        !sql.includes("p.prosecdef")
      ) {
        return { rows: expectedAppointmentRpcs.map((signature) => ({ signature })) };
      }
      if (sql.includes("p.prosecdef")) return { rows: [structuredClone(fn)] };
      if (sql.includes("select r.rolname,r.rolsuper")) return { rows: structuredClone(roles) };
      if (sql.includes("select r.rolname from pg_roles") && sql.includes("'SET'")) {
        return { rows: setter ? [{ rolname: setter }] : [] };
      }
      if (sql.includes("select r.rolname from pg_roles") && sql.includes("'USAGE'")) {
        return { rows: inheritor ? [{ rolname: inheritor }] : [] };
      }
      if (sql.includes("select rolname from pg_roles where rolsuper")) {
        return {
          rows: ["supabase_admin", ...(extraSuperuser ? [extraSuperuser] : [])].map((rolname) => ({
            rolname,
          })),
        };
      }
      if (sql.includes("r.rolcanlogin")) {
        return { rows: structuredClone(infrastructureRoles) };
      }
      if (sql.includes("as inherits_granted_role")) {
        return {
          rows:
            hostedReachability ??
            [
              ...(cliPresent ? [{ member: "cli_login_postgres", granted_role: "postgres" }] : []),
              { member: "supabase_realtime_admin", granted_role: "anon" },
              { member: "supabase_realtime_admin", granted_role: "authenticated" },
              { member: "supabase_realtime_admin", granted_role: "service_role" },
            ].map((edge) => ({
              ...edge,
              inherits_granted_role: false,
              can_set_granted_role: true,
            })),
        };
      }
      if (sql.includes("from pg_auth_members") && sql.includes("m.rolname='postgres'")) {
        return {
          rows: [postgresPath ?? { admin_option: true, inherit_option: true, set_option: true }],
        };
      }
      if (sql.includes("from pg_auth_members")) {
        return { rows: structuredClone(infrastructureEdges) };
      }
      if (sql.includes("from pg_class c")) {
        return { rows: [{ rls: true, policies: 0, authenticated_access: false }] };
      }
      throw new Error(`Unexpected catalog query: ${sql.slice(0, 80)}`);
    },
  };
}

test("catalog ACL rejects reviewer's extra EXECUTE grantee and other unauthorized grants", async () => {
  const versions = expectedMigrations.map((name) => name.slice(0, 14));
  await assert.doesNotReject(verifyCatalog(catalogClient(), versions));
  for (const extraGrantee of ["unreviewed_role", "PUBLIC", "anon", "service_role"]) {
    await assert.rejects(
      verifyCatalog(catalogClient({ extraGrantee }), versions),
      /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
      extraGrantee,
    );
  }
  await assert.rejects(
    verifyCatalog(catalogClient({ grantOption: true }), versions),
    /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  );
  await assert.rejects(
    verifyCatalog(catalogClient({ defaultPublic: true }), versions),
    /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  );
});

test("catalog ACL rejects inherited EXECUTE and service_role SET path", async () => {
  const versions = expectedMigrations.map((name) => name.slice(0, 14));
  await assert.rejects(
    verifyCatalog(catalogClient({ inheritor: "unreviewed_role" }), versions),
    /unapproved role inherits authenticated EXECUTE/,
  );
  await assert.rejects(
    verifyCatalog(catalogClient({ serviceCanSet: true }), versions),
    /service_role can SET ROLE authenticated/,
  );
});

test("catalog ACL rejects an additional SET-only path to authenticated EXECUTE", async () => {
  const versions = expectedMigrations.map((name) => name.slice(0, 14));
  await assert.doesNotReject(verifyCatalog(catalogClient(), versions));
  for (const setter of ["unreviewed_role", "transitive_unreviewed_role"]) {
    await assert.rejects(
      verifyCatalog(catalogClient({ setter }), versions),
      /unapproved role can SET ROLE authenticated EXECUTE/,
      setter,
    );
  }
  await assert.rejects(
    verifyCatalog(
      catalogClient({ inheritor: "unreviewed_role", setter: "unreviewed_role" }),
      versions,
    ),
    /unapproved role inherits authenticated EXECUTE/,
  );
});

test("catalog ACL accepts only the exact Supabase infrastructure membership path", async () => {
  const versions = expectedMigrations.map((name) => name.slice(0, 14));
  await assert.doesNotReject(verifyCatalog(catalogClient(), versions));
  await assert.rejects(
    verifyCatalog(
      catalogClient({ infrastructureEdge: { granted_role: "authenticated" } }),
      versions,
    ),
    /approved infrastructure role membership graph differs/,
  );
  await assert.rejects(
    verifyCatalog(catalogClient({ infrastructureEdge: { inherit_option: true } }), versions),
    /approved infrastructure role membership graph differs/,
  );
  await assert.rejects(
    verifyCatalog(catalogClient({ infrastructureRole: { rolsuper: true } }), versions),
    /approved infrastructure role attributes or effective paths differ/,
  );
  await assert.rejects(
    verifyCatalog(catalogClient({ extraSuperuser: "task009_unreviewed_role" }), versions),
    /unapproved superuser role/,
  );
});

test("DEV hosted profile accepts the recorded graph with or without the optional CLI role", async () => {
  const versions = expectedMigrations.map((name) => name.slice(0, 14));
  for (const cliPresent of [false, true]) {
    await assert.doesNotReject(
      verifyCatalog(catalogClient({ hosted: true, cliPresent }), versions, "dev-hosted"),
    );
  }
  await assert.rejects(
    verifyCatalog(catalogClient({ hosted: true, cliPresent: true }), versions),
    /approved infrastructure role attributes or effective paths differ/,
  );
  await assert.rejects(
    verifyCatalog(catalogClient(), versions, "dev-hosted"),
    /approved infrastructure role attributes or effective paths differ/,
  );
});

test("DEV hosted profile rejects role impersonation and membership drift", async () => {
  const versions = expectedMigrations.map((name) => name.slice(0, 14));
  const hostedClient = (options) => catalogClient({ hosted: true, cliPresent: true, ...options });
  for (const role of ["cli_login_postgres", "supabase_realtime_admin"]) {
    for (const attribute of [
      { rolinherit: true },
      { inherits_authenticated: true },
      { can_set_authenticated: false },
      { rolbypassrls: true },
      { rolcanlogin: role === "supabase_realtime_admin" },
    ]) {
      await assert.rejects(
        verifyCatalog(
          hostedClient({ infrastructureRole: { rolname: role, ...attribute } }),
          versions,
          "dev-hosted",
        ),
        /approved infrastructure role attributes or effective paths differ/,
      );
    }
    for (const edgeChange of [
      { inherit_option: true },
      { admin_option: true },
      { set_option: false },
      { grantor: "postgres" },
      { granted_role: "task009_unreviewed_role" },
    ]) {
      await assert.rejects(
        verifyCatalog(
          hostedClient({ hostedEdge: { member: role, ...edgeChange } }),
          versions,
          "dev-hosted",
        ),
        /approved infrastructure role membership graph differs/,
      );
    }
    await assert.rejects(
      verifyCatalog(
        hostedClient({
          extraInfrastructureEdge: {
            member: role,
            granted_role: "task009_unreviewed_role",
            grantor: "supabase_admin",
            admin_option: false,
            inherit_option: false,
            set_option: true,
          },
        }),
        versions,
        "dev-hosted",
      ),
      /approved infrastructure role membership graph differs/,
    );
  }
  await assert.rejects(
    verifyCatalog(
      hostedClient({
        postgresPath: { admin_option: false, inherit_option: true, set_option: true },
      }),
      versions,
      "dev-hosted",
    ),
    /CLI route through postgres to authenticated differs/,
  );
  await assert.rejects(
    verifyCatalog(
      hostedClient({
        hostedReachability: [
          {
            member: "cli_login_postgres",
            granted_role: "postgres",
            inherits_granted_role: true,
            can_set_granted_role: true,
          },
        ],
      }),
      versions,
      "dev-hosted",
    ),
    /approved hosted role USAGE\/SET paths differ/,
  );
  await assert.rejects(
    verifyCatalog(hostedClient({ setter: "task009_role_impersonator" }), versions, "dev-hosted"),
    /unapproved role can SET ROLE authenticated EXECUTE/,
  );
  await assert.rejects(
    verifyCatalog(hostedClient({ inheritor: "supabase_realtime_admin" }), versions, "dev-hosted"),
    /unapproved role inherits authenticated EXECUTE/,
  );
  await assert.rejects(
    verifyCatalog(
      hostedClient({ extraGrantee: "task009_unreviewed_role" }),
      versions,
      "dev-hosted",
    ),
    /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  );
  await assert.rejects(
    verifyCatalog(hostedClient({ grantOption: true }), versions, "dev-hosted"),
    /slot RPC EXECUTE ACL contains a missing\/unapproved grantee or GRANT OPTION/,
  );
});

test("database verifier rejects a non-loopback target", () => {
  assert.throws(
    () => loopbackConnection("postgres://postgres@db.example.com/postgres"),
    /loopback/,
  );
  assert.throws(() => loopbackConnection("postgres://postgres@127.0.0.1/not-postgres"));
});
