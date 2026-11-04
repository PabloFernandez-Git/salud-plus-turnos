# Implementación

- La página `/login` usa título y descripción de exploración cuando `PORTFOLIO_DEMO_MODE=true`.
- En DEMO, el único Turnstile aparece antes del botón principal de invitado. Debajo queda el ingreso por email y contraseña, identificado como alternativa y con botón secundario.
- Los dos botones DEMO tienen cursor pointer habilitados, cursor not allowed y opacidad reducida deshabilitados; el login fuera de DEMO mantiene el botón principal original.
- No se alteró la lógica de Auth ni la configuración de Supabase, Cloudflare o variables de entorno.

## Verificación

- Tests focales: 3 archivos, 9 tests PASS (`vitest --configLoader runner`).
- `pnpm typecheck`: PASS.
- ESLint focal y Prettier: PASS.
- Build DEMO: PASS con `next build --webpack`, usando valores sintéticos de prueba solo en el proceso. El build Turbopack predeterminado no puede resolver el junction local `node_modules` que apunta fuera del filesystem root.
- `pnpm bootstrap`: Node y pnpm correctos; termina con FAIL porque falta `.env.local` en este worktree.
