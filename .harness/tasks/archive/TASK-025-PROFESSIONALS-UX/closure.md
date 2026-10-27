# TASK-025 — Cierre documental

**Fecha:** 2026-10-26

**Estado:** `CLOSED / ARCHIVED` en esta rama documental; pendiente de integración del PR de cierre.

## Resultado

El [PR #28](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/28) fue aprobado y fusionado en `main` mediante el commit `0e9a3e91a6043e7de9d28e58f605fd74e352cb10`. GitHub confirmó `merged=true`, base `main` y ese SHA; la rama documental parte del mismo `origin/main`.

Quedaron integrados los modales responsive de alta/vinculación, configuración y cambio de estado de Profesionales; el descarte seguro de borradores; los guardados independientes de Configuración y Especialidades con token CAS actualizado; la validación accesible y el selector de países ISO alpha-2. La tabla muestra especialidades activas, habilita Guardar configuración sólo ante cambios e indica el desplazamiento horizontal cuando corresponde. Las acciones conservan una fila y una altura uniforme en móvil. El 404 local del detalle de Disponibilidad se debió a un registro de rutas obsoleto del servidor de desarrollo y se resolvió mediante Fast Refresh; se añadió una prueba de regresión de la ruta sin cambiar su código.

El alcance, las decisiones y los hallazgos de implementación permanecen en [brief.md](brief.md), [plan.md](plan.md), [implementation-report.md](implementation-report.md) y [review.md](review.md). Se conserva también [visual-check.mjs](visual-check.mjs) como parte del expediente.

## Evidencia de aceptación

- [CI del PR #28](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40321739140): `success`.
- Pruebas focales de Profesionales y Disponibilidad: 134/134 PASS en 9 archivos.
- Regresión Playwright de la ruta de detalle de Disponibilidad: 1/1 PASS sobre el servidor local existente.
- TypeScript, ESLint focal, Prettier focal y `git diff --check` de implementación: PASS.
- Chromium sintético a 390, 556 y 1440 px: PASS. La persona usuaria aprobó la revisión visual y funcional autenticada en escritorio y móvil el 26/10/2026, incluidos los accesos a Disponibilidad desde ambas pantallas.
- [review.md](review.md): revisión técnica local PASS, sin hallazgos abiertos antes del PR de implementación.

## Decisiones y límites

El expediente completo se traslada de `tasks/active/` a `tasks/archive/`, conservando sus cinco archivos originales. La documentación del módulo Profesionales ya fue actualizada en PR #28. No se requieren cambios adicionales en arquitectura o decisiones técnicas. Este cierre sólo cambia documentación y expediente; no reejecuta pruebas funcionales ni modifica código, base de datos, RPC, RLS o migrations. No accede a Supabase DEV/PROD ni interviene el servidor local.

Para una mejora futura del MVP, conviene conservar la prueba de registro de ruta frente a estados obsoletos del servidor de desarrollo y reutilizar el patrón de borradores independientes, confirmación de descarte y errores accesibles en formularios similares. No se amplía el alcance aprobado de TASK-025. La integridad y el alcance de este cierre se revisan en [closure-review.md](closure-review.md). El PR documental no se fusionará sin aprobación de la persona usuaria.
