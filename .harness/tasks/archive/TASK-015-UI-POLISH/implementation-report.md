# Implementación

- Se añadió `src/app/icon.svg`, calendario azul con cruz médica, mediante la convención de iconos de Next.js. `metadata.title` y `metadata.description` no se tocaron. No hay archivo `favicon.ico` en `src/app` ni `public`.
- `ModuleHeader` acepta una opción de ancho de descripción que utiliza sólo Pacientes; el texto y el botón se conservaron.
- El estado «Descartar cambios» del mismo diálogo de registro ahora tiene ancho máximo de 448 px, copy solicitado, descripción accesible y acciones alineadas. Se conservaron los manejadores de foco, cierre, pendiente y descarte.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest focal: 3 archivos, 32/32 PASS.
- `pnpm typecheck`: PASS.
- ESLint y Prettier focales: PASS.
- Chromium sintético local 1440/390 px: PASS. Descripción 24/72 px; modal 448/358 px; botones en la misma fila y de igual alto; sin overflow; foco, Escape, fondo, conservación y descarte: PASS.
- Next local `GET /icon.svg`: 200 `image/svg+xml`; `GET /favicon.ico`: 404. Chromium local cargó el enlace `rel=icon` y el SVG.
- Capturas: `artifacts/task015-ui-polish/{desktop-1440,mobile-390}-{pacientes,descartar-cambios}.png`.

No hubo acceso a Supabase DEV/PROD, commit, push ni merge.
