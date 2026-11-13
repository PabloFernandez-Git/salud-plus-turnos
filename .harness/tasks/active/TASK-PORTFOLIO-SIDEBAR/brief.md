# TASK-PORTFOLIO-SIDEBAR — Navegación V1 en Portfolio DEMO

**Base:** `origin/codex/portfolio-mvp` (`ce6e8d3`). **Referencia visual:** TASK-037 integrada en `origin/main` (`08a2125`, PR #49). **Rama:** `codex/portfolio-sidebar-navigation`.

## Objetivo

Adaptar la sidebar compacta, el encabezado, el Dashboard y los encabezados de módulos aprobados en V1 a la demo de portfolio, conservando todas sus rutas y restricciones de solo lectura.

## Criterios de aceptación

- Sidebar de 64 px que se expande a 240 px por mouse o foco, con sombra solo expandida, íconos, ruta activa y navegación por teclado.
- Menú móvil modal con Escape, selección y devolución de foco. Header de ancho completo con marca enlazada al Dashboard, centro, identidad y acciones accesibles con íconos.
- Dashboard operativo sin tarjetas de navegación, con Actualizar animado y accesible. Sin breadcrumbs en pantallas principales; los retornos de detalles permanecen.
- Se mantienen el aviso DEMO superior, la identidad de invitado, login tradicional, Turnstile, datos ficticios, controles de edición deshabilitados, guards, RLS y aislamiento de entornos. No se añaden funciones administrativas ni permisos.
- Pruebas focales, TypeScript, ESLint, Prettier y revisión local a 1366×608, 1366×768, 1440×900 y 390×844. Se informa por separado la evidencia visual y la autenticación o permisos reales.

## Impacto

`src/app/centers/[centerId]/layout.tsx`, componentes de navegación, header, Dashboard y `ModuleHeader`, sus pruebas y documentación relevante. `lucide-react` es la única dependencia visual nueva. Sin cambios de Auth, Server Actions, esquema, RLS, migraciones ni configuración remota.

## Riesgos y controles

- La copia directa del layout V1 quitaría el aviso DEMO: integrar la estructura de sidebar preservando el aviso existente.
- La copia directa del header V1 mostraría email sintético al invitado: conservar su tratamiento de identidad y el rótulo «Demo de lectura».
- Un enlace indebido o un control de escritura activo confundiría y podría exponer una acción: respetar la matriz de rutas y verificar los guards y estados deshabilitados existentes.
- El overlay y el menú móvil pueden desbordar o perder foco: comprobar geometría, hover, Escape, selección y teclado en los tamaños pedidos.
- Turnstile puede exigir un dominio autorizado: no cambiar Cloudflare ni afirmar una prueba real de login si localhost no la permite.

## Límite de publicación

La aprobación visual humana habilitó commit local, push de esta rama y PR hacia `codex/portfolio-mvp`.
El PR no se fusiona todavía. Sin deploy manual, migraciones ni cambios de Supabase, Vercel o Cloudflare.
