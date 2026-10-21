# Implementación — TASK-010 Usabilidad

## Cambios

- El primer paso de Agregar usuario alinea Email y Continuar en desktop con altura de 44 px; en mobile los apila. Se conservaron estados, validaciones y submit.
- Administrar abre un diálogo mediante portal fuera de la tabla. Muestra identidad, rol, estado y vínculo profesional aplicable; mantiene revisión, confirmación, errores y actualización posterior al éxito.
- El modal devuelve el foco al disparador, contiene Tab, admite Escape y Cancelar, exige confirmar el descarte si hay cambios y bloquea el cierre durante una mutación pendiente.
- No se modificaron Server Actions, queries, contratos, Auth, RLS, RPC, migraciones ni permisos.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest focal de los tres componentes afectados: 29/29 PASS.
- `pnpm typecheck`: PASS.
- ESLint focal de componentes, test y script visual: PASS.
- Chromium local sintético a 1440 y 390 px: PASS. Email/Continuar de 44 px, fila de tabla estable en 72.5 px, modal, foco/teclado, cancelación, rol/estado/vínculo profesional, revisión/confirmación y refresco tras éxito. Sin desbordamiento horizontal.
- Capturas y resultados: `artifacts/task010-usability/`.
- `git diff --check`: PASS.

La validación Chromium utilizó datos y acciones sintéticos en un harness visual local; no accedió a Supabase DEV ni PROD. No se hizo commit ni push.
