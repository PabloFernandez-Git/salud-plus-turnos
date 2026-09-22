# Review — TASK-004 Esquema PostgreSQL inicial

**Rol:** Reviewer / Verifier independiente + Database/RLS Reviewer + Security Reviewer

**Fecha:** 2026-09-22

**Branch verificada:** `task/004-initial-postgres-schema`

**Base:** `main` / `9093cd04a5f102a1fd5d5380c1f831554e77b983`

**Estado del cambio:** working tree sin commit; `HEAD` continúa coincidiendo con `main`; la branch no
existe en `origin`; TASK-004 continúa bajo `.harness/tasks/active/` y no fue cerrada ni archivada.

**Resultado general del Review:** `PASS`

**Estado de TASK-004:** `READY_FOR_CLOSE`

## Conclusión

En esta segunda ronda, la migration incremental corrige correctamente el predicado parcial de
turnos: tanto el archivo como el catálogo DEV enumeran sólo `PENDING`, `CONFIRMED`, `ATTENDED` y
`NO_SHOW`. La exclusion constraint conserva el ProfessionalCenter, el `tstzrange(..., '[)')` y los
operadores aprobados. El primer hallazgo original queda resuelto.

La corrección final reemplaza la lease temporal por un latch controlado mediante cuatro conexiones
PostgreSQL persistentes. No existe `pg_sleep`; el controller conserva un advisory lock de sesión y
sólo lo libera explícitamente después de que el observer demuestra simultáneamente que A sigue con
la transacción abierta detrás del gate y que B espera `Lock/transactionid` bloqueada por A.

El Reviewer ejecutó diez corridas consecutivas e independientes con resultado `10/10 PASS`. En todas
se observaron PIDs distintos para controller, A y B, el latch controller → A, el bloqueo A → B y el
rechazo estricto de B con SQLSTATE `23P01`. El último hallazgo queda resuelto y no aparecieron
regresiones en Database, migrations, RLS, Security, tipos ni limpieza.

## Hallazgos por severidad

### [RESUELTO] El predicado de `appointments_no_blocking_overlap` usa una lista cerrada

**Archivo/objeto afectado:**

- `supabase/migrations/20260921210000_use_explicit_appointment_blocking_statuses.sql`
- constraint e índice GiST `public.appointments.appointments_no_blocking_overlap`

**Evidencia:**

- Las dos migrations anteriores siguen coincidiendo exactamente con sus statements registrados en
  `supabase_migrations.schema_migrations`; no fueron reescritas.
- La tercera migration sólo abre una transacción, elimina la constraint y la recrea con la lista
  cerrada; no modifica tablas, columnas, enums ni datos.
- `pg_get_constraintdef` y `pg_get_expr(indpred, ...)` devuelven exactamente
  `status = ANY (ARRAY['PENDING', 'CONFIRMED', 'ATTENDED', 'NO_SHOW'])`, con los casts al enum.
- La suite inspecciona ese predicado exacto y revalida los cuatro estados bloqueantes, `CANCELLED`,
  contigüidad, solapamientos parciales/completos, ProfessionalCenter distintos y updates
  conflictivos.

**Comportamiento esperado:** cumplido. Un futuro valor del enum no queda incluido automáticamente y
requerirá una migration que decida explícitamente su semántica.

**Corrección requerida:** ninguna.

### [RESUELTO] El runner concurrente usa un latch controlado y fue estable en 10/10 corridas

**Archivo/objeto afectado:**

- `scripts/verify-initial-schema.mjs:248`
- `scripts/verify-initial-schema.mjs:266`
- `scripts/verify-initial-schema.mjs:367`
- `scripts/verify-initial-schema.mjs:446`
- `scripts/verify-initial-schema.mjs:511`
- `scripts/verify-initial-schema.mjs:558`

**Evidencia:**

- No existe `pg_sleep`. Los `setTimeout` restantes sólo rechazan watchdogs de cleanup; el polling usa
  una demora de 150 ms entre lecturas. Ninguno libera el gate, confirma una transacción ni puede
  convertir un timeout en PASS.
- Una clave advisory aleatoria de 64 bits se genera para cada marker/gate de cada ejecución. El
  controller adquiere `pg_advisory_lock(gateKey)` y conserva ese lock de sesión antes de iniciar A.
- A abre transacción, obtiene su PID, completa el primer `INSERT`, adquiere su marker transaccional y
  recién después espera `pg_advisory_xact_lock(gateKey)`. El observer exige `xact_start`, espera
  `Lock/advisory`, lock no concedido y controller como blocker. A no puede alcanzar el `COMMIT`
  mientras el controller conserva el gate.
- B sólo se inicia después de observar ese estado de A. B adquiere un marker diferente y ejecuta el
  `INSERT` solapado; nunca solicita el gate del controller.
- Antes de liberar el gate, el observer exige simultáneamente A abierta y esperando el advisory lock,
  B abierta y esperando `Lock/transactionid`, lock de transactionid no concedido, A incluida en
  `pg_blocking_pids(B)`, markers de A/B concedidos y promises de A/B pendientes.
- El observer sólo lee catálogo. El advisory lock prueba el latch controller → A; la evidencia de la
  exclusion concurrente es separadamente B esperando el transactionid de A.
- `pg_advisory_unlock(gateKey)` aparece en el camino exitoso únicamente después de todas las
  aserciones anteriores. Luego se espera que A salga del gate, se ejecuta el `COMMIT` de A y B debe
  rechazarse estrictamente con `secondResult.reason.code === '23P01'`. El nombre de constraint no
  sustituye el SQLSTATE.
- La corrida 1 conservó evidencia: controller PID `114350`, A PID `114351`, B PID `114352`; A retenida
  detrás del controller, B pendiente en `Lock/transactionid` y bloqueada por A, seguida por `23P01`.
  Las diez corridas completaron también la aserción de exactamente un appointment.
- El `finally` libera el gate si continúa tomado, espera/rollbackea A y B según su estado, cierra las
  cuatro conexiones, elimina fixtures y verifica explícitamente cero sesiones y advisory locks del
  runner. Los errores de cleanup se agregan sin ocultar el error original.

**Comportamiento esperado:** cumplido. El latch no caduca por tiempo, la evidencia de bloqueo es
independiente del advisory gate y el resultado fue estable en diez de diez ejecuciones.

**Corrección requerida:** ninguna.

## Resultado de Database review

| Área | Resultado | Evidencia independiente |
| --- | --- | --- |
| Tablas | PASS | Catálogo DEV enumera exactamente las 11 tablas aprobadas y ninguna tabla pública adicional. |
| `public.users` / Auth | PASS | `users.id` es simultáneamente PK y FK a `auth.users(id)` con `ON UPDATE/DELETE RESTRICT`; no existe `auth_user_id`, email ni credencial alternativa. |
| Columnas y defaults | PASS | Tipos, nulabilidad, defaults, auditoría e `is_active`/status coinciden con la propuesta. `normalized_document` figura generated stored y `NOT NULL` en ambas entidades. |
| FKs multi-centro | PASS | Catálogo y suite SQL confirman FKs compuestas para membership, asignación, disponibilidad, paciente, profesional y especialidad del turno. Los cruces inválidos son rechazados. |
| Membership | PASS | `UNIQUE (center_id, user_id)`, enum de rol único, vínculo obligatorio sólo para `PROFESSIONAL` y FK compuesta al mismo centro. |
| Normalización documental | PASS | Una sola función privada, `IMMUTABLE`, `STRICT`, `SECURITY INVOKER`, `search_path` vacío; conserva ceros/símbolos no aprobados y no translitera. Los CHECK rechazan el resultado vacío. |
| Identidad documental | PASS | `UNIQUE (nationality_code, normalized_document)` en `persons` y `professionals`; nacionalidad limitada a dos letras ASCII uppercase. |
| Especialidades | PASS | Índice único funcional `(center_id, lower(btrim(name)))`, sin predicado de actividad; conflicto por case/trim, reserva del nombre inactivo y sin normalización de acentos. |
| Professional-Center | PASS | Unicidad por centro/profesional; matrícula nullable y no unique; duración default 30, rango 5–480 y múltiplo de 5. |
| Disponibilidad | PASS | `weekday` 1–7, `start_time < end_time`, rango `[)`, contiguidad permitida y GiST parcial sólo para filas activas del mismo ProfessionalCenter/día. |
| Turnos actuales | PASS | `starts_at < ends_at`; GiST por `professional_center_id` + `tstzrange(..., '[)')`; los cuatro estados aprobados bloquean, `CANCELLED` libera y ProfessionalCenter distintos pueden coincidir. |
| Predicado futuro de turnos | PASS | Predicado cerrado y exacto sobre `PENDING`, `CONFIRMED`, `ATTENDED` y `NO_SHOW`; futuros valores no quedan incluidos automáticamente. |
| Triggers | PASS | Once triggers técnicos `BEFORE UPDATE`; una función común `SECURITY INVOKER`, sin SQL dinámico y con `search_path` vacío. |
| Borrados/updates referenciales | PASS | Todas las FKs del dominio usan `RESTRICT`; no hay cascadas destructivas. |

## Índices

| Clasificación | Índices revisados | Resultado |
| --- | --- | --- |
| Constraints | PK/UNIQUE de las tablas, claves candidatas `(id, center_id)`, identidad documental, nombre normalizado y ambos GiST de exclusión | Necesarios y coherentes. |
| FKs/performance | reverse lookups por profesional, usuario, ProfessionalCenter, Specialty y Person | Las FKs operativas importantes tienen soporte razonable. |
| Agenda | disponibilidad activa por ProfessionalCenter/día; turnos por centro/fecha, ProfessionalCenter/fecha y paciente/fecha | Coherentes con los accesos previstos. |
| Dashboard | memberships, profesionales, pacientes y especialidades activas por centro; turnos por centro/status/fecha | Coherentes con el MVP. |
| Potencialmente redundantes | B-tree parcial de disponibilidad frente al GiST parcial y algunos prefijos de claves únicas | No se observó redundancia significativa: los B-tree soportan filtros/orden habituales que el GiST o los UNIQUE no sustituyen bien. |

Las operator classes reales son `extensions.gist_uuid_ops`, `extensions.gist_int2_ops` y
`pg_catalog.range_ops`, según corresponde. `btree_gist` está instalado en `extensions`.

## Resultado de RLS / Security review

| Verificación | Resultado | Evidencia independiente |
| --- | --- | --- |
| RLS habilitada | PASS | `relrowsecurity = true` en 11/11 tablas. |
| Policies | PASS | Cero filas en `pg_policies` para las 11 tablas. |
| Grants API | PASS | `anon` y `authenticated` no tienen SELECT ni DML/REFERENCES/TRIGGER/TRUNCATE sobre ninguna tabla. |
| Default-deny real | PASS | Con grants DML temporales dentro de transacciones, ambos roles vieron cero filas, no pudieron insertar y afectaron cero filas al intentar update/delete; todo terminó en ROLLBACK. |
| Funciones | PASS | Sólo existen `private.normalize_document(text)` y `private.set_updated_at()` en `public/private`; ninguna es `SECURITY DEFINER`; ACL de función y schema privado limitada a `postgres`. |
| Bypass accidental | PASS | No hay views, materialized views ni funciones públicas agregadas; `anon`/`authenticated` no tienen `BYPASSRLS`. |
| Datos sensibles | PASS | Sin policies o grants que expongan Person, Professional, memberships, appointments ni notas administrativas. |
| Secretos | PASS | `security:check:client-bundle` pasó; búsqueda del working tree versionable no encontró secret/service-role keys, tokens, passwords ni connection strings. `.env.local` sigue ignorado y no versionado. |

## Concurrencia

- Resultado de estabilidad independiente: `10/10 PASS`.
- En las diez corridas se observaron PIDs independientes para controller, A y B; A abierta esperando
  el advisory gate; B esperando `Lock/transactionid` con A como blocker; ambas promises pendientes
  antes del unlock; B rechazada con `23P01`; exactamente una reserva; cleanup completo.
- Evidencia detallada de la corrida 1: controller PID `114350`, A PID `114351`, B PID `114352`; B
  pendiente en `Lock/transactionid`, bloqueada por A; después del unlock controlado y commit de A, B
  terminó con `23P01`.
- No existe un camino temporal de éxito: los deadlines y watchdogs sólo lanzan errores y conducen al
  `finally`.

## Dependencia `pg` y destino de conexión

- `pg` está exclusivamente en `devDependencies`; `package.json` y `pnpm-lock.yaml` resuelven
  coherentemente `pg@8.23.0`, confirmado también por `pnpm list pg --depth 0`.
- El único import versionado de `pg` está en `scripts/verify-initial-schema.mjs`; no existe cliente
  PostgreSQL directo en `src/` ni cambio a la decisión arquitectónica de usar Supabase Client desde
  la aplicación.
- Las credenciales son temporales y se obtienen en memoria desde `supabase db dump --linked
  --dry-run`; no se imprimen ni persisten. No hay password, connection string ni secreto versionado.
- El runner ejecuta primero los guards existentes: `.env.local` debe declarar development y el ref
  aprobado, y `supabase/.temp/project-ref` debe ser `ehllxymqyzrofydrvtzo`.
- El host temporal sólo se acepta si es `db.ehllxymqyzrofydrvtzo.supabase.co` o coincide con el pooler
  linkeado y el usuario termina en `.ehllxymqyzrofydrvtzo`. Un destino distinto o un error de
  conexión lanza error; no existe fallback que produzca PASS.
- `.env.local` y `supabase/.temp/` continúan ignorados y no versionados.

## Migrations y drift

| Verificación | Resultado |
| --- | --- |
| Historial local/remoto | PASS — existen exactamente tres migrations locales y `migration list --linked` muestra `20260921150000`, `20260921170000` y `20260921210000` sincronizadas; no existe una cuarta migration. |
| Migration inicial inmutable | PASS — los 62 statements almacenados en `supabase_migrations.schema_migrations` coinciden exactamente, ordinal por ordinal, con el archivo local actual. |
| Segunda migration | PASS — cuatro statements exactos (`BEGIN`, dos `ALTER ... SET NOT NULL`, `COMMIT`), segura con el estado actual y al aplicar ambas migrations en orden desde cero porque `document_number` y la función strict impiden NULL previo. |
| Tercera migration | PASS — cuatro statements exactos (`BEGIN`, `DROP CONSTRAINT`, `ADD CONSTRAINT`, `COMMIT`); incremental y limitada a reemplazar el predicado de la exclusión de appointments. |
| Catálogo vs migrations | PASS con verificación alternativa — tablas, columnas, defaults, generated expressions, constraints, índices, triggers, enums, funciones, RLS, ACL y objetos expuestos coinciden; no aparecieron objetos manuales extra. |
| `supabase db diff --linked` | No disponible en este host: la creación de la shadow database volvió a fallar por `LegacyImagePrepullError`, HTTP 500 de Docker Desktop. No modificó DEV. La comparación exacta de los tres SQL registrados más la inspección exhaustiva del catálogo no encontró drift inexplicado. |
| Destino remoto | PASS — único proyecto visible/linkeado: `salud-plus-turnos-dev`, ref `ehllxymqyzrofydrvtzo`, `sa-east-1`, `ACTIVE_HEALTHY`. |
| PROD | PASS según evidencia disponible — no existe proyecto PROD visible en la cuenta de CLI, no hay ref/configuración PROD en los scripts y todas las operaciones del review pasaron por el guard DEV. |

## Tipos generados

- `pnpm db:types`: PASS.
- SHA-256 antes y después: `2166323A6001988B0EF4BB4C768B5D779EFD5D71B3A6B5E1D127FF7056D1E263`;
  la regeneración no cambió el archivo.
- La tercera migration sólo cambia una constraint y no produjo cambios innecesarios en los tipos.
- Contiene las 11 tablas, los dos enums y las relaciones públicas esperadas.
- `persons.Row.normalized_document` y `professionals.Row.normalized_document` son `string`, no
  `string | null`, coherentes con el catálogo DEV.

## Comandos y verificaciones reproducidas

| Comando / inspección | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS — Node 24.21.0, pnpm 11.26.0 y link/config DEV coherentes. |
| `pnpm supabase:check:dev` | PASS. |
| Suite SQL de TASK-004 | PASS en cada invocación del runner y en una ejecución separada adicional. |
| Runner concurrente corregido | PASS — 10/10; latch controller → A, bloqueo A → B y SQLSTATE estricto `23P01` observados. |
| `pnpm db:types` | PASS y sin cambio de hash. |
| `supabase migration list --linked` | PASS — tres migrations locales/remotas. |
| `supabase db lint --linked --schema public --fail-on error` | PASS — cero errores. |
| `supabase db advisors --linked --type security --fail-on error` | PASS — cero issues. |
| `pnpm security:check:client-bundle` | PASS. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS — lint, typecheck y 17/17 tests. |
| `pnpm build` | PASS. |
| `git diff --check` | PASS; sólo avisos informativos de conversión LF/CRLF. |

## Limpieza de DEV

La consulta final posterior a todas las pruebas confirmó:

- cero filas en las 11 tablas del dominio;
- cero usuarios en `auth.users`;
- cero policies;
- cero privilegios de tabla para `anon` y `authenticated`;
- cero advisory locks y cero sesiones con `application_name` del runner;
- ninguna fixture persistente después de las diez corridas y la suite SQL adicional.

## Resultado

`PASS`

Todos los hallazgos están resueltos. TASK-004 queda `READY_FOR_CLOSE`, pero este review no la cerró ni
archivó. Sólo se actualizó este archivo; no se modificaron código, migrations ni dependencias, no se
crearon migrations y no se hizo commit/push/PR.
