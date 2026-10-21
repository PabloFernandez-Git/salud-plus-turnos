import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import pg from "pg";
import ts from "typescript";
import { z } from "zod";
import {
  appointmentIdSchema,
  appointmentStatusSchema,
  appointmentTimestampSchema,
  localDateSchema,
  localStartTimeSchema,
} from "../../src/modules/appointments/schemas/appointment-input.ts";

export const expectedMigrations = [
  "20260921150000_initial_domain_schema.sql",
  "20260921170000_enforce_normalized_document_not_null.sql",
  "20260921210000_use_explicit_appointment_blocking_statuses.sql",
  "20260922120000_add_user_email_and_platform_admins.sql",
  "20260922121000_add_auth_access_helpers_and_policies.sql",
  "20260922122000_add_auth_platform_center_rpcs.sql",
  "20260922123000_remove_unused_membership_lock_variable.sql",
  "20260923100000_add_provisioning_idempotency.sql",
  "20260923120000_enforce_provisioning_intent_fingerprints.sql",
  "20260924120000_add_bootstrap_platform_preflight.sql",
  "20260924140000_harden_bootstrap_final_auth_revalidation.sql",
  "20260924160000_serialize_bootstrap_auth_users.sql",
  "20260925120000_enforce_professional_membership_assignment.sql",
  "20260928120000_make_membership_stale_check_atomic.sql",
  "20261009120000_add_professional_specialty_foundation.sql",
  "20261009130000_enforce_task006_cas_monotonicity.sql",
  "20261009140000_align_professional_email_contract.sql",
  "20261013190000_add_patient_foundation.sql",
  "20261013200000_remove_patient_rpc_unused_variables.sql",
  "20261016160000_add_availability_foundation.sql",
  "20261016190000_add_appointment_foundation.sql",
  "20261019150000_add_appointment_mutations.sql",
  "20261019170000_add_appointment_slot_civil_time.sql",
];

export const expectedOutput = [
  ["starts_at", "timestamp with time zone"],
  ["ends_at", "timestamp with time zone"],
  ["local_date", "date"],
  ["local_start_time", "text"],
  ["local_end_date", "date"],
  ["local_end_time", "text"],
];

export const expectedAppointmentRpcs = [
  "professional_get_own_appointment(uuid,uuid)",
  "professional_list_own_appointments(uuid,date,date,appointment_status,timestamp with time zone,uuid,integer)",
  "staff_bookable_professional_centers_for_specialty(uuid,uuid)",
  "staff_create_appointment(uuid,uuid,uuid,uuid,date,time without time zone,text)",
  "staff_get_appointment(uuid,uuid)",
  "staff_list_appointments(uuid,date,date,appointment_status,uuid,timestamp with time zone,uuid,integer)",
  "staff_list_bookable_specialties(uuid)",
  "staff_reschedule_appointment(uuid,uuid,timestamp with time zone,uuid,uuid,date,time without time zone)",
  "staff_search_appointment_slots(uuid,uuid,uuid,date)",
  "staff_transition_appointment_status(uuid,uuid,timestamp with time zone,text)",
  "staff_update_appointment_note(uuid,uuid,timestamp with time zone,text)",
];

export function verifyMigrationInventory(names) {
  assert.deepEqual(
    names.filter((name) => name.endsWith(".sql")).sort(),
    expectedMigrations,
    "TASK-009 Gate D: migration inventory/order differs from the 23 approved files",
  );
  assert.equal(new Set(expectedMigrations.map((name) => name.slice(0, 14))).size, 23);
  return expectedMigrations.map((name) => name.slice(0, 14));
}

export function verifySqlBoundary(sql) {
  const normalized = sql.replaceAll("\r\n", "\n");
  assert.match(
    normalized,
    /^--[^\n]*\n--[^\n]*\n--[^\n]*\nbegin;\s*\ndrop function public\.staff_search_appointment_slots\(uuid,uuid,uuid,date\);/i,
  );
  assert.match(
    normalized,
    /revoke all on function public\.staff_search_appointment_slots\(uuid,uuid,uuid,date\)\s+from public, anon, authenticated, service_role;/i,
  );
  assert.match(
    normalized,
    /grant execute on function public\.staff_search_appointment_slots\(uuid,uuid,uuid,date\)\s+to authenticated;\s*commit;\s*$/i,
  );
  assert.equal((normalized.match(/\bbegin;/gi) ?? []).length, 1);
  assert.equal((normalized.match(/\bcommit;/gi) ?? []).length, 1);
}

export async function verifyTypescriptContract(types, adapter, selector) {
  const block = types.match(
    /staff_search_appointment_slots:\s*\{[\s\S]*?Returns:\s*\{([^}]+)\}\[\];/,
  );
  assert(block, "generated TypeScript slot RPC declaration missing");
  const fields = [...block[1].matchAll(/\b(\w+):\s*(\w+);/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(
    fields.map(([name]) => name).sort(),
    expectedOutput.map(([name]) => name).sort(),
    "TypeScript slot RPC fields differ from SQL output",
  );
  assert(
    fields.every(([, type]) => type === "string"),
    "TypeScript slot RPC fields must be strings",
  );
  verifySlotSchema(adapter);
  await verifySlotAdapterBehavior(adapter);
  assert.match(adapter, /client\.rpc\("staff_search_appointment_slots", args\)/);
  assert.match(selector, /local_start_time/);
  assert.match(selector, /local_end_time/);
}

export function verifySlotSchema(adapter) {
  const source = ts.createSourceFile("appointment-rpc.ts", adapter, ts.ScriptTarget.Latest, true);
  const declarations = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "slotSchema") {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(declarations.length, 1, "exactly one slotSchema declaration is required");
  assert(
    ts.isVariableStatement(declarations[0].parent.parent) &&
      declarations[0].parent.parent.parent === source &&
      (declarations[0].parent.flags & ts.NodeFlags.Const) !== 0,
    "slotSchema must be a module-level constant",
  );
  const initializer = declarations[0].initializer;
  assert(
    initializer &&
      ts.isCallExpression(initializer) &&
      initializer.expression.getText(source) === "z.object",
    "slotSchema must construct a Zod object",
  );
  const schema = vm.runInNewContext(
    `(${initializer.getText(source)})`,
    {
      z,
      timestamp: appointmentTimestampSchema,
      localDateSchema,
      localStartTimeSchema,
    },
    { timeout: 1000 },
  );
  assert(schema instanceof z.ZodType, "slotSchema must evaluate to a Zod schema");
  const valid = {
    starts_at: "2026-10-19T14:00:00+00:00",
    ends_at: "2026-10-19T14:30:00+00:00",
    local_date: "2026-10-19",
    local_start_time: "00:00",
    local_end_date: "2026-10-19",
    local_end_time: "23:59",
  };
  assert(schema.safeParse(valid).success, "slotSchema rejects a valid six-column slot");
  for (const [name] of expectedOutput) {
    const missing = { ...valid };
    delete missing[name];
    assert(!schema.safeParse(missing).success, `slotSchema accepts missing ${name}`);
  }
  for (const field of ["local_start_time", "local_end_time"]) {
    for (let hour = 0; hour < 100; hour++) {
      for (let minute = 0; minute < 100; minute++) {
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const accepted = schema.safeParse({ ...valid, [field]: time }).success;
        assert.equal(
          accepted,
          hour < 24 && minute < 60,
          `${field} ${accepted ? "accepts invalid" : "rejects valid"} civil time ${time}`,
        );
      }
    }
    for (const invalid of ["0:00", "00:0", "12:30:00", "12:30Z", "", 1230, null, {}]) {
      assert(
        !schema.safeParse({ ...valid, [field]: invalid }).success,
        `${field} accepts invalid civil time ${JSON.stringify(invalid)}`,
      );
    }
  }
  for (const field of ["local_date", "local_end_date"]) {
    for (const invalid of ["2026-02-30", "2026-2-3", "not-a-date", 20261019, null]) {
      assert(
        !schema.safeParse({ ...valid, [field]: invalid }).success,
        `${field} accepts invalid civil date ${JSON.stringify(invalid)}`,
      );
    }
  }
  for (const field of ["starts_at", "ends_at"]) {
    for (const invalid of ["2026-10-19", "not-an-instant", 0, null]) {
      assert(
        !schema.safeParse({ ...valid, [field]: invalid }).success,
        `${field} accepts invalid timestamp ${JSON.stringify(invalid)}`,
      );
    }
  }
}

export function loadAppointmentAdapter(adapter) {
  // Execute the whole adapter, including its own rows helper and lexical bindings.
  // Only external imports are substituted; product source is never rewritten.
  const javascript = ts.transpileModule(adapter, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const adapterModule = { exports: {} };
  const inputs = {
    appointmentIdSchema,
    appointmentStatusSchema,
    appointmentTimestampSchema,
    localDateSchema,
    localStartTimeSchema,
  };
  vm.runInNewContext(
    javascript,
    {
      module: adapterModule,
      exports: adapterModule.exports,
      require(specifier) {
        if (specifier === "server-only") return {};
        if (specifier === "zod") return { z };
        if (specifier === "../schemas/appointment-input") return inputs;
        throw new Error(`unexpected appointment adapter import: ${specifier}`);
      },
    },
    { timeout: 1000 },
  );
  assert.equal(
    typeof adapterModule.exports.searchAppointmentSlots,
    "function",
    "searchAppointmentSlots export is required",
  );
  return adapterModule.exports;
}

export async function verifySlotAdapterBehavior(adapter) {
  const { searchAppointmentSlots, AppointmentRpcContractError } = loadAppointmentAdapter(adapter);
  const valid = {
    starts_at: "2026-10-19T14:00:00+00:00",
    ends_at: "2026-10-19T14:30:00+00:00",
    local_date: "2026-10-19",
    local_start_time: "00:00",
    local_end_date: "2026-10-19",
    local_end_time: "23:59",
  };
  const args = { center_id: "contract-check" };
  async function search(row) {
    let called = 0;
    const result = await searchAppointmentSlots(
      {
        rpc(name, receivedArgs) {
          assert.equal(name, "staff_search_appointment_slots");
          assert.equal(receivedArgs, args);
          called++;
          return Promise.resolve({ data: [row], error: null });
        },
      },
      args,
    );
    assert.equal(called, 1, "slot RPC must be called exactly once");
    return result;
  }
  const accepted = await search(valid);
  assert.equal(accepted.length, 1, "valid slot response must reach the consumer");
  assert.deepEqual(
    { ...accepted[0] },
    valid,
    "searchAppointmentSlots does not preserve the valid six-column slot",
  );
  for (const [field, invalid] of [
    ["local_start_time", "00:60"],
    ["local_start_time", "0:00"],
    ["local_start_time", 1230],
    ["local_end_time", "24:00"],
    ["local_date", "2026-02-30"],
    ["starts_at", "not-an-instant"],
  ]) {
    await assert.rejects(
      search({ ...valid, [field]: invalid }),
      (error) => error instanceof AppointmentRpcContractError,
      `searchAppointmentSlots accepts invalid ${field}: ${JSON.stringify(invalid)}`,
    );
  }
}

export async function localChecks(root = process.cwd()) {
  const names = readdirSync(resolve(root, "supabase/migrations"));
  const versions = verifyMigrationInventory(names);
  verifySqlBoundary(
    readFileSync(resolve(root, "supabase/migrations", expectedMigrations.at(-1)), "utf8"),
  );
  await verifyTypescriptContract(
    readFileSync(resolve(root, "src/lib/supabase/database.types.ts"), "utf8"),
    readFileSync(resolve(root, "src/modules/appointments/server/appointment-rpc.ts"), "utf8"),
    readFileSync(resolve(root, "src/modules/appointments/components/booking-selector.tsx"), "utf8"),
  );
  return versions;
}

export function loopbackConnection(rawUrl) {
  assert(rawUrl, "TASK009_SHADOW_DATABASE_URL is required");
  const url = new URL(rawUrl);
  assert.equal(url.protocol, "postgres:");
  assert(["127.0.0.1", "localhost"].includes(url.hostname), "shadow must be loopback");
  assert.equal(url.username, "postgres");
  assert.equal(url.pathname, "/postgres");
  return rawUrl;
}

export async function verifyCatalog(client, versions, infrastructureProfile = "shadow") {
  assert(
    ["shadow", "dev-hosted"].includes(infrastructureProfile),
    "unknown infrastructure profile",
  );
  const hosted = infrastructureProfile === "dev-hosted";
  const infrastructureNames = [
    "authenticator",
    "supabase_storage_admin",
    ...(hosted ? ["supabase_realtime_admin", "cli_login_postgres"] : []),
  ];
  const infrastructureSqlNames = infrastructureNames.map((name) => `'${name}'`).join(",");
  const applied = (
    await client.query("select version from supabase_migrations.schema_migrations order by version")
  ).rows.map((row) => row.version);
  assert.deepEqual(applied, versions, "applied migration order differs from local files");
  const rpcSignatures = (
    await client.query(`
    select p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and
      (p.proname like '%appointment%' or p.proname like 'staff_list_bookable_%'
       or p.proname='staff_bookable_professional_centers_for_specialty')
      and p.proname <> 'staff_update_usual_appointment_duration'
    order by p.oid::regprocedure::text`)
  ).rows.map((row) => row.signature);
  assert.deepEqual(
    rpcSignatures,
    expectedAppointmentRpcs,
    "appointment RPC signatures/overloads differ",
  );
  const rows = (
    await client.query(`
    select p.oid::regprocedure::text as signature, p.prosecdef, p.proconfig,
      pg_get_userbyid(p.proowner) as owner, pg_get_function_result(p.oid) as result_type,
      p.proacl::text as acl,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        'grantable',a.is_grantable
      )
        order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end
      ),'[]'::jsonb)
       from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       where a.privilege_type='EXECUTE') as execute_acl,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute,
      coalesce((select bool_or(a.grantee=0) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),false) as public_execute,
      (select jsonb_agg(jsonb_build_array(p.proargnames[i],format_type(p.proallargtypes[i],null)) order by i)
       from generate_subscripts(p.proallargtypes,1) i where p.proargmodes[i]='t') as output
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='staff_search_appointment_slots'`)
  ).rows;
  assert.equal(rows.length, 1, "missing or overloaded slot RPC");
  const fn = rows[0];
  assert.equal(fn.signature, "staff_search_appointment_slots(uuid,uuid,uuid,date)");
  assert.deepEqual(fn.output, expectedOutput);
  assert.equal(
    fn.result_type,
    "TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone, local_date date, local_start_time text, local_end_date date, local_end_time text)",
  );
  assert.equal(fn.owner, "postgres");
  assert.equal(fn.prosecdef, true);
  assert.deepEqual(fn.proconfig, ['search_path=""']);
  assert.equal(fn.authenticated_execute, true);
  assert.deepEqual(
    fn.execute_acl,
    [
      { grantee: "authenticated", grantable: false },
      { grantee: "postgres", grantable: false },
    ],
    "slot RPC EXECUTE ACL contains a missing/unapproved grantee or GRANT OPTION",
  );
  assert.equal(fn.anon_execute, false);
  assert.equal(fn.service_role_execute, false);
  assert.equal(fn.public_execute, false);
  const roles = (
    await client.query(`
    select r.rolname,r.rolsuper,r.rolbypassrls,r.rolinherit,
      pg_has_role('service_role',r.oid,'USAGE') as inherited_by_service_role,
      pg_has_role(r.oid,'authenticated'::regrole,'USAGE') as inherits_authenticated,
      pg_has_role(r.oid,'authenticated'::regrole,'SET') as can_set_authenticated
    from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by r.rolname`)
  ).rows;
  assert.equal(roles.length, 3);
  assert.equal(roles.find((row) => row.rolname === "service_role").rolsuper, false);
  assert.equal(
    roles.find((row) => row.rolname === "authenticated").inherited_by_service_role,
    false,
  );
  for (const name of ["anon", "service_role"]) {
    const role = roles.find((row) => row.rolname === name);
    assert.equal(role.inherits_authenticated, false, `${name} inherits authenticated EXECUTE`);
    assert.equal(role.can_set_authenticated, false, `${name} can SET ROLE authenticated`);
  }
  const otherInheritors = (
    await client.query(`select r.rolname from pg_roles r
      where r.rolname not in ('postgres','authenticated') and not r.rolsuper
        and pg_has_role(r.oid,'authenticated'::regrole,'USAGE')
      order by r.rolname`)
  ).rows.map((row) => row.rolname);
  assert.deepEqual(otherInheritors, [], "unapproved role inherits authenticated EXECUTE");
  // Every excluded identity is checked against its complete role and outgoing edge profile below.
  const otherSetters = (
    await client.query(`select r.rolname from pg_roles r
      where r.rolname not in ('postgres','authenticated',${infrastructureSqlNames})
        and not r.rolsuper
        and pg_has_role(r.oid,'authenticated'::regrole,'SET')
      order by r.rolname`)
  ).rows.map((row) => row.rolname);
  assert.deepEqual(otherSetters, [], "unapproved role can SET ROLE authenticated EXECUTE");
  const superusers = (
    await client.query("select rolname from pg_roles where rolsuper order by rolname")
  ).rows.map((row) => row.rolname);
  assert.deepEqual(superusers, ["supabase_admin"], "unapproved superuser role");
  const infrastructureRoles = (
    await client.query(`select r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolinherit,
      pg_has_role(r.oid,'authenticated'::regrole,'USAGE') as inherits_authenticated,
      pg_has_role(r.oid,'authenticated'::regrole,'SET') as can_set_authenticated
      from pg_roles r where r.rolname in (${infrastructureSqlNames})
      order by r.rolname`)
  ).rows;
  const cliPresent =
    hosted && infrastructureRoles.some((row) => row.rolname === "cli_login_postgres");
  const expectedInfrastructureNames = [
    "authenticator",
    ...(cliPresent ? ["cli_login_postgres"] : []),
    ...(hosted ? ["supabase_realtime_admin"] : []),
    "supabase_storage_admin",
  ];
  assert.deepEqual(
    infrastructureRoles,
    expectedInfrastructureNames.map((rolname) => ({
      rolname,
      rolcanlogin: rolname !== "supabase_realtime_admin",
      rolsuper: false,
      rolbypassrls: false,
      rolinherit: false,
      inherits_authenticated: false,
      can_set_authenticated: true,
    })),
    "approved infrastructure role attributes or effective paths differ",
  );
  const infrastructureEdges = (
    await client.query(`select m.rolname as member,p.rolname as granted_role,
      g.rolname as grantor,a.admin_option,a.inherit_option,a.set_option
      from pg_auth_members a
      join pg_roles m on m.oid=a.member
      join pg_roles p on p.oid=a.roleid
      join pg_roles g on g.oid=a.grantor
      where m.rolname in (${infrastructureSqlNames})
      order by m.rolname,p.rolname`)
  ).rows;
  const expectedEdges = [
    { member: "authenticator", granted_role: "anon" },
    { member: "authenticator", granted_role: "authenticated" },
    { member: "authenticator", granted_role: "service_role" },
    ...(cliPresent ? [{ member: "cli_login_postgres", granted_role: "postgres" }] : []),
    ...(hosted
      ? [
          { member: "supabase_realtime_admin", granted_role: "anon" },
          { member: "supabase_realtime_admin", granted_role: "authenticated" },
          { member: "supabase_realtime_admin", granted_role: "service_role" },
        ]
      : []),
    { member: "supabase_storage_admin", granted_role: "authenticator" },
  ];
  assert.deepEqual(
    infrastructureEdges,
    expectedEdges.map((edge) => ({
      ...edge,
      grantor: "supabase_admin",
      admin_option: false,
      inherit_option: false,
      set_option: true,
    })),
    "approved infrastructure role membership graph differs",
  );
  if (hosted) {
    const hostedReachability = (
      await client.query(`select r.rolname as member,p.rolname as granted_role,
        pg_has_role(r.oid,p.oid,'USAGE') as inherits_granted_role,
        pg_has_role(r.oid,p.oid,'SET') as can_set_granted_role
        from pg_roles r cross join pg_roles p
        where (r.rolname='cli_login_postgres' and p.rolname='postgres')
           or (r.rolname='supabase_realtime_admin' and p.rolname in ('anon','authenticated','service_role'))
        order by r.rolname,p.rolname`)
    ).rows;
    assert.deepEqual(
      hostedReachability,
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
      "approved hosted role USAGE/SET paths differ",
    );
  }
  if (cliPresent) {
    const postgresPath = (
      await client.query(`select a.admin_option,a.inherit_option,a.set_option
        from pg_auth_members a
        join pg_roles m on m.oid=a.member
        join pg_roles p on p.oid=a.roleid
        where m.rolname='postgres' and p.rolname='authenticated'`)
    ).rows;
    assert.deepEqual(
      postgresPath,
      [{ admin_option: true, inherit_option: true, set_option: true }],
      "CLI route through postgres to authenticated differs",
    );
  }
  const appointment = (
    await client.query(`
    select c.relrowsecurity as rls,
      (select count(*)::integer from pg_policy q where q.polrelid=c.oid) as policies,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_access
    from pg_class c where c.oid='public.appointments'::regclass`)
  ).rows[0];
  assert(appointment.rls && appointment.policies === 0 && !appointment.authenticated_access);
  return {
    signature: fn.signature,
    output: fn.output,
    acl: fn.acl,
    roles,
    rls: appointment,
    infrastructureProfile,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const versions = await localChecks();
  if (process.argv[2] === "--local") {
    console.log(
      JSON.stringify({ result: "TASK009_GATE_D_LOCAL_CONTRACT_PASS", migrations: versions.length }),
    );
  } else if (process.argv[2] === "--shadow") {
    const client = new pg.Client({
      connectionString: loopbackConnection(process.env.TASK009_SHADOW_DATABASE_URL),
    });
    await client.connect();
    try {
      await client.query("begin transaction read only");
      const catalog = await verifyCatalog(client, versions);
      await client.query("commit");
      console.log(
        JSON.stringify({
          result: "TASK009_GATE_D_SHADOW_CATALOG_PASS",
          migrations: versions.length,
          ...catalog,
        }),
      );
    } finally {
      await client.end();
    }
  } else {
    throw new Error("usage: node scripts/task009-gate-d/verify.mjs --local|--shadow");
  }
}
