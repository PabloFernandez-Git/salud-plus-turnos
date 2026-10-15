import { finalizerDigest, finalizerRunId } from "./finalize-core.mjs";

export const smokeDisposition =
  "DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction";
export const harnessImprovement =
  "remote-authenticated DEV gates must be orchestrated as one-shot workflows; user must not act as command-by-command relay.";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function upsert(source, name, content, insertionPoint = null) {
  const start = `<!-- ${name}_START -->`;
  const end = `<!-- ${name}_END -->`;
  const block = `${start}\n${content.trim()}\n${end}`;
  if (source.includes(start)) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert(last >= 0, `Missing ${name} end marker`);
    return `${source.slice(0, first)}${block}${source.slice(last + end.length)}`;
  }
  if (insertionPoint) {
    const index = source.indexOf(insertionPoint);
    assert(index >= 0, `Missing ${name} insertion point`);
    return `${source.slice(0, index)}${block}\n\n${source.slice(index)}`;
  }
  return `${source.trimEnd()}\n\n${block}\n`;
}

export function renderFinalDocs(files, evidence) {
  assert(evidence.migrations?.exact === true, "Final docs require migration parity PASS");
  assert(evidence.schema?.verdict === "PASS", "Final docs require schema/API PASS");
  assert(evidence.baseline?.digest === finalizerDigest, "Final docs require Baseline V2 PASS");
  const result = { ...files };
  const status = "docs/status.md";
  assert(result[status]?.startsWith("# Estado actual"), "Unexpected status document");
  result[status] = result[status].replace(
    /^\*\*Fase:\*\*.*$/m,
    "**Fase:** TASK-007A y TASK-007B `CLOSED`; TASK-007C+D `GATE C PASS — GATE D AUTOMATED PASS — READY FOR FINAL INDEPENDENT IMPLEMENTATION REVIEW`. TASK-007 general sigue `ACTIVE`.",
  );
  result[status] = upsert(
    result[status],
    "TASK007_FINALIZER_STATUS",
    `## TASK-007C+D — finalización automatizada

- Run DEV exacto \`${finalizerRunId}\`: integración DB y E2E PASS previos. Smoke humano: **${smokeDisposition}**; no se afirma smoke PASS.
- Ownership por UUID exacto, cleanup y auditoría posterior PASS; inventario DEV restaurado. Sin nuevos fixtures ni E2E.
- Paridad ${evidence.migrations.local}/${evidence.migrations.remote}, dry-run sin pendientes, DB lint, schema/API y Baseline V2 exacto PASS (${evidence.baseline.components}/15 componentes; digest \`${finalizerDigest}\`).
- \`next-env.d.ts\` M, unstaged y con SHA exacto. Listo para review independiente final; TASK-007 sigue abierta, sin PR ni merge.`,
    "## Plan de la etapa restante TASK-007C+D",
  );

  const modulePath = "docs/modules/patients.md";
  assert(
    /\*\*GATE D (?:en curso|automatizado PASS):\*\*/.test(result[modulePath] ?? ""),
    "Patient module gate missing",
  );
  result[modulePath] = result[modulePath].replace(
    /^\*\*GATE D (?:en curso|automatizado PASS):\*\*.*$/m,
    `**GATE D automatizado PASS:** integración DB, privacidad multi-Center, carreras/CAS y E2E pasaron. Cleanup por UUID exacto y auditoría posterior restauraron el inventario DEV; paridad 19/19, dry-run, lint, schema/API y Baseline V2 exacto pasaron (\`${finalizerDigest}\`). Smoke humano: **${smokeDisposition}**; no se afirma smoke PASS. Review independiente final pendiente. Gap histórico categoría E y controles de abuso/rate limiting/monitoreo PRE-PROD. PROD fuera de alcance.`,
  );

  const report = ".harness/tasks/active/TASK-007/implementation-report.md";
  assert(result[report]?.includes("TASK-007C+D"), "Implementation report missing");
  result[report] = upsert(
    result[report],
    "TASK007_FINALIZER_REPORT",
    `## TASK-007C+D — finalización automatizada

- Run \`${finalizerRunId}\`; GATE C PASS y GATE D automatizado PASS. Integración DB y E2E previos no se repitieron. Smoke humano: **${smokeDisposition}**. El aplazamiento fue autorizado para el portfolio MVP y no equivale a smoke PASS.
- Ownership y referencias verificados antes de borrar; cleanup exclusivamente por UUID registrado y en orden FK inverso. La auditoría posterior confirmó ausencia de todos los IDs y restauración exacta del inventario previo.
- Verificación DEV final: migrations ${evidence.migrations.local}/${evidence.migrations.remote} idénticas, dry-run al día, DB lint sin errores, schema/API PASS, Baseline V2 exacto PASS (${evidence.baseline.components}/15 componentes; \`${finalizerDigest}\`). Verifier y \`next-env.d.ts\` conservan SHA exactos. Zero migrations/SQL/RLS/grants/RPC/types modificados; PROD fuera de alcance.
- Mejora pendiente del Harness: **${harnessImprovement}**
- Listo para review independiente final. Sin PR, merge ni cierre de TASK-007.`,
  );

  const plan = ".harness/tasks/active/TASK-007/plan.md";
  assert(result[plan]?.includes("### GATE D"), "TASK-007 plan missing");
  result[plan] = upsert(
    result[plan],
    "TASK007_SMOKE_DISPOSITION",
    `### Decisión posterior de ejecución GATE D

La persona usuaria detuvo el relay interactivo y autorizó el finalizador one-shot. Smoke humano: **${smokeDisposition}**. Esta excepción para el MVP portfolio no equivale a smoke PASS; ownership exacto, cleanup y Baseline V2 siguieron obligatorios. TASK-007 queda abierta para review independiente final.`,
  );

  const improvements = ".harness/knowledge/improvements.md";
  assert(result[improvements]?.startsWith("# Improvements"), "Harness improvements missing");
  result[improvements] = upsert(
    result[improvements],
    "TASK007_HARNESS_IMPROVEMENT",
    `- TASK-007, mejora pendiente del Harness: **${harnessImprovement}** Diseñar gates remotos autenticados como workflows one-shot con logs seguros, ownership persistente y reanudación determinista.`,
  );
  return result;
}
