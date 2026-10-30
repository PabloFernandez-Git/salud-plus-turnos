# TASK-035 — Preparación del cierre documental

**Resultado de preparación:** `READY_FOR_TASK035_CLOSURE`; TASK-035 permanece ACTIVE. Este documento no registra un commit, PR, merge, CI posterior a integración ni cierre ya realizados.

## Alcance aprobado

La configuración del centro permite a una membership ADMIN activa editar nombre, teléfono, email institucional y dirección mediante una RPC acotada con control de concurrencia. La pantalla ofrece zona horaria de solo lectura y conserva el borrador ante conflicto o resultado incierto. La lectura API de datos institucionales continúa disponible para miembros activos del mismo centro según la policy tenant preexistente; pantalla y escritura requieren ADMIN.

La navegación, el formulario, las Server Actions, el servicio, el schema compartido con el alta, los tipos Supabase, la migración y las pruebas pertenecen a TASK-035. No se modifican otras reglas, RLS ni permisos generales.

## Evidencia que se conserva

- Fase A: diagnóstico en el brief y plan.
- Fase B: `implementation-report.md`, código, pruebas y refinamientos visuales documentados.
- Fase C: `phase-c-report.md`; 27/27 migraciones DEV, RPC verificada, SQL local aislado, concurrencia de dos sesiones, persistencia real por formulario y restauración exacta de los datos visibles. No quedaron valores temporales pendientes.
- Fase D: `review.md`; dictamen final `APPROVED`, M1 y M2 `RESOLVED`, 64/64 pruebas focales, 34/34 de acceso y tooling focal en PASS. `review-response.md` conserva la respuesta a los hallazgos iniciales.
- `retrospective.md` registra las lecciones del proceso. Ningún informe histórico se elimina o reemplaza.

## Manifiesto del commit de implementación

- Ruta: `src/app/centers/[centerId]/settings/page.tsx`, `page.test.tsx`.
- Acciones: `src/modules/access/actions/center-settings-actions.ts`, `center-settings-actions.test.ts`.
- Formulario: `src/modules/access/components/center-settings-screen.tsx`, `center-settings-screen.test.tsx`.
- Navegación: `src/modules/access/components/center-navigation.tsx`, `center-navigation.test.tsx`.
- Validación: `src/modules/access/schemas/center-institutional.ts`, `center-institutional.test.ts`, `platform.ts`.
- Servidor: `src/modules/access/server/center-settings.ts`, `center-settings.test.ts`, `center-settings-action.ts`, `center-settings-action.test.ts`.
- Contrato: `src/lib/supabase/database.types.ts`.
- SQL: `supabase/migrations/20261030120000_admin_update_center_settings.sql`, `supabase/tests/task-035-center-settings.sql`.
- Documentación compartida: `docs/modules/centers.md`, `docs/modules/access.md`, `docs/status.md`.
- Expediente activo completo: `.harness/tasks/active/TASK-035/{brief.md,plan.md,implementation-report.md,phase-c-report.md,review.md,review-response.md,closure.md,retrospective.md}`.

Son 29 archivos. El diff de `docs/status.md`, los módulos documentales y los archivos compartidos de código se inspeccionó por hunk; sus cambios listados corresponden a TASK-035. Se excluyen expresamente `next-env.d.ts`, la página raíz del centro y su test, las otras TASK activas/archivadas, artefactos visuales ajenos, scripts temporales, `.pnpm-store/` y `supabase/.branches/`.

## Integración propuesta

1. Crear un commit de implementación de TASK-035 en `codex/task-035-center-settings` con selección explícita de archivos. Revisar el diff staged antes del commit para excluir cambios ajenos.
2. Abrir PR hacia `main`, ejecutar CI y revisar el diff y los checks. Integrar según la estrategia habitual del repositorio tras autorización.
3. Sólo después de confirmar el merge en `main`, preparar un cambio documental separado: trasladar **todo** `.harness/tasks/active/TASK-035/` a `.harness/tasks/archive/TASK-035/` sin perder evidencia, actualizar este cierre con PR, SHA, checks y fecha efectivos, y cambiar `docs/status.md` a CLOSED / ARCHIVED propuesto.
4. Verificar el traslado y el estado documental; obtener la revisión y autorización de cierre requeridas por el harness antes de integrar ese cambio documental. El cierre formal ocurre al integrarlo.

## Riesgos y límites preservados

El trigger previo de `centers.updated_at` basado en `now()` no garantiza monotonía para varios cambios en una sola transacción; el flujo actual hace una RPC por solicitud y las carreras verificadas pasaron. No se probó una identidad no ADMIN en DEV: los rechazos por rol y centro se probaron en PostgreSQL local. Los nuevos caminos de error de caché/red se probaron con mocks. La navegación SPA ajena al formulario conserva el límite aceptado en el brief. No se operó en PROD.

## Verificación de preparación

`pnpm bootstrap`: PASS. Doce suites de TASK-035, alta compartida y acceso: **98/98 PASS**. `pnpm typecheck`: PASS. `pnpm lint`: código 0, sin errores; un warning preexistente por `oid` sin uso en TASK-009. Prettier focal: PASS. El SHA-256 de la migración sigue siendo `A1B631DC5297E450AEB677A881AEC5625E4040A115C68E4B1F83F07A659A52D4`, igual al informe de Fase C y la revisión. No se repitieron SQL ni escrituras DEV.

Al auditar antes del commit, `HEAD`, `main`, `origin/main` local y la rama `main` remota consultada con `git ls-remote` coincidían en `dd3c2c9bcb83c15f7c16ff258415e6488cc91db9`. No había commits propios de TASK-035, diferencias entre HEAD y main ni archivos staged. `git diff --check` pasó. El árbol mezclado permite preparar un commit selectivo tras revisar el diff staged.

## Datos pendientes de completar después de integrar

- Commit y PR de implementación, resultado de CI y SHA del merge en `main`.
- PR/commit documental de archivo, revisión del traslado y fecha de cierre efectiva.
