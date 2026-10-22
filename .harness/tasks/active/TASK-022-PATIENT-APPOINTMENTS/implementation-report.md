# TASK-022 — Informe de auditoría y preparación local

## Estado final para PR (2026-10-22)

**PASS funcional DEV consolidado.** La persona usuaria ejecutó una vez el runId
`9b581bb1-e2be-44e4-b33d-77efbc594982`; `closure-ledger.json`,
`closure-report.json` y `closure-browser-evidence.json` coinciden en PASS del
único escenario pendiente, `stage=cleaned`, cleanup con `residue=0` y 14
inventarios inicial/final idénticos. RECEPTION leyó nombre y turno; las
denegaciones de PROFESSIONAL, adminB y unlinked comprobaron página no
encontrada sin datos ni controles administrativos, con `noindex` válido para
el HTTP 200 de streaming. Los checks RPC reales y los otros tres escenarios
Chromium del primer run ya estaban aprobados y no se repitieron. El detalle de
proveniencia y cleanup consta en `focused-dev-revalidation.md`. Esta revisión
leyó sólo archivos locales tras la ejecución manual; no abrió otra conexión
DEV. La migration aprobada conserva SHA-256
`A846341BD7C252EA782F20793F943EBBEE1010D0A2C64B21BCAF3C782137A6B3`.
TASK-022 queda lista para revisión mediante PR; no se hizo commit, push,
apertura de PR ni merge.

## Preparación de validación funcional DEV (2026-10-22)

El procedimiento funcional quedó preparado en `functional-dev-runbook.md` y `scripts/task022-functional-dev/`. Su `run` exige autorización separada y no se ejecutó en esta etapa. Diseña 5 Auth, 2 centros, 3 pacientes y 30 turnos sintéticos con runId/UUIDs preplanificados, baseline de 14 recursos, pruebas JWT/RPC y Chromium aislado, cleanup exacto y reconciliación de solo lectura ante ambigüedad. El PASS estructural DEV informado anteriormente sigue vigente, pero no equivale a PASS funcional. El procedimiento local pasó bootstrap, control de hash/24 migrations, pruebas puras del plan y aislamiento de secretos, Vitest focal de respuestas tardías, typecheck, ESLint y formato. La revisión independiente focal del procedimiento dio **PASS estático**, sin bloqueantes; no acredita ejecución remota. No hubo conexión ni escritura DEV/PROD, fixtures, migration, commit, push ni merge.

## Estado

**Contrato SQL validado localmente; integración y DEV pendientes.** El criterio 13 no está implementado ni validado en una UI funcional. La migration sólo se aplicó en un PostgreSQL Supabase temporal; no hubo escritura Supabase DEV/PROD, commit, push ni merge.

## Preparación segura

- `pnpm bootstrap`: PASS (Node 24.21.0, pnpm 11.26.0, configuración DEV coherente).
- `git fetch origin main`: `origin/main` avanzó a `69c1cd0`; `main` local se actualizó por fast-forward a ese commit. El árbol de la rama de partida y `main` era idéntico.
- Rama nueva local `codex/task-022-patient-history` apuntando a `69c1cd0`, sin cambios de checkout que reemplacen archivos ajenos.
- `next-env.d.ts`, `.env.local`, `TASK-021-DASHBOARD-OPERATIVO`, artefactos, scripts y demás trabajo preexistente permanecen intactos. No se inició servidor ni navegador.

## Reutilización y gap

- La ficha `PatientWorkspace` y `getPatientCenter()` ofrecen el panel aprobado y un detalle autorizado por Center/PatientCenter, incluso para pacientes fuera de la página actual.
- `requireRole`, el cliente Supabase de sesión y `getStaffAppointment()` ofrecen patrones de doble autorización y enlace a detalle.
- Los joins de `staff_list_appointments` ya conservan nombres de vínculos inactivos; el patrón `SECURITY DEFINER`, grants mínimos y keyset se puede reutilizar.
- `appointments` tiene RLS habilitado, SELECT revocado a `authenticated` y ninguna policy. `staff_list_appointments` limita la consulta a 31 días y no recibe PatientCenter. `staff_get_appointment` sólo recibe appointment ID. Ninguno permite un historial completo seguro y paginado por paciente.
- El índice existente `(patient_center_id, starts_at DESC)` puede servir parcialmente; el desempate de cursor por UUID requiere evaluar un índice compuesto en la migration nueva.

## Contrato requerido

`plan.md` especifica una RPC de lectura por Center + PatientCenter, proyección mínima, roles ADMIN/RECEPTION, control de pertenencia, estados/tiempo, cursores ASC/DESC, límite SQL y aislamiento. Requiere **nueva RPC y migration incremental**. No se modifican RPCs existentes ni reglas de Turnos.

## Verificación de la auditoría inicial (antes del gate SQL)

- Lectura focal de `docs/mvp.md`, módulos Pacientes/Turnos, código de panel/servicios, esquema, migration de Turnos, permisos y tests SQL.
- Vitest focal: 3 archivos, **49/49 PASS** (`patient-management`, `appointments`, `patient-workspace`). Es una línea base existente; no verifica la RPC propuesta.
- `git diff --check`: PASS para el árbol seguido; aviso CRLF preexistente de `next-env.d.ts` sin tocar el archivo.
- En ese checkpoint todavía no se podían ejecutar las pruebas nuevas de SQL. El gate SQL posterior consta abajo; los componentes de turnos de la ficha y su verificación visual siguen pendientes.

## Revisión independiente

**PASS condicionado del diseño en la auditoría inicial.** El reviewer confirmó coherencia del guard de rol/Center, RLS y revocación de SELECT, FK y joins tenant, proyección sin notas, clasificación disjunta, cursores ASC/DESC y patrón de offset DST. Señaló como gate P2 que `PatientWorkspace` usa `detail.updatedAt` como key: al integrar la lectura, el estado y las respuestas tardías deberán ligarse a `(centerId, patientCenterId)`. En ese momento no había migration ni SQL ejecutado. Véase `review.md` y el gate posterior abajo.

## Bloqueo identificado en la auditoría inicial

La ausencia inicial de una lectura por PatientCenter impedía una implementación real sin omisiones. La migration/RPC y su prueba SQL quedaron escritas localmente en el siguiente checkpoint. Aplicarlas a Supabase DEV requiere autorización específica de la persona usuaria. Después se puede integrar el servicio y el panel y ejecutar las pruebas y capturas requeridas. No se solicita autorización para PROD.

## Checkpoint PostgreSQL local (2026-10-22)

- Migration nueva: `supabase/migrations/20261022120000_add_patient_appointment_history.sql`. Agrega índice `(patient_center_id, starts_at, id)` y la RPC `staff_list_patient_appointments(uuid,uuid,text,timestamptz,timestamptz,uuid,integer)`; no altera tablas, datos, RPCs previas, grants globales ni policies.
- Prueba nueva: `supabase/tests/task-022-patient-appointment-history.sql`, transaccional con `ROLLBACK`. Cubre ADMIN, RECEPTION, PROFESSIONAL, sin membership, membership/Center inactivos, PatientCenter ajeno/inexistente/inactivo, historial vacío/extenso, cursores en ambas direcciones, empates, estados, frontera temporal, nombres inactivos, DST, proyección y grants.
- La RPC comprueba `auth.uid()` y `private.has_active_center_role` antes de leer PatientCenter, valida inputs, devuelve vacío tanto para paciente ajeno como inexistente, y acota respuesta a ID, instantes, estado, nombres profesionales/especialidad y `has_more`. `SECURITY DEFINER SET search_path = ''`; EXECUTE sólo `authenticated`; SELECT directo permanece revocado.
- El índice anterior `(patient_center_id, starts_at DESC)` se conserva hasta comparar planes. El nuevo índice soporta el desempate UUID del cursor en ambos sentidos, pero agrega costo de escritura mientras ambos convivan.
- Se intentó iniciar un contenedor local sin puertos publicados con la imagen Supabase Postgres ya disponible. Docker Desktop devolvió error 500 y luego `Docker Desktop is unable to start`. `psql` local no está instalado; no se ejecutaron migration, prueba SQL ni `EXPLAIN`. No hubo conexión ni escritura DEV/PROD.
- Revisión independiente de la capa SQL: **PASS estático condicionado a ejecución PostgreSQL**. No halló defectos bloqueantes de seguridad/aislamiento/proyección/orden. Marcó cobertura incompleta del cursor de próximos y de timestamps infinitos; se añadieron ambos casos a la prueba tras la revisión. No se repitió el review completo porque no cambió la migration.
- Limitación histórica: `RESCHEDULE` sobrescribe `starts_at`/`ends_at`; la RPC muestra el horario vigente almacenado y no inventa un registro de reprogramaciones.

### Gate que estaba pendiente antes de la reanudación

En ese momento no estaban acreditados la sintaxis/semántica ejecutada, los resultados SQL ni los planes de índice. El gate local se completó en la reanudación documentada abajo. El comportamiento DEV sigue sin acreditar y su aplicación requiere autorización específica separada. Procedimiento en `validation-procedure.md`.

### Diagnóstico del bloqueo local

Un diagnóstico posterior confirmó la causa en `local-runtime-diagnosis.md`: Docker usa Linux/Hyper-V, pero `DockerDesktopVM` no puede reservar 2048 MB (`0x800705AA`). El motor permanece detenido tras un único intento de arranque no destructivo. WSL 2 no tiene kernel/distribuciones y no es el backend configurado; la Supabase CLI local requiere contenedores y no hay PostgreSQL nativo completo. Por instrucción, se detuvo la ejecución SQL y no se pasó a DEV.

### Reanudación y gate SQL local (2026-10-22)

El bloqueo de memoria descrito arriba era histórico: tras liberar memoria, `docker desktop status` devolvió `running` y `docker version` mostró daemon Linux 28.5.1. Se inició `ghcr.io/supabase/postgres:17.6.1.166` en `task022-pg-local-20261022`, sin puertos publicados ni volúmenes. La imagen contiene `auth.users`, `auth.uid()` y los roles `anon`, `authenticated`, `service_role`, `supabase_auth_admin`. Docker Desktop devolvió `No such container` para `docker exec`/`inspect` aunque `docker ps` y `top` confirmaban el contenedor saludable; `psql` desde un cliente efímero con `--network container:task022-pg-local-20261022` funcionó. No se cambió la configuración global.

- Las **23 migrations previas** se aplicaron en orden con `ON_ERROR_STOP=1`; luego la migration TASK-022 produjo `BEGIN`, `CREATE INDEX`, `CREATE FUNCTION`, `REVOKE`, `GRANT`, `COMMIT` sin error. SHA-256 de la migration ejecutada: `A846341BD7C252EA782F20793F943EBBEE1010D0A2C64B21BCAF3C782137A6B3`.
- La prueba `supabase/tests/task-022-patient-appointment-history.sql` pasó con `ON_ERROR_STOP=1` y terminó en `ROLLBACK`. SHA-256: `BD979AE14FBCDF805931F1A6B812C758DBAFBFC3483430C2CB2070936AF439CC`. Cubre permisos efectivos, ADMIN/RECEPTION y denegaciones, aislamiento Center/PatientCenter, paciente y vínculos inactivos, páginas largas y empates, `has_more`, estados/corte temporal, DST y entradas inválidas. La firma real contiene sólo ocho columnas autorizadas; `authenticated` tiene EXECUTE, `anon` y `service_role` no; RLS de `appointments` sigue habilitado y `authenticated` carece de SELECT directo.
- Inventario tras la prueba: **0** fixtures de prefijo `92000000` en `centers`, `auth.users`, `users`, `persons`, `patient_centers` y `appointments`. Una segunda transacción con 5.000 cancelados y 1.000 pendientes para planes terminó en `ROLLBACK`; inventario posterior: **0** `appointments` con prefijos `92000000` y `93000000`.
- `EXPLAIN (ANALYZE, BUFFERS)` sobre la selección acotada de la RPC, con 6.000 filas adicionales transaccionales: UPCOMING inicial usó `appointments_center_starts_at_idx` + incremental sort (0,111 ms, 5 buffers); UPCOMING con cursor usó bitmap del índice nuevo + sort (0,719 ms, 23 buffers); HISTORY inicial usó index scan backward del índice nuevo (1,084 ms, 40 buffers, 1.003 filas futuras filtradas); HISTORY con cursor usó index scan backward del índice nuevo (0,072 ms, 5 buffers). Son planes locales de la subconsulta representativa, no un benchmark DEV ni del costo completo de la RPC.
- El índice nuevo aporta una ruta observable para cursores `(starts_at,id)` y orden inverso; no se retiró el índice previo `(patient_center_id, starts_at DESC)` porque puede servir otras consultas y faltan planes de carga DEV. La página HISTORY inicial puede recorrer turnos futuros antes de encontrar históricos; registrar esa característica para observar con distribución real, sin cambiar una implementación que pasó las pruebas.
- Al finalizar, `docker stop task022-pg-local-20261022` respondió correctamente. El contenedor se eliminó automáticamente por `--rm`; `docker ps -a --filter name=task022-pg-local-20261022` quedó vacío. No se tocaron otros contenedores ni volúmenes.

**Gate local:** PASS de ejecución PostgreSQL. **Gate independiente:** PASS focal sobre la ejecución real, sin hallazgos materiales bloqueantes; ver `review.md`. **DEV:** no aplicado y requiere autorización específica; UI y criterio 13 siguen pendientes.

### Preparación para DEV (sin conexión remota)

`dev-application-runbook.md` fija el proyecto `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), SHA-256 aprobado, preflight de solo lectura, detenciones, aplicación de un único archivo y postflight estructural sin fixtures. Se preparó `scripts/task022-dev/gate.mjs` con modos `local`, `preflight` y `apply`, y `run.ps1` para solicitar una sola vez la contraseña PostgreSQL preexistente mediante entrada oculta. La vía de escritura usa `pg` existente y una transacción que ejecuta exclusivamente las cuatro sentencias de efecto de la migration aprobada y registra su versión; no usa `db push`, que podría procesar otras migrations pendientes.

`local` pasó con 23 migrations previas + TASK-022 y hash `A846341BD7C252EA782F20793F943EBBEE1010D0A2C64B21BCAF3C782137A6B3`. Un shadow local con las 23 previas probó el runner nuevo (`TASK022_SHADOW_RUNNER_PASS prior=23 applied=1 postcheck=PASS`). Esa prueba descubrió y permitió corregir una conversión de catálogo `"char"` del runner; no cambió la migration ni invalida el PASS SQL anterior. No se abrió conexión DEV/PROD ni se tocó el servidor Next.js.

## Aplicación estructural DEV informada y ficha local (2026-10-22)

La persona usuaria confirmó que su ejecución controlada en terminal local terminó con `LOCAL PASS`, `PREFLIGHT PASS` y `APPLICATION_AND_STRUCTURAL_POSTCHECK PASS`. Destino informado: `salud-plus-turnos-dev` / `ehllxymqyzrofydrvtzo`; migration `20261022120000_add_patient_appointment_history.sql`; 24 migrations remotas. Es **PASS estructural DEV informado por la persona usuaria**, separado del PASS de ejecución PostgreSQL local; este checkpoint no abrió una conexión independiente a DEV ni repitió `apply`. No se crearon fixtures remotos.

La integración nueva usa `PatientWorkspace` y la ruta `/centers/[centerId]/patients`: la zona horaria procede del Center autorizado, el panel se identifica por Center + PatientCenter y descarta respuestas tardías. `patient-appointment-rpc.ts` valida estrictamente las ocho columnas de la RPC; el servicio `server-only` reautoriza ADMIN/RECEPTION, captura un único `asOf` por apertura/actualización y solicita ambas secciones con el cliente de sesión. Cada página siguiente conserva `asOf` y envía el último `(starts_at,id)` a la RPC. La UI muestra horario local con offset DST, profesional, especialidad, estado, errores/vacíos y acceso al detalle que reautoriza. El índice y la migration aprobados no se modificaron.

Verificación local focal: `pnpm bootstrap` PASS; Vitest de contrato, servicio, panel y ruta **52/52 PASS**; TypeScript y ESLint focal PASS. Chromium aislado con datos sintéticos locales a 1440 y 390 px, sin red externa: ambas secciones y estados visibles, cero errores de navegador y cero desbordamiento horizontal. Capturas y mediciones en `artifacts/task022-patient-history/`. Review independiente focal de seguridad, comportamiento y presentación: **PASS**, sin defectos materiales; ver `review.md`. La validación funcional con fixtures en DEV requiere autorización y cleanup exacto separados.

### Siguiente gate DEV, aún no autorizado

Obtener una autorización específica para crear fixtures sintéticos en DEV y definir de antemano sus UUIDs exactos. Capturar baseline de esos IDs en `auth.users`, `public.users`, `centers`, `center_memberships`, `persons`, `patient_centers`, `professionals`, vínculos/especialidades y `appointments`; exigir ausencia inicial. Crear sólo esos registros, probar la RPC con sesiones reales ADMIN, RECEPTION y denegadas, Center y PatientCenter ajenos, paginación, empates, estados y DST. El cleanup debe eliminar en orden inverso de dependencias **por los UUIDs exactos registrados**, incluidos usuarios Auth creados para el fixture, y comprobar ausencia final de cada ID y restauración del inventario baseline. Detenerse ante una eliminación incierta; no usar prefijos amplios, resets ni tocar registros preexistentes. No ejecutar este gate dentro de TASK-022 local.
