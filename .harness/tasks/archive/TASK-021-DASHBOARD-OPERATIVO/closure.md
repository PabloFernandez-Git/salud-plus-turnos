# TASK-021 — Cierre documental

**Fecha:** 2026-10-23
**Estado propuesto:** `CLOSED / ARCHIVED`, sujeto al merge del PR exclusivo de cierre documental.

## Cumplimiento y alcance

El Dashboard operativo de TASK-021 está integrado en `main` mediante [PR #22](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/22), con merge commit `5f0cead268adbc64ccdaf055e64e90ff87f4eb71`. La verificación de GitHub confirmó `merged=true`, base `main` y el mismo SHA. El árbol de ese commit conserva el expediente activo y la implementación; este cierre mueve el expediente completo al archivo sin modificar funcionalidad, RPC, migrations ni RLS.

El criterio 14 de `docs/mvp.md` queda satisfecho en el alcance MVP: actividad diaria y hasta cinco próximos turnos del centro para ADMIN/RECEPTION, y sólo actividad propia para PROFESSIONAL. Se conservan la navegación y las rutas por rol. Los indicadores distinguen estados y cancelados, y la lectura usa fecha civil del centro. Las alertas sin regla definida y el checklist de onboarding siguen como evoluciones separadas, según `brief.md` y `docs/modules/dashboard.md`; no son requisitos pendientes de TASK-021.

## Evidencia de aceptación

| Control | Evidencia y resultado |
| --- | --- |
| Gate A DEV | `gate-a-apply-diagnosis.md`: `APPLY_AND_POSTCHECK PASS`, 25 migrations y SHA aprobado `7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`. |
| Gate B DEV | `gate-b-final-report.md`: preflight y ejecución funcional PASS; Chromium autenticado 1/1 PASS; último ledger `run-2a6cabc8-d5da-4f33-b298-5c4f64efbb66.json` en `cleaned`, inventarios inicial/final idénticos para 14 recursos y `residue=0`. |
| Pruebas locales | `gate-b-final-report.md`: Vitest 706/706, `node:test` 21/21, Chromium controlado 13/13, TypeScript, ESLint, Prettier y diff check PASS. El PR #22 documenta CI `verify` PASS y la prueba Playwright focal local 1/1 PASS. |
| Revisión técnica | `review.md`, `sql-review.md` y `dev-gates-review.md`: revisión independiente focal PASS, con hallazgos previos corregidos y sin bloqueantes pendientes. |
| Validación visual final | La persona usuaria aprobó la inspección en `localhost:3000` en escritorio y móvil de 390 px y confirmó la conservación de la navegación existente. Esta es aprobación humana comunicada para el cierre; no se atribuye a una nueva captura o corrida de este PR. |

Los seis PNG de `artifacts/task021-dashboard-ui/` pertenecen a una etapa anterior a los refinamientos finales, según `gate-b-final-report.md`; no se presentan como capturas de la aprobación visual final. Los ledgers históricos y resultados locales existentes se conservan en su ubicación original; este cambio documental no los elimina, reejecuta ni publica. No se ejecutaron operaciones DEV/PROD para el cierre. La migration de TASK-021 no está aplicada en PROD, que requiere una decisión de despliegue separada.

## Decisiones de cierre

- El expediente completo pasa de `.harness/tasks/active/TASK-021-DASHBOARD-OPERATIVO/` a `.harness/tasks/archive/TASK-021-DASHBOARD-OPERATIVO/`, conforme a `.harness/protocols/close-task.md`.
- `docs/status.md` refleja el estado de cierre propuesto y `docs/mvp.md` registra el criterio 14 cumplido. `docs/modules/dashboard.md` ya describe el comportamiento integrado; no requiere cambio adicional. No hubo cambio arquitectónico ni decisión técnica nueva que registrar.
- La revisión independiente de este PR documental se registra en `closure-review.md`. El archivo y el estado `CLOSED` quedan definitivos al integrar ese PR; no se autoriza su merge mediante este expediente.
