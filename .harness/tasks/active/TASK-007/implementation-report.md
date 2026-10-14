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
