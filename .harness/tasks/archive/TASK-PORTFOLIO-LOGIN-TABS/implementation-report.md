# Implementación

- `/login` usa un contenedor de dos paneles solo en DEMO. El panel decorativo contiene únicamente «Salud Plus», un degradado y una cruz CSS no interactiva; en móvil se oculta.
- El panel derecho presenta pestañas accesibles con «Iniciar sesión» inicial, cambio por clic, flechas, Home, End y enlaces inferiores que actualizan la pestaña y el foco sin navegar ni enviar el formulario.
- Los campos de credenciales conservan sus valores al alternar. El mismo componente Turnstile permanece montado entre ambos flujos, con un único token compartido.
- Se mantiene `AuthCard` fuera de DEMO, sin cambios en Auth, Supabase, Cloudflare, Vercel, migraciones, variables persistentes ni dependencias.

## Verificación

- Tests focales: 4 archivos, 14 tests PASS (`vitest --configLoader runner`).
- `pnpm typecheck`, ESLint focal y Prettier: PASS.
- Build DEMO con webpack: PASS con valores sintéticos limitados al proceso de build; no se creó ni cambió `.env.local`.
- Revisión visual en navegador de producción local: 1280 × 800 y 375 × 812 para ambas pestañas. El título de invitado ocupa una línea en escritorio; `scrollWidth` iguala el viewport en móvil.
- `pnpm bootstrap`: Node y pnpm correctos; falla por ausencia preexistente de `.env.local`.

## Límite local

El script externo de Turnstile no completó la carga durante la captura local, por lo que se vio su estado de error. La integración del token, expiración y reset permanece cubierta por los tests; el aspecto del widget real requiere revisión en un entorno con acceso a Cloudflare.
