function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export function compareBaselineV2(reference, actual) {
  const drift = [];
  if (!actual.verification?.stable) drift.push("fresh READ #1 / READ #2 unstable");
  if (!actual.verification?.domain_invariants_pass) drift.push("domain invariant failure");
  if (actual.stable_data?.global_sha256 !== reference.stable_data.global_sha256)
    drift.push("global stable-data digest");
  const expectedComponents = reference.stable_data.components;
  const actualComponents = actual.stable_data?.components ?? {};
  for (const name of Object.keys(actualComponents))
    if (!(name in expectedComponents)) drift.push(`${name}: extra component`);
  for (const [name, expected] of Object.entries(expectedComponents)) {
    const found = actualComponents[name];
    if (!found) {
      drift.push(`${name}: missing component`);
      continue;
    }
    for (const key of ["included_fields", "excluded_fields", "field_types", "row_key_fields"])
      if (JSON.stringify(canonical(found[key])) !== JSON.stringify(canonical(expected[key])))
        drift.push(`${name}: ${key} metadata`);
    if (found.row_count !== expected.row_count)
      drift.push(`${name}: row count ${expected.row_count} -> ${found.row_count}`);
    if (found.component_sha256 !== expected.component_sha256)
      drift.push(`${name}: component digest`);
    const expectedRows = new Map(expected.rows.map((row) => [row.row_key_sha256, row]));
    const actualRows = new Map((found.rows ?? []).map((row) => [row.row_key_sha256, row]));
    for (const [key, row] of expectedRows) {
      const newer = actualRows.get(key);
      if (!newer) {
        drift.push(`${name}: missing row ${key}`);
        continue;
      }
      if (
        JSON.stringify(canonical(newer.field_sha256)) !==
        JSON.stringify(canonical(row.field_sha256))
      )
        drift.push(`${name}: row ${key} field hashes`);
    }
    for (const key of actualRows.keys())
      if (!expectedRows.has(key)) drift.push(`${name}: extra row ${key}`);
  }
  return drift;
}
