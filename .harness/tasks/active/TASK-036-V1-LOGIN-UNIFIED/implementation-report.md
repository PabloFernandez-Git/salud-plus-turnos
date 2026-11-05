# TASK-036 — Implementación y verificación

## Cambio

- `/login` usa `LoginShell`, adaptado de la composición de `DemoLoginShell` de `codex/portfolio-mvp`.
- Se conservaron el formulario V1 y sus llamadas a `loginAction`, la recuperación, validación, errores, sesión y redirecciones. No se copiaron flags de DEMO, acceso invitado ni Turnstile.
- Un ajuste responsive reduce la altura del marco a 800 px de viewport o menos.

## Verificación

- Chromium local con URL de Supabase ficticia, sin conexión ni escrituras a DEV/DEMO: 1366 × 608, 1440 × 900 y 390 × 844. En los tres tamaños `scrollWidth` y `scrollHeight` coincidieron con el viewport y el formulario fue legible.
- A 1366 × 608: error de callback, errores de campos al enviar el formulario vacío y estado «Ingresando…» con petición interceptada localmente. El botón pendiente quedó deshabilitado y no apareció desborde.
- Comparación con la referencia: mismo marco de dos columnas, gradiente, cruz, tarjeta, radios, sombras, tipografía y marca móvil. El portfolio publicado no fue accesible desde Chromium local por restricción de red; la comparación tomó el código de `codex/portfolio-mvp` como fuente visual.
- Pruebas focales existentes de `LoginForm`, operaciones Auth y destino poslogin: 16/16 PASS. Typecheck: PASS. ESLint completo: 0 errores y 1 warning preexistente de `oid` en `scripts/task009-gate-d/preflight-dev-readonly.mjs`. Prettier en código cambiado y documentos nuevos: PASS; `docs/status.md` y `docs/modules/access.md` ya fallaban el formato de Prettier en `origin/main`, por lo que se conservaron sin reformateo masivo.

## Límite

No se probó una autenticación con credenciales reales porque Supabase DEV/DEMO quedó fuera de alcance. La ruta, formulario y acción de autenticación no cambiaron de contrato ni implementación.
