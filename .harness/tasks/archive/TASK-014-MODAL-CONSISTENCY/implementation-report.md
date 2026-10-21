# Implementación — TASK-014

## Cambios

- El disparador del listado dice **Administrar acceso**; conserva el botón secundario y abre el mismo modal. Se actualizaron selectores de pruebas de componente, E2E y scripts visuales locales.
- `PatientDialog` conserva su drawer para Administración de pacientes. Sólo Registration activa la variante centrada de 672 px máximos, fondo oscurecido, altura acotada al viewport y scroll interno, con encabezado y X del patrón aprobado.
- X, fondo y Escape pasan por el mismo guard. Los datos sin guardar muestran una confirmación dentro del diálogo; Seguir editando conserva los valores y Descartar cierra sin mutar. Pending bloquea el cierre. Se conserva el foco dentro y se restaura al disparador.
- El contenido y los handlers de resolve, create, link y reactivate no cambiaron. No hubo cambios de contratos, Auth, RLS, RPC, PostgreSQL ni permisos.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest focal de cuatro archivos afectados: 57/57 PASS, incluidos los caminos existentes de registro y los nuevos cierres/foco/pending.
- `pnpm typecheck`, ESLint focal y `git diff --check`: PASS.
- Chromium local con props y acciones sintéticas a 1440 y 390 px: botón sin desbordar la tabla/página; registro centrado, etapa 2 con scroll interno y sin desbordamiento; X, fondo, Escape, descarte, conservación de valores, foco/Tab; alta, vínculo y reactivación 1/1 por flujo. Resultados y capturas en `artifacts/task014-modal-consistency/`.

No hubo acceso a Supabase DEV/PROD ni commit, push o merge.
