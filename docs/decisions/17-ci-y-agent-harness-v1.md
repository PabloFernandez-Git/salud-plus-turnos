# 17. CI y Agent Harness v1

## Decisión aprobada

**Harness multiagente v1 con Orchestrator, Implementer y Reviewer/Verifier.**

### Principio central

> Los chats son efímeros. El repositorio es la memoria del sistema.

### Roles

- **Orchestrator:** analiza, enruta contexto, crea el Task Brief, planifica, delega, controla loops, cierra tareas y actualiza estado.
- **Implementer:** implementa el cambio, agrega o actualiza tests y documentación, ejecuta verificaciones y entrega un Implementation Report.
- **Reviewer / Verifier:** revisa de forma independiente el diff y los criterios de aceptación, vuelve a verificar y aprueba o devuelve la tarea.

Los especialistas (Database/RLS, Security, UI, E2E) se invocarán solo cuando el riesgo de la tarea lo justifique.

### Ciclo de trabajo

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
FIX LOOP si corresponde
↓
CLOSE TASK
↓
RETROSPECTIVE
```

Los ciclos automáticos de corrección serán limitados para evitar loops indefinidos.

### Contexto por capas

```text
Global
→ AGENTS.md
→ docs/product.md
→ docs/status.md

Módulo
→ docs/modules/...

Tarea
→ .harness/tasks/active/TASK-XXX/

Trabajo
→ código, tests y diff relevantes
```

El historial completo no se cargará por defecto.

### Comunicación entre agentes

Cada tarea tendrá artefactos estructurados:

```text
brief.md
plan.md
implementation-report.md
review.md
retrospective.md
```

### Estado del proyecto

`docs/status.md` será una fotografía concisa del estado actual.

El historial detallado vivirá en `.harness/tasks/archive/`.

### Mejora del harness

Las retrospectivas podrán detectar:

- errores recurrentes;
- pasos olvidados;
- documentación insuficiente;
- verificaciones que deberían automatizarse.

Se preferirá enforcement automático antes que instrucciones repetidas cuando sea posible.

### Límites de auto-modificación

- Bajo riesgo: documentación técnica del harness, checklists, artefactos de tareas y `status.md`.
- Riesgo medio: `AGENTS.md`, protocolos, scripts de verificación y CI requieren revisión.
- Alto riesgo: producto, reglas de negocio, arquitectura y permisos requieren aprobación humana.

### Bootstrap

Se utilizará un script cross-platform, preferentemente `scripts/bootstrap.mjs`, expuesto como:

```text
npm run bootstrap
```

Su función será preparar y verificar el workspace, nunca modificar producción.

### CI

GitHub Actions ejecutará inicialmente en Pull Requests:

- lint;
- typecheck;
- Vitest / React Testing Library;
- build.

Playwright se incorporará progresivamente cuando exista un entorno E2E reproducible y aislado.

### Vercel Preview

Los Pull Requests podrán utilizar Preview Deployments para revisión humana antes del merge.

### Estado

**Harness v1 aprobado**
