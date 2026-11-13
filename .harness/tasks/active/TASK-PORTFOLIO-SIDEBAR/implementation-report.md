# Implementación — TASK-PORTFOLIO-SIDEBAR

**Estado:** diseño aprobado visualmente; preparación de commit y PR hacia `codex/portfolio-mvp`. Sin integración ni publicación.

## Traslado selectivo de TASK-037

- Sidebar de 64 px, expansión superpuesta a 240 px, sombra, íconos Lucide, ruta activa y menú móvil accesible.
- Header de ancho completo, marca al Dashboard, acciones con íconos y cierre de sesión en todas las páginas del centro.
- Dashboard sin tarjetas de navegación, con Actualizar animado y deshabilitado mientras relee.
- `ModuleHeader` sin breadcrumb en pantallas principales, con retorno conservado en detalles.
- `lucide-react@1.72.0` y pruebas visuales y de componentes correspondientes.

## Adaptaciones propias de Portfolio

- El layout conserva el aviso DEMO superior y ajusta las filas del grid para ese aviso.
- El header conserva «Invitado» para correo sintético y «Demo de lectura» en lugar del rol visible de V1.
- El acceso a plataforma en DEMO conserva su visibilidad original: solo en Dashboard y únicamente con permiso global existente.
- La navegación muestra solo los módulos ya presentes en Portfolio y conserva la matriz de roles preexistente. No se trasladó el header ni las funciones de `/platform` de V1.
- Los archivos de login, Turnstile, acceso invitado, Server Actions de escritura, autorización, RLS, migraciones y configuración de Supabase no cambiaron.

## Verificación

- 280/280 pruebas focales de navegación, Dashboard, acceso invitado, login/Turnstile, controles de solo lectura y pantallas de módulos: PASS.
- TypeScript, ESLint focal, Prettier focal y `git diff --check`: PASS.
- Verificación final tras aprobación visual: 517/517 pruebas de acceso, autorización, DEMO y componentes afectados; TypeScript, ESLint y Prettier focales: PASS.
- Chromium con datos sintéticos a 1366×608, 1366×768, 1440×900 y 390×844: PASS. Se comprobaron sidebar 64/240 px sin mover el contenido, rutas de los ocho módulos, ruta activa, menú móvil, Escape, retorno de foco, aviso DEMO, identidad invitada, diálogo de salida, botón Actualizar y ausencia de desborde horizontal.
- Vista local: `http://127.0.0.1:3017/centers/11111111-1111-4111-8111-111111111111`. Se levanta con `node .harness/tasks/active/TASK-PORTFOLIO-SIDEBAR/preview.mjs` desde este worktree. Usa componentes reales y datos sintéticos, sin Supabase.

## Límites pendientes

`pnpm bootstrap` instaló dependencias y validó Node, pnpm y lockfile, pero terminó con código 1 porque este worktree no tiene `.env.local`. Por ello no se levantó Next con autenticación real ni se probó Turnstile en localhost. No se hicieron pruebas remotas de RLS o permisos ni se modificó Cloudflare. La revisión visual humana fue aprobada; la integración y publicación siguen pendientes.
