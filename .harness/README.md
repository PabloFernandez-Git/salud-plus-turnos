# Agent Harness v1

## Objetivo

Proveer un ciclo de desarrollo multiagente controlado, verificable y con memoria persistente en el repositorio.

> Los chats son efímeros. El repositorio es la memoria del sistema.

## Roles estables

```text
Orchestrator
→ analiza, enruta contexto, planifica y cierra

Implementer
→ implementa, testea y documenta

Reviewer / Verifier
→ revisa de forma independiente y verifica
```

Especialistas se invocan on demand: Database/RLS, Security, UI y E2E.

## Ciclo

```text
STARTUP
↓
TASK BRIEF
↓
PLAN
↓
IMPLEMENT
↓
VERIFY
↓
REVIEW
↓
PASS?
├─ sí → CLOSE TASK → RETROSPECTIVE
└─ no → DIAGNOSE → FIX → VERIFY AGAIN
```

Máximo recomendado: 2–3 ciclos automáticos de corrección antes de escalar al humano.

## Contexto por capas

```text
GLOBAL
AGENTS.md + docs/product.md + docs/status.md
↓
MODULE
relevant docs/modules/*.md
↓
TASK
brief.md + plan.md
↓
WORKING
código/tests/diff relevantes
```

No cargar el archivo histórico completo de tareas por defecto.

## Artefactos por tarea

```text
.harness/tasks/active/TASK-XXX/
├── brief.md
├── plan.md
├── implementation-report.md
├── review.md
└── retrospective.md
```

Al cerrar, mover a `tasks/archive/`.

## Estado

`docs/status.md` es la fotografía actual, no un diario.

El Orchestrator lo actualiza cuando una tarea fue aceptada o cuando existe un bloqueo relevante.

## Self-improvement

Las retrospectivas pueden proponer mejoras.

- Bajo riesgo: documentación/checklists/ejemplos.
- Riesgo medio: AGENTS, protocolos, scripts, CI → review obligatorio.
- Alto riesgo: producto, reglas de negocio, arquitectura, permisos → aprobación humana.

Preferir enforcement automático a recordatorios repetidos.

## Seguridad

Agentes nunca deben:
- aplicar migrations automáticamente a PROD;
- sembrar o resetear PROD;
- exponer secretos;
- elevar permisos sin decisión explícita;
- reescribir reglas de producto por iniciativa propia.
