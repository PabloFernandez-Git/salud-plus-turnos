import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareBaselineV2 } from "./compare-task007a-baseline-v2.mjs";

const reference = JSON.parse(
  readFileSync(".harness/tasks/active/TASK-007/baseline-v2-manifest.json", "utf8"),
);
function fresh() {
  return {
    ...structuredClone(reference),
    verification: { stable: true, domain_invariants_pass: true },
  };
}

describe("TASK-007A V2 exact comparator", () => {
  it("accepts the fixed reference with passing live invariants", () => {
    expect(compareBaselineV2(reference, fresh())).toEqual([]);
  });
  it("rejects an added column on empty persons with unchanged rows and digests", () => {
    const actual = fresh();
    actual.stable_data.components["public.persons"].included_fields.push("unexpected_field");
    expect(actual.stable_data.components["public.persons"].rows).toEqual([]);
    expect(compareBaselineV2(reference, actual)).toContain(
      "public.persons: included_fields metadata",
    );
  });
  it("rejects changed type and row key independently", () => {
    const typeDrift = fresh();
    typeDrift.stable_data.components["public.persons"].field_types.id = "text";
    expect(compareBaselineV2(reference, typeDrift)).toContain(
      "public.persons: field_types metadata",
    );
    const keyDrift = fresh();
    keyDrift.stable_data.components["public.persons"].row_key_fields = ["document_number"];
    expect(compareBaselineV2(reference, keyDrift)).toContain(
      "public.persons: row_key_fields metadata",
    );
  });
  it("rejects changed Auth exclusion rationale and extra components", () => {
    const actual = fresh();
    actual.stable_data.components["auth.users"].excluded_fields.updated_at = "different reason";
    actual.stable_data.components["public.extra"] = structuredClone(
      actual.stable_data.components["public.persons"],
    );
    expect(compareBaselineV2(reference, actual)).toEqual(
      expect.arrayContaining([
        "auth.users: excluded_fields metadata",
        "public.extra: extra component",
      ]),
    );
  });
});
