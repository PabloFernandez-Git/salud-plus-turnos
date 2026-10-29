# TASK-034 — Fase D: gate técnico final

**Dictamen:** `APPROVED`. TASK-034 permanece **ACTIVE**. El diff funcional está listo para preparar posteriormente un commit selectivo y un PR, sujeto a autorización separada. Durante este gate no se hizo commit, push, PR, merge ni despliegue.

## Preflight y alcance

- Rama: `codex/task-034-platform-admin-resilience`. `HEAD`, `main` y merge-base local: `855f7fae08623ea9c4bebfaf4535bfbf6f0aaccf`, la base conocida de TASK-034. No hay commits nuevos ni cambios staged.
- El diff tracked de TASK-034 incluye `src/modules/access/server/access.ts`, `src/modules/access/domain/access-routing.ts`, `src/app/centers/[centerId]/layout.tsx`, `src/app/platform/page.tsx`, sus pruebas y `docs/modules/access.md`/`docs/status.md`. Son nuevos en TASK-034 `src/app/error.tsx`, `src/app/error.test.tsx`, `src/modules/access/server/access.test.ts` y el expediente `.harness/tasks/active/TASK-034/`.
- Se preservaron los cambios preexistentes de `next-env.d.ts`, `src/app/centers/[centerId]/page.tsx` y `page.test.tsx`, los archivos sin seguimiento ajenos, TASK-029, los expedientes archivados, `.env.local` y el servidor Next existente. Ninguno forma parte del cambio funcional propuesto para TASK-034.
- `pnpm bootstrap`: PASS; Node 24.21.0 y pnpm 11.26.0. Verificó configuración local, sin consulta a Supabase DEV/PROD.

## Auditoría funcional y de seguridad

- `requireCenterMembership` sigue exigiendo identidad, perfil, membresía activa y centro activo antes de consultar la navegación opcional. Los errores obligatorios se propagan y los roles protegidos siguen usando `requireRole`.
- `hasOptionalPlatformNavigation` limita la recuperación al enlace global: un error lo oculta. `getAccessOverview` conserva centros accesibles y representa permiso desconocido con `null`; `false` continúa siendo una denegación confirmada. Sin centros y con fallo global propaga el error para permitir reintento. Ningún error produce `true`.
- `/platform` mantiene `requirePlatformAdmin`; `listPlatformCenters` y las mutaciones conservan sus guardias propias. La membresía tenant no concede permiso global.
- El botón de error raíz recarga sólo al pulsarlo, vuelve a resolver el servidor y muestra un mensaje genérico. La Fase C comprobó fallo persistente y recuperación sin bucle.

## Verificación técnica

| Comprobación                                                  | Resultado                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`, primera corrida                                 | ESLint PASS con 0 errores y 1 warning preexistente en `scripts/task009-gate-d/preflight-dev-readonly.mjs:238`; TypeScript PASS. Vitest: 96/96 archivos iniciados y 723/723 pruebas PASS, pero 7 archivos no iniciaron por `Timeout waiting for worker to respond`; comando terminó con código 1 antes de tooling. |
| Repetición controlada `pnpm exec vitest run --maxWorkers=2`   | **103/103 archivos, 943/943 pruebas PASS**, sin errores de pool; duración reportada 515.43 s. No se cambiaron dependencias ni configuración.                                                                                                                                                                      |
| `pnpm test:task007-tooling`                                   | 11/11 PASS.                                                                                                                                                                                                                                                                                                       |
| `pnpm test:task021-tooling`                                   | 20/20 PASS.                                                                                                                                                                                                                                                                                                       |
| Pruebas focales TASK-034                                      | Los seis archivos focales, con 64 pruebas, están incluidos en la suite completa aprobada; no se duplicó su ejecución.                                                                                                                                                                                             |
| Prettier focal de código y documentación                      | PASS.                                                                                                                                                                                                                                                                                                             |
| `git diff --check` y `node --check functional-next-check.mjs` | PASS. Git sólo avisó de conversión LF/CRLF en el working tree.                                                                                                                                                                                                                                                    |

Se intentó inicialmente pasar `--minWorkers=2` a la repetición; Vitest 5.0.1 rechazó esa opción antes de ejecutar pruebas. Se consultó la ayuda CLI y se usó el parámetro admitido `--maxWorkers=2`. El primer resultado de `pnpm check` se conserva explícitamente; el fallo fue de inicio de workers, no de aserciones. La repetición completa y las dos suites de tooling verificaron todo lo que ese comando habría ejecutado.

## Revisión independiente

El revisor emitió `APPROVED` sobre el diff acumulado frente a `main`, incluidas pruebas y expediente. No encontró defectos bloqueantes de autorización, aislamiento, manejo de `false`/`null`/error, propagación de errores obligatorios, navegación, reintento ni contratos. Detectó tres imprecisiones no bloqueantes en `implementation-report.md` y `plan.md`; se corrigieron y se detallan en `review.md`. No hubo corrección funcional en Fase D.

## Evidencia y límites

Fase A: `DIAGNOSIS_COMPLETE`. Fase B: `IMPLEMENTATION_READY_FOR_VALIDATION`, con 64/64 pruebas focales. Fase C: `FUNCTIONAL_VALIDATION_APPROVED`, con **18 escenarios distintos PASS en Chromium** sobre rutas reales de Next.js y Auth/servicios sintéticos. Véase `validation-report.md` y `evidence/`.

No se validó RLS desplegada, autenticación real, persistencia ni acciones administrativas contra Supabase. No hubo operaciones en DEV/PROD ni modificaciones de SQL, RPC, RLS o migraciones. El riesgo residual es la ausencia de E2E con Supabase real en este gate; no afecta la conclusión de la validación local solicitada.

Tiempos aproximados: preflight y análisis ~4 min; `pnpm check` inicial ~12 min, repetición Vitest ~9 min y tooling/formato ~1 min; revisión independiente ~2 min en paralelo; documentación y cierre ~3 min. La mayor parte del tiempo se concentró en arranque y ejecución de workers Vitest.
