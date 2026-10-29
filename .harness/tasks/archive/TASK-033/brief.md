# TASK-033 — Refinamiento UX de plataforma y Centros

**Estado:** ACTIVE. **Base:** `origin/main` (`a5b5042`, PR #40 y #41). **Rama:** `codex/task-033-centers-ux`.

## Objetivo

Mejorar navegación plataforma↔centro, alta guiada de centros y listado móvil sin cambiar permisos, reglas de negocio ni contratos de servidor.

## Criterios de aceptación

- En el encabezado tenant, «Administrar plataforma» aparece sólo si la consulta autoritativa confirma PLATFORM_ADMIN, con `/platform` protegido independientemente. El enlace a centros desde plataforma refleja cero, uno o varios accesos activos en centros activos; errores de consulta son visibles.
- «Crear centro» abre un diálogo accesible sin mover el listado. Etapas: resolución de email sin alta, datos con confirmación exacta de contraseña para identidad nueva y revisión sin mutación. Éxito permanece abierto, distingue operación nueva de confirmación idempotente y permite cerrar o crear otro.
- Cierre, Escape y descarte protegen cambios; pendientes e incertidumbre conservan la intención y el mismo `operation_id`, sin persistir contraseña.
- Tabla de escritorio y tarjetas móviles muestran todos los datos y acciones actuales en el mismo orden, sin desbordamiento a 390/556 px.
- Pruebas focales, regresiones, TypeScript, ESLint, Prettier, `git diff --check`, capturas Chromium a 390/556/1440 px y revisión independiente. Mantener tarea ACTIVE para segunda revisión visual.

## Diagnóstico inicial

`requirePlatformAdmin` consulta `platform_admins`; `requireCenterMembership` exige membership y centro activos, y `requireRole` restringe ADMIN tenant. `getAccessOverview` consulta memberships y centros activos y falla ante error; `/select-center` redirige con un solo centro. El encabezado tenant no ofrece `/platform`. `/platform` usa `requirePlatformAdmin`, lista con `platform_list_centers` y agrega estados desde RPC, pero muestra alta inline y siempre enlaza `/select-center` si hay accesos. La resolución exacta de email y el alta idempotente viven en acciones/servicios existentes; el componente conserva intención no secreta en sesión y mismo ID ante incertidumbre. La activación usa la RPC actual y confirmación existente.

## Impacto y riesgos

Componentes de `src/modules/access`, páginas/layouts de plataforma y centro, pruebas focales y documentación de Centros/acceso/estado. Riesgos: fuga del enlace privilegiado, convertir error de accesos en cero destinos, pérdida de intención tras timeout o cierre, contraseña en almacenamiento, doble alta y cambios involuntarios de reglas de estado. Sin SQL, RPC, RLS, Auth, migraciones ni operaciones Supabase. Preservar TASK-029 y archivos locales ajenos.

`pnpm bootstrap` invoca la reconciliación de `node_modules` y falla sin TTY; `node scripts/bootstrap.mjs` pasó. Se usarán binarios existentes sin reinstalar.

## Ajuste visual posterior solicitado

La segunda revisión visual solicita únicamente un icono decorativo similar a Building2 antes de «Administrar plataforma» y otro similar a LayoutDashboard antes de «Ir a mi centro». Ambos deben medir aproximadamente 17 px, usar currentColor, mantener 8 px de separación y conservar estilos y destinos. Sin dependencias ni cambios de navegación, permisos, modal o reglas.

## Segunda iteración visual solicitada

En el dashboard, igualar ancho y alto de «Administrar plataforma» y «Cerrar sesión»; ocultar el acceso a plataforma en módulos interiores y conservar «Volver al inicio». En `/platform`, separar navegación y cierre de sesión del alta, ubicar «Crear centro» junto a «Centros registrados» y dividir la descripción en dos párrafos. En el modal, explicar el paso 1, separar encabezado, contenido desplazable y pie, enfocar y revelar el primer campo inválido, traducir la etiqueta de zona horaria y pulir revisión, descarte y éxito. Verificar 390/556/1440 px y viewport bajo, pruebas focales y de regresión, revisión independiente y capturas nuevas. No cambiar reglas, permisos, contratos, SQL ni mecanismos de intención/idempotencia; mantener ACTIVE para revisión visual.

Riesgo principal: el pie sticky actual comparte scroll con el formulario y puede cubrir errores. Separar regiones debe preservar foco, valores y el bloqueo de envío duplicado. El alcance afecta sólo encabezados, plataforma, modal, pruebas y evidencia del expediente.

## Tercera iteración visual solicitada

Compactar por igual las acciones del dashboard; ajustar a unos 8 px la separación entre párrafos de plataforma; quitar divisores visibles del paso 1 y centrar su acción; cambiar la zona horaria a un selector buscable sin limitar zonas IANA válidas; centrar grupos de acciones en escritorio; y dar cursor de interacción sólo a controles habilitados. Verificar el estado pendiente sin rediseñar la idempotencia. Capturas nuevas a 390/556/1440 px, pruebas y revisión independiente. Mantener ACTIVE, sin commit ni operaciones remotas.

El servidor acepta cualquier identificador validado por `Intl.DateTimeFormat`, incluidos alias que `Intl.supportedValuesOf("timeZone")` no enumera. El selector debe permitir introducir una zona válida fuera de sus sugerencias, preservar el valor exacto y rechazar el inválido con las validaciones existentes. Riesgos: pérdida de alias, divergencia del valor enviado y error de foco/scroll al cambiar el control. El estado incierto requiere preservar el identificador hasta conocer un resultado concluyente.

La persona usuaria aclaró el criterio funcional: una intención incierta no puede abandonarse para iniciar otra alta con un `operation_id` distinto. Sólo se permite reintentar/verificar con el identificador original; un resultado concluyente vuelve a habilitar el flujo habitual. Una intención guardada ilegible bloquea nuevas altas y requiere verificación administrativa segura. Implementar el cambio mínimo sin modificar backend ni esquema.

## Cuarta iteración visual solicitada

Unificar el encabezado de `/platform` con el encabezado horizontal del centro; sustituir la confirmación nativa de desactivación por un diálogo propio accesible sin cambiar la acción de servidor; comprobar en Chromium la usabilidad real del selector de zona horaria y corregir sólo fallos demostrados; distinguir la creación en curso de un resultado incierto sin alterar el contrato ni el identificador idempotente. Aceptación: navegación y permisos intactos, cancelación sin mutación, confirmación única, foco y teclado, progreso normal sin aviso de incertidumbre, recuperación con el mismo `operation_id`, pruebas focales, TypeScript, ESLint, Prettier, capturas 390/556/1440 y revisión independiente del diff. Mantener ACTIVE y no publicar.

Riesgos: el diálogo de estado se renderiza dentro de una tabla o tarjeta; debe quedar en la capa superior y restaurar foco. La intención persistida antes del envío protege la idempotencia pero no prueba incertidumbre; el estado pendiente de la acción debe decidir el texto visible. Un `datalist` nativo puede ocultar o recortar sugerencias según navegador y teclado virtual; verificar antes de reemplazarlo. No tocar Auth, RPC, RLS, SQL ni otros módulos.

## Quinta iteración: loaders y encabezado de plataforma

Objetivo acotado: reutilizar `AppLoader` durante esperas reales del dashboard y `/platform`, cubrir la navegación en ambos sentidos y compactar moderadamente sólo el encabezado de plataforma. Aceptación: sin tarjetas vacías transitorias, sin loader cuando los datos están listos, error o autorización visibles al finalizar, destinos y permisos intactos, encabezado sin overflow a 390/556/1440 px, pruebas focales y visuales, revisión independiente. TASK-033 permanece ACTIVE y sin publicar.

Diagnóstico: `/platform/loading.tsx` contiene dos esqueletos de grandes tarjetas blancas. El dashboard espera `refreshDailyDashboardAction` en cliente y renderiza sus tarjetas con textos de carga antes de recibir datos. El `loading.tsx` del centro está dentro de su layout, cuyo `requireCenterMembership` y consulta de PLATFORM_ADMIN esperan antes de renderizar; según la convención de Next, ese límite cubre la página, no el propio layout. El enlace entre rutas puede esperar allí sin fallback visible. El `PageReveal` del dashboard mantiene `transform` durante su animación y puede limitar un loader `fixed` descendiente. Riesgos: no alterar el resultado HTTP/redirect de autorización moviendo consultas bajo Suspense; no mostrar un loader persistente sobre errores; evitar parpadeo en navegación rápida. Solución prevista: sustituir el esqueleto de plataforma por `AppLoader`, mostrarlo mientras el dashboard carece de datos, dar feedback de navegación con el estado de `Link`, y preservar la autorización en el layout. Sin contratos de servidor ni demoras artificiales.

## Sexta iteración: validación, zonas horarias y administradores

Objetivo: evitar validación HTML nativa del email en el primer paso y mostrar el error local bajo el campo; presentar etiquetas amigables de zona horaria separadas del valor IANA, conservando entrada libre, teclado y desplegable adaptativo; distinguir email institucional del administrador activo en el listado sólo si existe una fuente autorizada. Aceptación: pruebas de entradas válidas/inválidas, offsets con DST, búsqueda, selección y visual 390/556/1440 px, sin cambios de creación ni idempotencia.

Diagnóstico de administradores: `platform_list_centers()` devuelve centros, email institucional y contadores, no identidades. `center_memberships` liga `center_id` y `user_id`, rol y `is_active`; `public.users.email` proyecta Auth. Sus SELECT RLS permiten el propio usuario o un ADMIN del centro, no un PLATFORM_ADMIN global. Para mostrar todos los ADMIN activos por centro sin N+1 haría falta una RPC `SECURITY DEFINER` de lectura por lote, que compruebe `private.is_platform_admin()` y devuelva exclusivamente `center_id` y emails de memberships `ADMIN` activas, sin pacientes ni datos operativos. Esta RPC exige una migración y contrato tipado nuevos. La persona usuaria eligió **dejar esa columna pendiente** y no autorizó la migración en esta iteración. No se mostrarán emails históricos ni una columna incompleta.

## Gate técnico final solicitado

La validación visual fue aprobada. Objetivo: dictaminar preparación para commit/PR mediante revisión acumulada frente a `origin/main` y de archivos nuevos, suite Vitest completa y focal, tooling, TypeScript, ESLint, Prettier, Git y revisión independiente. Criterio: no quedan bloqueantes funcionales o de seguridad; cualquier fallo de tooling se clasifica con evidencia y se distingue del formato o test preexistente. Riesgos principales: lectura global no autorizada, duplicación por intención incierta, regresión de foco y disponibilidad por consulta adicional de `platform_admins`. Impacto autorizado: corrección focal de bloqueantes dentro del alcance y documentación del gate; sin commit, push, PR, merge, Supabase ni cierre de TASK-033.
