# TASK-007A — DB/API Foundation · Implementation report

**Estado:** TASK-007A DB/API Foundation implementada y verificada en DEV; lista para review independiente. TASK-007 completa sigue abierta.

## Preflight y gates

- Rama `task/007-patients`; staging vacío. Cambios iniciales: documentación de TASK-007 y `next-env.d.ts` ajeno. Este último conservó SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, unstaged e intacto.
- `pnpm bootstrap` pasó. Supabase CLI instalada: **2.117.0**. El wrapper `pnpm exec supabase` falló bajo sandbox; la CLI local se ejecutó con acceso a su directorio de configuración. No se actualizó tooling.
- Antes de SQL: 17 migrations locales = 17 DEV; `db push --dry-run --linked` sin pendientes. Catálogo DEV de `persons`, `patient_centers`, `centers` y `center_memberships` concordó con migrations y tipos: columnas/nulabilidad, UNIQUE, FK, índices, triggers, RLS, policies y grants. `persons.normalized_document` es generated/stored y único con nacionalidad; `patient_centers` único por Center/Person.
- Baseline inicial ampliado, por contenido exacto de Auth, relaciones, entidades y operaciones: SHA-256 `72e4ff430c470d65e6d7d7a46e722fb02383bc509aecea6b80e2f87f2b21de30`. Conteos: 1 Auth user, 1 Auth identity, 1 public user, 1 PLATFORM_ADMIN, 1 Center, 1 membership, 2 operaciones; cero Persons, PatientCenters, Professionals, Specialties, Availability y Appointments. El digest histórico de TASK-006 también pasó: `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.
- Se releyeron `brief.md`, `plan.md` y `review.md`: D1–D8 vinculantes y P007-R1/R2/R3 CLOSED en el segundo re-review.

## Implementación aplicada a DEV

- `20261013190000_add_patient_foundation.sql`: trim explícito `PATIENT_EDGE_WHITESPACE`; snapshot de 249 códigos ISO alpha-2 compartido con TypeScript; email opcional tras trim y validador TASK-006; helper privado de día local; autorización tenant; dos policies SELECT y grants; siete RPCs estrechas; lock de identidad/Center, CAS y trigger monotónico de PatientCenter.
- `20261013200000_remove_patient_rpc_unused_variables.sql`: correction incremental de tres variables sin uso que señaló `db lint`. La primera migration aplicada no se editó.
- Las RPCs cubren búsqueda tenant literal/paginada, resolve exacto con salida mínima, create, link, reactivate, update y deactivate. Person global permanece inmutable en este flujo. `SECURITY DEFINER` usa `search_path=''`, grants por firma a `authenticated` y autorización interna ADMIN/RECEPTION.
- Tipos de `public` regenerados desde DEV por `pnpm db:types`; no editados a mano.
- TypeScript: helpers/schema de trim, nacionalidad, documento, email y campos de paciente. Snapshot ISO consultado con [ISO](https://www.iso.org/iso-3166-country-codes.html) y lista de códigos versionada desde [country-list](https://github.com/datasets/country-list/blob/master/data.csv) el 2026-10-13.

## Verificación realizada

- Migration inicial y correction probadas en transacciones que siempre terminan en ROLLBACK. La matriz DB cubrió trim, ISO completo, frontera fija Buenos Aires, create, resolve mínimo y mismatch, búsqueda con tabs, email/campos opcionales, CAS/no-op/stale, deactivate/reactivate, role denial, RLS de Person no vinculada y link explícito. No se crearon fixtures persistentes.
- Tests TypeScript focalizados: 15/15 PASS. `pnpm lint`, `pnpm typecheck` y `git diff --check`: PASS.
- Tras ambas migrations: **19 locales = 19 DEV**, dry-run sin pendientes, `db lint --linked` sin resultados. No se ejecutaron aún pruebas de concurrencia real, matriz DB completa, suite unitaria completa, build, guard de secretos ni review independiente.

## Bloqueo y estado final

- El baseline ampliado después de las migrations dio SHA-256 `86b6cd6a9c548cf5fcb24cc9e428c0205fd1bdfb02ccc485e350687fbd3fcc65`, distinto del inicial; una segunda lectura dio el mismo digest posterior. Los conteos siguieron idénticos y el baseline histórico TASK-006 conservó su digest. La causa de la diferencia exacta no está establecida. No se modificó ni limpió ninguna fila persistente para resolverla.
- Por la condición de parada explícita, se suspenden más mutaciones DEV y el checkpoint. No hubo stage, commit ni push. `next-env.d.ts` permanece unstaged con el SHA esperado. PROD no fue consultado ni modificado.
- Antes de retomar: reconciliar con evidencia read-only qué dato cambió entre ambos snapshots ampliados y obtener un baseline exacto aprobado; después completar concurrencia, matrices, verificación local restante y review. Las migrations aplicadas son inmutables.

## Read-only baseline forensics — 2026-10-13

**Clasificación: E — Insufficient evidence.** El snapshot canonicalizado inicial no se guardó; sólo quedó su SHA, conteos y catálogo impreso. No existe un diff campo por campo verificable. El estado permanece **STOPPED — BASELINE RECONCILIATION REQUIRED**. No se ejecutaron DML, RPCs mutantes, Auth login, fixtures, migrations, cleanup ni acceso a PROD en este diagnóstico.

### Definición y estabilidad del algoritmo

`scripts/verify-task007a-dev-preflight.mjs` establece una transacción `REPEATABLE READ READ ONLY`, asume el rol `postgres` y recorre en orden fijo los 15 componentes de `tables`. Para cada uno ejecuta `to_jsonb(record)` sobre **todas las columnas de todas las filas**, serializa cada objeto con `JSON.stringify`, ordena lexicográficamente esas cadenas y las guarda bajo el nombre de tabla. Calcula `SHA-256(JSON.stringify(snapshot))` sobre ese objeto de 15 claves en orden de inserción. Para cada componente, el digest diagnóstico de abajo es `SHA-256(JSON.stringify(filas_serializadas_ordenadas))`. El script no excluye NULL, timestamps, Auth metadata ni campos secretos del cálculo; los valores de estos últimos no se imprimen.

La consulta de catálogo del mismo script se ejecuta **después** del digest y sólo aparece en la salida: schema, migration history, functions, policies, grants, triggers e índices **no participan** en el hash. Tampoco participan `auth.sessions`, `auth.refresh_tokens` ni otras tablas fuera de la lista. Sí participa la fila completa de `private.provisioning_operations`, incluidos `created_at`, `updated_at` y `completed_at`.

El historial de comandos de este task muestra que el script quedó con la misma lógica antes de la primera medición exitosa y no fue editado entre `72e4...` y `86b6...`. Código, orden de componentes y serialización fueron idénticos. El archivo actual tiene SHA-256 `0B72AC73E203193DE02DC55452306594805493F0830E5C0BEFAA226B51E17846`. No se conservó un hash del archivo en el momento de cada lectura, por lo que esta constatación se basa en la secuencia de edición/ejecución del task, no en dos artefactos firmados independientes.

### Descomposición actual de DATA

Estos son **nombres de campos**, conteos y digests; no se imprimieron valores de Auth, credenciales ni datos personales. Los campos de Auth se nombran para auditar el contrato, pero su contenido no está en este informe.

| Componente | Filas | Digest SHA-256 | Campos incluidos |
| --- | ---: | --- | --- |
| `auth.users` | 1 | `50856cd2dbe4c84fc0494a591471dbe95f595f8bfff1ab389be0cc1dc0c15dc5` | Todos los 35 campos actuales: identidad/cuenta, email/teléfono, confirmación/recovery/cambio, tokens, `last_sign_in_at`, `created_at`, `updated_at`, flags y metadata. Incluye `encrypted_password`, `raw_app_meta_data` y `raw_user_meta_data`; ningún valor se expone. |
| `auth.identities` | 1 | `5792e3681282b6b4113b61711ed217f40717215bffdc9d60d3999d7689480e80` | `provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,email,id` |
| `public.users` | 1 | `2fdd92670f49a3d8c2a7f92aa871476b5321590694916ccbdb69ee9280a59409` | `id,first_name,last_name,created_at,updated_at,email` |
| `public.platform_admins` | 1 | `bdc9b7b306698c8a3a0c63398e0ec2eeeb4bf6e30a73eb1745450abdda4cf6e6` | `user_id,created_at` |
| `public.centers` | 1 | `e29801e85445a579013b35c451667cd1ec36ceda0e8f9803664785dd014512eb` | `id,name,phone,email,address,logo_path,timezone,is_active,created_at,updated_at` |
| `public.center_memberships` | 1 | `d64b7bf6e9a44dcae3a210908a64f3afce8be3ee31d3d62a30de4212e3a54970` | `id,center_id,user_id,role,professional_center_id,is_active,created_at,updated_at` |
| `private.provisioning_operations` | 2 | `b7810eef4bf71fcd6ad5a27493b5b78756f295f0b8f4d44adfd62c22b2a66fda` | `id,operation_type,payload_hash,actor_user_id,scope_center_id,auth_user_id,auth_user_was_created,status,result_user_id,result_center_id,result_membership_id,result_application_user_created,created_at,updated_at,completed_at` |
| `public.professionals` | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `id,first_name,last_name,nationality_code,document_number,normalized_document,email,phone,created_at,updated_at` |
| `public.professional_centers` | 0 | igual al digest de `[]` | `id,professional_id,center_id,license_number,usual_appointment_duration_minutes,is_active,created_at,updated_at` |
| `public.specialties` | 0 | igual al digest de `[]` | `id,center_id,name,description,is_active,created_at,updated_at` |
| `public.professional_center_specialties` | 0 | igual al digest de `[]` | `professional_center_id,specialty_id,center_id,is_active,created_at,updated_at` |
| `public.persons` | 0 | igual al digest de `[]` | `id,first_name,last_name,birth_date,nationality_code,document_number,normalized_document,created_at,updated_at` |
| `public.patient_centers` | 0 | igual al digest de `[]` | `id,person_id,center_id,phone,email,insurance_name,administrative_notes,is_active,created_at,updated_at` |
| `public.availabilities` | 0 | igual al digest de `[]` | `id,professional_center_id,center_id,weekday,start_time,end_time,is_active,created_at,updated_at` |
| `public.appointments` | 0 | igual al digest de `[]` | `id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status,administrative_note,created_at,updated_at` |

El agregado actual volvió a reproducir `86b6cd6a9c548cf5fcb24cc9e428c0205fd1bdfb02ccc485e350687fbd3fcc65`.

### Qué se puede y no se puede concluir

- El snapshot inicial de `72e4...` **no se guardó** en archivo ni en el reporte; la salida inicial contenía sólo digest, conteos y catálogo. No hay digests iniciales por componente. **Initial snapshot unavailable for direct diff.**
- El baseline histórico TASK-006 sigue dando `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`. Incluye las filas completas de las tablas de dominio compartidas y operaciones, pero para `auth.users` sólo `id,email,encrypted_password,raw_user_meta_data`. No incluye `auth.identities`, `persons`, `patient_centers`, `availabilities` ni `appointments`. Estas cuatro tablas de dominio adicionales estuvieron vacías antes y después; por tanto la discrepancia se acota a **algún campo adicional de `auth.users` y/o alguna columna de `auth.identities`**. No se puede señalar cuál sin el snapshot/digests iniciales.
- La suite TASK-007A no hizo Auth login con el usuario persistente. `verify-task007a-migration-smoke.mjs` usó IDs aleatorios de fixtures en una transacción con ROLLBACK y simuló claims mediante `set_config`; no llamó `signIn` ni Auth Admin login. `verify-task007a-dev-preflight.mjs` sólo leyó tablas. El baseline ampliado **sí** incluye `last_sign_in_at` y `updated_at` de Auth, que pueden variar por actividad externa; no hay evidencia inicial para atribuirles este cambio concreto. No se alteró ningún timestamp para comprobarlo.
- Lectura adicional sin valores de identidad: `auth.users.last_sign_in_at = 2026-09-28T21:02:03.487Z` y `auth.users.updated_at = 2026-10-13T19:21:24.592Z`; en `auth.identities`, `last_sign_in_at = updated_at = 2026-09-25T15:06:04.681Z`. El `updated_at` actual del Auth user es posterior a la preparación del primer baseline, lo que apunta a una actualización de esa fila, pero no conserva su valor inicial ni demuestra qué otras columnas cambiaron o quién la actualizó. Una consulta limitada a hora y tipo de eventos de `auth.audit_log_entries` entre 19:14 y 19:30 UTC devolvió cero filas; no prueba ausencia de cambios fuera de ese log. `last_sign_in_at` actual no sugiere un login TASK-007A.
- Las migrations cambiaron functions, RPCs, policies, grants, trigger y migration history. Nada de eso entra al hash DATA. El catálogo se imprimió aparte. Por ello no se demuestra un problema de mezcla DATA/SCHEMA ni un cambio necesario del hash causado por las migrations. Schema se verifica por separado: 19/19, dry-run sin pendientes y DB lint limpio.
- Los conteos actuales muestran cero Persons, PatientCenters y demás filas de fixtures de dominio; Auth users e identities siguen en 1, memberships en 1 y operaciones en 2. No hay fila residual TASK-007A en los componentes auditados. No se infiere nada sobre tablas fuera de la lista sin un baseline inicial de ellas.
- Una definición futura de **stable data baseline** debería preservar identidad Auth, roles, memberships, `is_active`, relaciones, filas de dominio, datos de pacientes y ownership/estado de provisioning; tener digests por componente y conservar el snapshot inicial de forma segura para diff. Sólo tras demostrar que un campo concreto es técnico y volátil se podría proponer excluirlo, con aprobación; no se excluye ninguno en este turno. La capa **schema/migration** debe conservar paridad, dry-run, lint y revisión de catálogo/RLS/grants separadas.

**Resultado:** `TASK-007A BASELINE RECONCILIATION INCONCLUSIVE — KEEP STOPPED`.

## Baseline V2 definition + read-only capture — 2026-10-13

La decisión humana acepta un **HISTORICAL VERIFICATION GAP** entre el primer digest ampliado `72e4ff430c470d65e6d7d7a46e722fb02383bc509aecea6b80e2f87f2b21de30` y el posterior `86b6cd6a9c548cf5fcb24cc9e428c0205fd1bdfb02ccc485e350687fbd3fcc65`. Se conserva la categoría **E — insufficient evidence**, el snapshot inicial faltante, la observación de `auth.users.updated_at` y el digest TASK-006 `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`. **The historical difference is not proven benign and is not proven to be a domain mutation. It is irrecoverable with available evidence.** V2 es un checkpoint nuevo del estado DEV actual aceptado; no demuestra que los dos estados históricos fueran iguales. La conclusión forense anterior permanece como historial, sin marcarla reconciliada.

### Contrato y evidencia segura

- **Stable data:** 15 componentes persistentes: `auth.users`, `auth.identities`, `public.users`, `public.platform_admins`, `public.centers`, `public.center_memberships`, `public.professionals`, `public.professional_centers`, `public.specialties`, `public.professional_center_specialties`, `public.persons`, `public.patient_centers`, `public.availabilities`, `public.appointments`, `private.provisioning_operations`. Las tablas de dominio incluyen todas sus columnas de catálogo, también `id`, FK, roles, `is_active`, `updated_at`/CAS y timestamps. Las tablas vacías tienen conteo y digest propios. En provisioning se incluyen **todos** los campos: tipo, ownership, actor, scope, `payload_hash`, vínculo Auth, estado, resultados y `created_at`/`updated_at`/`completed_at`; no se presupone que sus timestamps sean prescindibles.
- **Schema/API:** historial de migrations, dry-run, lint y catálogo/RLS/policies/grants/firmas RPC/triggers se comprueban aparte. Ninguna señal de schema entra en el digest stable data.
- **Auth identity invariants incluidos:** `auth.users`: `instance_id,id,aud,role,email,email_confirmed_at,invited_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,phone,phone_confirmed_at,phone_change,confirmed_at,email_change,email_change_confirm_status,banned_until,is_sso_user,deleted_at,is_anonymous`. `auth.identities`: `id,provider_id,user_id,provider,created_at,email`. Se incluyen los estados de cuenta y cambios de email/teléfono pendientes porque sí alteran la identidad o su habilitación. Los valores identificadores/personales sólo se guardan como hashes de campo. El script rechaza una columna Auth nueva o sin clasificar.
- **Auth excluidos:** cada campo, propósito y motivo específico consta también en el manifest. `encrypted_password` es credencial; `confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change_token_current`, `phone_change_token`, `reauthentication_token` son credenciales efímeras: su rotación no cambia identidad. `confirmation_sent_at`, `recovery_sent_at`, `email_change_sent_at`, `phone_change_sent_at`, `reauthentication_sent_at` registran entrega de flujos Auth, no el estado de identidad incluido. `last_sign_in_at` registra login; `updated_at` registra mantenimiento Auth: pueden variar sin modificar los campos de identidad/estado incluidos. En `auth.identities`, `identity_data` es payload de perfil/claims del provider que puede refrescarse sin cambiar `provider_id,user_id,provider,email`; `last_sign_in_at` y `updated_at` son actividad/mantenimiento Auth. No se consulta ni persiste ningún valor de estas columnas excluidas.
- **Serialización:** orden fijo de componentes y campos incluidos; filas ordenadas por SHA-256 de la tupla de clave ordenada; valores JSONB con objetos anidados ordenados por clave, `NULL` con marca explícita, timestamps JSONB en UTC con la precisión almacenada; `JSON.stringify` codificado en UTF-8; SHA-256 hex minúscula. `generated_at` y schema/API quedan fuera del digest. Para cada fila se guardan sólo `row_key_sha256` y un SHA-256 determinista por campo, con tipo de dato; esto permite ubicar drift de tabla, fila y campo sin guardar valores, secretos o credenciales.
- El Harness define `implementation-report.md` pero no prescribe ubicación de snapshots seguros. Se guardó el artefacto local sin valores en `.harness/tasks/active/TASK-007/baseline-v2-manifest.json`. Incluye `baseline_version`, `generated_at`, SHA del verificador, columnas incluidas/excluidas y motivo, conteos, ambas lecturas y digests. El verificador es `scripts/verify-task007a-baseline-v2.mjs`, SHA-256 **`f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c`**.

### Captura READ #1 / READ #2

Dos transacciones separadas `REPEATABLE READ READ ONLY`, rol `postgres`, zona UTC, mismo código y mismo proyecto DEV `ehllxymqyzrofydrvtzo`. Cada digest y conteo de componente coincidió; el global V2 en ambas lecturas fue **`24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`**.

| Componente | Filas #1/#2 | Digest #1 | Digest #2 |
| --- | ---: | --- | --- |
| `auth.users` | 1/1 | `a51f7fc9834c45eed3da1bda85f40e0352a37b588127d8ee0977ebae66f81146` | `a51f7fc9834c45eed3da1bda85f40e0352a37b588127d8ee0977ebae66f81146` |
| `auth.identities` | 1/1 | `78225ce2820c779b504fc121414129fbd48a5e3af92ee5e179595896a26da1b8` | `78225ce2820c779b504fc121414129fbd48a5e3af92ee5e179595896a26da1b8` |
| `public.users` | 1/1 | `ef14f9fae67a1d5aede5694702d0a4c1b72793760350a907b29c3b3f27b0aa90` | `ef14f9fae67a1d5aede5694702d0a4c1b72793760350a907b29c3b3f27b0aa90` |
| `public.platform_admins` | 1/1 | `8bc19ce6a8dafcb5cb473d6c683ebe82ee9d137e43427b5fea7c1e07bef17878` | `8bc19ce6a8dafcb5cb473d6c683ebe82ee9d137e43427b5fea7c1e07bef17878` |
| `public.centers` | 1/1 | `4a6a9a963e225b5dc1aae2d5b1299ed19e8b393a47a6da52f3697a38620df915` | `4a6a9a963e225b5dc1aae2d5b1299ed19e8b393a47a6da52f3697a38620df915` |
| `public.center_memberships` | 1/1 | `faf6d6aae943aa836de055e9d225a06e80db2e97f2c0057b4e225833d121f491` | `faf6d6aae943aa836de055e9d225a06e80db2e97f2c0057b4e225833d121f491` |
| `public.professionals` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `public.professional_centers` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `public.specialties` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `public.professional_center_specialties` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `public.persons` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `public.patient_centers` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `public.availabilities` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `public.appointments` | 0/0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `private.provisioning_operations` | 2/2 | `afd29c8042d2e0b2f2dc0d9d4942149147cee7d5f093fff9fb29a4c2abb564cb` | `afd29c8042d2e0b2f2dc0d9d4942149147cee7d5f093fff9fb29a4c2abb564cb` |

### Invariantes y schema/API independientes

- El verificador confirmó una sola identidad Auth de provider `email`, asociada al mismo `public.users` y PLATFORM_ADMIN, con proyección de email consistente; un Center aprobado `76dcbe41-38be-475d-a590-f4ae6619c1e8` activo y en `America/Argentina/Buenos_Aires`; una membership ADMIN activa para ese Center/User; dos operaciones aprobadas por ID, tipo, ownership y resultado en `SUCCEEDED`. Profesionales, relaciones, Specialties y asociaciones: cero. `persons=0`, `patient_centers=0`, disponibilidad y turnos: cero. No hay fixtures TASK-007A residuales en los 15 componentes conocidos. Además, el verificador read-only TASK-006 reprodujo su digest aprobado exacto `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`, comprobando contenido persistente previo más allá de conteos.
- Schema/API fuera del digest: Supabase CLI 2.117.0 informó **19 migrations locales = 19 DEV**, `db push --linked --dry-run` sin pendientes y `db lint --linked` sin errores. `scripts/verify-task007a-schema-v2.mjs` verificó por consultas read-only columnas, constraints/índices, RLS de cuatro tablas relevantes, policies SELECT de `persons` y `patient_centers`, ausencia de acceso `anon` y DML directo `authenticated`, grants SELECT autenticados, trigger CAS de PatientCenter y las siete firmas RPC `SECURITY DEFINER` con EXECUTE sólo para `authenticated`. PASS.
- Sólo se añadieron los dos scripts de verificación, este informe, `docs/status.md` y el manifest local. No se ejecutaron INSERT/UPDATE/DELETE, Auth login, RPC mutante, fixtures, migration, seed, cleanup ni tests de concurrencia. No se consultó ni modificó PROD. `next-env.d.ts` sigue M, unstaged, intacto, SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.

**Veredicto:** `TASK-007A BASELINE V2 ESTABLISHED — AWAITING RESUME AUTHORIZATION`. No se reanuda aún la verificación mutante de TASK-007A.

## Reanudación autorizada y verificación final TASK-007A — 2026-10-13

La autorización humana reanudó 007A desde el checkpoint V2 anterior. No se redefinió V2 ni se editó su manifest/verificador; `scripts/compare-task007a-baseline-v2.mjs` intercepta únicamente la escritura local del verificador y compara la nueva captura con la referencia inmutable, incluso por fila/campo. El **HISTORICAL VERIFICATION GAP** `72e4ff... → 86b6cd...`, categoría **E — insufficient evidence**, sigue abierto como evidencia histórica. V2 no demuestra equivalencia retrospectiva.

### Gate previo y foundation

- DEV `ehllxymqyzrofydrvtzo`: 19/19 migrations local/remote, dry-run sin pendientes, DB lint limpio y `verify-task007a-schema-v2.mjs` PASS antes de mutar. Las migrations aplicadas `20261013190000_add_patient_foundation.sql` y `20261013200000_remove_patient_rpc_unused_variables.sql` permanecieron **inmutables**; no hubo nuevas migrations.
- Foundation existente: siete RPCs `staff_*patient*`; dos policies SELECT tenant sobre Person/PatientCenter; SELECT `authenticated` y ningún DML genérico ni acceso `anon`; once helpers privados para trim/ISO/email/día local/autorización y locks. CAS compara `expected_updated_at` antes de no-op y el trigger de PatientCenter avanza monotónicamente. Se verificaron firmas, `SECURITY DEFINER`, grants, columnas, constraints, índices, policies y triggers contra DEV.
- Tipos `src/lib/supabase/database.types.ts` fueron generados desde DEV durante implementación previa; incluyen `persons`, `patient_centers` y las siete firmas RPC. Como el schema no cambió tras esas dos migrations, no se regeneraron en esta reanudación ni se editaron manualmente.

### Concurrencia real y cleanup

`scripts/verify-task007a-concurrency.mjs` usó dos conexiones reales; la primera mantuvo abierta la transacción y la segunda fue observada en espera de lock mediante `pg_stat_activity` antes del commit. Se estableció un timeout de 15 s para detectar bloqueos. Resultados:

| Carrera | Primer resultado | Segundo resultado |
| --- | --- | --- |
| create/create | CREATED | `P0001/PATIENT_IDENTITY_ALREADY_EXISTS` |
| create/link | CREATED | ALREADY_ACTIVE, mismo PatientCenter |
| link/link | LINKED | ALREADY_ACTIVE, mismo PatientCenter |
| reactivate/reactivate | REACTIVATED | `P0001/STALE_PATIENT_CENTER_STATE` |
| update/update | UPDATED | `P0001/STALE_PATIENT_CENTER_STATE` |
| state/state | DEACTIVATED | `P0001/STALE_PATIENT_CENTER_STATE` |

No hubo duplicados, estado parcial ni deadlock. La reactivación preservó teléfono, email, cobertura y notas. Tres mutaciones efectivas consecutivas produjeron `updated_at` estrictamente creciente sin delays artificiales; las perdedoras stale no cambiaron valores. El runner inventarió cuatro UUID de Person y cuatro de PatientCenter, comprobó ownership y ausencia de Appointments/relaciones ajenas, y eliminó sólo esos UUID en orden FK. El primer intento del runner falló al leer membership antes de asumir el rol `postgres`; ocurrió antes de crear fixtures. Se corrigió el rol del runner y las seis carreras pasaron.

### Matrices DB/RPC/RLS y suites

- `verify-task007a-migration-smoke.mjs --correction-only`: PASS en una transacción con **ROLLBACK final**. Matriz de diez casos idénticos de trim SQL/TypeScript; 249 códigos ISO de PostgreSQL = snapshot TS; AR/ar/US válidos y ZZ, longitud/símbolos inválidos. Phone sólo whitespace rechazado; email/cobertura/notas vacíos → NULL. Email con trim y lowercase válido, formato inválido rechazado por RPC.
- Búsqueda: default 25; 1/50 aceptados y 0/51 rechazados; offsets 0/10000 aceptados y negativo/10001 rechazados; query 100 aceptada y 101 rechazada; estado inválido rechazado. Documento normalizado, nombre/apellido case-insensitive, teléfono recortado, email lowercase, `%`, `_` y `\\` literales, orden con tie-break de PatientCenter, query whitespace-only como listado tenant. Un Person global no vinculado no aparece en search miss. Ningún resultado cross-center.
- Límites de alta: 100/100/100/50/320/160/4000 aceptados simultáneamente para nombre/apellido/documento/teléfono/email/cobertura/notas; máximo+1 individual rechazado sin truncar. Documento compuesto sólo de separadores rechazado. Fecha de hoy local aceptada; mañana local rechazada. Helper con instantes fijos `2026-10-14T02:59:59Z` → 13 y `03:00:00Z` → 14 en Buenos Aires. Timezone IANA inválida falló sin crear Person.
- Cada una de las siete RPCs y SELECT permitido: ADMIN/RECEPTION activos pasan; PROFESSIONAL, PLATFORM_ADMIN-only, membership inactiva, cross-center y `anon` se deniegan. Person no vinculada y filas de otro Center quedan ocultas por RLS; no hay grants DML genéricos. Resolve devuelve exclusivamente ocho columnas aprobadas (estado, nombres, booleano DOB, relación, IDs/timestamp opacos); no devuelve DOB almacenada, documento, contacto, notas, otros centros ni User/Auth. DOB mismatch bloquea link sin crear relación. Lifecycle create→Person+PatientCenter, link explícito, ACTIVE reusado, INACTIVE reactivado en la misma fila, update restringido a cuatro campos y estado vía RPC quedaron verificados. Sin hard delete funcional. Taxonomía `INVALID_PATIENT_INPUT`, `PATIENT_ACCESS_DENIED`, `PATIENT_BIRTH_DATE_MISMATCH`, `PATIENT_IDENTITY_ALREADY_EXISTS`, `STALE_PATIENT_CENTER_STATE` y outcomes de no-op/activo probada sin contenido adicional. Riesgo de oráculo/inferencia global **ACCEPTED RISK — MVP DEV**; abuso/rate limiting/monitoring obligatorio **PRE-PROD**.
- Focused TS: **15/15**. Suite completa Vitest: **323/323 en 39 archivos**. `pnpm lint`, `pnpm typecheck`, `pnpm build`, Prettier focalizado y `git diff --check`: PASS. Guard de secretos del bundle cliente: PASS. El E2E habitual `task-006-integration.spec.mjs` pasó **1/1** con cleanup propio y baseline TASK-006 exacto. No se creó E2E funcional de UI Patients, reservado a fases posteriores. `verify-task007a-dev-preflight.mjs` se mantuvo byte por byte (SHA histórico `0B72AC73E203193DE02DC55452306594805493F0830E5C0BEFAA226B51E17846`), por eso no se reformateó para no invalidar la evidencia forense.

### Gates finales

- Tras cleanup y todos los tests, comparación read-only con V2: **PASS**. Global `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`; los 15 conteos, digests de componente y hashes de fila/campo coincidieron exactamente con el manifest. `persons=0`, `patient_centers=0`, ningún fixture residual conocido. No se creó V3 ni se ajustaron exclusiones.
- Schema/API final separado: 19/19 migrations, dry-run sin pendientes, DB lint limpio y schema V2 verifier PASS. Secret guard del bundle PASS; búsqueda focalizada de credenciales literales en scripts, migrations, manifest, docs, tests, tipos y código no halló claves/tokens. El manifest conserva sólo hashes por fila/campo y motivos de exclusión, sin snapshot personal crudo.
- `next-env.d.ts` fue regenerado temporalmente por `build`/secret guard y restaurado byte por byte a los dos imports DEV previos: SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, M y unstaged. PROD no fue consultado ni modificado.
- `.gitattributes` fija LF sólo para el verificador V2 y el script forense V1, preservando sus SHA documentados bajo `core.autocrlf=true`. Se quitaron dos espacios finales del encabezado histórico de `review.md` para que el diff staged pase `git diff --check`; el veredicto histórico no cambió.

**Estado de implementación/verificación:** `IMPLEMENTATION COMPLETE — VERIFICATION COMPLETE — READY FOR INDEPENDENT REVIEW`. El checkpoint Git autorizado es un commit y push de TASK-007/007A, excluyendo `next-env.d.ts`; la evidencia de su SHA se informa al terminar. TASK-007 completa no se cierra; no hay PR, merge ni archivo.

## Remediación de implementation review 007A-IR-1/IR-2 — 2026-10-13

El review independiente de `3a0f74cefa8d8935be7e146e92e626a9e243e9f1` pidió dos correcciones MEDIUM. Ambas quedan **remediated — pending independent closure**; `review.md` permanece intacto. D1–D8 y P007-R1/R2/R3 no cambian. No se inició 007B.

### Matriz exacta SQL → contrato de aplicación

La autoridad es `20261013190000_add_patient_foundation.sql`, incluidos `RETURN QUERY`, y el schema vivo comprobado por `verify-task007a-schema-v2.mjs`. Todos los argumentos sin default son obligatorios; los siete RPCs rechazan `NULL` en campos de identidad, token, teléfono y confirmación mediante helpers/guards. Los tres campos administrativos aceptan `NULL` explícito como ausencia/limpieza. El tipo generado por la introspección de funciones marca erróneamente argumentos `text` y columnas `RETURNS TABLE` como no nulos; no se editó `database.types.ts` a mano ni se cambió SQL.

| RPC | Argumentos obligatorios no NULL | NULL permitido / default | Retorno exitoso |
| --- | --- | --- | --- |
| `staff_search_patient_centers` | `p_center_id` | `p_query text DEFAULT NULL`, `p_state text DEFAULT NULL`; `p_limit integer DEFAULT 25`, `p_offset integer DEFAULT 0` son omitibles pero `NULL` explícito inválido | 0..N filas; `email`, `insurance_name` pueden ser NULL; los otros diez campos siempre valor |
| `staff_resolve_patient_identity` | `p_center_id`, `p_nationality_code`, `p_document_number`, `p_birth_date` | ninguno | exactamente una fila; matriz abajo |
| `staff_create_patient_with_center` | `p_center_id`, `p_first_name`, `p_last_name`, `p_birth_date`, `p_nationality_code`, `p_document_number`, `p_phone` | `p_email`, `p_insurance_name`, `p_administrative_notes`: NULL, sin default | `person_id`, `patient_center_id`, `updated_at`, `outcome=CREATED`: todos valor |
| `staff_link_person_to_center` | `p_center_id`, `p_person_id`, `p_nationality_code`, `p_document_number`, `p_birth_date`, `p_phone`, `p_confirmed=true` | los mismos tres administrativos: NULL, sin default | mismos IDs/token valor; `outcome=LINKED/ALREADY_ACTIVE` |
| `staff_reactivate_patient_center` | `p_center_id`, `p_patient_center_id`, `p_nationality_code`, `p_document_number`, `p_birth_date`, `p_expected_updated_at`, `p_confirmed=true` | ninguno | `patient_center_id`, `updated_at`, `outcome=REACTIVATED/ALREADY_ACTIVE`: valor |
| `staff_update_patient_center` | `p_center_id`, `p_patient_center_id`, `p_expected_updated_at`, `p_phone` | los mismos tres administrativos: NULL, sin default | `patient_center_id`, `updated_at`, `outcome=UPDATED/UNCHANGED`: valor |
| `staff_deactivate_patient_center` | `p_center_id`, `p_patient_center_id`, `p_expected_updated_at`, `p_confirmed=true` | ninguno | `patient_center_id`, `updated_at`, `outcome=DEACTIVATED/UNCHANGED`: valor |

| Resolve state | `first_name`/`last_name` | `birth_date_matches` | `relationship_state` | `person_id` | `patient_center_id`/`patient_center_updated_at` |
| --- | --- | --- | --- | --- | --- |
| `NOT_FOUND` | NULL | NULL | NULL | NULL | NULL |
| `FOUND`, DOB mismatch | valor | false | `NOT_LINKED/ACTIVE/INACTIVE` | NULL | NULL |
| `FOUND`, DOB match, `NOT_LINKED` | valor | true | `NOT_LINKED` | valor | NULL |
| `FOUND`, DOB match, `ACTIVE` | valor | true | `ACTIVE` | valor | valor |
| `FOUND`, DOB match, `INACTIVE` | valor | true | `INACTIVE` | valor | valor |

`patient-rpc-contracts.ts` usa Zod para args y retornos; deriva los tipos desde esos schemas. `patient-rpc-adapter.ts` es el único límite con un cast local documentado para el transporte generado: valida argumentos, llama `supabase.rpc`, propaga errores y valida el payload de éxito antes de exponerlo. El guard de compilación compara los siete nombres/claves de argumentos con `Database["public"]["Functions"]`; `@ts-expect-error` comprueba NULL de resolve/search y obligatoriedad de teléfono. Los tests runtime cubren las cinco ramas, opcionales NULL, rechazos de forma y el adapter. En el smoke DB anterior se verificaron `NOT_FOUND`, mismatch, opcionales y paths reales; no fueron necesarios fixtures DEV nuevos en esta remediación.

### Baseline V2 y verificación

`compareBaselineV2(reference, actual)` es función pura y el preloader CLI usa esa misma implementación. Ahora compara inventario bidireccional de componentes y `included_fields`, `excluded_fields` con motivos, `field_types`, `row_key_fields`, conteos, digests y hashes de filas/campos. Las pruebas sintéticas fallan para columna agregada en `public.persons` vacía aun con mismo digest/filas, cambio de tipo, cambio de row key, motivo de exclusión Auth y componente extra. No se creó V3 ni se mutó DEV para los casos negativos. Manifest V2 y `verify-task007a-baseline-v2.mjs` siguen byte por byte intactos; SHA del verificador `f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c`.

- `pnpm bootstrap` PASS. Tests focalizados nuevos 7/7; suite completa 330/330 en 41 archivos; `pnpm lint`, `pnpm typecheck`, `pnpm build`, Prettier focalizado, `git diff --check` y guard de secretos del bundle PASS.
- DEV read-only `ehllxymqyzrofydrvtzo`: schema verifier PASS para tablas/RLS/grants/siete firmas; 19 migrations locales == 19 DEV, dry-run sin pendientes, `db lint --linked` sin errores.
- Comparador V2 vivo: `stable=true`, `domain_invariants_pass=true`, 15/15 componentes, metadata exacta y global `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359` PASS. `persons=0`, `patient_centers=0`; sin fixtures nuevos ni cleanup.
- El **HISTORICAL VERIFICATION GAP** `72e4ff... → 86b6cd...` sigue categoría **E — insufficient evidence**. El riesgo de inferencia por resolve/create continúa `ACCEPTED RISK — MVP DEV`; abuso, rate limiting y monitoreo siguen **PRE-PROD REQUIRED**. PROD no se consultó ni modificó.

**Veredicto de remediación:** `TASK-007A REVIEW FINDINGS REMEDIATED — READY FOR INDEPENDENT RE-REVIEW`. Sólo el reviewer puede cerrar 007A-IR-1/IR-2.

## Checkpoint final TASK-007A — 2026-10-14

El re-review independiente de `review.md` concluyó `007A-IR-1 CLOSED`, `007A-IR-2 CLOSED` y **`TASK-007A IMPLEMENTATION REVIEW PASS — READY FOR 007B`**. TASK-007A queda `IMPLEMENTATION COMPLETE — VERIFICATION COMPLETE — INDEPENDENT REVIEW PASS — CLOSED`; TASK-007 general permanece activa y 007B no se inició.

El reviewer aceptó `HUMAN-CAPTURED LIVE DEV EVIDENCE` para su gate read-only final: 19/19 migrations, dry-run sin pendientes, DB lint y schema verifier PASS, y comparación Baseline V2 exacta con 15/15 componentes y digest `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`. Esa evidencia fue ejecutada por la persona usuaria desde una terminal autenticada; no se atribuye al entorno aislado del reviewer ni implica nuevas mutaciones DEV en este checkpoint.

Permanece el **HISTORICAL VERIFICATION GAP** `72e4ff... → 86b6cd...`, categoría **E — insufficient evidence**, sin reconciliación retrospectiva. La inferencia por resolve/create continúa como **ACCEPTED RISK — MVP DEV**; protección contra abuso, rate limiting y monitoreo siguen requeridos **PRE-PROD**. No se consultó ni modificó PROD.

## TASK-007B — Patients List + Tenant Search · implementación 2026-10-14

**Estado:** `TASK-007B IMPLEMENTATION COMPLETE — READY FOR INDEPENDENT IMPLEMENTATION REVIEW`. TASK-007 general sigue ACTIVE; 007A permanece CLOSED. La autorización humana de 007B y el `TASK-007B PLAN REVIEW PASS` son el gate de esta implementación. D1–D8 no cambian.

### Preflight y límites

- Rama `task/007-patients`, HEAD/base remoto `ff391d832ae887aefa228eec11d8d8d435b282c6`. Working tree inicial exactamente `M plan.md`, `M review.md`, `M docs/status.md` y `M next-env.d.ts`, todos unstaged; los tres primeros eran artefactos de PLAN/PLAN REVIEW de 007B. `next-env.d.ts` era ajeno y conservaba SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- `pnpm bootstrap` y `git diff --check` iniciales PASS. Sólo se leyeron código y documentos relevantes. Ninguna migration, SQL, RLS, grant, RPC o tipo generado se modificó. No se consultó ni mutó DEV para esta implementación; PROD no se accedió. Baseline V2 fijo: `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`; no se regeneró.

### Implementación

- `patient-search-params.ts` interpreta exclusivamente `q`, `state`, `page`. Omite defaults; elimina desconocidos; repetidos o inválidos descartan el valor afectado y vuelven a página 1. `q` usa `trimPatientInput` de 007A y máximo 100 puntos de código. `state` permite ACTIVE/INACTIVE/ALL; páginas canónicas 1..401. Genera URL determinista y señal de redirect sin autorización mezclada. Página 401 produce offset 10000, nunca superior.
- La ruta `page.tsx` valida UUID, crea `createSupabaseServerClient()` con la sesión real, exige `requireRole(centerId, ["ADMIN", "RECEPTION"], supabase)`, interpreta filtros sólo después del guard, redirige URL no canónica antes de leer y compone la pantalla. `UNAUTHENTICATED` → `/login`; Center/rol denegado y revocación RPC → `notFound()`. Fallo ordinario de SEARCH → estado de error sin exponer SQL/PII.
- `listPatientCenters()` usa `tenantPatientSearchSchema` y exclusivamente `callPatientRpc(client, "staff_search_patient_centers", { p_center_id, p_query, p_state, p_limit: 26, p_offset })`. Conserva NULL en filas, muestra primeras 25, `hasNext` sólo con fila 26 antes de página 401, `hasPrevious` sólo desde página 2. Página >1 sin filas redirige a página 1 con `q/state`, sin segunda consulta en esa request. No usa resolve, SELECT directo sobre Person/PatientCenter, COUNT ni cliente privilegiado.
- `PatientsScreen` usa un solo array de filas para tabla desktop y tarjetas móviles informativas. Muestra nombre/apellido, nacionalidad/documento, nacimiento como fecha civil `DD/MM/YYYY` sin `Date`, teléfono, email/cobertura con `—` sólo en UI y estado activo/inactivo. No muestra notas, IDs/tokens internos ni datos de otros Centers. Formulario GET accesible envía `q/state` sin `page`; Limpiar vuelve a ruta base. Hay loading, error con reintento que conserva URL y mensajes exactos de búsqueda vacía/ACTIVE/INACTIVE/ALL. No se hace consulta secundaria para clasificar ACTIVE vacío, conforme a la autorización de implementación más reciente.
- `CenterAdminNavigation` se generalizó a `CenterNavigation` y se actualizaron todos los imports/tests/call sites. ADMIN ve Pacientes, Usuarios, Especialidades y Profesionales; RECEPTION sólo Pacientes; PROFESSIONAL ninguno. Los guards ADMIN de rutas existentes permanecen intactos.

### Verificación

- Tests focalizados iniciales: **47/47 PASS**. Suite completa después de formatear: **377/377 PASS** en 46 archivos. Incluye parser literal, límites, adapter y paginación, presentación responsive, estados vacíos/error, guard de página, redirects y matriz de navegación. No se creó E2E Patients; corresponde a 007D. No se crearon fixtures DEV.
- `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm build` PASS con la ruta Patients server-rendered; Prettier focalizado PASS; `git diff --check` PASS; `pnpm security:check:client-bundle` PASS. Un typecheck intermedio detectó sólo la mutabilidad del array literal en un test; se ajustó el tipo de entrada puro y el typecheck final pasó.
- Build y guard de secretos regeneraron temporalmente `next-env.d.ts`; se repusieron exactamente sus bytes previos desde una copia local verificada. SHA-256 final `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, `M` y unstaged, fuera de 007B.

**Handoff:** review independiente de implementación pendiente. No PR, merge, archive ni 007C.

## Remediación de implementation review TASK-007B — 2026-10-14

El review independiente de `5b2ec479c90c5c85323ac08c0c7faee476d26bfd` pidió tres correcciones LOW. Esta sección documenta el estado anterior al re-review de `1c214bad`: éste mantuvo 007B-IR-1 OPEN por una regresión de cookie refresh y cerró 007B-IR-2/IR-3. La remediación actual de IR-1 se registra abajo. `review.md` no fue editado durante implementación. D1–D8, 007A y el comportamiento ACTIVE vacío sin consulta extra permanecen intactos.

- **007B-IR-1 (intento anterior, refutado por re-review):** `src/proxy.ts` usaba `refreshSupabaseSession()` y reenviaba el mismo snapshot de headers incluso tras `setAll`. La query original y el spoofing estaban cubiertos, pero el test de proxy sólo probaba la cookie de respuesta: no detectaba que la request seguía reenviando la cookie vieja. `PatientsPage` lee `headers()` sólo después de `requireRole()`; el parser y su matriz de canonicalización no cambiaron.
- **007B-IR-2 remediated — pending independent re-review:** sólo `{ code: "42501", message: "PATIENT_ACCESS_DENIED" }` se mapea a `AuthorizationError("CENTER_ACCESS_DENIED")`. Subcadena con prefijo/sufijo, mensaje distinto y código distinto conservan exactamente el error técnico.
- **007B-IR-3 remediated — pending independent re-review:** se eliminó `it.each` sin uso del rol. La ruta verifica que solicita `ADMIN` y `RECEPTION`, y los tests del guard real con fake client ejercen ambos roles activos, rechazo de PROFESSIONAL, membership/Center inactivos y cross-center.
- Preflight: rama `task/007-patients`, HEAD `5b2ec479c90c5c85323ac08c0c7faee476d26bfd`, sólo `review.md` y `next-env.d.ts` modificados previamente; bootstrap y diff check PASS. `next-env.d.ts` no se editó ni restauró; SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Verificación: tests IR **74/74** en 5 archivos; focalizados 007B **85/85** en 7; suite **399/399** en 47; lint y typecheck PASS. Build y `pnpm security:check:client-bundle` PASS en copia temporal del código y dependencias instaladas, aislada para que Next no regenere el `next-env.d.ts` ajeno del checkout. Prettier focalizado y `git diff --check` PASS.
- Zero migrations, SQL, RLS, grants, RPC o tipos generados cambiados. DEV no se consultó ni mutó; PROD fuera de alcance. Sin E2E DEV, baseline regeneration, PR, merge ni 007C.

**Estado de ese intento:** `TASK-007B REVIEW REMEDIATION COMPLETE — READY FOR INDEPENDENT RE-REVIEW`; el re-review posterior mantuvo IR-1 OPEN.

## Remediación de regresión cookie refresh 007B-IR-1 — 2026-10-14

El re-review de `1c214bad3f8a92e71624a16679dac696ea84f283` confirmó **007B-IR-1 OPEN**, **007B-IR-2 CLOSED**, **007B-IR-3 CLOSED** y `TASK-007B IMPLEMENTATION REVIEW CHANGES_REQUESTED`. La afirmación anterior de preservación de cookies era incorrecta: se reutilizaba un `Headers` creado antes de `setAll`, por lo que la request de página reenviaba `session=old` aunque `NextRequest` ya tenía `session=new` y el response emitía `Set-Cookie` nuevo.

- `refreshSupabaseSession()` construye headers frescos desde `request.headers` en cada `NextResponse.next` y sobrescribe siempre `x-salud-plus-original-search` con `request.nextUrl.search`. Tras `request.cookies.set` para todas las cookies de `setAll`, el segundo snapshot incluye las renovadas y conserva las no reemplazadas. No se cambió el flujo Supabase ni la canonicalización de Patients.
- La regresión con `NextRequest`/`NextResponse` reales, `session=old`, query `?q=%41na` y header privado spoofed falló sobre el código de `1c214bad`: `x-middleware-request-cookie` contenía `session=old` en lugar de `session=new`. Tras el fix, el override contiene `session=new`, `renewed=fresh` y `retained=keep`, no contiene `session=old`; el header privado reenviado es `?q=%41na` y el response emite ambas cookies renovadas en `Set-Cookie`. Sin `setAll`, se reenvían la cookie original y la query real, sin cookies de respuesta.
- Preflight exacto: rama `task/007-patients`, HEAD `1c214bad3f8a92e71624a16679dac696ea84f283`; sólo `review.md` previo del reviewer y `next-env.d.ts` ajeno modificados. `pnpm bootstrap` y `git diff --check` PASS; SHA-256 de `next-env.d.ts` `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Verificación: proxy 2/2; IR-1 44/44 en 3 archivos; 007B 86/86 en 7; suite completa 400/400 en 47; lint, typecheck, Prettier focalizado y `git diff --check` PASS. `pnpm build` y `pnpm security:check:client-bundle` PASS en copia física aislada, con `pnpm_config_verify_deps_before_run=false` para evitar reinstalar dependencias ya copiadas. La copia no alteró `next-env.d.ts` del checkout.
- ZERO migrations, SQL, RLS, grants, RPCs y cambios de `database.types.ts`. Sin DEV, fixtures, E2E, baseline regeneration ni acceso a PROD. El gap histórico de 007A permanece categoría E y el riesgo PRE-PROD aceptado no cambia. `review.md` conserva el veredicto independiente y no se editó en esta implementación. No se inicia 007C.

**Gate:** `007B-IR-1 COOKIE REFRESH REMEDIATED — PENDING INDEPENDENT RE-REVIEW`; IR-1 sigue OPEN hasta cierre del reviewer. IR-2 e IR-3 siguen CLOSED.

## Cierre TASK-007B — 2026-10-14

**Estado:** `TASK-007B IMPLEMENTATION COMPLETE — VERIFICATION COMPLETE — INDEPENDENT REVIEW PASS — CLOSED`. El re-review independiente final de `review.md` confirmó `007B-IR-1 CLOSED`, `007B-IR-2 CLOSED`, `007B-IR-3 CLOSED` y `TASK-007B IMPLEMENTATION REVIEW PASS — READY FOR 007B CLOSURE`. Los gates anteriores permanecen arriba como historial de cada checkpoint.

El cierre técnico comprende listado y búsqueda tenant mediante la RPC autorizada, URL canónica `q/state/page` con manejo de raw query, acceso ADMIN y RECEPTION, navegación según rol, paginación de 25 filas más una de lookahead y reenvío de cookies renovadas mediante el proxy. El review final verificó la regresión de cookie refresh y no encontró findings nuevos. Este checkpoint sólo actualiza documentación; no repite tests, build ni gates DB/DEV.

El **HISTORICAL VERIFICATION GAP** de 007A permanece en categoría **E — insufficient evidence**, sin reconciliación retrospectiva. La inferencia por resolve/create sigue como **ACCEPTED RISK — MVP DEV**; controles de abuso, rate limiting y monitoreo siguen **PRE-PROD REQUIRED**. DEV y PROD no se consultaron ni modificaron en este cierre. TASK-007 general continúa ACTIVE, lista para 007C ANALYZE + PLAN; 007C no se implementó.

## TASK-007C+D — implementación funcional y verificación local (2026-10-14)

**Estado:** `TASK-007C+D GATE C PASS — GATE D BLOCKED ON HUMAN-CAPTURED DEV EVIDENCE`. La autorización humana conjunta cubre C y D; el plan review independiente en `review.md` es PASS. No se emite implementation review ni se cierra TASK-007 en este checkpoint.

### Preflight y límites

- Rama `task/007-patients`; HEAD y base remota esperadas `76206deca44853215f666d6bc4dd327ba611e977`. Working tree inicial exactamente `M plan.md`, `M review.md`, `M docs/status.md`, `M next-env.d.ts`; los tres primeros provienen de ANALYZE+PLAN y PLAN REVIEW. `next-env.d.ts` ajeno quedó intacto, unstaged, SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`. `pnpm bootstrap` y `git diff --check` iniciales PASS.
- Releídos brief, plan, review, report, docs de producto/status/módulo y código Patients, Access y Supabase. No se rediseñaron D1–D8. No se alteró `plan.md` ni `review.md` durante esta implementación.
- Delta DB **cero**: ninguna migration, SQL, RLS, grant, definición RPC ni `database.types.ts` modificado. No se usó service role, RPC paralela ni DML directo de Patients.

### Arquitectura GATE C

- URL `patient=<UUID>` canónica y opcional mantiene `q/state/page`; la fila y tarjeta tienen acción Administrar. La página conserva el guard antes de interpretar filtros; el panel lee por `center_id` y `patient_center_id` con proyección específica de PatientCenter y Person vinculada. La query del módulo vuelve a exigir ADMIN/RECEPTION. ID inválido se canonicaliza fuera; ID ajeno/ausente produce estado genérico. Notes sólo en panel.
- El diálogo adaptable usa `<dialog>` nativo para trampa de foco y Escape, título/descripción, foco inicial, labels, `aria-describedby` para errores y confirmaciones separadas. Registrar sólo se inicia por botón explícito, no por búsqueda vacía. En móvil ocupa la pantalla; en desktop es panel lateral.
- Registro staged: nacionalidad, documento y DOB se resuelven por `staff_resolve_patient_identity` y su proyección mínima. NOT_FOUND requiere nombre/apellido y datos de Center antes de create atómico; mismatch bloquea mutación sin mostrar fecha almacenada; NOT_LINKED exige confirmación y maneja LINKED/ALREADY_ACTIVE; ACTIVE abre la relación sin mutar; INACTIVE exige confirmación y token CAS, conservando administrativos. Cambiar identidad invalida resolve/tokens/confirmación.
- Edición sólo de teléfono/email/cobertura/notas, con NULL y edge trim de 007A; identidad global readonly. Desactivar es lógico con confirmación; reactivar desde panel inactivo exige un nuevo resolve con DOB ingresada y confirmación. `UPDATED`, `UNCHANGED`, `DEACTIVATED`, `REACTIVATED`, `ALREADY_ACTIVE` son outcomes, no errores. Stale bloquea reenvío y ofrece Recargar datos; no hay retry u overwrite automático. Revalidación y `router.refresh()` usan el listado server como autoridad.
- Seis Server Actions crean cliente Supabase de sesión, validan Zod, reautorizan con `requireRole`, delegan a servicio `server-only` y revalidan la ruta tras mutaciones exitosas. Todas las RPC pasan exclusivamente por `callPatientRpc()`. Mapping exacto code/message para denegación, input inválido, mismatch, stale, carreras, relación cambiada y ausencia; `23505` o errores desconocidos permanecen genéricos sin SQL ni PII.

### Verificación GATE C

- Tests focalizados nuevos para detalle tenant y no divulgación de person ID, mapping SQL exacto, validación/reautorización de Actions, NULL/confirmación, ramas staged NOT_FOUND/mismatch/NOT_LINKED/ACTIVE/INACTIVE, reactivación desde detalle, stale de edit/deactivate y canonicalización de selección. Tests existentes de búsqueda garantizan que SEARCH miss no dispara resolve. Full suite **429/429 PASS** en 51 archivos.
- `pnpm lint` PASS, `pnpm typecheck` PASS, Prettier focalizado PASS y `git diff --check` PASS. `pnpm build` PASS y `pnpm security:check:client-bundle` PASS en copia física aislada con dependencias propias y `pnpm_config_verify_deps_before_run=false`. Los primeros intentos de build en copia fallaron por junctions/copia incompleta de `node_modules`; tras reconstruir los enlaces internos y limpiar sólo `.next` de la copia, el build estándar y el guard pasaron. Ningún intento modificó el checkout original.
- `next-env.d.ts` conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, sigue `M` y unstaged. **Veredicto formal: TASK-007C+D GATE C PASS.**

### GATE D — preflight detenido antes de escritura

- Configuración/link local `ehllxymqyzrofydrvtzo`, 19 migrations locales y SHA-256 del verificador `f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c` coinciden con el plan. La primera invocación CLI chocó con el archivo de telemetría fuera del sandbox; con telemetría deshabilitada llegó a `LegacyPlatformAuthRequiredError` (`Access token not provided`) antes de consultar DEV. No se solicitó ni mostró ningún token.
- Paridad viva de migrations, dry-run, DB lint, schema/API verifier y Baseline V2 exacto **sin evidencia actual**. No se creó fixture manifest porque todavía no se puede pasar el preflight. Ningún fixture, escritura, E2E, smoke humano, cleanup ni baseline final de DEV se realizó. PROD no fue consultado ni modificado.
- Para continuar, se necesita salida **HUMAN-CAPTURED LIVE DEV EVIDENCE** de los comandos read-only aprobados desde una terminal humana autenticada. Sólo tras PASS exacto se podrá crear ledger de ownership y comenzar integración. No stage, commit, push, PR ni cierre de TASK-007 en este checkpoint.
- **HISTORICAL VERIFICATION GAP** `72e4ff... → 86b6cd...`: categoría E, no reconciliado. Riesgo de inferencia global exacta aceptado sólo para MVP DEV; rate limiting, protección contra abuso y monitoreo/telemetría siguen **PRE-PROD REQUIRED**. El digest V2 `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359` sigue expectativa fija, no medición viva nueva.

### Continuación GATE D — preflight humano PASS, ejecución pendiente (2026-10-14)

**Incidente de ejecución:** `setup` creó fixtures DEV para runId `c9818e40-2d4d-4c1b-a392-14a9404a5111`; `integration.mjs` reportó PASS, incluida privacidad multi-Center y carreras/CAS. Playwright 1.63 limpia el `outputDir` predeterminado `test-results` antes de importar el spec; el ledger guardado dentro fue eliminado y falló `readLedger()` en el top level. `No tests found` fue secundario. `integration.mjs` no hizo cleanup; `cleanup-isolated.mjs` sólo retiró la copia de Next bajo el directorio temporal y su archivo `server-temp.json`. No se ejecutaron tests E2E, smoke ni cleanup de fixtures. El estado DEV exacto aún requiere inventario read-only; no se atribuyen filas por semejanza.

Se cambió el ledger a `.task007-gate-d/fixture-ledger.json`, ignorado por Git y fuera de Playwright. La prueba local `ledger-lifecycle.test.mjs` ejercita el cierre de integración y la limpieza de `test-results`: PASS. La persona usuaria ejecutó `recovery-inventory.mjs` desde su terminal autenticado y aportó UUIDs exactos de los 6 actores, 3 Centers, 6 memberships, 1 Professional/ProfessionalCenter, 7 Persons y 6 PatientCenters; las cantidades corresponden al baseline inicial y las referencias externas consultadas son cero. `recovery-known.mjs` fija esos UUIDs y campos; `recover-ledger.mjs` volvió a comparar el inventario DEV exacto y reconstruyó el ledger local. El `audit` siguiente confirmó ownership (`centers=3`, `authUsers=6`, `persons=7`, `patientCenters=6`). `recover-credentials.mjs` revalidó ownership y reasignó una contraseña temporal sólo a los seis Auth UUID exactos, sin imprimirla; el segundo `audit` volvió a pasar. El ledger local guarda la contraseña fuera de Git. No se ha reanudado E2E ni se ha ejecutado cleanup. No hay commit ni push.

- La persona usuaria aportó salida LIVE DEV capturada en terminal autenticada: proyecto `salud-plus-turnos-dev`/`ehllxymqyzrofydrvtzo`, 19/19 migrations idénticas, dry-run `Remote database is up to date.`, lint `No schema errors found`, schema/API verifier PASS, comparador Baseline V2 exact PASS con SHA del verifier `f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c` y digest `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`; `stable=true`, sin mismatches ni domain errors; antes de fixtures `persons=0` y `patient_centers=0`. **TASK-007C+D GATE D PREFLIGHT PASS.**
- Se preparó `.harness/tasks/active/TASK-007/gate-d-runbook.md` y runner local con ledger ignorado por Git para inventario previo, UUIDs reservados/registrados, Auth/users/Centers/memberships propios, privacidad A/B, integración SQL con roles/RLS/CAS/carreras, Playwright desktop/móvil, captura de UUIDs del smoke humano, auditoría de referencias y cleanup exacto. El servidor E2E se probó en copia temporal (webpack, `/login` HTTP 200); su cleanup local se probó. Sintaxis Node, ESLint, Prettier y `git diff --check` PASS para el runner; `next-env.d.ts` conserva el SHA esperado.
- La API Auth DEV es accesible desde Codex, pero las tablas base devuelven `42501` con la clave de servicio; la conexión PostgreSQL documentada necesita la sesión CLI autenticada que sólo está en el terminal humano. La persona usuaria ejecuta los comandos preparados desde su terminal sin compartir credenciales. `setup` e integración DB pasaron; los fixtures permanecen en DEV bajo ownership exacto. **GATE D sigue pendiente** hasta E2E puntual, smoke humano, cleanup y comparador final exacto. Sin stage/commit/push ni PR/merge/cierre TASK-007.

### E2E reanudado y recheck pendiente

- El primer E2E tras recuperar credenciales quedó en login por el timeout predeterminado de 5 s. La credencial Auth funcionó en consulta directa y una prueba UI aislada completó la redirección en 5,226 ms. Se amplió sólo la espera de login a 60 s y la espera general de aserciones a 30 s. El servidor aislado fue limpiado y `audit` pasó, sin nuevas filas de pacientes.
- En la ejecución siguiente, el escenario completo de RECEPTION desktop pasó. El segundo escenario avanzó por DOB mismatch, NOT_LINKED, vínculo confirmado, ACTIVE reuse, móvil y ADMIN y falló en la última aserción: esperaba HTTP 404 para PROFESSIONAL y recibió 200. La captura Playwright mostró la página 404 renderizada, sin pantalla ni listado de pacientes. La ruta usa `notFound()` ante `ROLE_FORBIDDEN`; en este renderizado por streaming el código HTTP no sirve como única prueba. Se corrigió la aserción para exigir 404 visible y ausencia de UI de pacientes.
- `cleanup-isolated` y `audit` volvieron a pasar. El ledger conserva 8 Persons y 8 PatientCenters propios, con los UUIDs generados por UI capturados. El test puntual de sólo lectura con runId exacto verificó la denegación (1/1 PASS) sin repetir las mutaciones; otro `cleanup-isolated` y `audit` pasaron y el ledger quedó `e2e_pass`. Smoke humano, cleanup y verificación final DEV siguen pendientes. `next-env.d.ts` conserva su SHA y permanece unstaged.

### Aclaración del ledger antes del smoke

- La persona usuaria comprobó `test-results/task007-gate-d/` y no vio `fixture-ledger.json`. Esa es la ruta eliminada por Playwright en el incidente inicial. El ledger vigente de este run existe en `.task007-gate-d/fixture-ledger.json`, con SHA-256 `572f62a8875c25682437000df13be9ac5c129c86119677f951f2d2c53fc0297d`, etapa `e2e_pass`, 6 Auth/Public users, 3 Centers, 6 memberships, 1 Professional/ProfessionalCenter, 1 Platform Admin, 8 Persons y 8 PatientCenters. Los Center IDs coinciden con los dos aportados. Las credenciales siguen presentes en el ledger local sin imprimirse. No hubo pérdida nueva ni reconstrucción de fixtures.
- `server-temp.json` en `test-results` identifica sólo la copia temporal Next. El puerto 31007 estaba abierto, por lo que no se tocó el servidor activo. Se reforzó `cleanup-isolated.mjs` para comparar el SHA del ledger antes/después, y `audit` para hacer la misma comparación alrededor de sus lecturas DEV. `ledger-status.mjs` proporciona una comprobación local read-only sin secretos. Dos pruebas locales de lifecycle pasaron: limpieza de `test-results` y ejecución real de cleanup aislado en workspace temporal con el ledger intacto.
- El audit DEV intentado desde Codex no llegó a consultar la DB: el CLI devolvió `LegacyPlatformAuthRequiredError`. La última auditoría LIVE DEV humana anterior había pasado; la comprobación local posterior confirma que el ledger permanece presente con el mismo SHA. No se ejecutó smoke, cleanup de fixtures, commit ni push.

<!-- TASK007_FINALIZER_REPORT_START -->
## TASK-007C+D — finalización automatizada

- Run `c9818e40-2d4d-4c1b-a392-14a9404a5111`; GATE C PASS y GATE D automatizado PASS. Integración DB y E2E previos no se repitieron. Smoke humano: **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**. El aplazamiento fue autorizado para el portfolio MVP y no equivale a smoke PASS.
- Ownership y referencias verificados antes de borrar; cleanup exclusivamente por UUID registrado y en orden FK inverso. La auditoría posterior confirmó ausencia de todos los IDs y restauración exacta del inventario previo.
- Verificación DEV final: migrations 19/19 idénticas, dry-run al día, DB lint sin errores, schema/API PASS, Baseline V2 exacto PASS (15/15 componentes; `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`). Verifier y `next-env.d.ts` conservan SHA exactos. Zero migrations/SQL/RLS/grants/RPC/types modificados; PROD fuera de alcance.
- Mejora pendiente del Harness: **remote-authenticated DEV gates must be orchestrated as one-shot workflows; user must not act as command-by-command relay.**
- Listo para review independiente final. Sin PR, merge ni cierre de TASK-007.
<!-- TASK007_FINALIZER_REPORT_END -->

## TASK-007 — remediación de FINAL IMPLEMENTATION REVIEW (2026-10-15)

- **FIR-1 remediated — pending independent re-review.** `pnpm test` fallaba porque Vitest descubría tres suites del finalizador escritas con `node:test` y las calificaba como vacías. `vitest.config.ts` conserva `configDefaults.exclude` y excluye sólo esas tres rutas. `package.json` ejecuta Vitest seguido de `test:task007-tooling` con `node --test`; el comando canónico pasó con 435/435 tests Vitest en 51 archivos y 11/11 tests de tooling, exit code 0.
- **FIR-2 remediated — pending independent re-review.** Registration conserva un snapshot exacto de `nationalityCode`, `documentNumber` y `birthDate` para cada resolve, con generación y referencia síncrona a la identidad actual. Cada edición relevante invalida la solicitud, borra resolución y confirmación. Una respuesta sólo se aplica si generación e identidad aún coinciden; submit comprueba de nuevo el snapshot. Las regresiones con promesas diferidas para los tres campos prueban que el `NOT_FOUND` tardío no habilita create y que B requiere su propio resolve. El botón pending impide iniciar dos resolves simultáneos desde la UI; la generación también descarta una respuesta anterior si llegara fuera de orden.
- Verificación local: componente de registro 15/15; Patients 104/104 en 9 archivos; suite Vitest 435/435 en 51; tooling `node:test` 11/11; `pnpm test` PASS, exit code 0; lint, typecheck, build y guard de secretos del bundle cliente PASS. Prettier focalizado y diff check PASS. El build y el guard preservaron el SHA exacto de `next-env.d.ts`. No hubo cambios DB, RPC, RLS, grants, migration, tipos generados, Server Actions, E2E ni layout visual. `review.md` conserva íntegra el acta del reviewer. `next-env.d.ts` sigue ajeno, unstaged y excluido, con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Smoke humano: **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**. El **HISTORICAL VERIFICATION GAP** permanece categoría **E — insufficient evidence**. El riesgo exact-resolve/create y controles de abuso, rate limiting y monitoreo permanecen **PRE-PROD**. Cero DEV, Supabase, fixtures y baseline en esta remediación; PROD fuera de alcance. FIR-1 y FIR-2 siguen OPEN formalmente hasta el re-review independiente; TASK-007 no se cierra.
