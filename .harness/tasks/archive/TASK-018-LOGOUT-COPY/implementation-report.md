# Implementación

- Se reemplazaron únicamente el título y la descripción visibles del diálogo de cierre de sesión.
- Se actualizaron las aserciones de componente, el selector E2E y la verificación visual local que dependían del texto anterior.
- El componente conserva su estructura, estilos, acciones, estados y manejo de cierre.

## Verificación

- `pnpm exec vitest run src/modules/access/components/logout-button.test.tsx`: 7/7 PASS.
- `node scripts/task017-logout-confirmation-visual.mjs`: PASS en Chromium 1440 y 390 px con mocks locales; capturas actualizadas en `artifacts/task017-logout-confirmation/`.
- `pnpm exec eslint` sobre los cuatro archivos afectados: PASS.
- `pnpm exec prettier --check` sobre los cuatro archivos afectados: PASS.
- `pnpm exec tsc --noEmit`: PASS.
- `node --check tests/e2e/auth-access.spec.mjs`: PASS.
- `git diff --check`: PASS (avisos existentes de fin de línea en otros archivos).

No se ejecutó E2E conectado a Supabase.
