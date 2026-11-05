# Implementación

- Se añadieron SVG outline de User, CirclePlay y ArrowRight dentro de `login-form.tsx`, exclusivos del modo DEMO. Lucide no está instalado en el proyecto; no se incorporaron dependencias.
- Cada tab usa un icono de 20 px que hereda `currentColor`. Los controles inferiores incluyen icono, texto y flecha dentro del mismo botón `inline-flex`.
- Los SVG tienen `aria-hidden` y `focusable=false`; los nombres accesibles siguen siendo los textos originales.
- No se modificaron el shell visual, los campos, los botones principales, Turnstile ni la lógica de autenticación.

## Verificación

- 4 archivos de tests focales: 14 pruebas aprobadas. `login-form.test.tsx` comprueba iconos decorativos, nombres accesibles y cambio en ambas direcciones; ya cubría teclado y token Turnstile compartido.
- Typecheck, ESLint focal, Prettier y build DEMO con webpack: aprobados.
- Chromium/Edge en `localhost:3001/login`: capturas de login e invitado en 1280 × 800, 900 × 850 y 375 × 812; sin scroll horizontal. Los dos tabs mantienen igual ancho; la transición de color finaliza con un solo tab activo.
- `pnpm bootstrap` validó Node y pnpm, pero no completó porque falta `.env.local` en este worktree. No se modificaron variables de entorno.

Turnstile mostró «Cargando verificación…» en la sesión local; su integración no se alteró y las pruebas focales pasaron.
