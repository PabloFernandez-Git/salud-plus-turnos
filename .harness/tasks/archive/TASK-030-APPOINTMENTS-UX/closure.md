# TASK-030 — Cierre documental del refinamiento UX de Turnos

**Estado:** CLOSED / ARCHIVED propuesto en este PR documental. El cierre formal quedará consolidado cuando se integre este PR a `main`. No implica despliegue.

## Resultado integrado

- La implementación se integró mediante [PR #36](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/36), commit `d8baf097f4f0114a1eceb9c6dca0e6cddfc49bea` en `main`.
- El [job `verify` posterior al merge](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40525457158/job/122263689050) terminó `SUCCESS`, incluidos los pasos Format check y Verify.
- La revisión independiente final del código consta como **APPROVED**, sin hallazgos bloqueantes pendientes, en [review.md](review.md). Es una revisión del expediente, no una aprobación formal registrada en GitHub.
- La persona usuaria aprobó visualmente las cuatro iteraciones en escritorio y móvil.

## Funcionalidad refinada

El listado y sus tarjetas presentan fecha civil, hora, paciente y etiquetas de estado con mejor jerarquía. El detalle destaca la información y organiza las acciones según rol, estado y ancho de pantalla, con confirmaciones para acciones terminales y regreso visible al listado. La nota administrativa tiene lectura, edición, eliminación y confirmación de descarte, conservando la distinción persistida entre `NULL`, cadena vacía y texto.

Crear turno requiere seleccionar paciente antes de continuar. El calendario presenta fecha civil del centro y la grilla distingue los horarios exactos disponibles de PostgreSQL de las referencias deshabilitadas; las horas ambiguas por DST muestran offset. La reprogramación usa un modal accesible con carga inicial, errores y descarte confirmado. También se ajustaron cursores y estados de foco. El detalle completo está en [implementation-report.md](implementation-report.md) y las decisiones en [brief.md](brief.md).

## Verificaciones históricas

Estas comprobaciones pertenecen a la implementación ya integrada; no se repitieron en este cierre documental.

| Ámbito | Evidencia y resultado |
| --- | --- |
| Pruebas locales antes de integrar `main` en la rama de implementación | Gate registrado en [implementation-report.md](implementation-report.md): Vitest 95 archivos, **751/751 PASS**; focales TASK-030 7 archivos, **51/51 PASS**; tooling Node TASK-007 **11/11** y TASK-021 **20/20**; TypeScript y Prettier focal PASS; ESLint completo 0 errores, 1 warning preexistente. |
| Pruebas locales tras integrar `main` en la rama del PR #36 | La [descripción del PR #36](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/36) registra Vitest 96 archivos, **848/848 PASS**; focales **51/51 PASS**; tooling **11/11 + 20/20 PASS**; TypeScript y Prettier focal PASS; ESLint completo 0 errores, 1 warning preexistente. Este resultado precede al merge final del PR a `main`. |
| Revisión independiente | [review.md](review.md) registra **APPROVED** para el diff acumulado. La [descripción del PR #36](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/36) registra la revisión focal posterior a integrar `main` como **APPROVED**. No quedaron hallazgos bloqueantes. |
| Validación visual manual | Aprobación de la persona usuaria en escritorio y móvil; capturas y resultados sintéticos en [evidence/](evidence/), [evidence-iteration-2/](evidence-iteration-2/), [evidence-iteration-3/](evidence-iteration-3/) y [evidence-final/](evidence-final/). |
| CI hospedado posterior al merge del PR #36 | GitHub Actions, job [`verify`](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40525457158/job/122263689050): **SUCCESS**. Sus logs registran Vitest **96 archivos, 848/848 PASS**, tooling **11/11 + 20/20 PASS** y build completado. |

`pnpm check` abortó localmente antes de ejecutar sus scripts porque el wrapper intentó reconciliar `node_modules` sin TTY (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Sus verificaciones equivalentes se ejecutaron individualmente con los binarios instalados; el CI hospedado finalizó correctamente. No se ejecutaron E2E con Supabase, pruebas SQL ni verificaciones remotas de la aplicación en este cierre. Las pruebas visuales utilizaron datos sintéticos.

## Limitaciones aceptadas y trabajo diferido

- Back/Forward de navegación SPA puede eludir la confirmación de descarte de una nota sin guardar.
- «Volver a turnos» no restaura los filtros anteriores.
- El calendario no permite escribir manualmente la fecha.
- Las restricciones temporales de transición siguen pendientes: Confirmar antes del inicio, marcar Atendido desde el inicio y marcar Ausente desde la finalización. Su definición e implementación corresponden a una futura tarea funcional. Se conservan por ahora las reglas existentes de Cancelar y Reprogramar; este PR no crea TASK-031.

## Archivo

Se trasladaron sin alterar los 62 archivos versionados del expediente activo: brief, plan, informe, revisión, cuatro scripts de validación, resultados y capturas de todas las iteraciones. Los scripts conservan sus rutas de salida originales bajo `tasks/active/TASK-030/` como evidencia histórica; no se ejecutan desde esta carpeta archivada. La integridad de los blobs se comprueba en la [revisión documental](closure-review.md).
