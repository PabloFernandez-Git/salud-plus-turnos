# TASK-034 — Cierre documental de la resiliencia de acceso ante fallos de platform_admins

**Estado propuesto: CLOSED / ARCHIVED.** La implementación está integrada en `main`. El cierre formal será efectivo cuando se autorice y fusione el PR documental de este expediente; hasta entonces, TASK-034 permanece ACTIVE.

## Problema, causa y solución

Una falla de la lectura global opcional de `platform_admins` impedía abrir un centro autorizado después de validar su membresía. También hacía fallar `getAccessOverview` por su `Promise.all`, perdía los centros accesibles y confundía permiso global desconocido con una negativa. Sin centros accesibles, la falla no ofrecía recuperación. El botón «Reintentar» no volvía a consultar el servidor y `/platform` repetía una lectura global para el enlace de retorno.

La solución separó la autorización tenant obligatoria de la navegación global opcional. Un error global con centros accesibles conserva esos destinos y representa el permiso como `null`; sin centros, propaga el error y muestra un reintento manual que recarga la ruta. `/platform` mantiene su autorización estricta y dejó de usar `getAccessOverview` para el enlace de retorno. Se conservaron los controles de membresía, centro y plataforma. No se modificaron SQL, RPC, RLS, migraciones ni acciones administrativas.

## Integración y fases

- [PR de implementación #44](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/44): **MERGED**. Commit de implementación `8ee1971df6c8f97e12eeee80d9fbe0ed23ef691f`; squash merge `5c06957f030110efc303a2464345dd377c6ad495` en `main` el **2026-10-29 a las 18:53:07 UTC**. `origin/main` apunta a ese merge al preparar este cierre.
- Fase A: `DIAGNOSIS_COMPLETE`. Fase B: `IMPLEMENTATION_READY_FOR_VALIDATION`. Fase C: `FUNCTIONAL_VALIDATION_APPROVED`. Fase D: [gate técnico](gate-report.md) `APPROVED` y [revisión independiente de implementación](review.md) `APPROVED`.
- El [CI del PR #44](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40934275701) terminó en **SUCCESS**.

## Evidencia y límites

- Vitest: **943/943 pruebas PASS en 103/103 archivos** con `--maxWorkers=2`; las **64 pruebas focales** están incluidas. Tooling: **31/31 PASS**. TypeScript, ESLint, Prettier focal y `git diff --check`: PASS.
- La primera ejecución completa de `pnpm check` terminó con código 1 por siete workers de Vitest que no arrancaron a tiempo. Las **723 pruebas que sí se ejecutaron pasaron**. La repetición controlada completó las 943 pruebas y el tooling se ejecutó por separado. El fallo inicial no se presenta como un `pnpm check` exitoso.
- [Validación funcional](validation-report.md): **18 escenarios PASS en Chromium** con rutas reales de Next.js y servicios y autenticación sintéticos. Se comprobó el reintento tras fallo persistente y recuperación. El [informe de implementación](implementation-report.md), [brief](brief.md), [plan](plan.md), script y `evidence/` conservan el detalle histórico.
- No se ejecutaron E2E autenticados contra Supabase real ni se verificaron las políticas RLS desplegadas. No hubo operaciones en DEV/PROD. Estas limitaciones siguen vigentes; el cierre documental no añade validación funcional.

El expediente se archiva íntegramente el **2026-10-29**. La [revisión independiente del cierre](closure-review.md) verifica este traslado y su alcance exclusivamente documental. No se fusiona este PR ni se despliega la aplicación como parte del cierre propuesto.
