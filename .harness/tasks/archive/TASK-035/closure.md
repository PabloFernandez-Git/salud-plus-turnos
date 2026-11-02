# TASK-035 — Preparación del cierre documental

**Estado:** cierre funcional integrado en `main`; cierre documental preparado como `CLOSED / ARCHIVED` propuesto. El cierre formal de TASK-035 será efectivo únicamente tras la aprobación e integración de este cambio documental en `main`.

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
- Expediente archivado completo: `.harness/tasks/archive/TASK-035/{brief.md,plan.md,implementation-report.md,phase-c-report.md,review.md,review-response.md,closure.md,retrospective.md}`.

Son 29 archivos. El diff de `docs/status.md`, los módulos documentales y los archivos compartidos de código se inspeccionó por hunk; sus cambios listados corresponden a TASK-035. Se excluyen expresamente `next-env.d.ts`, la página raíz del centro y su test, las otras TASK activas/archivadas, artefactos visuales ajenos, scripts temporales, `.pnpm-store/` y `supabase/.branches/`.

## Integración funcional confirmada

- [PR #46](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/46) se integró por squash merge el 2026-11-02.
- Commit de implementación en la rama del PR: `d1dec943ba463628bb34462fa2528a634c6d67c9`.
- Commit squash en `main` y `origin/main`: `86c190f7c6ce328a0d810f06977ad61925cb2eaf`.
- El [CI del PR #46](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/41444972346) concluyó en **SUCCESS**.
- Fase A: diagnóstico completado en [brief](brief.md) y [plan](plan.md). Fase B: implementación completada y documentada en [implementation-report.md](implementation-report.md). Fase C: `PHASE_C_PASSED` según [phase-c-report.md](phase-c-report.md). Fase D: dictamen final `APPROVED` tras re-review según [review.md](review.md); M1 y M2 quedaron `RESOLVED` y la [respuesta](review-response.md) conserva el tratamiento de ambos hallazgos.

En Supabase DEV constan 27/27 migraciones aplicadas y la RPC `admin_update_center_settings` verificada. La prueba real desde la interfaz confirmó guardado, recarga, actualización del encabezado, rechazo de una versión obsoleta y restauración exacta de los datos visibles originales. La carrera de dos conexiones PostgreSQL se validó en una base local aislada; no quedaron valores temporales en DEV. La evidencia detallada está en [Fase C](phase-c-report.md). No se repitieron pruebas ni operaciones en DEV para este cierre.

## Cierre documental propuesto

Los ocho documentos del expediente se trasladaron íntegramente a `.harness/tasks/archive/TASK-035/`. Seis archivos históricos conservaron sus hashes SHA-256; en `review.md` sólo se corrigieron tres referencias a la nueva ubicación. `docs/status.md` apunta al expediente archivado y propone `CLOSED / ARCHIVED`; la tarea sigue formalmente ACTIVE hasta aprobar e integrar el cambio documental.

## Riesgos y límites preservados

El trigger previo de `centers.updated_at` basado en `now()` no garantiza monotonía para varios cambios en una sola transacción; el flujo actual hace una RPC por solicitud y las carreras verificadas pasaron. No se probó una identidad no ADMIN en DEV: los rechazos por rol y centro se probaron en PostgreSQL local. Los nuevos caminos de error de caché/red se probaron con mocks. La navegación SPA ajena al formulario conserva el límite aceptado en el brief. No se operó en PROD.

## Verificación previa al PR de implementación

`pnpm bootstrap`: PASS. Doce suites de TASK-035, alta compartida y acceso: **98/98 PASS**. `pnpm typecheck`: PASS. `pnpm lint`: código 0, sin errores; un warning preexistente por `oid` sin uso en TASK-009. Prettier focal: PASS. El SHA-256 de la migración sigue siendo `A1B631DC5297E450AEB677A881AEC5625E4040A115C68E4B1F83F07A659A52D4`, igual al informe de Fase C y la revisión. No se repitieron SQL ni escrituras DEV.

Al auditar antes del commit, `HEAD`, `main`, `origin/main` local y la rama `main` remota consultada con `git ls-remote` coincidían en `dd3c2c9bcb83c15f7c16ff258415e6488cc91db9`. No había commits propios de TASK-035, diferencias entre HEAD y main ni archivos staged. `git diff --check` pasó. El árbol mezclado permite preparar un commit selectivo tras revisar el diff staged.

## Verificación del traslado documental

El worktree documental parte de `origin/main` en `86c190f7c6ce328a0d810f06977ad61925cb2eaf`; el checkout original con cambios ajenos permanece intacto. El directorio activo de TASK-035 ya no existe en este worktree y el archivo contiene los ocho documentos previstos. La comparación de blobs de Git confirmó que los seis documentos históricos no editados conservan exactamente su contenido; `review.md` sólo cambió tres rutas y `closure.md` registra la integración y el cierre propuesto. Los enlaces relativos del expediente y `docs/status.md` apuntan a archivos existentes. Prettier focal con `--end-of-line crlf`, para respetar los finales de línea preexistentes de estos Markdown, y `git diff --check` pasaron. El intento de `pnpm bootstrap` en el worktree nuevo no completó la instalación por `EACCES` al descargar desde npm; la revisión documental usó el Prettier ya instalado en el checkout original. No se modificó código funcional, migraciones, permisos ni datos.

## Datos pendientes de completar

- Revisión del cambio documental y fecha efectiva de cierre tras su aprobación e integración en `main`.
