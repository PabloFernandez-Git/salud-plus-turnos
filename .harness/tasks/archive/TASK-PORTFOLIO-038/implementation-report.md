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
- Prettier focal: PASS en los 14 archivos TS/TSX/CSS copiados.
- `next build --webpack` con URL DEMO y claves públicas sintéticas: PASS.
- `git diff --check`: PASS.

El `pnpm bootstrap` del worktree encontró un junction preexistente hacia `node_modules` del repositorio raíz y rechazó instalar allí. Se reemplazó solo el junction por una instalación local con el lockfile exacto; `pnpm install --frozen-lockfile` reutilizó 501 paquetes del almacén, sin descarga ni cambios de dependencias.

## Publicación

- Commit integrado y publicado: `557cc6ba481fb35d01c60e30e97cf839db494644` en `codex/portfolio-mvp`, desde el commit fuente selectivo `82935a7`.
- Vercel Production: `dpl_hZYWhAtM81GZ4h2kig23Ne9hG4pS`, `READY`, alias `https://salud-plus-portfolio.vercel.app/`.
- `/login` responde HTTP 200 y muestra Demo invitado y Turnstile. Los 12 scripts cargados por esa página contienen un único origen Supabase, `oygrwetmxsqgcizopezq.supabase.co`; ninguno de DEV.
- DEMO: Ana tiene VACATION el 16/11 y HOLIDAY el 20/11; Luis tiene ABSENCE el 17–18/11 y OTHER el 21–22/11. No hay turnos superpuestos con esos bloqueos y se conservan los tres turnos previos. Sin SQL mutante.
- Vercel no registró errores/fatales para ese despliegue durante la ventana consultada.
- Smoke visual autenticado de Agenda (Día, Semana y Mes) y Disponibilidad: **PASS por confirmación del operador en Chrome con acceso invitado**. Confirmó los cuatro bloqueos ficticios: Ana 16/11 y 20/11; Luis 17–18/11 y 21–22/11, en ambas vistas. El host de control del navegador del agente devolvió `browser access host is unavailable`, por lo que esta observación visual es informada por el operador y no una inspección directa del agente.
