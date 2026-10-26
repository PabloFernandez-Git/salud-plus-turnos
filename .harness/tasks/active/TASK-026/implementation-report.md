# TASK-026 — Informe de implementación

## Cambios

- La tabla de Especialidades utiliza el patrón de Profesionales para detectar overflow real con `ResizeObserver` y `resize` de ventana; la indicación secundaria aparece sólo durante ese overflow.
- La celda Acciones contiene un grupo horizontal sin wrap. Editar y Desactivar/Activar comparten clases para altura mínima de 44 px, centrado, padding, tipografía, foco y cursores habilitado/deshabilitado. La tabla conserva el scroll dentro de su sección.
- Se agregaron pruebas de componente para la indicación y ambos estados de acciones, además de una comprobación local Chromium con datos sintéticos a 390, 556 y 1440 px.
- Se actualizó la documentación de Especialidades. No se modificaron datos, permisos, servidor, modales ni reglas de negocio.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest focal de `specialties-screen.test.tsx`: 25/25 PASS.
- `pnpm typecheck`: PASS.
- ESLint focal: PASS.
- Chromium local a 390, 556 y 1440 px, zoom 100 %: PASS para fila única, altura calculada de 44 px, centrado, scroll contenido, indicación según overflow y ausencia de overflow de página.
- `localhost:3000`: HTTP 200 con Next.js en ejecución después del cambio de rama.

## Verificación final para PR

- `pnpm verify`: PASS. ESLint terminó con una advertencia preexistente de variable sin usar en `scripts/task009-gate-d/preflight-dev-readonly.mjs`, sin errores; TypeScript PASS; Vitest 764/764 en 93 archivos; tooling `node:test` 31/31; build Next.js PASS.
- `pnpm format:check` sobre todo el checkout de Windows: FAIL en 275 archivos ajenos al cambio por formato del checkout. El archivo de referencia `src/app/page.tsx` leído desde el blob de `HEAD` pasa Prettier, y los dos archivos fuente modificados pasan `prettier --check`. No se reformatearon archivos fuera de TASK-026.
- `git diff --check`: PASS.

## Aprobación visual y publicación

El 26/10/2026, la persona usuaria aprobó visualmente la tabla en `localhost:3000` tras revisarla personalmente a 390 y 556 px, ambas al 100 % de zoom. Autorizó preparar el commit y publicar un PR hacia `main`, sin merge ni cierre de TASK-026.

La revisión final confirmó que el diff de producto sólo cambia la tabla, sus pruebas y la documentación de Especialidades. Los modales, validaciones, confirmaciones y reglas de negocio permanecen intactos.
