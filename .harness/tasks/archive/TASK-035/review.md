# TASK-035 — Fase D: revisión técnica independiente

**Fecha:** 2026-10-30

**Dictamen actual:** `APPROVED` tras re-review; el dictamen inicial fue `CHANGES_REQUESTED`.

**Rama y base:** `codex/task-035-center-settings`, `main` / merge-base `dd3c2c9bcb83c15f7c16ff258415e6488cc91db9`; sin commits de la tarea al momento de la revisión.
**Límite:** revisión de código, pruebas y expediente; sin cambios de producto, migraciones, permisos o datos, sin acceso a PROD y sin cierre.

## 1. Alcance y atribución

Se revisaron el brief, el informe de implementación, el informe de Fase C, las reglas de producto y autorización, la ruta y las Server Actions de configuración, el schema compartido con el alta, el componente, los tests, la migración y el test SQL. Se contrastaron la ruta y la RPC con las políticas y grants existentes de `centers`, el helper de rol y el trigger `updated_at`.

TASK-035 comprende `src/app/centers/[centerId]/settings/`, los archivos `center-settings*` y `center-institutional*` de `src/modules/access/`, la nueva tarjeta de navegación, el uso del schema en `platform.ts`, la firma agregada en `database.types.ts`, la migración `20261030120000_admin_update_center_settings.sql`, `supabase/tests/task-035-center-settings.sql` y su documentación. Los cambios locales en `next-env.d.ts`, la página raíz del centro, TASK-029, expedientes archivados, artefactos visuales y otros archivos sin seguimiento no se atribuyen a esta tarea. La política SELECT y el grant general sobre `centers` son anteriores a TASK-035; su interacción con el nuevo requisito sí forma parte de esta revisión.

## 2. Evidencia examinada

- `.harness/tasks/archive/TASK-035/{brief.md,implementation-report.md,phase-c-report.md}` y `docs/{product.md,status.md,business-rules.md,modules/centers.md,modules/access.md,decisions/05-autorizacion.md}`.
- Código, tests y migraciones mencionados arriba, más `authorization.ts`, `layout.tsx`, `20260921150000_initial_domain_schema.sql` y `20260922121000_add_auth_access_helpers_and_policies.sql`.
- El SHA-256 local de la migración es `A1B631DC5297E450AEB677A881AEC5625E4040A115C68E4B1F83F07A659A52D4`, igual al registrado en Fase C. El informe de Fase C documenta 27/27 migraciones DEV, catálogo y grants de la RPC, prueba SQL con rollback, carrera de dos conexiones, guardado real, conflicto y restauración. Se contrastaron esas afirmaciones con el código y el test, pero **no** se repitieron consultas ni escrituras en DEV, ni se dispone en el expediente de un log bruto independiente de esas operaciones.

## 3. Seguridad y autorización

La página valida UUID y exige `requireRole(centerId, ["ADMIN"])` antes de leer. La acción de recarga vuelve a autorizar y la de escritura autoriza antes de validar el payload. La RPC usa `SECURITY DEFINER` con `search_path = ''`, `auth.uid()`, `private.has_active_center_role(..., ADMIN)`, centro activo y grants de ejecución sólo a `authenticated`. Actualiza únicamente `name`, `phone`, `email` y `address`; `authenticated` no recibe UPDATE directo sobre `centers`. PLATFORM_ADMIN sin membership tenant no obtiene un bypass en esta RPC. El test SQL cubre negativas de rol, otro centro, centro inactivo y ausencia de sesión. No se encontró una vía de escritura no ADMIN en el código revisado.

Sí existe una diferencia de **lectura**: la ruta ADMIN está protegida, pero el grant y la policy SELECT preexistentes permiten a cualquier miembro activo de un centro leer todas las columnas de su fila en `public.centers`, incluidos teléfono, email y dirección. Esto no rompe aislamiento entre centros, pero no cumple una lectura ADMIN exclusiva si ése es el alcance del criterio de aceptación. Ver hallazgo M1.

## 4. Funcionalidad, concurrencia y persistencia

La pantalla carga los cuatro valores y la zona horaria; el borrador se compara tras `trim`, Guardar requiere cambio válido y se deshabilita durante el envío. Cancelar pide confirmación si hay cambios; tras conflicto se mantiene el borrador y se ofrece recarga con confirmación de descarte. La respuesta exitosa usa los valores devueltos por la RPC y refresca el layout para actualizar el encabezado. Los opcionales vacíos se envían como NULL. El schema de edición comparte reglas con el alta. No se observó regresión del alta en las pruebas focales.

La RPC toma advisory lock por centro y `FOR UPDATE` de la fila, compara `updated_at` antes de actualizar y retorna la versión resultante. El informe de Fase C describe una carrera PostgreSQL y una prueba desde dos pestañas DEV que rechazaron el borrador obsoleto sin sobrescribir; el código es consistente con esos resultados. El trigger de `centers` usa `now()`, que permanece fijo durante una transacción. Por eso `updated_at` no es estrictamente monótono para dos cambios dentro de la misma transacción o una transacción antigua que actualice después de otra. La aplicación actual hace una llamada RPC por solicitud y la carrera documentada pasó; queda como riesgo de contrato para usos transaccionales futuros, no como prueba de pérdida de datos en el flujo actual. [PostgreSQL documenta esta semántica de `now()`](https://www.postgresql.org/docs/current/functions-datetime.html).

El manejo de un resultado incierto no cumple el brief: una excepción después de confirmar la RPC, por ejemplo en `revalidatePath`, se devuelve como error genérico y la pantalla invita a reintentar sin ofrecer recarga. Ver hallazgo M2.

## 5. UX y accesibilidad

El formulario usa los componentes y estilos administrativos compartidos, dos columnas desde `sm` y una en móvil; los controles tienen etiquetas, errores asociados, objetivos de 44 px y estados interactivos. El éxito usa `role=status`, los errores `role=alert`. El diálogo está en `document.body`, tiene `role=dialog`, `aria-modal`, título accesible, foco inicial, ciclo de Tab, Escape y devolución de foco. La evidencia visual de Fase C describe escritorio y 390 px sin desborde; no se repitió un navegador autenticado en esta revisión.

La protección de cambios pendientes cubre Cancelar y `beforeunload`, y el brief documenta expresamente que otros enlaces SPA no tienen bloqueo global. Se registra como límite aceptado de UX, sin hallazgo nuevo. El diálogo no bloquea clics de fondo como mecanismo de cierre, pero el backdrop cubre la pantalla y no se identificó una acción accidental concreta.

## 6. Pruebas ejecutadas y cobertura

- `pnpm bootstrap`: PASS (Node 24.21.0, pnpm 11.26.0).
- Diez archivos focales de settings, navegación y alta: **58/58 PASS**.
- `pnpm typecheck`: PASS.
- `pnpm lint`: exit 0; un warning preexistente de `oid` sin uso en `scripts/task009-gate-d/preflight-dev-readonly.mjs`.
- Prettier focal: PASS. `git diff --check`: PASS en archivos rastreados.

No se ejecutaron SQL local, E2E remoto, nueva escritura DEV ni suite general: el informe de Fase C ya documenta SQL local, carrera, persistencia DEV y regresión general. La suite general allí terminó 963/965 por dos timeouts de módulos ajenos, que pasaron al repetirse con margen. Los tests existentes de TASK-035 no cubren lectura directa como miembro no ADMIN, error posterior a persistencia ni la semántica de dos cambios dentro de una transacción.

## 7. Hallazgos

### M1 — MEDIUM: la lectura institucional no es exclusiva de ADMIN

- **Ubicación:** `supabase/migrations/20260922121000_add_auth_access_helpers_and_policies.sql:152-156,201-215`; contraste con `src/app/centers/[centerId]/settings/page.tsx:18-30` y `.harness/tasks/archive/TASK-035/brief.md:15`.
- **Problema y evidencia reproducible:** la policy `centers_select_active_members` usa `private.has_active_center_membership(id)` y el grant `SELECT` se concede sobre la tabla completa a `authenticated`. Una sesión RECEPTION o PROFESSIONAL con membership activa puede ejecutar `SELECT phone,email,address FROM public.centers WHERE id = <su centro>` por PostgREST, aunque no pueda abrir settings. Es una autorización previa a TASK-035, no una policy creada por la migración nueva.
- **Impacto:** el requisito de lectura ADMIN exclusiva no se cumple a nivel de base/API; el aislamiento entre centros sí se conserva.
- **Corrección recomendada:** aclarar en el brief si la exclusividad aplica a la pantalla o también a los datos por API. Si aplica a datos, acotar la lectura institucional a ADMIN mediante permisos por columna o una RPC de lectura, conservando las lecturas mínimas de nombre/zona horaria que necesitan los demás roles. Probar el caso negativo con un miembro no ADMIN.

### M2 — MEDIUM: un éxito persistido puede presentarse como fallo sin vía de recarga

- **Ubicación:** `src/modules/access/server/center-settings-action.ts:79-97`; `src/modules/access/components/center-settings-screen.tsx:112-145,220-228`; `.harness/tasks/archive/TASK-035/brief.md:25`.
- **Problema y evidencia reproducible:** `deps.persist()` y `deps.revalidate()` comparten un `try`. Si `persist` confirma la escritura y `revalidatePath` falla, el `catch` devuelve `status:"error"`. La pantalla conserva el borrador, muestra «Intentá de nuevo más tarde» y sólo ofrece recarga en `status:"conflict"`. El mismo resultado incierto puede surgir si se pierde la respuesta tras el commit.
- **Impacto:** la persona usuaria no sabe si guardó; puede reintentar un borrador ya persistido y recibir un conflicto evitable, mientras el encabezado puede quedar desactualizado. Contradice el procedimiento de recarga antes de reintentar definido en el brief.
- **Corrección recomendada:** separar el resultado de persistencia del fallo de revalidación o representar explícitamente el resultado incierto; ofrecer una lectura autorizada con confirmación de descarte antes de volver a guardar. Agregar un test con `persist` exitoso y `revalidate` fallido.

## 8. Riesgos residuales y dictamen

El token `updated_at` de `centers` usa el trigger previo basado en `now()`; conviene hacerlo monótono si esta RPC se reutiliza dentro de transacciones con más de un cambio. La autorización negativa y la concurrencia de dos conexiones se verificaron en PostgreSQL local, no con identidades no ADMIN en DEV. La evidencia DEV real se limita al centro y los campos temporales indicados en Fase C, restaurados según ese informe. Las limitaciones de navegación SPA y los dos timeouts ajenos están documentadas; no se atribuyen a TASK-035.

**Dictamen inicial, superado por el re-review siguiente — `CHANGES_REQUESTED`:** había dos diferencias concretas frente al brief. Esta revisión no cerró TASK-035 ni autorizó correcciones o despliegues.

## 9. Re-review independiente del 2026-10-30

Se revisaron `review-response.md`, el brief actualizado, los informes de implementación y Fase C, `docs/modules/{centers,access}.md`, `docs/status.md`, las decisiones de autorización, la ruta, las acciones, el servicio, el componente, las pruebas nuevas, la policy RLS previa y la migración TASK-035. Se preservaron los cambios locales. La migración mantiene el SHA-256 `A1B631DC5297E450AEB677A881AEC5625E4040A115C68E4B1F83F07A659A52D4`; no se modificaron sus permisos ni su cuerpo.

### M1 — `RESOLVED`

La decisión de producto aclara que la exclusividad ADMIN corresponde a la pantalla de configuración y a la escritura, mientras los miembros activos pueden leer los datos institucionales **de su propio centro** por API. El brief (`brief.md:15`), `docs/modules/centers.md:39-49` y `docs/modules/access.md:49-56` expresan el mismo contrato. No contradice la regla 6 de aislamiento en `docs/business-rules.md` ni `docs/decisions/05-autorizacion.md`, que exigen aislamiento por centro y autorización server-side de operaciones sensibles.

La policy `centers_select_active_members` (`20260922121000_add_auth_access_helpers_and_policies.sql:152-156`) limita SELECT al helper `private.has_active_center_membership(id)`. Éste compara `membership.center_id` con la fila, `membership.user_id` con `auth.uid()` y exige membership y centro activos (`:17-33`). El grant SELECT de tabla completa (`:210-217`) permite las columnas institucionales al miembro propio, sin abrir filas de otro centro. Una identidad exclusivamente PLATFORM_ADMIN no obtiene esta lectura tenant. La página (`settings/page.tsx:20`), la acción de recarga (`center-settings-actions.ts:15`), la escritura (`center-settings-action.ts:61`) y la RPC (`20261030120000_admin_update_center_settings.sql:35-50`) conservan la exigencia ADMIN para administrar. El UPDATE directo sigue revocado. Por tanto, M1 puede cerrarse sin cambiar RLS; la diferencia original era el alcance del requisito, ahora decidido y documentado.

### M2 — `RESOLVED`

`center-settings-action.ts:79-115` separa la llamada `persist` de `revalidate`: si la RPC devuelve settings, una falla de revalidación retorna `success` con esos settings y `refreshPending:true`, nunca un fallo de persistencia. Si `persist` no entrega una respuesta concluyente, retorna `uncertain`; conflicto, denegación y errores previos a escritura conocidos (`PGRST202`, `22023`) se clasifican aparte con mensajes sin detalles internos. El componente (`center-settings-screen.tsx:155-188`) adopta los valores y el `updatedAt` persistidos al recibir éxito; un error síncrono de `router.refresh()` sólo agrega la advertencia de vista desactualizada. El próximo submit usa la versión persistida. La RPC conserva el lock, la comparación de `updated_at` y el rechazo `STALE_CENTER_SETTINGS` (`20261030120000_admin_update_center_settings.sql:29-60`).

Para `uncertain`, `canSave` depende de `!mustReloadBeforeSave` (`center-settings-screen.tsx:53-63`). Editar el borrador no retira el bloqueo. La recarga pide confirmar el descarte cuando el borrador difiere de la base; una lectura autorizada exitosa adopta la versión actual y libera el bloqueo (`:119-145`), mientras una lectura fallida conserva borrador y bloqueo. El aviso de éxito confirmado con `refreshPending` pide recargar la página para verificar el encabezado; los estados incierto y conflicto ofrecen «Recargar datos del centro» (`:236-255`). Cancelar conserva la confirmación de descarte y `beforeunload` protege la recarga del navegador. No se encontró un estado imposible ni una vía de reintento accidental en las rutas revisadas.

### Verificación del re-review

- `pnpm bootstrap`: PASS.
- Batería focal de settings, navegación y alta compartida: **64/64 PASS**, 10 archivos. Incluye revalidación fallida tras escritura confirmada, uso del token persistido en el siguiente submit, respuesta perdida, incertidumbre con recarga exitosa/fallida y conflicto.
- Regresión de autorización y acceso: **34/34 PASS**, 2 archivos.
- `pnpm typecheck`, ESLint focal, Prettier focal y `git diff --check`: PASS.
- No se repitieron SQL local, E2E autenticado ni escrituras DEV; la evidencia de Fase C sobre la ruta normal, RPC y concurrencia sigue siendo aplicable, y los nuevos caminos de error se verificaron con tests de acción y componente. No se accedió a PROD.

### Hallazgos nuevos y riesgos residuales

No se identificaron defectos nuevos que exijan corrección. Permanece el riesgo ya registrado de que el trigger `updated_at` de `centers`, basado en `now()`, no sea estrictamente monótono para múltiples cambios en una transacción; el flujo actual usa una RPC por solicitud y la carrera de dos conexiones de Fase C pasó. La lectura negativa por rol y centro se probó en PostgreSQL local, no con identidades no ADMIN en DEV. La navegación SPA fuera del formulario mantiene el límite aceptado en el brief. Las pruebas nuevas de error son sintéticas; no acreditan fallas reales de caché o red en DEV.

**Dictamen final — `APPROVED`:** M1 y M2 están resueltos según el contrato de producto vigente, y la evidencia es suficiente para recomendar el cierre técnico. Esta aprobación no cierra TASK-035, no autoriza despliegue ni modifica DEV/PROD.
