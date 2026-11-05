# Implementación

- Se aplicó un fondo azul continuo a la tarjeta exterior. El panel claro solo redondea su esquina superior izquierda; el azul redondea la inferior derecha sobre una base clara. La línea central permanece vertical entre ambas curvas.
- El panel izquierdo recibió un degradado turquesa/azul, dos ondas inferiores confinadas por `overflow-hidden`, una cruz ampliada con opacidad reducida y el nombre «Salud Plus» centrado en altura con acento verde.
- El cambio de código se limita a `src/modules/access/components/demo-login-shell.tsx`. El contenido y la lógica del panel derecho no cambiaron.
- Se actualizó la descripción visual en `docs/modules/access.md` y la fotografía de la tarea en `docs/status.md`.

## Verificación

- Vitest focal: 4 archivos, 14 pruebas aprobadas.
- `pnpm typecheck`: aprobado.
- ESLint focal y Prettier: aprobados.
- `next build --webpack` con configuración DEMO temporal en el proceso: aprobado.
- Revisión en `localhost:3001/login`: escritorio 1280 × 800 y tablet 900 × 850 con capturas de Edge; móvil 375 px con captura y métricas de Chromium. Sin scroll horizontal en los tres tamaños.
- `pnpm bootstrap` validó Node y pnpm, pero no completó porque este worktree no tiene `.env.local`; no se creó ni modificó ninguna variable de entorno.

El widget Turnstile permaneció en el panel derecho sin cambios; el navegador local mostró «Cargando verificación…». Su funcionamiento de integración local ya estaba verificado antes de esta tarea y sus pruebas focales pasaron.
