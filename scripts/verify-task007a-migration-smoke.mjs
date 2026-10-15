import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { assertLinkedSupabaseProject, loadSupabaseDevConfig } from "./lib/supabase-dev-env.mjs";

pg.types.setTypeParser(1184, (value) => value);

const dev = loadSupabaseDevConfig();
assertLinkedSupabaseProject();
const output = execFileSync(
  process.execPath,
  [
    resolve("node_modules/supabase/dist/supabase.js"),
    "db",
    "dump",
    "--linked",
    "--dry-run",
    "--schema",
    "public",
  ],
  {
    encoding: "utf8",
    env: { ...process.env, CI: "true", DO_NOT_TRACK: "1", SUPABASE_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
const variables = Object.fromEntries(
  [...output.matchAll(/^export (PG[A-Z]+)="([^"]*)"$/gm)].map((match) => [match[1], match[2]]),
);
const pooler = new URL(readFileSync(resolve("supabase/.temp/pooler-url"), "utf8").trim());
if (
  variables.PGHOST !== `db.${dev.projectRef}.supabase.co` &&
  !(variables.PGHOST === pooler.hostname && variables.PGUSER?.endsWith(`.${dev.projectRef}`))
) {
  throw new Error("Database target is not approved DEV.");
}
const client = new pg.Client({
  host: variables.PGHOST,
  port: Number(variables.PGPORT),
  database: variables.PGDATABASE,
  user: variables.PGUSER,
  password: variables.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  application_name: "task007a-migration-smoke",
});
async function asActor(actorId, action) {
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [actorId]);
  const result = await action();
  await client.query("set local role postgres");
  return result;
}

async function expectFailure(label, action, code, message) {
  await client.query("savepoint task007a_expected_failure");
  try {
    await action();
  } catch (error) {
    await client.query("rollback to savepoint task007a_expected_failure");
    await client.query("release savepoint task007a_expected_failure");
    if (error.code !== code || error.message !== message) {
      throw new Error(`${label}: expected ${code}/${message}, got ${error.code}/${error.message}`);
    }
    return;
  }
  await client.query("rollback to savepoint task007a_expected_failure");
  await client.query("release savepoint task007a_expected_failure");
  throw new Error(`${label}: unexpectedly succeeded`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await client.connect();
  await client.query("begin");
  await client.query("set local role postgres");
  const migration = process.argv.includes("--correction-only")
    ? "20261013200000_remove_patient_rpc_unused_variables.sql"
    : "20261013190000_add_patient_foundation.sql";
  await client.query(readFileSync(resolve("supabase/migrations", migration), "utf8"));
  const checks = await client.query(`
    select private.trim_patient_input(E' \\t\\r\\n abc \\t') = 'abc' as trim_ok,
      private.is_valid_patient_nationality_code('AR') as ar_ok,
      not private.is_valid_patient_nationality_code('ZZ') as zz_rejected,
      private.center_local_date_at('America/Argentina/Buenos_Aires',
        '2026-10-14T02:59:59Z'::timestamptz) = '2026-10-13'::date as before_midnight,
      private.center_local_date_at('America/Argentina/Buenos_Aires',
        '2026-10-14T03:00:00Z'::timestamptz) = '2026-10-14'::date as after_midnight
  `);
  if (Object.values(checks.rows[0]).some((value) => value !== true)) {
    throw new Error(`Migration contract smoke failed: ${JSON.stringify(checks.rows[0])}`);
  }
  const trimCases = [
    ["", ""],
    [" ", ""],
    ["\t", ""],
    ["\n", ""],
    ["\r\n", ""],
    [" \t\r\n ", ""],
    [" abc ", "abc"],
    ["\tabc\t", "abc"],
    ["\nabc\r", "abc"],
    ["a\tb", "a\tb"],
  ];
  for (const [input, expected] of trimCases) {
    const trimmed = await client.query("select private.trim_patient_input($1) as value", [input]);
    assert(trimmed.rows[0].value === expected, "canonical SQL trim matrix");
  }
  const isoSnapshot = JSON.parse(
    readFileSync(resolve("src/modules/patients/schemas/iso-3166-1-alpha-2.json"), "utf8"),
  );
  const isoResult = await client.query(`
    select pg_catalog.array_agg(code order by code) as codes
    from (
      select chr(a.codepoint) || chr(b.codepoint) as code
      from generate_series(65,90) as a(codepoint)
      cross join generate_series(65,90) as b(codepoint)
    ) as candidates
    where private.is_valid_patient_nationality_code(code)
  `);
  assert(
    JSON.stringify(isoResult.rows[0].codes) === JSON.stringify(isoSnapshot),
    "full ISO snapshot matches SQL",
  );
  const ids = {
    centerA: randomUUID(),
    centerB: randomUUID(),
    admin: randomUUID(),
    reception: randomUUID(),
    professional: randomUUID(),
    platform: randomUUID(),
    inactive: randomUUID(),
    professionalRecord: randomUUID(),
    professionalCenter: randomUUID(),
  };
  for (const actor of ["admin", "reception", "professional", "platform", "inactive"]) {
    await client.query(
      "insert into auth.users (id,email,created_at,updated_at) values ($1,$2,now(),now())",
      [ids[actor], `task007a-${ids[actor]}@example.test`],
    );
    await client.query(
      "insert into public.users (id,email,first_name,last_name) values ($1,$2,'TASK007A','Fixture')",
      [ids[actor], `task007a-${ids[actor]}@example.test`],
    );
  }
  await client.query(
    "insert into public.centers (id,name) values ($1,'TASK007A A'),($2,'TASK007A B')",
    [ids.centerA, ids.centerB],
  );
  await client.query(
    "insert into public.professionals (id,first_name,last_name,nationality_code,document_number,email) values ($1,'Test','Professional','AR',$2,$3)",
    [
      ids.professionalRecord,
      `P-${ids.professionalRecord}`,
      `p-${ids.professionalRecord}@example.test`,
    ],
  );
  await client.query(
    "insert into public.professional_centers (id,professional_id,center_id) values ($1,$2,$3)",
    [ids.professionalCenter, ids.professionalRecord, ids.centerA],
  );
  const memberships = [
    [ids.centerA, ids.admin, "ADMIN", null, true],
    [ids.centerA, ids.reception, "RECEPTION", null, true],
    [ids.centerA, ids.professional, "PROFESSIONAL", ids.professionalCenter, true],
    [ids.centerA, ids.inactive, "RECEPTION", null, false],
  ];
  for (const row of memberships) {
    await client.query(
      "insert into public.center_memberships (center_id,user_id,role,professional_center_id,is_active) values ($1,$2,$3,$4,$5)",
      row,
    );
  }
  await client.query("insert into public.platform_admins (user_id) values ($1)", [ids.platform]);
  const document = `PAT-${randomUUID()}`;
  await asActor(ids.admin, async () => {
    const created = await client.query(
      "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        ids.centerA,
        " Ada ",
        " Lovelace ",
        "1990-01-01",
        " ar ",
        document,
        " 12345 ",
        "\t",
        "\t",
        "\r\n",
      ],
    );
    const row = created.rows[0];
    assert(row.outcome === "CREATED", "create outcome");
    const stored = await client.query("select * from public.patient_centers where id=$1", [
      row.patient_center_id,
    ]);
    assert(
      stored.rows[0].phone === "12345" &&
        stored.rows[0].email === null &&
        stored.rows[0].insurance_name === null &&
        stored.rows[0].administrative_notes === null,
      "canonical tenant fields",
    );
    const resolved = await client.query(
      "select * from public.staff_resolve_patient_identity($1,$2,$3,$4)",
      [ids.centerA, "AR", document, "1990-01-01"],
    );
    assert(
      resolved.rows[0].relationship_state === "ACTIVE" &&
        resolved.rows[0].birth_date_matches === true,
      "exact resolve",
    );
    const mismatch = await client.query(
      "select * from public.staff_resolve_patient_identity($1,$2,$3,$4)",
      [ids.centerA, "AR", document, "1991-01-01"],
    );
    assert(
      mismatch.rows[0].birth_date_matches === false &&
        mismatch.rows[0].person_id === null &&
        mismatch.rows[0].patient_center_id === null,
      "resolve mismatch privacy",
    );
    const search = await client.query(
      "select * from public.staff_search_patient_centers($1,$2,$3,$4,$5)",
      [ids.centerA, "\t", "ACTIVE", 25, 0],
    );
    assert(
      search.rows.some((found) => found.patient_center_id === row.patient_center_id),
      "tabs-only query must list tenant",
    );
    const unchanged = await client.query(
      "select * from public.staff_update_patient_center($1,$2,$3,$4,$5,$6,$7)",
      [ids.centerA, row.patient_center_id, row.updated_at, "12345", null, null, null],
    );
    assert(
      unchanged.rows[0].outcome === "UNCHANGED" &&
        String(unchanged.rows[0].updated_at) === String(row.updated_at),
      "no-op CAS",
    );
    const updated = await client.query(
      "select * from public.staff_update_patient_center($1,$2,$3,$4,$5,$6,$7)",
      [ids.centerA, row.patient_center_id, row.updated_at, "777", null, null, null],
    );
    assert(
      updated.rows[0].outcome === "UPDATED" && updated.rows[0].updated_at > row.updated_at,
      "monotonic CAS",
    );
    await expectFailure(
      "stale update",
      () =>
        client.query("select * from public.staff_update_patient_center($1,$2,$3,$4,$5,$6,$7)", [
          ids.centerA,
          row.patient_center_id,
          row.updated_at,
          "888",
          null,
          null,
          null,
        ]),
      "P0001",
      "STALE_PATIENT_CENTER_STATE",
    );
    const deactivated = await client.query(
      "select * from public.staff_deactivate_patient_center($1,$2,$3,$4)",
      [ids.centerA, row.patient_center_id, updated.rows[0].updated_at, true],
    );
    assert(deactivated.rows[0].outcome === "DEACTIVATED", "deactivate outcome");
    const reactivated = await client.query(
      "select * from public.staff_reactivate_patient_center($1,$2,$3,$4,$5,$6,$7)",
      [
        ids.centerA,
        row.patient_center_id,
        "AR",
        document,
        "1990-01-01",
        deactivated.rows[0].updated_at,
        true,
      ],
    );
    assert(
      reactivated.rows[0].outcome === "REACTIVATED" &&
        reactivated.rows[0].patient_center_id === row.patient_center_id,
      "reactivate same relationship",
    );
    await expectFailure(
      "existing identity",
      () =>
        client.query(
          "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [ids.centerA, "Ada", "Lovelace", "1990-01-01", "AR", document, "1", null, null, null],
        ),
      "P0001",
      "PATIENT_IDENTITY_ALREADY_EXISTS",
    );
    await expectFailure(
      "future birth date",
      () =>
        client.query(
          "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            ids.centerA,
            "Ada",
            "Lovelace",
            "2999-01-01",
            "AR",
            `F-${document}`,
            "1",
            null,
            null,
            null,
          ],
        ),
      "22023",
      "INVALID_PATIENT_INPUT",
    );
    await expectFailure(
      "tabs-only phone",
      () =>
        client.query(
          "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            ids.centerA,
            "Ada",
            "Lovelace",
            "1990-01-01",
            "AR",
            `P-${document}`,
            "\t",
            null,
            null,
            null,
          ],
        ),
      "22023",
      "INVALID_PATIENT_INPUT",
    );
    await expectFailure(
      "invalid ISO",
      () =>
        client.query("select * from public.staff_resolve_patient_identity($1,$2,$3,$4)", [
          ids.centerA,
          "ZZ",
          document,
          "1990-01-01",
        ]),
      "22023",
      "INVALID_PATIENT_INPUT",
    );
    await expectFailure(
      "bad email",
      () =>
        client.query("select * from public.staff_update_patient_center($1,$2,$3,$4,$5,$6,$7)", [
          ids.centerA,
          row.patient_center_id,
          reactivated.rows[0].updated_at,
          "777",
          "bad@@example.com",
          null,
          null,
        ]),
      "22023",
      "INVALID_PATIENT_INPUT",
    );
    await expectFailure(
      "bad paging",
      () =>
        client.query("select * from public.staff_search_patient_centers($1,$2,$3,$4,$5)", [
          ids.centerA,
          null,
          "ACTIVE",
          null,
          0,
        ]),
      "22023",
      "INVALID_PATIENT_INPUT",
    );
    await expectFailure(
      "cross-center",
      () => client.query("select * from public.staff_search_patient_centers($1)", [ids.centerB]),
      "42501",
      "PATIENT_ACCESS_DENIED",
    );
    const count = await client.query(
      "select count(*)::integer as people from public.persons where nationality_code='AR'",
    );
    assert(count.rows[0].people === 1, "rejected mutations leave no partial Person");
  });
  await asActor(ids.admin, async () => {
    const callSearch = (query = null, state = "ACTIVE", limit = 25, offset = 0) =>
      client.query("select * from public.staff_search_patient_centers($1,$2,$3,$4,$5)", [
        ids.centerA,
        query,
        state,
        limit,
        offset,
      ]);
    for (const [label, query, state, limit, offset] of [
      ["limit 0", null, "ACTIVE", 0, 0],
      ["limit 51", null, "ACTIVE", 51, 0],
      ["offset negative", null, "ACTIVE", 25, -1],
      ["offset 10001", null, "ACTIVE", 25, 10001],
      ["query 101", "q".repeat(101), "ACTIVE", 25, 0],
      ["invalid state", null, "UNKNOWN", 25, 0],
    ]) {
      await expectFailure(
        label,
        () => callSearch(query, state, limit, offset),
        "22023",
        "INVALID_PATIENT_INPUT",
      );
    }
    for (const [query, state, limit, offset] of [
      [null, "ACTIVE", 1, 0],
      [null, "ACTIVE", 50, 0],
      [null, "ACTIVE", 25, 10000],
      ["q".repeat(100), "ACTIVE", 25, 0],
    ])
      await callSearch(query, state, limit, offset);
    const defaultSearch = await client.query(
      "select * from public.staff_search_patient_centers($1)",
      [ids.centerA],
    );
    assert(defaultSearch.rows.length === 1, "default 25/ACTIVE listing");
    const fixtureDocument = `S-${randomUUID()}`;
    const second = (
      await client.query(
        "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          ids.centerA,
          " Ada ",
          " Lovelace ",
          "1990-01-01",
          "AR",
          fixtureDocument,
          " 98765 ",
          " A.B+tag@Example.COM ",
          " Coverage ",
          " Note ",
        ],
      )
    ).rows[0];
    assert(second.outcome === "CREATED", "search fixture created");
    const secondStored = (
      await client.query("select * from public.patient_centers where id=$1", [
        second.patient_center_id,
      ])
    ).rows[0];
    assert(
      secondStored.email === "a.b+tag@example.com" &&
        secondStored.phone === "98765" &&
        secondStored.insurance_name === "Coverage" &&
        secondStored.administrative_notes === "Note",
      "email and optional canonical storage",
    );
    for (const [term, expected] of [
      [fixtureDocument.toLowerCase(), 1],
      ["ada", 2],
      ["LOVELACE", 2],
      ["98765", 1],
      ["A.B+TAG@EXAMPLE.COM", 1],
      ["%", 0],
      ["_", 0],
      ["\\", 0],
      ["not-found", 0],
    ]) {
      const found = await callSearch(term);
      assert(found.rows.length === expected, `literal/case/normalized search ${term}`);
    }
    const ordered = await callSearch("ada");
    assert(
      ordered.rows.length === 2 &&
        ordered.rows[0].patient_center_id < ordered.rows[1].patient_center_id,
      "stable patient_center_id tie-break",
    );
    const empty = await callSearch(" \t\r\n ");
    assert(empty.rows.length === 2, "whitespace-only tenant listing");
    const resolve = await client.query(
      "select * from public.staff_resolve_patient_identity($1,$2,$3,$4)",
      [ids.centerA, "AR", fixtureDocument, "1990-01-01"],
    );
    assert(
      JSON.stringify(Object.keys(resolve.rows[0]).sort()) ===
        JSON.stringify(
          [
            "birth_date_matches",
            "first_name",
            "identity_status",
            "last_name",
            "patient_center_id",
            "patient_center_updated_at",
            "person_id",
            "relationship_state",
          ].sort(),
        ),
      "resolve exact privacy projection",
    );
    const beforeMismatch = await client.query(
      "select count(*)::int as n from public.patient_centers where person_id=$1",
      [second.person_id],
    );
    await expectFailure(
      "link mismatch existing Person",
      () =>
        client.query(
          "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            ids.centerA,
            second.person_id,
            "AR",
            fixtureDocument,
            "1991-01-01",
            "123",
            null,
            null,
            null,
            true,
          ],
        ),
      "P0001",
      "PATIENT_BIRTH_DATE_MISMATCH",
    );
    const afterMismatch = await client.query(
      "select count(*)::int as n from public.patient_centers where person_id=$1",
      [second.person_id],
    );
    assert(beforeMismatch.rows[0].n === afterMismatch.rows[0].n, "birth mismatch zero mutation");
    const maxEmail = `${"a".repeat(64)}@${["b".repeat(63), "c".repeat(63), "d".repeat(63), "e".repeat(63)].join(".")}`;
    assert(maxEmail.length === 320, "email 320 construction");
    const maxDocument = `M-${randomUUID()}`.padEnd(100, "9");
    const maxArgs = [
      ids.centerA,
      "N".repeat(100),
      "L".repeat(100),
      "1990-01-01",
      "AR",
      maxDocument,
      "5".repeat(50),
      maxEmail,
      "I".repeat(160),
      "A".repeat(4000),
    ];
    const maxCreated = (
      await client.query(
        "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        maxArgs,
      )
    ).rows[0];
    assert(maxCreated.outcome === "CREATED", "all maximum lengths accepted without truncation");
    for (const [label, index, value] of [
      ["first name 101", 1, "N".repeat(101)],
      ["last name 101", 2, "L".repeat(101)],
      ["document 101", 5, "D".repeat(101)],
      ["phone 51", 6, "5".repeat(51)],
      ["email 321", 7, `a${maxEmail}`],
      ["insurance 161", 8, "I".repeat(161)],
      ["notes 4001", 9, "A".repeat(4001)],
      ["separator document", 5, "---"],
      ["whitespace phone", 6, "\t\r\n"],
      ["invalid email", 7, "bad@@example.com"],
      ["invalid ISO", 4, "ZZ"],
      ["malformed ISO", 4, "AAA"],
      ["nonalpha ISO", 4, "A1"],
    ]) {
      const args = [...maxArgs];
      args[index] = value;
      await expectFailure(
        label,
        () =>
          client.query(
            "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            args,
          ),
        "22023",
        "INVALID_PATIENT_INPUT",
      );
    }
    await client.query("set local role postgres");
    for (const [input, expected] of [
      ["AR", "AR"],
      [" ar ", "AR"],
      ["US", "US"],
    ]) {
      const value = await client.query("select private.patient_nationality($1) as code", [input]);
      assert(value.rows[0].code === expected, "SQL nationality canonical result");
    }
    await client.query("set local role authenticated");
    const today = (
      await client.query(
        "select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text as day",
      )
    ).rows[0].day;
    const tomorrow = (
      await client.query(
        "select ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 1)::text as day",
      )
    ).rows[0].day;
    const todayCreated = (
      await client.query(
        "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [ids.centerA, "Today", "Local", today, "AR", `T-${randomUUID()}`, "123", null, null, null],
      )
    ).rows[0];
    assert(todayCreated.outcome === "CREATED", "current Center local date accepted");
    await expectFailure(
      "tomorrow local",
      () =>
        client.query(
          "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            ids.centerA,
            "Tomorrow",
            "Local",
            tomorrow,
            "AR",
            `T-${randomUUID()}`,
            "123",
            null,
            null,
            null,
          ],
        ),
      "22023",
      "INVALID_PATIENT_INPUT",
    );
    await client.query("set local role postgres");
    const invalidTimezone = await client.query(
      "insert into public.centers (name,timezone) values ('TASK007A bad timezone','Invalid/Zone') returning id",
    );
    await client.query(
      "insert into public.center_memberships (center_id,user_id,role) values($1,$2,'ADMIN')",
      [invalidTimezone.rows[0].id, ids.admin],
    );
    await client.query("set local role authenticated");
    await client.query("savepoint invalid_timezone");
    let timezoneFailed = false;
    try {
      await client.query(
        "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          invalidTimezone.rows[0].id,
          "Zone",
          "Invalid",
          today,
          "AR",
          `Z-${randomUUID()}`,
          "123",
          null,
          null,
          null,
        ],
      );
    } catch {
      timezoneFailed = true;
    }
    await client.query("rollback to savepoint invalid_timezone");
    await client.query("release savepoint invalid_timezone");
    assert(timezoneFailed, "invalid timezone fails closed");
    const noPartial = await client.query(
      "select count(*)::int as n from public.persons where first_name='Zone'",
    );
    assert(noPartial.rows[0].n === 0, "invalid timezone zero partial Person");
  });
  for (const actor of ["professional", "platform", "inactive"]) {
    await asActor(ids[actor], () =>
      expectFailure(
        `${actor} denied`,
        () => client.query("select * from public.staff_search_patient_centers($1)", [ids.centerA]),
        "42501",
        "PATIENT_ACCESS_DENIED",
      ),
    );
  }
  await asActor(ids.reception, async () => {
    const result = await client.query("select * from public.staff_search_patient_centers($1)", [
      ids.centerA,
    ]);
    assert(result.rows.length >= 1, "reception search");
  });
  const unlinkedPersonId = randomUUID();
  const unlinkedDocument = `UNLINKED-${randomUUID()}`;
  await client.query(
    "insert into public.persons (id,first_name,last_name,birth_date,nationality_code,document_number) values ($1,'Grace','Hopper','1906-12-09','US',$2)",
    [unlinkedPersonId, unlinkedDocument],
  );
  await asActor(ids.admin, async () => {
    const invisible = await client.query("select id from public.persons where id=$1", [
      unlinkedPersonId,
    ]);
    assert(invisible.rows.length === 0, "RLS hides unlinked global Person");
    const searchMiss = await client.query(
      "select * from public.staff_search_patient_centers($1,$2)",
      [ids.centerA, unlinkedDocument],
    );
    assert(searchMiss.rows.length === 0, "search miss does not globally resolve Person");
  });
  await asActor(ids.reception, async () => {
    const resolved = await client.query(
      "select * from public.staff_resolve_patient_identity($1,$2,$3,$4)",
      [ids.centerA, "US", unlinkedDocument, "1906-12-09"],
    );
    assert(resolved.rows[0].relationship_state === "NOT_LINKED", "exact unlinked resolve");
    await expectFailure(
      "link birth mismatch",
      () =>
        client.query(
          "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            ids.centerA,
            unlinkedPersonId,
            "US",
            unlinkedDocument,
            "1907-12-09",
            "123",
            null,
            null,
            null,
            true,
          ],
        ),
      "P0001",
      "PATIENT_BIRTH_DATE_MISMATCH",
    );
    const linked = await client.query(
      "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        ids.centerA,
        unlinkedPersonId,
        "US",
        unlinkedDocument,
        "1906-12-09",
        "123",
        null,
        null,
        null,
        true,
      ],
    );
    assert(linked.rows[0].outcome === "LINKED", "reception link");
    const again = await client.query(
      "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        ids.centerA,
        unlinkedPersonId,
        "US",
        unlinkedDocument,
        "1906-12-09",
        "456",
        null,
        null,
        null,
        true,
      ],
    );
    assert(
      again.rows[0].outcome === "ALREADY_ACTIVE" &&
        again.rows[0].patient_center_id === linked.rows[0].patient_center_id,
      "link reuses active relationship",
    );
    const visible = await client.query("select id from public.persons where id=$1", [
      unlinkedPersonId,
    ]);
    assert(visible.rows.length === 1, "RLS shows linked Person");
  });
  const matrixPerson = randomUUID();
  const matrixDocument = `MATRIX-${randomUUID()}`;
  const matrixUnlinked = randomUUID();
  const matrixUnlinkedDocument = `UNLINKED-${randomUUID()}`;
  const inactivePerson = randomUUID();
  const inactiveDocument = `INACTIVE-${randomUUID()}`;
  const matrixActive = randomUUID();
  const matrixInactive = randomUUID();
  for (const [personId, document] of [
    [matrixPerson, matrixDocument],
    [matrixUnlinked, matrixUnlinkedDocument],
    [inactivePerson, inactiveDocument],
  ]) {
    await client.query(
      "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Matrix','Patient','1990-01-01','AR',$2)",
      [personId, document],
    );
  }
  await client.query(
    "insert into public.patient_centers(id,person_id,center_id,phone,is_active) values($1,$2,$3,'123',true),($4,$5,$3,'123',false)",
    [matrixActive, matrixPerson, ids.centerA, matrixInactive, inactivePerson],
  );
  const otherCenterPerson = randomUUID();
  const otherCenterPatient = randomUUID();
  await client.query(
    "insert into public.persons(id,first_name,last_name,birth_date,nationality_code,document_number) values($1,'Other','Center','1990-01-01','AR',$2)",
    [otherCenterPerson, `OTHER-${randomUUID()}`],
  );
  await client.query(
    "insert into public.patient_centers(id,person_id,center_id,phone) values($1,$2,$3,'123')",
    [otherCenterPatient, otherCenterPerson, ids.centerB],
  );
  const activeToken = (
    await client.query("select updated_at from public.patient_centers where id=$1", [matrixActive])
  ).rows[0].updated_at;
  const inactiveToken = (
    await client.query("select updated_at from public.patient_centers where id=$1", [
      matrixInactive,
    ])
  ).rows[0].updated_at;
  const rpcCases = (center) => [
    [
      "staff_search_patient_centers",
      "select * from public.staff_search_patient_centers($1)",
      [center],
    ],
    [
      "staff_resolve_patient_identity",
      "select * from public.staff_resolve_patient_identity($1,$2,$3,$4)",
      [center, "AR", matrixDocument, "1990-01-01"],
    ],
    [
      "staff_create_patient_with_center",
      "select * from public.staff_create_patient_with_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        center,
        "New",
        "Patient",
        "1990-01-01",
        "AR",
        `CASE-${randomUUID()}`,
        "123",
        null,
        null,
        null,
      ],
    ],
    [
      "staff_link_person_to_center",
      "select * from public.staff_link_person_to_center($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        center,
        matrixUnlinked,
        "AR",
        matrixUnlinkedDocument,
        "1990-01-01",
        "123",
        null,
        null,
        null,
        true,
      ],
    ],
    [
      "staff_reactivate_patient_center",
      "select * from public.staff_reactivate_patient_center($1,$2,$3,$4,$5,$6,$7)",
      [center, matrixInactive, "AR", inactiveDocument, "1990-01-01", inactiveToken, true],
    ],
    [
      "staff_update_patient_center",
      "select * from public.staff_update_patient_center($1,$2,$3,$4,$5,$6,$7)",
      [center, matrixActive, activeToken, "456", null, null, null],
    ],
    [
      "staff_deactivate_patient_center",
      "select * from public.staff_deactivate_patient_center($1,$2,$3,$4)",
      [center, matrixActive, activeToken, true],
    ],
  ];
  for (const actor of ["admin", "reception"]) {
    await asActor(ids[actor], async () => {
      for (const [name, sql, params] of rpcCases(ids.centerA)) {
        await client.query("savepoint task007a_allowed_rpc");
        try {
          const result = await client.query(sql, params);
          assert(result.rows.length >= 1, `${actor} ${name} allowed`);
        } finally {
          await client.query("rollback to savepoint task007a_allowed_rpc");
          await client.query("release savepoint task007a_allowed_rpc");
        }
      }
      assert(
        (await client.query("select id from public.persons where id=$1", [matrixPerson])).rows
          .length === 1,
        `${actor} linked Person SELECT`,
      );
      assert(
        (await client.query("select id from public.persons where id=$1", [matrixUnlinked])).rows
          .length === 0,
        `${actor} unlinked Person hidden`,
      );
      assert(
        (await client.query("select id from public.patient_centers where id=$1", [matrixActive]))
          .rows.length === 1,
        `${actor} PatientCenter SELECT`,
      );
      assert(
        (await client.query("select id from public.persons where id=$1", [otherCenterPerson])).rows
          .length === 0,
        `${actor} cross-center Person hidden`,
      );
      assert(
        (
          await client.query("select id from public.patient_centers where id=$1", [
            otherCenterPatient,
          ])
        ).rows.length === 0,
        `${actor} cross-center PatientCenter hidden`,
      );
    });
  }
  for (const actor of ["professional", "platform", "inactive"]) {
    await asActor(ids[actor], async () => {
      for (const [name, sql, params] of rpcCases(ids.centerA)) {
        await expectFailure(
          `${actor} ${name}`,
          () => client.query(sql, params),
          "42501",
          "PATIENT_ACCESS_DENIED",
        );
      }
      assert(
        (await client.query("select id from public.persons where id=$1", [matrixPerson])).rows
          .length === 0,
        `${actor} Person RLS`,
      );
      assert(
        (await client.query("select id from public.patient_centers where id=$1", [matrixActive]))
          .rows.length === 0,
        `${actor} PatientCenter RLS`,
      );
    });
  }
  await asActor(ids.admin, async () => {
    for (const [name, sql, params] of rpcCases(ids.centerB)) {
      await expectFailure(
        `cross-center ${name}`,
        () => client.query(sql, params),
        "42501",
        "PATIENT_ACCESS_DENIED",
      );
    }
  });
  await client.query("set local role anon");
  for (const [name, sql, params] of rpcCases(ids.centerA)) {
    await expectFailure(
      `anon ${name}`,
      () => client.query(sql, params),
      "42501",
      `permission denied for function ${name}`,
    );
  }
  for (const table of ["persons", "patient_centers"]) {
    await expectFailure(
      `anon ${table}`,
      () => client.query(`select id from public.${table} limit 1`),
      "42501",
      `permission denied for table ${table}`,
    );
  }
  await client.query("set local role postgres");
  console.log("TASK-007A migration and contract smoke passed inside rollback-only transaction.");
} finally {
  try {
    await client.query("rollback");
  } finally {
    await client.end();
  }
}
