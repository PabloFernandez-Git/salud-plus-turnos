# TASK-008 — Review independiente de brief y plan

## Resultado

**TASK-008 PLAN REVIEW PASS — READY FOR IMPLEMENTATION AUTHORIZATION**

Review de planning únicamente. No autoriza implementar en esta conversación. No se ejecutaron migraciones, tests, conexión a DEV ni cambios funcionales.

## Base y alcance comprobados

- Rama: `task/008-availability`. `HEAD`, `main` y `origin/main`: `6e5e4f46fe7871966557ee1822ac08e2575ac22b`.
- Se revisaron `brief.md`, `plan.md`, producto, reglas de negocio, módulos Availability/Professionals/Appointments, arquitectura, convenciones y protocolo de review; schema y migraciones de auth/RLS, Professionals y CAS; helpers de autorización, queries/ruta actuales de Professionals, navegación y verificadores de catálogo afectados.
- `pnpm bootstrap` consta como PASS en el brief y plan de esta fase. No se volvió a ejecutar en este review, que sólo admite cambios en este archivo.

## Evaluación del contrato

### DB, RLS y autorización

- **DB blocker confirmado.** `public.availabilities` existe con RLS habilitada y sin grant/policy de lectura ni superficie de mutación para `authenticated`. La solución SELECT bajo una policy tenant para filas activas + RPCs estrechas respeta la arquitectura. No se propone service role en la app, DML genérico, bypass de RLS ni una RPC de actualización arbitraria.
- La policy planeada exige `is_active` y un helper con `ProfessionalCenter` activo del mismo `center_id`. Para ADMIN/RECEPTION exige membership activa en Center activo; para PROFESSIONAL compara el ID exacto con `private.active_professional_center_id(center_id)`, cuyo SQL exige rol, membership, Center y vínculo activos. Manipular URL, filtros, `center_id` o `professional_center_id` no debe ampliar el resultado. PLATFORM_ADMIN sin membership tenant no tiene acceso implícito. La matriz DB propuesta verifica estos casos, incluidos cross-center e inactivos.
- Los `SECURITY DEFINER` propuestos son acotados: `search_path=''`, referencias calificadas, `auth.uid()`, revocación de PUBLIC/anon, grants EXECUTE por firma y revalidación tenant en cada RPC. El helper de appointments queda privado y sin EXECUTE para el cliente. El review del SQL concreto en Gate A debe comprobar esos invariantes antes de DEV.

### Mutaciones, duración y concurrencia

- Create fuerza `is_active=true`; update sólo cambia horas de una fila activa; deactivate sólo fija `is_active=false`. Las RPCs verifican el par `ProfessionalCenter`/Center contra la DB y no confían en los IDs del request para determinar pertenencia. `p_center_id` es redundante pero se revalida y se usa para autorización y lock; no permite combinaciones arbitrarias. Sólo ADMIN/RECEPTION mutan; PROFESSIONAL, vínculo inactivo y Center/membership inactivos se rechazan. No hay mutación de appointments.
- La RPC de duración específica es preferible a ampliar `admin_update_professional_center`, que hoy es ADMIN-only y también acepta matrícula. El contrato nuevo cambia exclusivamente `usual_appointment_duration_minutes`, conserva el campo fuente, valida 5–480 y múltiplo de 5, exige contexto activo y aplica CAS sobre el token monotónico existente de ProfessionalCenter.
- Hay riesgo real de lost update si dos ediciones de la misma franja usan el mismo snapshot. El trigger actual de Availability usa `now()`, que no garantiza un token estrictamente creciente dentro de una transacción. Reutilizar `private.set_task006_cas_updated_at()` para updates efectivos, sin reescribir timestamps existentes, es un cambio proporcionado dentro de TASK-008. `FOR UPDATE` + `expected_updated_at` por fila basta; no hace falta copiar el CAS más complejo de Patients. La misma clave advisory de Center existe en las RPCs de Center, membership y ProfessionalCenter. Gate A debe verificar que el nuevo lock compartido use esa clave exacta y se adquiera antes de leer el estado sensible.
- La exclusión GiST `availabilities_no_active_overlap` ya es la autoridad final: mismo ProfessionalCenter + weekday + solapamiento activo falla; intervalos `[inicio, fin)` contiguos, otros días, otros ProfessionalCenter/Centers y filas inactivas no se bloquean mutuamente. La traducción de `23P01` exige el nombre exacto de constraint y mensaje estable, sin SQL crudo. Quitar preserva la fila histórica; una nueva franja inserta otra fila. El crecimiento de inactivas no representa un bloqueo material para el MVP.

### Turnos futuros, tiempo y UI

- La advertencia booleana tras guardar es viable en esta tarea como consulta `EXISTS` privada, de sólo lectura y sobre el mismo ProfessionalCenter. No necesita slot generator, devuelve cero IDs/datos personales y mantiene appointments intactos. Su alcance debe mantenerse tal como está: no crear lógica de Agenda ni resolver turnos fuera de horario. La comprobación del SQL y las pruebas deben exigir los bordes `[inicio, fin)`, fecha local y estado CANCELLED; el mensaje es informativo, no una garantía de disponibilidad para reservar. Existe un índice `(professional_center_id, starts_at)` para acotar la búsqueda, pero Gate A debe revisar el plan de consulta y su costo con datos representativos.
- La subruta de detalle y el índice de entrada satisfacen el acceso de ADMIN, RECEPTION y PROFESSIONAL propio sin reescribir permisos de Professionals. La RPC de contexto devuelve sólo nombre, ID, duración y token; evita ampliar SELECT sobre columnas personales de Professionals para RECEPTION. La ruta ajena/inactiva y la plataforma sin membership fallan cerradas. `CenterNavigation` hoy oculta todo a PROFESSIONAL, por lo que el cambio de navegación previsto es necesario.
- La UX contempla siete días verticales, varias franjas, alta, edición inline, cancelación, confirmación para quitar, estados vacíos, duración y timezone. Usa el `AppLoader` existente y `PageReveal`, y exige semántica móvil sin scroll horizontal, teclado y foco.
- `start_time`/`end_time` son horas locales recurrentes del Center. No corresponde convertirlas a `timestamptz` ni generar slots en TASK-008. La tabla `centers` sólo exige timezone no vacío, pero la RPC vigente de creación de centros ya comprueba `pg_timezone_names`; el preflight del plan también valida valores existentes. El riesgo de datos cargados por vías privilegiadas sigue documentado y no requiere migration ajena en esta tarea.

### Acciones, verificación y scope

- Las Server Actions planeadas validan con Zod, reautorizan mediante `requireRole`, llaman servicios/RPC y revalidan rutas. La lectura de PROFESSIONAL corresponde a Server Component/query bajo RLS; no necesita Action de lectura. El mapping de errores usa pares código/token o constraint conocidos y no expone texto SQL.
- La matriz de pruebas cubre roles y denegaciones, aislamiento, centros/memberships/vínculos inactivos, franjas múltiples/adyacentes, GiST concurrente, stale update/deactivate, duración, deactivación, UX y accesibilidad. La prueba concurrente con barrera observable es apropiada; un sleep no demostraría la carrera.
- El gate DEV es proporcional: identidad/preflight, paridad y dry-run, lint DB, catálogo y pruebas DB focalizadas, suite local, navegador focalizado y cleanup por IDs exactos con auditoría. No requiere repetir el finalizador completo de TASK-007. Los tests históricos `auth-access-foundation.sql` y `task-006b-foundation.sql` enumeran policies/grants exactos; el plan propone ajustar sólo sus expectativas legítimas. Los baselines archivados de TASK-007 no deben reescribirse ni usarse para ocultar drift.
- Fuera de TASK-008 permanecen creación/reprogramación/cancelación de turnos, slots, Agenda, feriados, excepciones, licencias, vacaciones, bloqueos extraordinarios y resolución automática de turnos fuera de horario.

## Hallazgos

Ninguno BLOCKER, HIGH ni MEDIUM. No se identificó ajuste obligatorio del brief o plan antes de solicitar autorización de implementación.

## Riesgos residuales y gate siguiente

- Gate A debe revisar el SQL real de policy, `SECURITY DEFINER`, grants, orden de locks, constraint mapping y consulta booleana antes de aplicar la migration a DEV. Este review evalúa el contrato del plan, no código aún inexistente.
- La advertencia no sustituye la validación de appointments/slots de TASK-009 y puede requerir tratamiento explícito de cambios DST en esa fase.
- El preflight vivo de DEV sigue pendiente de la futura implementación; no se afirma paridad ni ausencia de drift hoy.

## Estado Git al cerrar el review

- Se conserva `M docs/status.md` y `M next-env.d.ts` preexistentes y `.harness/tasks/active/` no trackeado. Este review sólo agregó `TASK-008/review.md`; no hubo stage, commit, push ni PR.
- `next-env.d.ts` quedó sin tocar; SHA-256: `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.

---

# Implementation Review — 2026-10-16

**Base:** `6e5e4f46fe7871966557ee1822ac08e2575ac22b` (`main` = `origin/main`). **Head:** `490dfae47f0dd0fb3be798ae3ef6f42bddc33cca` (`HEAD` = `origin/task/008-availability`, commit `feat: implement TASK-008 availability`). Rama `task/008-availability`. Se inspeccionó el diff completo base..head y los cuatro artefactos del task. Este review no cambió source, SQL, tests ni status.

## Evidence y evaluación

1. **Migration y objetos:** `20261016160000_add_availability_foundation.sql` fue revisada íntegra (418 líneas), junto con la migration fundacional de Availability y los helpers previos. Es transaccional y no contiene DML de datos, ALTER de appointments ni cambios de GiST/FK/CHECK históricos. Reemplaza sólo el trigger `availabilities_set_updated_at` por `private.set_task006_cas_updated_at()`; agrega `private.can_view_active_availability(uuid,uuid)`, `private.has_future_appointments_outside_availability(uuid,uuid)`, policy `availabilities_select_active_tenant`, grant SELECT de `availabilities` a `authenticated`, y cinco RPC públicas: `staff_list_availability_professional_centers(uuid)`, `staff_create_availability(uuid,uuid,smallint,time,time)`, `staff_update_availability(uuid,uuid,uuid,timestamptz,time,time)`, `staff_deactivate_availability(uuid,uuid,uuid,timestamptz)` y `staff_update_usual_appointment_duration(uuid,uuid,timestamptz,integer)`. Revoca EXECUTE de PUBLIC/anon/authenticated sobre las funciones nuevas y concede sólo las seis firmas que necesita `authenticated`; el helper de appointments no tiene grant de cliente. Las nuevas funciones SECURITY DEFINER usan `search_path=''` y objetos calificados; el trigger reutilizado es SECURITY INVOKER.
2. **RLS y RPCs:** la policy exige `is_active`, ProfessionalCenter activo con par ID/Center coincidente y ADMIN/RECEPTION con membership activa en Center activo, o PROFESSIONAL vinculado a ese mismo PC. PLATFORM_ADMIN sin membership no recibe bypass. El contexto mínimo devuelve sólo PC ID, nombre, apellido, duración y token; el PROFESSIONAL sólo puede obtener su vínculo. Las cuatro RPCs de mutación revalidan rol y estado bajo lock, comprueban same-center, devuelven sólo estado de franja/duración y un booleano de advertencia. No se observa IDOR, columnas arbitrarias ni PII en las respuestas. Esta conclusión es del SQL versionado; no pudo comprobarse nuevamente el catálogo vivo.
3. **Duración y concurrencia:** la RPC de duración acepta sólo ADMIN/RECEPTION, valida 5–480 y múltiplos de 5, compara CAS bajo lock exclusivo de Center y `FOR UPDATE`, y sólo asigna `usual_appointment_duration_minutes`; un no-op conserva el token. Las RPCs de Availability usan lock compartido de Center, revalidan pertenencia, bloquean PC y, para update/deactivate, la fila activa `FOR UPDATE` antes de comparar `expected_updated_at`. El trigger usa `greatest(clock_timestamp(), old.updated_at + 1 microsecond)`. GiST `availabilities_no_active_overlap` sigue siendo la autoridad para solapamiento activo `[inicio,fin)`; TS no intenta reemplazarla. Create no necesita CAS. Update no cambia día/identidad; deactivate sólo fija `is_active=false`, sin DELETE ni reactivación.
4. **Advertencia de turnos:** la helper privada ejecuta sólo `EXISTS` sobre appointments del mismo Center/PC con `starts_at >= now()`, excluye CANCELLED, usa fecha/día/hora locales de `centers.timezone` y exige que inicio y fin estén dentro de una misma franja activa. No escribe appointments, no devuelve IDs ni PII y no genera slots. El test de integración versionado verifica dentro/fuera, CANCELLED y que el appointment permanezca igual; no cubre fecha actual, cambio de día por timezone, DST ni bordes exactos, por lo que la evidencia de esos bordes procede del SQL inspeccionado, no de ejecución independiente.
5. **Servidor, rutas y UI:** schemas Zod validan UUID, weekday, HH:MM, orden, duración y token; queries usan cliente de sesión; Actions reautorizan ADMIN/RECEPTION, llaman RPCs estrechas, mapean sólo errores conocidos y revalidan índice, detalle y Profesionales. Índice ADMIN/RECEPTION lista sólo contexto mínimo; PROFESSIONAL redirige al vínculo propio. Detalle deniega ruta ajena/inactiva y PLATFORM_ADMIN-only; PROFESSIONAL recibe UI de sólo lectura. `AvailabilityScreen` presenta nombre, Center, timezone, duración, siete días, estados vacíos, varias franjas, alta, edición inline, cancelar, quitar con confirmación, feedback status/alert, disabled durante pending, labels, foco inicial y botones con tipo explícito. Navegación no concede acceso general a Profesionales a PROFESSIONAL. `PageReveal` está en ambas páginas y el loader padre existente usa `AppLoader`. La cobertura de tests de componente/Actions y el código sostienen estas conclusiones; el smoke independiente de desktop/tablet/390px no se pudo repetir.
6. **Tipos y scope:** el diff de `database.types.ts` añade exactamente las cinco firmas RPC de la migration, sin cambios manuales inexplicables visibles; la generación desde DEV es evidencia previa del implementation report, no repetida. El diff no incluye slot generator, creación/reprogramación/cancelación de appointments, Agenda, excepciones, feriados, vacaciones/licencias ni bloqueos extraordinarios. Sólo se añadió un helper booleano read-only sobre appointments.
7. **Verificadores históricos:** `finalize-core.test.mjs` acota a las 19 migrations de TASK-007 sin cambiar el parser/gate de producción; `verify-task006b-db-foundation.mjs` hace ROLLBACK antes de cleanup y conserva snapshot/auditoría; las expectativas SQL de policies y SELECT grants siguen siendo conjuntos exactos. La excepción por nombre en `task-006b-foundation.sql` sí debilita la aserción histórica: ver finding IR-01. El verificador TASK-008 emplea fixtures con UUID propios, rol/JWT de sesión, consultas funcionales, locks observables para tres carreras, cleanup exacto y comparación de inventario/digest de 13 tablas. No contiene truncate/reset/borrado amplio ni imprime credenciales. Sus tests de catálogo comprueban firmas aprobadas, SECURITY DEFINER/search_path/grants, RLS y trigger, aunque no enumeran todas las sobrecargas posibles ni prueban todos los bordes temporales de la advertencia.
8. **DEV e integración:** `pnpm bootstrap` confirmó configuración DEV coherente y link local a `ehllxymqyzrofydrvtzo` (`salud-plus-turnos-dev` según configuración aprobada). El implementation report declara 20/20 migrations, dry-run limpio, health, db lint, catálogo, gate de integración, cleanup exacto y smoke Playwright PASS. No se pudo confirmar independientemente el estado vivo: `pnpm supabase:check:dev` falló por conectividad; la CLI `migration list --linked` devolvió `LegacyPlatformAuthRequiredError` por ausencia de `SUPABASE_ACCESS_TOKEN` (antes, sin telemetría deshabilitada, intentó escribir fuera del sandbox). Por ello no se afirma PASS independiente para catálogo, 20/20, lint DB, integration gate ni navegador. Reejecutar el verificador también crearía su manifiesto en el repositorio, fuera del único archivo que esta conversación puede modificar. La evidencia previa fue contrastada con el script y el SQL, sin sustituir una ejecución viva.
9. **Verificación local independiente:** `pnpm bootstrap` PASS; `pnpm check` PASS: ESLint, `tsc --noEmit`, 492 Vitest en 63 archivos y 11 tests históricos `node:test`. `pnpm lint` y `pnpm typecheck` pasaron dentro de `pnpm check`. `git diff --check` de working tree y base..head PASS. Build de producción `next build --webpack` PASS en copia temporal aislada, con ambas rutas de Availability; la primera copia omitió `vitest.setup.ts` y falló en tipos de matchers de tests, se corrigió sólo la composición temporal y la repetición pasó. No se cambió `next-env.d.ts`.
10. **Formato:** `pnpm format:check` falla en 183 archivos. Un chequeo independiente sobre los 237 archivos versionados incluidos por su glob mostró que los 183 difieren de Prettier exclusivamente por CRLF local; al normalizar a LF, los 183 coinciden exactamente con Prettier. De los archivos modificados por TASK-008, sólo `scripts/task007-gate-d/finalize-core.test.mjs` y `scripts/verify-task006b-db-foundation.mjs` aparecen en el aviso; ambos tienen contenido formateado después de normalizar CRLF. Ningún archivo introdujo una desviación de formato de código. Se deja el listado exacto al final de esta sección para reproducir el diagnóstico sin reformatear archivos ajenos.

## Finding

**TASK008-IR-01 — MEDIUM — `supabase/tests/task-006b-foundation.sql:261`.** El control histórico de RPCs de listado ahora excluye `routine_name = 'staff_list_availability_professional_centers'` sin comprobar firma. **Escenario reproducible:** agregar en una transacción de prueba una sobrecarga pública `staff_list_availability_professional_centers()` que enumere profesionales globalmente. El `NOT EXISTS` de líneas 256–263 la descarta por nombre y no detecta esa nueva superficie, aunque la firma aprobada es únicamente `(uuid)`; el verificador TASK-008 comprueba privilegios de la firma conocida pero tampoco rechaza una sobrecarga adicional. **Impacto:** el gate histórico deja de detectar drift de una RPC de listado no autorizada, precisamente la clase de expansión de acceso que protegía. **Corrección mínima recomendada:** exceptuar sólo el OID/firma exacta `public.staff_list_availability_professional_centers(uuid)` mediante `pg_proc`/`regprocedure`, manteniendo la detección de cualquier otra firma; añadir una prueba que demuestre que una sobrecarga adicional hace fallar el gate. No se hizo el fix en este review.

## Verdict y estado

El finding MEDIUM impide abrir PR. La falta de acceso DEV para repetir catálogo/integración/browser queda registrada como limitación de evidencia, separada del defecto concreto. **TASK-008 IMPLEMENTATION REVIEW CHANGES_REQUESTED**.

Al cierre: `review.md` es el único archivo modificado por este review, sin stage/commit/push/PR; se preservan `M next-env.d.ts` y los artefactos locales TASK-009–012. SHA-256 de `next-env.d.ts`: `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; permanece unstaged y fuera de TASK-008.

### Inventario exacto del fallo de `pnpm format:check`

Los siguientes 183 paths son los avisados; todos son diferencias de fin de línea CRLF frente a LF:

- `next.config.ts`
- `package.json`
- `playwright.task007.config.mjs`
- `scripts/bootstrap-platform-admin.mjs`
- `scripts/check-auth-config-dev.mjs`
- `scripts/check-client-bundle-secrets.mjs`
- `scripts/compare-task007a-baseline-v2.mjs`
- `scripts/lib/bootstrap-platform-preflight.mjs`
- `scripts/lib/bootstrap-platform-preflight.test.mjs`
- `scripts/lib/compare-task007a-baseline-v2.mjs`
- `scripts/lib/compare-task007a-baseline-v2.test.mjs`
- `scripts/task007-gate-d.mjs`
- `scripts/task007-gate-d/audit-clean.mjs`
- `scripts/task007-gate-d/audit-clean.test.mjs`
- `scripts/task007-gate-d/cleanup-isolated.mjs`
- `scripts/task007-gate-d/finalize-core.mjs`
- `scripts/task007-gate-d/finalize-core.test.mjs`
- `scripts/task007-gate-d/finalize-docs.mjs`
- `scripts/task007-gate-d/finalize.mjs`
- `scripts/task007-gate-d/fixture-core.mjs`
- `scripts/task007-gate-d/integration-state.mjs`
- `scripts/task007-gate-d/integration.mjs`
- `scripts/task007-gate-d/isolated-dev-server.mjs`
- `scripts/task007-gate-d/ledger-lifecycle.test.mjs`
- `scripts/task007-gate-d/ledger-status.mjs`
- `scripts/task007-gate-d/recover-credentials.mjs`
- `scripts/task007-gate-d/recover-ledger.mjs`
- `scripts/task007-gate-d/recovery-inventory.mjs`
- `scripts/task007-gate-d/recovery-known.mjs`
- `scripts/test-support/server-only.ts`
- `scripts/verify-auth-foundation.mjs`
- `scripts/verify-b3a-db-invariants.mjs`
- `scripts/verify-bootstrap-preflight.mjs`
- `scripts/verify-provisioning-orchestration.integration.mjs`
- `scripts/verify-provisioning-reconciliation.mjs`
- `scripts/verify-task006b-db-foundation.mjs`
- `scripts/verify-task007a-concurrency.mjs`
- `scripts/verify-task007a-migration-smoke.mjs`
- `scripts/verify-task007a-schema-v2.mjs`
- `src/app/auth/callback/route.ts`
- `src/app/centers/[centerId]/loading.test.tsx`
- `src/app/centers/[centerId]/loading.tsx`
- `src/app/centers/[centerId]/page.test.tsx`
- `src/app/centers/[centerId]/page.tsx`
- `src/app/centers/[centerId]/patients/loading.tsx`
- `src/app/centers/[centerId]/patients/page.test.tsx`
- `src/app/centers/[centerId]/patients/page.tsx`
- `src/app/centers/[centerId]/professionals/loading.tsx`
- `src/app/centers/[centerId]/professionals/page.test.tsx`
- `src/app/centers/[centerId]/professionals/page.tsx`
- `src/app/centers/[centerId]/specialties/loading.tsx`
- `src/app/centers/[centerId]/specialties/page.test.tsx`
- `src/app/centers/[centerId]/specialties/page.tsx`
- `src/app/centers/[centerId]/users/loading.tsx`
- `src/app/centers/[centerId]/users/page.test.tsx`
- `src/app/centers/[centerId]/users/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/login/page.tsx`
- `src/app/no-access/page.tsx`
- `src/app/page.tsx`
- `src/app/platform/loading.tsx`
- `src/app/platform/page.tsx`
- `src/app/select-center/page.tsx`
- `src/app/update-password/page.tsx`
- `src/components/app-loader.module.css`
- `src/components/app-loader.test.tsx`
- `src/components/app-loader.tsx`
- `src/components/page-reveal.module.css`
- `src/components/page-reveal.test.tsx`
- `src/components/page-reveal.tsx`
- `src/components/password-input.test.tsx`
- `src/components/password-input.tsx`
- `src/lib/original-search-header.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/supabase/server.ts`
- `src/modules/access/actions/auth-actions.ts`
- `src/modules/access/actions/center-user-actions.ts`
- `src/modules/access/actions/platform-actions.ts`
- `src/modules/access/components/action-message.tsx`
- `src/modules/access/components/add-center-user-panel.test.tsx`
- `src/modules/access/components/add-center-user-panel.tsx`
- `src/modules/access/components/auth-card.tsx`
- `src/modules/access/components/center-status-form.tsx`
- `src/modules/access/components/center-users-screen.test.tsx`
- `src/modules/access/components/center-users-screen.tsx`
- `src/modules/access/components/center-users-table.tsx`
- `src/modules/access/components/create-center-panel.test.tsx`
- `src/modules/access/components/create-center-panel.tsx`
- `src/modules/access/components/login-form.test.tsx`
- `src/modules/access/components/login-form.tsx`
- `src/modules/access/components/logout-button.tsx`
- `src/modules/access/components/manage-center-membership-panel.test.tsx`
- `src/modules/access/components/manage-center-membership-panel.tsx`
- `src/modules/access/components/platform-centers-table.test.tsx`
- `src/modules/access/components/platform-centers-table.tsx`
- `src/modules/access/components/recovery-form.tsx`
- `src/modules/access/components/submit-button.tsx`
- `src/modules/access/components/update-password-form.test.tsx`
- `src/modules/access/components/update-password-form.tsx`
- `src/modules/access/components/use-center-user-operation-intent.test.tsx`
- `src/modules/access/components/use-center-user-operation-intent.ts`
- `src/modules/access/components/use-platform-operation-intent.test.tsx`
- `src/modules/access/components/use-platform-operation-intent.ts`
- `src/modules/access/domain/access-routing.test.ts`
- `src/modules/access/domain/access-routing.ts`
- `src/modules/access/domain/auth-compensation.test.ts`
- `src/modules/access/domain/auth-compensation.ts`
- `src/modules/access/domain/auth-operations.test.ts`
- `src/modules/access/domain/auth-operations.ts`
- `src/modules/access/domain/center-user-action-state.ts`
- `src/modules/access/domain/platform-action-state.ts`
- `src/modules/access/schemas/auth.ts`
- `src/modules/access/schemas/center-membership-management.ts`
- `src/modules/access/schemas/center-user-provisioning.test.ts`
- `src/modules/access/schemas/center-user-provisioning.ts`
- `src/modules/access/schemas/platform.test.ts`
- `src/modules/access/schemas/platform.ts`
- `src/modules/access/server/access.ts`
- `src/modules/access/server/administration.test.ts`
- `src/modules/access/server/administration.ts`
- `src/modules/access/server/authorization.test.ts`
- `src/modules/access/server/authorization.ts`
- `src/modules/access/server/center-membership-actions.test.ts`
- `src/modules/access/server/center-membership-actions.ts`
- `src/modules/access/server/center-user-actions.test.ts`
- `src/modules/access/server/center-user-actions.ts`
- `src/modules/access/server/center-users.test.ts`
- `src/modules/access/server/center-users.ts`
- `src/modules/access/server/platform-actions.test.ts`
- `src/modules/access/server/platform-actions.ts`
- `src/modules/access/server/provisioning.ts`
- `src/modules/patients/actions/patient-actions.test.ts`
- `src/modules/patients/actions/patient-actions.ts`
- `src/modules/patients/api/patient-rpc-adapter.ts`
- `src/modules/patients/api/patient-rpc-contracts.test.ts`
- `src/modules/patients/api/patient-rpc-contracts.ts`
- `src/modules/patients/components/patient-workspace.test.tsx`
- `src/modules/patients/components/patient-workspace.tsx`
- `src/modules/patients/components/patients-screen.test.tsx`
- `src/modules/patients/components/patients-screen.tsx`
- `src/modules/patients/schemas/patient-input.test.ts`
- `src/modules/patients/schemas/patient-input.ts`
- `src/modules/patients/search/patient-search-params.test.ts`
- `src/modules/patients/search/patient-search-params.ts`
- `src/modules/patients/server/patient-errors.test.ts`
- `src/modules/patients/server/patient-errors.ts`
- `src/modules/patients/server/patient-management.test.ts`
- `src/modules/patients/server/patient-management.ts`
- `src/modules/patients/server/patients.test.ts`
- `src/modules/patients/server/patients.ts`
- `src/modules/professionals/actions/professional-actions.ts`
- `src/modules/professionals/actions/professional-specialty-action.ts`
- `src/modules/professionals/components/professional-specialties-editor.test.tsx`
- `src/modules/professionals/components/professional-specialties-editor.tsx`
- `src/modules/professionals/schemas/create-professional-with-center.test.ts`
- `src/modules/professionals/schemas/create-professional-with-center.ts`
- `src/modules/professionals/schemas/professional-center.ts`
- `src/modules/professionals/schemas/professional-document.test.ts`
- `src/modules/professionals/schemas/professional-document.ts`
- `src/modules/professionals/schemas/professional-email.ts`
- `src/modules/professionals/schemas/professional-specialties.ts`
- `src/modules/professionals/server/professional-actions.test.ts`
- `src/modules/professionals/server/professional-actions.ts`
- `src/modules/professionals/server/professional-specialties.test.ts`
- `src/modules/professionals/server/professional-specialties.ts`
- `src/modules/professionals/server/professional-specialty-actions.test.ts`
- `src/modules/professionals/server/professional-specialty-actions.ts`
- `src/modules/professionals/server/professionals.test.ts`
- `src/modules/professionals/server/professionals.ts`
- `src/modules/specialties/actions/specialty-actions.ts`
- `src/modules/specialties/components/specialties-screen.test.tsx`
- `src/modules/specialties/components/specialties-screen.tsx`
- `src/modules/specialties/schemas/specialty.test.ts`
- `src/modules/specialties/schemas/specialty.ts`
- `src/modules/specialties/server/specialties.test.ts`
- `src/modules/specialties/server/specialties.ts`
- `src/modules/specialties/server/specialty-actions.test.ts`
- `src/modules/specialties/server/specialty-actions.ts`
- `src/proxy.test.ts`
- `src/proxy.ts`
- `vitest.config.ts`
- `vitest.provisioning-integration.config.ts`

---

# TASK008-IR-01 Re-review — 2026-10-16

**Base/head:** `490dfae47f0dd0fb3be798ae3ef6f42bddc33cca` → `817a181c8792a4168f0e6a0ad3613fea976ec8a4`, rama `task/008-availability`; `HEAD == origin/task/008-availability`. El delta contiene exactamente `implementation-report.md`, `review.md`, `scripts/task008-ir01-professional-list.regression.mjs` y `supabase/tests/task-006b-foundation.sql`. No hay cambios de migration, RPC/RLS runtime, aplicación o DEV. Se revisaron esos cuatro archivos, el gate histórico anterior y el review original. Una comparación de prefijo confirmó que el plan review, el implementation review original y el finding IR-01 permanecen íntegros.

## Evidencia focalizada

- **Excepción exacta:** el gate histórico ahora consulta `pg_catalog.pg_proc` unido a `pg_catalog.pg_namespace`, exige `nspname = 'public'` y el patrón original `proname like '%list%professional%'`, y excluye sólo `list_function.oid = 'public.staff_list_availability_professional_centers(uuid)'::regprocedure`. Un overload `(uuid,text)` tiene otro OID y conserva el error histórico `TASK-006B exposed an unapproved global Professional listing routine`. El resto de las aserciones SQL no cambió; no se amplió la allowlist ni se ocultó drift de otra firma.
- **Regresión real:** el script extrae el bloque `IF EXISTS` del archivo SQL histórico y lo ejecuta contra PostgreSQL local efímero; no reimplementa el predicado en JavaScript. Crea `(uuid)` y `(uuid,text)` dentro de una transacción. El subtest de `(uuid)` pasa y el de `(uuid,text)` recibe exactamente `P0001` y el mensaje histórico. Hace ROLLBACK, comprueba que ambas firmas desaparecieron, elimina/audita el contenedor propio. La repetición con Docker operativo dio **3/3 PASS**; `docker ps --all --filter name=task008-ir01-` no mostró residuos. El primer intento en sandbox fue denegado por Docker; un intento elevado recibió 500 al crear el contenedor; ninguno llegó a ejecutar SQL. Esos fallos permitieron detectar IR-02.
- **Tooling y full verification:** `pnpm bootstrap` PASS; `pnpm check` PASS con 492 Vitest (63 archivos) y tooling histórico **11/11 PASS**; `pnpm lint` PASS; `pnpm typecheck` PASS; `git diff --check` del delta y working tree PASS. Build `next build --webpack` en copia aislada PASS, incluidas ambas rutas de Availability. No se necesitó ni tocó DEV.
- **Formato:** Prettier focalizado de `scripts/task008-ir01-professional-list.regression.mjs` PASS. SQL no tiene parser Prettier configurado y los Markdown no integran el glob de `format:check`. El check global sigue con 183 avisos de CRLF locales; ninguno corresponde al test nuevo. No se reformatearon archivos ajenos.
- **Documentación:** `implementation-report.md` agrega causa, corrección, regresión y resultados sin sustituir la evidencia previa. `review.md` conserva el review histórico y añade esta sección.

## Estado de findings y veredicto

**TASK008-IR-01 CLOSED.** La corrección por OID exacto cierra el bypass original y el test de overload lo demuestra con SQL ejecutado.

**TASK008-IR-02 — MEDIUM — `scripts/task008-ir01-professional-list.regression.mjs:41`.** El password aleatorio de PostgreSQL se interpola en el argumento `--env POSTGRES_PASSWORD=...` de `docker run`. **Escenario reproducido:** cuando Docker rechazó `docker run`, `execFile` incluyó el comando completo en su error y `node:test` imprimió el password temporal en la salida sin redacción. **Impacto:** un fallo del runner puede dejar una credencial de prueba en logs; si el contenedor llegara a quedar activo tras un fallo parcial, esa credencial permitiría acceso al PostgreSQL temporal publicado en localhost. Esto incumple la exigencia explícita de que la regresión no imprima secretos en failure paths. **Corrección mínima recomendada:** entregar el valor mediante el entorno del proceso hijo con `--env POSTGRES_PASSWORD` sin valor en argv, y sanitizar cualquier error del subprocess antes de pasarlo a `node:test`; comprobar el camino de fallo con un test que no exponga credenciales. Los intentos de este review no dejaron contenedores. No se corrigió código en esta conversación.

**Veredicto:** el único finding original está cerrado, pero el nuevo IR-02 MEDIUM impide aprobar el delta. `TASK-008 IMPLEMENTATION REVIEW CHANGES_REQUESTED`. No hubo stage, commit, push ni PR. `next-env.d.ts` permanece `M`, unstaged e intacto con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; TASK-009–012 permanecen ajenos. El único cambio de esta conversación es esta sección de `review.md`.

---

# TASK008-IR-02 Re-review — 2026-10-16

**Base/head:** `817a181c8792a4168f0e6a0ad3613fea976ec8a4` → `0d0a2ad720ce3a7deaff431af65f758c065e83d4`, rama `task/008-availability`; `HEAD == origin/task/008-availability`, commit `test: keep disposable postgres password out of argv`. El delta contiene exactamente `scripts/task008-ir01-professional-list.regression.mjs`, `.harness/tasks/active/TASK-008/implementation-report.md` y `.harness/tasks/active/TASK-008/review.md`. No modificó migration, RLS, RPCs, aplicación, UI ni DEV. Se revisaron los tres archivos, el bloque SQL histórico usado por la regresión y la preservación de los artefactos documentales.

## Evidencia focalizada

- **Password/argv:** `runDisposablePostgres()` pasa `--env`, `POSTGRES_PASSWORD` sin valor en argv. El valor está únicamente en `options.env.POSTGRES_PASSWORD` del proceso hijo. El test real comprueba que el password no está en argv, `childError.cmd`, `stdout` ni `stderr`. El helper atrapa el fallo de `execFile` sin propagar su error original, `cause` ni metadatos y emite sólo `Disposable PostgreSQL docker run failed.`. Los tests comprueban además `inspect(error)` y `JSON.stringify(error)` sin password, tanto con fallo real de Docker como con un error inyectado que sí contiene el password en mensaje y diagnósticos. La salida observable de la corrida no incluyó credenciales.
- **Cleanup:** `removeOwnContainer()` consulta Docker con nombre exacto `^/<container>$` y label exacta `task008-disposable-postgres-owner=<container>`; sólo pasa a `docker rm --force` el ID encontrado con ambos filtros. Se invoca al fallar `docker run` y en `finally` si el contenedor arrancó. El test verifica ausencia del contenedor tras el fallo real, rollback de las funciones creadas y ausencia posterior del contenedor de IR-01; una inspección adicional de `docker ps --all` con el prefijo de los dos tests devolvió vacío. No hay borrado por prefijo ni de contenedores ajenos.
- **IR-01 sanity:** el script sigue extrayendo y ejecutando el bloque SQL histórico. `public.staff_list_availability_professional_centers(uuid)` pasó; el overload `(uuid,text)` fue rechazado con el error histórico. ROLLBACK y limpieza pasaron. **IR-01 permanece CLOSED.**
- **Regresión:** `node --test scripts/task008-ir01-professional-list.regression.mjs` **6/6 PASS** (fallo Docker real, error simulado con password, firma aprobada, overload rechazado y dos tests padres). Tooling histórico dentro de `pnpm check`: **11/11 PASS**.
- **Verificación mínima:** `pnpm bootstrap` PASS; `pnpm check` PASS con 492 Vitest en 63 archivos y 11 tests históricos; `pnpm lint` PASS; `pnpm typecheck` PASS; `git diff --check` del delta y working tree PASS; `next build --webpack` en copia aislada PASS con ambas rutas de Availability. No se usó DEV.
- **Formato y documentación:** Prettier focalizado del único script modificado PASS. El check global sigue con 183 avisos CRLF históricos y ninguno del script remediado; no se reformatearon archivos ajenos. La comparación de prefijos mostró que `review.md` conserva íntegros plan review, implementation review original, IR-01, su cierre e IR-02; `implementation-report.md` conserva la evidencia previa y añade causa, corrección, regresión y resultado de IR-02 sin reescribirla.

## Findings y verdict

**TASK008-IR-02 CLOSED.** El valor ya no entra en argv y los caminos de error probados no lo exponen. **TASK008-IR-01 REMAINS CLOSED.** No apareció ningún finding material nuevo en este delta focalizado.

**TASK-008 IMPLEMENTATION REVIEW PASS — READY FOR PR.** No se abrió PR ni hubo stage, commit o push durante este re-review. El único archivo modificado en esta conversación es este `review.md`; `next-env.d.ts` sigue `M`, unstaged e intacto con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, y TASK-009–012 permanecen ajenos.
