# 34. Agent Harness v1

El harness v1 combina:

```text
AGENTS.md
+
.harness/
+
docs/
+
scripts/bootstrap.mjs
+
tests
+
GitHub Actions
+
Vercel Preview
```

## Roles

```text
Orchestrator
→ analiza, planifica, enruta contexto y cierra tareas

Implementer
→ implementa, testea y documenta

Reviewer / Verifier
→ revisa y verifica de forma independiente
```

## Memoria y contexto

El repositorio será la memoria persistente.

Los agentes cargarán contexto en capas y no releerán el historial completo por defecto.

## Artefactos de tarea

```text
brief.md
plan.md
implementation-report.md
review.md
retrospective.md
```

## Progreso

`docs/status.md` mantendrá una fotografía actual del proyecto.

`.harness/tasks/archive/` conservará el historial.

## Mejora continua

El harness podrá aprender de retrospectivas, pero los cambios sensibles seguirán requiriendo revisión o aprobación humana.
