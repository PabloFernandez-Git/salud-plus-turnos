# Retrospective — TASK-007

## Resultado

TASK-007 entregó Patients: foundation 007A, listado/búsqueda tenant 007B y registro/administración 007C+D. El re-review independiente final cerró FIR-1 y FIR-2 y emitió PASS. La tarea está `CLOSED — READY_FOR_MERGE`; los artefactos permanecen en `active/` hasta integrar el PR a `main`, siguiendo TASK-006.

## Lecciones reutilizables

- Los workflows DEV autenticados de GATE D deben ejecutarse como procesos one-shot con evidencia y cleanup propios; la persona usuaria no debe actuar como relay comando por comando.
- El ledger de ownership debe vivir fuera de `test-results`, que Playwright limpia; auditar UUIDs y referencias exactas antes y después del cleanup.
- Los finalizers deben poder reanudarse y ser idempotentes: comprobar fase, ownership y baseline antes de continuar, sin repetir mutaciones ya completadas.
- Probar parsers de CLI contra output real, incluidos errores de autenticación y formatos inesperados, antes de confiar en ellos como gate.
- El resolve asíncrono de identidad debe asociar cada respuesta a su snapshot/generación y descartar respuestas stale antes de habilitar create/link/reactivate.
- Separar explícitamente runners `node:test` y Vitest en configuración y script canónico; verificar `pnpm test` completo tras agregar suites nuevas.

## Pendientes fuera del cierre

Smoke humano **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**. **HISTORICAL VERIFICATION GAP: Category E — insufficient evidence**. **PRE-PROD:** riesgo de inferencia por exact global resolve/create, rate limiting, protección contra abuso y monitoring/telemetry. Ninguno se declara resuelto.
