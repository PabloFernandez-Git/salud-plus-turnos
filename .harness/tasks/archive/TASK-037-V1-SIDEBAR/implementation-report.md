# TASK-037 — Informe de implementación

## Cambio

- Worktree `.worktrees/v1-sidebar-navigation`, rama `codex/v1-sidebar-navigation`, base `origin/main` `bb50697` (PR #48 integrado). Los cambios locales preexistentes del worktree original permanecen intactos.
- El layout `/centers/[centerId]` monta una sidebar de 240 px en escritorio y un menú modal en móvil. La navegación usa las rutas y la matriz de roles existentes. Los enlaces activos usan `aria-current="page"`, también en detalles de Turnos y otras rutas anidadas.
- El encabezado conserva centro, usuario, rol, enlace opcional a `/platform` y cierre de sesión en todas las pantallas del centro. Se quitó «Volver al inicio» porque Dashboard ya está en la sidebar.
- El Dashboard conserva `DailyDashboardPanel` y deja de renderizar tarjetas de navegación. No se modificaron consultas, acciones, autorización, Auth, RLS ni migraciones.
- Se añadió `lucide-react` 1.72.0 para los iconos de la navegación y el enlace de plataforma.

## Verificación

- `pnpm bootstrap`: PASS con `.env.local` y referencia de link local verificadas contra Supabase DEV `ehllxymqyzrofydrvtzo`; sin acceso a DEMO.
- Pruebas focales de layout, navegación, menú móvil, Dashboard y Gestión de usuarios: 21/21 PASS.
- Typecheck: PASS.
- ESLint global: 0 errores, 1 warning preexistente en `scripts/task009-gate-d/preflight-dev-readonly.mjs`.
- Prettier focal de código, dependencias y archivos del harness: PASS. Los tres documentos editados (`docs/modules/access.md`, `docs/modules/dashboard.md`, `docs/status.md`) ya fallan Prettier en `origin/main`; `pnpm format:check` global falla en 410 archivos del repositorio. No se aplicó formateo masivo.
- Chromium controlado con componentes reales y datos sintéticos en localhost: PASS en 1366 × 608, 1366 × 768, 1440 × 900 y 390 × 844. Revisados Dashboard, menú, Escape, selección, enlace activo, visibilidad de roles y desborde horizontal. Capturas en `artifacts/task037-sidebar-visual/`.
- Next DEV local: `http://localhost:3003`; una petición sin sesión a la ruta del centro devuelve `307 /login`, como corresponde.
- `git diff --check`: PASS. El wrapper de pnpm intentó reinstalar dependencias tras fijar la versión exacta de Lucide; la instalación se reconstruyó desde el store local y las verificaciones finales se ejecutaron con los binarios locales equivalentes. `node scripts/bootstrap.mjs` pasó de nuevo.

## Refinamiento de breadcrumbs y encabezado

- `ModuleHeader` omite el breadcrumb y el margen superior asociado en módulos principales. Las vistas de detalle y edición con `parent` conservan la ruta de retorno. Títulos, descripciones y acciones siguen presentes.
- El botón de cierre de sesión ajusta su ancho al contenido; los controles del encabezado comparten fila a la derecha en escritorio y se adaptan al espacio móvil. Se redujo el padding vertical del encabezado.
- Chromium local con los componentes reales y datos sintéticos: Dashboard y ocho módulos principales en 1366 × 608, 1366 × 768, 1440 × 900 y 390 × 844; sin scroll horizontal. Comprobados ambos controles en una fila en escritorio, encabezado sin acceso a plataforma, menú móvil y breadcrumb de detalle.
- Pruebas focales ampliadas: 195/195 PASS en 13 archivos. TypeScript, ESLint y Prettier focal del código y el harness: PASS. `git diff --check`: PASS.

## Límite de la revisión

La persona usuaria confirmó una revisión visual de la sidebar inicial con una sesión real de Supabase DEV. Para este refinamiento, el navegador integrado sigue sin acceder a esa sesión (host indisponible), por lo que la revisión autenticada del cambio se hizo en Chromium local con componentes reales y datos sintéticos. No se creó una cuenta ni se modificó Supabase DEV. Los cambios quedan disponibles en localhost:3003, sin commit por instrucción explícita.

## Sidebar compacta con expansión

- El layout reserva 64 px para el carril de escritorio; la sidebar se expande a 240 px en 200 ms como overlay al recibir un puntero mouse o foco de teclado. Se contrae al salir el puntero siempre que el foco no siga dentro.
- Los nueve destinos conservan icono, nombre accesible, ruta y visibilidad por rol. Los títulos de grupo aparecen al expandir; el carril contraído conserva separadores y resaltado activo. El menú móvil mantiene el comportamiento anterior y también se muestra en dispositivos táctiles de ancho tablet.
- Chromium con componentes reales y datos sintéticos: PASS en 1366 × 608, 1366 × 768, 1440 × 900 y 390 × 844, más 820 × 900 táctil. Se comprobaron estado contraído, expansión y contracción sin parpadeo, navegación por clic, foco de teclado, ruta activa, rol, menú móvil y ausencia de desbordamiento horizontal. El área principal conservó posición y ancho al expandir sobre Dashboard y Turnos; las capturas están en `artifacts/task037-sidebar-visual/`.
- Pruebas focales: 205/205 PASS en 15 archivos. TypeScript, ESLint y Prettier focal: PASS. `git diff --check`: PASS. `node scripts/bootstrap.mjs`: PASS con Supabase DEV. El servidor local en `http://localhost:3003` responde y redirige a `/login` sin sesión.
- El navegador integrado no pudo conectarse a la sesión DEV real durante este refinamiento. No hubo commit, push, deploy ni cambios de servicios externos.

## Encabezado de ancho completo

- El layout del centro ahora dispone el encabezado en la primera fila de ancho completo y, debajo, el carril de 64 px junto al contenido. La identidad Salud Plus y el disparador del menú móvil se trasladaron al encabezado. El panel de escritorio sigue expandiéndose a 240 px por mouse o foco y sólo se superpone a la fila inferior.
- Chromium local con componentes reales y datos sintéticos: PASS en 1366 × 608, 1366 × 768, 1440 × 900 y 390 × 844, más 820 × 900 táctil. Se comprobó el ancho y posición del encabezado, ausencia de superposición, posición estable del contenido al expandir, scroll vertical, altura de páginas cortas, estado activo, roles, menú móvil, Escape y ausencia de scroll horizontal. Capturas actualizadas en `artifacts/task037-sidebar-visual/`.
- Pruebas focales del layout, sidebar y navegación: 15/15 PASS. TypeScript y ESLint focal: PASS. Prettier focal y `git diff --check`: PASS. `node scripts/bootstrap.mjs`: PASS con configuración DEV. `http://localhost:3003` responde; la ruta de centro sin sesión devuelve `307 /login`.
- El navegador integrado continúa sin acceso al host y a la sesión DEV existente; la revisión visual autenticada del cambio queda para la persona usuaria en localhost:3003. No hubo commit, push, deploy ni cambios de servicios externos.

## Marca enlazada al Dashboard

- El ícono y texto Salud Plus forman un único Next.js Link a `/centers/[centerId]` del centro activo, con margen izquierdo de 20 px en móvil y 24 px en escritorio, cursor pointer y foco visible. El botón del menú móvil queda al otro lado de la fila de marca.
- Chromium local con componentes reales y datos sintéticos: PASS en los cuatro viewports, más tablet táctil. Se comprobó geometría, alineación vertical, cursor, href y navegación con Enter desde Configuración al Dashboard; el resto de módulos y la sidebar pasaron el harness visual.
- Pruebas focales de layout, sidebar y navegación: 15/15 PASS. TypeScript y ESLint focal: PASS. La sesión DEV real continúa inaccesible desde el navegador integrado; el servidor local en `http://localhost:3003` queda para revisión autenticada. Sin commit, push ni deploy.

## Acciones compactas y sombra de sidebar

- Las acciones del header usan controles cuadrados de 44 px con iconos Lucide: edificio para plataforma y salida para cierre de sesión. El botón de actualización del Dashboard usa icono de recarga de 44 px. Todos conservan `aria-label`, foco visible y tooltip de texto al pasar el mouse o recibir foco. La confirmación de cierre y el loader existente del Dashboard no cambiaron.
- La sidebar expandida agrega una sombra lateral sutil, sin alterar ancho, transición o interacción del menú móvil.
- Pruebas focales de layout, confirmación de salida, Dashboard, sidebar y navegación: 32/32 PASS. TypeScript y ESLint focal: PASS. Chromium local con componentes reales y datos sintéticos: PASS en 1366 × 608, 1366 × 768, 1440 × 900, 390 × 844 y tablet táctil 820 × 900. Se comprobaron cuadrados de 44 px, aparición y cierre de tooltips por hover y foco, ausencia de scroll horizontal, roles, expansión, rutas y menú móvil. Capturas actualizadas en `artifacts/task037-sidebar-visual/`.
- La sesión DEV real sigue sin estar disponible para el navegador integrado; la revisión autenticada queda en `http://localhost:3003`. Sin commit, push ni deploy.

## Recarga y encabezado de plataforma

- Actualizar conserva 44 px, tooltip, borde suave e icono Lucide azul sobre fondo azul claro. Mientras una relectura del mismo centro, membership y rol está pendiente, el resumen anterior permanece visible, el botón queda deshabilitado y el icono gira sólo cuando la preferencia de movimiento lo permite. La lectura inicial mantiene el loader existente; errores y cambios de acceso conservan sus flujos. No se modificó la Server Action.
- `/platform` usa un encabezado de ancho completo con marca Salud Plus, título, contexto, cuenta y advertencia. El retorno al centro y la salida inmediata son controles cuadrados con tooltip y foco visible. El cálculo del destino y la visibilidad del retorno permanecen en la página. Tabla, Crear centro y sus acciones no cambiaron.
- Pruebas focales de plataforma, logout, Dashboard y layout: 30/30 PASS; TypeScript y ESLint focal: PASS. Chromium local con componentes reales y datos sintéticos: PASS en 1366 × 608, 1366 × 768, 1440 × 900 y 390 × 844, más 820 × 900 táctil. Se comprobaron tamaños, tooltips, foco, navegación, scroll horizontal, animación normal y `prefers-reduced-motion`. Capturas en `artifacts/task037-sidebar-visual/`.
- El navegador integrado no pudo acceder a la sesión DEV existente; la revisión autenticada en `http://localhost:3003` sigue pendiente para la persona usuaria. Sin commit, push ni deploy.

## Alineación de marca en plataforma

- La marca de `/platform` se centra verticalmente respecto del bloque de contexto desde `sm` y enlaza a la ruta existente `/platform` con cursor pointer y foco visible. En móvil conserva la alineación izquierda. El título y las acciones no cambiaron.
- Chromium con componentes reales y datos sintéticos confirmó la geometría, navegación por teclado y ausencia de desborde en 1366 × 608, 1366 × 768, 1440 × 900 y 390 × 844. El navegador integrado continúa inaccesible para revisar la sesión DEV en localhost:3003.
