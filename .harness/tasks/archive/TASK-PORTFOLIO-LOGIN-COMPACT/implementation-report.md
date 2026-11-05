# Implementación y verificación — login DEMO compacto

## Cambios

- Se agregaron selectores del login DEMO en el shell y el formulario para aplicar un ajuste acotado a escritorio con `min-width: 768px` y `max-height: 800px`.
- Se redujeron el padding vertical exterior e interior, la altura mínima del shell y los espacios verticales entre pestañas, tarjeta, campos y enlace inferior. El padding horizontal, las columnas, los controles, los colores y el widget Turnstile no se alteraron.
- Escritorios de mayor altura y móvil conservan sus reglas originales.

## Verificación visual

Playwright/Chromium local, zoom 100 %. Para medir el espacio del CAPTCHA se usó **solo en el navegador de prueba** un sustituto visual de 300 × 65 px; la aplicación y la configuración Turnstile no cambiaron. No se envió el token simulado ni se probó un acceso.

| Viewport | Pestaña | Altura documento | CAPTCHA | Botón y enlace inferior |
| --- | --- | ---: | --- | --- |
| 1366 × 768 | Iniciar sesión | 768 px | visible, 65 px | visibles |
| 1366 × 768 | Demo invitado | 768 px | visible, 65 px | visibles |
| 1366 × 680 | Iniciar sesión | 680 px | visible, 65 px | visibles; shell termina en y=644 |
| 1366 × 680 | Demo invitado | 680 px | visible, 65 px | visibles; shell termina en y=574 |
| 1440 × 900 | ambas | 900 px | visible, 65 px | visibles; reglas originales |
| 390 × 844 | ambas | 844 px | visible, 65 px | visibles; sin scroll horizontal |

Antes del ajuste, 1366 × 768 tenía un documento de 839 px con el sustituto visual, y 1366 × 680 tenía scroll por el mínimo de 700 px del shell y los márgenes exteriores. Se inspeccionaron las capturas de ambas pestañas y tamaños.

Con Turnstile real en localhost, la protección del dominio mostró error y opción de reintento. A 1366 × 680 ese estado también quedó completo sin scroll en ambas pestañas. Esto verifica disposición visual, no acceso real ni éxito de CAPTCHA.

## Verificaciones técnicas

- `pnpm bootstrap`: Node y pnpm correctos; detenido porque falta `.env.local` en este worktree.
- Prettier focal, ESLint focal, `pnpm typecheck` y `git diff --check`: PASS.
- Vitest focal (`login-form` y `turnstile`) con `--configLoader runner`: 11/11 PASS. El loader habitual no pudo escribir en `node_modules/.vite-temp` por permisos del entorno.

No se ejecutó build ni acceso real. El servidor local existente permitió la verificación de `/login`; no se cambió Supabase, Cloudflare ni Vercel.
