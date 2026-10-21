# Implementación y verificación

- `CenterHeader` activa `confirm` sólo para el `LogoutButton` del Dashboard. Otros usos mantienen el formulario inmediato existente.
- La confirmación usa `<dialog>` nativo, ancho máximo 448 px, copy solicitado y `modalActionGroupClass`. Cancelar/Escape/fondo cierran sin llamar a la acción; el foco vuelve al botón de origen.
- La confirmación invoca el mismo `logoutAction` sin cambios. `useActionState` conserva errores en el diálogo, mientras `isPending` y una guarda sincrónica impiden cierres y envíos duplicados durante la operación.
- Se actualizó el paso existente de `tests/e2e/auth-access.spec.mjs` para confirmar el diálogo y esperar la redirección. No se ejecutó DEV.

## Verificación local

- Vitest focal: 2 archivos, 10/10 PASS, incluyendo StrictMode, cierre sin acción, error y pending.
- TypeScript, ESLint focal, Prettier focal, sintaxis del E2E y `git diff --check`: PASS.
- Chromium sintético a 1440/390 px: diálogo centrado de 448/358 px; botones centrados de 44 px; Cancelar/Escape/fondo 0 llamadas; pending sin duplicados; error visible; confirmación invoca la acción simulada; foco y Tab/Shift+Tab contenidos; sin overflow.
- Capturas: `artifacts/task017-logout-confirmation/{desktop-1440,mobile-390}-{confirmacion,error}.png` y `results.json`.

Sin acceso a Supabase DEV/PROD, commit ni push.
