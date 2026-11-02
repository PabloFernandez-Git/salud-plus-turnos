# TASK-035 — Informe de implementación de Fase B

**Estado:** implementación local; sin aplicación DEV/PROD, sin Fases C/D. **Rama:** `codex/task-035-center-settings`; HEAD `dd3c2c9bcb83c15f7c16ff258415e6488cc91db9` (sin commit TASK-035).

## B1 — PostgreSQL

`supabase/migrations/20261030120000_admin_update_center_settings.sql` define RPC `SECURITY DEFINER`, `search_path = ''`, grant `EXECUTE` únicamente a `authenticated` y ningún `UPDATE` directo de tabla. Usa lock advisory del centro y lock de fila, comprueba membership ADMIN activa del mismo centro con centro activo, compara `updated_at` bajo lock y modifica sólo nombre, teléfono, email y dirección. Devuelve valores persistidos y timestamp. Error de conflicto estable `P0001 / STALE_CENTER_SETTINGS`; permiso `42501`; input `22023`.

`supabase/tests/task-035-center-settings.sql` prepara fixtures locales y verifica éxito, normalización, no-op, rechazo de un token stale, roles, centro ajeno/inactivo, actor sin sesión, privilegios, configuración de la función y columnas protegidas. **No ejecutado**: `docker ps` falló por acceso denegado al daemon local. No se identificó una base PostgreSQL local aislada y descartable. Tampoco se probó una carrera simultánea de dos sesiones. No se usaron credenciales ni bases remotas.

Cuando exista una base local aislada y migrada, identificar su host/base/rol antes de ejecutar `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/task-035-center-settings.sql`. El script usa una transacción con `rollback`; no se debe apuntar a DEV/PROD.

## B2 — Aplicación

`center-institutional.ts` comparte reglas con el alta de `/platform`. Query institucional, servicio de actualización y Server Action mantienen `updated_at` como texto. La acción valida UUID y rol ADMIN antes del payload, devuelve errores seguros y revalida settings y layout del centro al guardar. Una acción de recarga vuelve a autorizar antes de usar la query del módulo. El servicio usa el cliente de sesión, traduce únicamente `P0001 / STALE_CENTER_SETTINGS` a conflicto y convierte opcionales vacíos en NULL.

`database.types.ts` incorpora manualmente la firma exacta de la migración. `pnpm db:types` usa `--project-id` de Supabase DEV y escribe el archivo completo, por lo que no se ejecutó. Pendiente: contrastar el tipo con un esquema local migrado fiable o regenerarlo sólo cuando se autorice el acceso correspondiente.
Con Supabase local aislado, `pnpm exec supabase gen types typescript --local --schema public` permite comparar la firma generada con la edición manual antes de reemplazar el archivo.

## B3 — Interfaz

Ruta `/centers/[centerId]/settings`, guardia ADMIN y tarjeta de navegación sólo para ADMIN. Formulario responsive de cuatro campos, zona horaria legible readonly, dirty normalizado, guardado deshabilitado sin cambios válidos, errores por campo, borrador conservado, éxito con valores persistidos y refresh del encabezado. Cancelar y recarga tras conflicto piden confirmación de descarte; la recarga obtiene datos actuales mediante una lectura autorizada y mantiene estable el componente durante la revalidación. `beforeunload` cubre la salida del navegador; no hay bloqueo global de navegación SPA ajena al formulario.

## Evidencia focal

- `pnpm bootstrap`: PASS; solo lectura.
- `pnpm exec vitest run ...` TASK-035: 20/20 PASS en seis archivos; luego 9/9 PASS en los dos archivos afectados por la recarga autorizada (tres casos nuevos). Total focal TASK-035: 23 casos distintos aprobados. Primera corrida 18/19: una expectativa del test corría mientras el botón mostraba «Guardando…»; se corrigió la espera y repitió la batería focal.
- `pnpm exec vitest run src/modules/access/schemas/platform.test.ts src/modules/access/server/platform-actions.test.ts src/modules/access/components/create-center-panel.test.tsx --maxWorkers=1 --no-file-parallelism`: 33/33 PASS.
- `pnpm typecheck`: PASS.
- ESLint focal de los archivos TS/TSX afectados: PASS. Una primera corrida detectó `setState` síncrono en efecto; se sustituyó por remontaje de página al cambiar `updated_at` y se repitió.
- Prettier focal de archivos TS/TSX afectados: PASS al escribir formato.
- `git diff --check`: PASS para archivos rastreados. Inspección de espacios finales en archivos nuevos: sin hallazgos.
- Prueba SQL local, Supabase DEV/PROD, Chromium, E2E, suite completa y revisión independiente final: NO EJECUTADOS en Fase B.

## Riesgos y siguientes fases

La prueba de comportamiento PostgreSQL y el contrato de tipos generado siguen pendientes por falta de base local identificada. El contrato UI/SQL se validó con pruebas sintéticas, no con persistencia desplegada. Fase C debe validar la ruta Next.js, encabezado, permisos y persistencia en el entorno que se autorice, sin tocar el servidor existente por defecto. Fase D reserva suite completa, revisión independiente y gate. No considerar TASK-035 cerrada.

## Primer refinamiento visual previo a Fase C (superado por la segunda iteración)

Se comparó Configuración con Pacientes, Profesionales, Especialidades y Gestión de usuarios. El encabezado propio, la tarjeta con radio y padding distintos, los campos sin el mismo borde/error, los mensajes planos y las acciones sin estados hover/focus rompían el patrón compartido. La distribución de tres campos cortos dejaba una columna vacía en escritorio.

La pantalla reutiliza ahora `ModuleHeader`, `FormFieldError`, `formFieldErrorProps`, `modulePrimaryActionClass` y `moduleSecondaryActionClass`. El formulario mantiene una tarjeta blanca con borde y radio `xl`, nombre y dirección ocupan el ancho de la tarjeta, teléfono y email comparten fila desde `sm`, y en móvil los cuatro campos se apilan. Se alinearon mensajes, botones y diálogo con los estilos administrativos. No cambió lógica, validaciones, contratos, acciones ni seguridad.

Verificación: 12/12 pruebas focales de pantalla, ruta y navegación, `tsc --noEmit`, ESLint y Prettier focales en PASS. En `localhost:3000`, Fast Refresh mostró la ruta autenticada sin reiniciar el servidor; inspección visual en escritorio y a 390 px sin desbordes. Un borrador habilitó Guardar y Cancelar abrió el diálogo de descarte; al restaurar el valor inicial, Guardar volvió a deshabilitarse. No se envió el formulario ni se comprobó persistencia real: esa verificación permanece pendiente de Fase C. TASK-035 sigue ACTIVE.

## Segundo refinamiento visual previo a Fase C

La revisión visual detectó una tarjeta editable limitada a `max-w-3xl` bajo un encabezado que usaba el ancho completo, además de una zona horaria reducida a texto entre divisores. La composición dejaba casi media pantalla vacía. Gestión de usuarios, Pacientes, Profesionales y Especialidades usan el contenedor compartido de hasta 1400 px y tarjetas que aprovechan el ancho disponible.

La tarjeta editable ahora ocupa el ancho del encabezado. Sus cuatro campos forman dos columnas regulares desde `sm` y una columna en móvil. El bloque de zona horaria recupera borde, fondo gris y padding de tarjeta informativa compacta; comparte la sección inferior con las acciones, separado de los campos por un único divisor. Las acciones mantienen su orden y comportamiento.

`localhost:3000` se comprobó sin reiniciar el servidor en escritorio, a 820 px y a 390 px; no se observó desborde horizontal. En móvil, un borrador habilitó Guardar y Cancelar mostró el diálogo; se restauró el valor inicial y Guardar volvió a deshabilitarse sin enviar datos. Pruebas focales de pantalla, ruta y navegación: 12/12 PASS. TypeScript (`tsc --noEmit`), ESLint y Prettier focales: PASS. Persistencia real y Fases C/D siguen fuera de alcance; TASK-035 continúa ACTIVE y pendiente de aprobación visual humana.

## Correcciones UX y diagnóstico de persistencia previos a Fase C

El cursor de los botones de Configuración era `default` al estar habilitados porque las clases de acción compartidas no declaran `cursor-pointer`. Profesionales y componentes de Access aplican selectores acotados a botones habilitados. Se añadió ese patrón sólo a la pantalla y al modal portalled; los botones deshabilitados conservan `not-allowed`. En `localhost:3000` se comprobó por estilo calculado `pointer` para Cancelar, Guardar habilitado, Seguir editando, Descartar cambios y el enlace del encabezado; Guardar deshabilitado devolvió `not-allowed`.

El backdrop estaba dentro de `PageReveal`, cuya animación aplica `transform`; un `fixed` descendiente se posicionaba respecto de ese contenedor. Antes de la corrección, su rectángulo comenzaba en `y=129` y medía 607 px de alto en un viewport de 720 px. El modal se monta ahora mediante `createPortal` en `document.body`, como otros diálogos de Access. Luego cubrió `y=0` y el alto completo de 720 px en escritorio y 844 px a 390 px, incluso con la página desplazada; permaneció centrado y el encabezado quedó oscurecido. El foco inicial, cierre, borrador y confirmación se conservaron. Una prueba de componente comprueba el montaje en `body` y el foco.

Recorrido del guardado revisado sin escritura real: el formulario envía los cuatro campos y `expectedUpdatedAt`; el schema y la Server Action validan y autorizan; el servicio llama a `admin_update_center_settings` con los seis parámetros de la migración y conserva el timestamp textual. La respuesta `invalid`, la denegación `42501` y el conflicto `P0001 / STALE_CENTER_SETTINGS` tienen tratamientos diferenciados. El mensaje observado corresponde al catch de error inesperado de persistencia. Según el pedido y `docs/status.md`, la migración que crea la RPC aún no se aplicó a DEV/PROD; su ausencia basta para impedir el guardado en DEV. Supabase documenta `PGRST202` cuando una función no existe o su firma falta en la caché: https://supabase.com/docs/guides/api/rest/postgrest-error-codes. **Inferencia:** ésa es la causa más probable del intento manual; no se obtuvo el código real de esa solicitud ni se descartó un defecto latente de integración.

El mensaje genérico ya no atribuye el fallo a los datos ingresados ni expone detalles de Supabase/PostgreSQL. Se agregaron pruebas sintéticas para un fallo `PGRST202` y para conservar el borrador al mostrar el error. La consulta remota read-only con Supabase CLI no pudo autenticarse (`SUPABASE_ACCESS_TOKEN` ausente); la variante con clave pública obtuvo HTTP 401. La revisión automática rechazó una consulta OpenAPI con `SUPABASE_SECRET_KEY` por el riesgo de transmitir esa credencial. No se reintentó con ella ni se ejecutó la RPC. No hubo acceso concluyente al catálogo o a registros de la solicitud manual. Para probar persistencia real falta aplicar la migración por un flujo autorizado y disponer de un entorno preparado; esa actividad queda fuera de esta iteración.

Verificación focal: 23/23 pruebas en seis archivos; TypeScript (`tsc --noEmit`), ESLint y Prettier focales PASS. En localhost se verificaron viewport y scroll en escritorio y móvil, cursores calculados y navegación real al descartar, sin enviar el formulario ni modificar datos persistidos. TASK-035 sigue ACTIVE; no se iniciaron Fases C/D.
