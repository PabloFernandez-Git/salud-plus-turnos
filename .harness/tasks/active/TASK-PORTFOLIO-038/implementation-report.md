# TASK-PORTFOLIO-038 — Integración en portfolio

## Alcance local

- Base `codex/portfolio-mvp` `7e6973c`, actualizada por fast-forward desde `ce6e8d3`.
- Fuente selectiva `82935a7`: Agenda, Disponibilidad, consulta `staff_list_availability_blocks`, tipos, ajuste de foco del sidebar y pruebas asociadas.
- No se incorporaron `main`, migraciones, seed, SQL de auditoría, Actions o RPC de escritura. Los cambios sin commit del worktree fuente tampoco se copiaron.
- `PORTFOLIO_DEMO_MODE`, Turnstile y la implementación de acceso invitado quedaron sin cambios.

## Verificación previa a publicación

- Supabase `oygrwetmxsqgcizopezq`: 4 bloqueos activos y 3 turnos. `authenticated` tiene SELECT de bloqueos y EXECUTE de la RPC de listado; no tiene INSERT, UPDATE ni DELETE en la tabla. La RPC de creación consultada no existe. Consultas de solo lectura; sin migración ni seed.
- Vercel Production: `PORTFOLIO_DEMO_MODE`, `PORTFOLIO_CAPTCHA_REQUIRED` y `PORTFOLIO_GUEST_ACCESS_ENABLED` son `true`. La URL de Supabase se guarda como variable sensible; el guard de servidor exige exactamente la URL DEMO al habilitar invitados.
- Vitest focal: 7 archivos, 78/78 pruebas aprobadas.
- TypeScript `tsc --noEmit`: PASS. ESLint focal: PASS.
- Prettier focal: se aplicó el formato a los 14 archivos TS/TSX/CSS copiados; comprobar de nuevo antes del commit.
- `next build --webpack` con URL DEMO y claves públicas sintéticas: PASS.
- `git diff --check`: PASS.

El `pnpm bootstrap` del worktree encontró un junction preexistente hacia `node_modules` del repositorio raíz y rechazó instalar allí. Se reemplazó solo el junction por una instalación local con el lockfile exacto; `pnpm install --frozen-lockfile` reutilizó 501 paquetes del almacén, sin descarga ni cambios de dependencias.

## Publicación

Pendiente de commit, push, despliegue y verificación funcional en la URL pública.
