# TASK-006B — Independent Review

**Veredicto:** `TASK-006B REVIEW CHANGES_REQUESTED`

**Checkpoint revisado:** `546678b4941360761658ce4f0947d09a6f4de860` contra el working tree actual.

**Alcance:** foundation DB/API de Professionals, ProfessionalCenters, Specialties y
ProfessionalCenterSpecialties. No se reviso `next-env.d.ts` como implementacion funcional. PROD
permanecio fuera de alcance.

## Findings

### TASK-006B-R1 — HIGH — `updated_at` no es un token CAS/version determinista

**Evidencia**

- Las RPCs nuevas ejecutan cambios reales mediante `UPDATE` sobre tablas que conservan los
  triggers historicos `professional_centers_set_updated_at` y `specialties_set_updated_at`.
- `private.set_updated_at()` asigna `new.updated_at = now()`
  (`supabase/migrations/20260921150000_initial_domain_schema.sql:32-41`). `now()` es constante
  durante toda la transaccion.
- Aunque el batch intenta asignar `clock_timestamp()` en
  `20261009120000_add_professional_specialty_foundation.sql:850-855`, el trigger `BEFORE UPDATE`
  reemplaza ese valor por `now()`.
- Sonda independiente contra DEV, ejecutada como `authenticated`/ADMIN y finalizada con
  `ROLLBACK`:
  - se creo un ProfessionalCenter;
  - se ejecuto `admin_update_professional_center` dos veces con cambios efectivos distintos en la
    misma transaccion;
  - ambos cambios persistieron dentro de la transaccion;
  - `initialToken == firstToken == secondToken == row.updated_at`.
- Resultado exacto de la sonda:
  `{"firstChangePersisted":true,"secondChangePersisted":true,"initialEqualsFirstToken":true,"firstEqualsSecondToken":true,"rowEqualsSecondToken":true}`.
- La suite agregada solo prueba avance entre transacciones separadas
  (`scripts/verify-task006b-db-foundation.mjs:820-838`, `:905-918`) y por eso no detecta el caso.
  La assertion SQL que busca el texto `clock_timestamp()`
  (`supabase/tests/task-006b-foundation.sql:174-182`) tampoco comprueba el valor efectivo despues
  del trigger.

**Riesgo**

D8 exige que toda mutacion efectiva avance el token del aggregate y que el CAS sea determinista. El
token actual puede permanecer identico para multiples cambios efectivos de una misma transaccion y
tambien puede retroceder si una transaccion mas antigua actualiza despues de otra mas nueva. La
resolucion temporal de `timestamptz` permite ademas colisiones entre transacciones. Si una mutacion
deja el mismo token, un escritor con el snapshot anterior puede superar el stale check y producir un
lost update. El defecto afecta las mutaciones de ProfessionalCenter, Specialty, reactivacion y el
aggregate del batch.

**Correccion esperada**

No editar ninguna migration aplicada. Agregar una migration incremental nueva que haga del token una
version estrictamente cambiante y monotona para cada mutacion efectiva de los aggregates afectados.
Una opcion valida es un trigger especifico que use un valor como
`greatest(clock_timestamp(), old.updated_at + interval '1 microsecond')`; otra es introducir una
version explicita ahora que existe evidencia de insuficiencia de `updated_at`. La solucion debe
cubrir RPCs 3/4/5/7/8/9 y evitar que el trigger anule la asignacion del batch.

Agregar pruebas que demuestren:

1. dos cambios efectivos consecutivos dentro de una misma transaccion producen tokens distintos;
2. una transaccion iniciada antes pero aplicada despues no hace retroceder el token;
3. un snapshot previo falla despues de cada cambio efectivo;
4. no-op conserva exactamente el token;
5. el batch avanza el token solo cuando hay transiciones efectivas.

### TASK-006B-R2 — MEDIUM — PostgreSQL acepta emails claramente invalidos que Zod rechaza

**Evidencia**

- Zod aplica `z.email()` en
  `src/modules/professionals/schemas/create-professional-with-center.ts:19`.
- La RPC usa
  `^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$` en
  `20261009120000_add_professional_specialty_foundation.sql:373-375`.
- Con la version instalada de Zod, `a@example.test.` es rechazado.
- Una invocacion directa de `admin_create_professional_with_center` como
  `authenticated`/ADMIN acepto el mismo valor y lo almaceno literalmente. La sonda termino con
  `ROLLBACK`.
- Resultado exacto:
  `{"candidate":"a@example.test.","accepted":true,"storedEmail":"a@example.test.","errorCode":null,"errorToken":null}`.
- El test DB agregado solo cubre `not-an-email`
  (`scripts/verify-task006b-db-foundation.mjs:773-792`), mientras que el unit test Zod si rechaza
  varias formas adicionales.

**Riesgo**

La RPC es invocable directamente por `authenticated`; la Server Action/Zod no es una barrera de
seguridad. Un ADMIN puede crear una identidad Professional global e inmutable con un email
claramente invalido. TASK-006 no ofrece correccion posterior de la identidad, por lo que el dato
queda sin remediacion funcional.

**Correccion esperada**

No editar la migration aplicada. Agregar una migration incremental que reemplace la funcion por una
validacion PostgreSQL determinista razonablemente equivalente a Zod para los casos aceptados por el
producto, sin pretender RFC completo. Debe rechazar al menos puntos iniciales/finales y segmentos
vacios/consecutivos en local/domain, conservar trim + lowercase + maximo 320 y mantener el error
`22023 / INVALID_PROFESSIONAL_INPUT`.

Agregar una tabla compartida de casos en tests server/DB que pruebe aceptacion y rechazo equivalentes,
incluido `a@example.test.`, `.a@example.test`, `a@.example.test` y
`a@example..test`.

## Auditoria funcional

### D1 — Professional global

PASS en el alcance implementado:

- no existe RPC para actualizar `first_name`, `last_name`, `nationality_code`,
  `document_number`, `normalized_document`, `email` o `phone`;
- `authenticated` no tiene DML directo sobre `professionals`;
- las nueve RPCs no insertan ni actualizan `auth.users`, `public.users` ni
  `center_memberships`;
- Professional continua separado de User/Auth.

R2 afecta exclusivamente la validacion durante el alta, no agrega editabilidad posterior.

### D2 — Resolucion exacta y privacidad

PASS:

- busqueda exclusiva por `nationality_code + private.normalize_document(document)`;
- retorno exacto de seis columnas: status, nombre, apellido e IDs/token opacos;
- no retorna email, telefono, documento almacenado, `normalized_document`, matricula,
  especialidades, otros Centers, Users, Auth ni memberships;
- solo consulta el ProfessionalCenter del `p_center_id` autorizado;
- cross-center probado: ADMIN A resolvio una identidad vinculada solo a B como `NOT_LINKED`, vio
  nombre/apellido y no obtuvo visibilidad RLS directa del Professional antes del link;
- roles no ADMIN y ADMIN de otro Center quedaron denegados.

### D3 y deduplicacion

PASS:

- autoridad final: UNIQUE `(nationality_code, normalized_document)`;
- create usa lock de identidad y luego lock de Center;
- identidad aparecida por carrera produce `PROFESSIONAL_IDENTITY_ALREADY_EXISTS`, sin auto-link;
- link verifica id + nacionalidad + documento canonico;
- carreras create/create y link/link pasaron con estado final unico;
- no existe auto-merge ambiguo.

### D4 — ProfessionalCenter con membership activa

PASS:

- la regla vive en `admin_set_professional_center_active`;
- usa el lock advisory comun por Center antes de PC `FOR UPDATE`;
- se serializa con `admin_provision_center_user` y `admin_set_center_membership`;
- solo bloquea `role='PROFESSIONAL' AND is_active`;
- no modifica memberships;
- la carrera membership assignment/deactivation termino con membership activa y PC activo.

La suite funcional no contiene un caso dedicado de membership PROFESSIONAL inactiva, pero el
predicado SQL es exacto y la inspeccion no encontro otra condicion que la bloquee.

### D5 — Specialty y asociaciones

PASS:

- activar/desactivar Specialty solo actualiza `specialties.is_active`;
- no elimina ni desactiva asociaciones;
- batch de activacion exige PC y Specialty activos;
- deactivacion explicita sigue permitida como reduccion;
- asociaciones omitidas no se tocan;
- reactivacion restaura la operatividad de asociaciones conservadas;
- no hay DELETE fisico.

### D6 — ProfessionalCenter unico y reutilizable

PASS:

- UNIQUE `(center_id, professional_id)`;
- activo retorna `REUSED_ACTIVE`;
- inactivo exige CAS y actualiza la misma fila;
- reactivacion solo cambia `is_active`;
- preserva matricula, duracion y asociaciones;
- no crea/reactiva User ni membership.

### D7 — Autorizacion

PASS:

- todas las RPCs validan internamente `auth.uid()` y
  `private.has_active_center_role(center_id, ADMIN)`;
- no hay bypass PLATFORM_ADMIN;
- RECEPTION, PROFESSIONAL, ADMIN inactivo, PLATFORM_ADMIN-only, anon y actor cross-center no
  administran;
- las lecturas TASK-005 de `professionals` y `professional_centers` permanecen sin cambios;
- las dos lecturas nuevas son ADMIN-only mediante RLS.

### D8 — locks, CAS y no-op

- Orden de locks de las RPCs nuevas: identidad (create/link) -> Center -> aggregate -> hijas por UUID.
- No se encontro inversion con las RPCs TASK-005, que comparten el lock de Center antes de tocar
  membership/PC.
- CAS se compara bajo row lock y stale checks preceden la mutacion.
- Batch es atomico, bloquea Specialties/asociaciones ordenadas y usa ProfessionalCenter como
  aggregate.
- No-op de update, set-active y batch no ejecuta UPDATE artificial; batch no vacio ya satisfecho
  retorna counts 0 y token igual; batch vacio falla `NO_SPECIALTY_CHANGES`.

El avance determinista del token en cambios efectivos queda rechazado por R1.

## RLS, grants y catalogo real DEV

Auditoria read-only del catalogo real:

- exactamente 9 firmas TASK-006B;
- owner `postgres` en las 9;
- 9/9 `SECURITY DEFINER`;
- 9/9 `search_path=""`;
- resolver `STABLE`; las 8 mutadoras `VOLATILE`;
- `PUBLIC=false`, `anon=false`, `authenticated=true`, `service_role=false` para EXECUTE;
- RLS activa en `professionals`, `professional_centers`, `specialties` y
  `professional_center_specialties`;
- SELECT de `authenticated` en las cuatro, sin SELECT de PUBLIC/anon;
- cero DML directo de `authenticated`;
- cero privilegio de dominio directo de `service_role` sobre las cuatro;
- policies nuevas exactas, rol `authenticated`, comando SELECT y predicado ADMIN tenant;
- conjunto global: 8 policies y 8 tablas SELECT aprobadas;
- 15 migrations locales == 15 DEV; cero drift observado;
- DB lint `public,private --level warning`: cero findings.

## Tests y checks ejecutados

| Check                                          | Resultado                                                       |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `pnpm bootstrap`                               | PASS                                                            |
| `supabase migration list --linked`             | PASS, 15/15                                                     |
| `pnpm db:test:task006b:dev`                    | PASS aislado, ejecutado dos veces                               |
| TASK-006B concurrencia lock-observed           | PASS para create/link/reactivation/specialty/batch/D4 cubiertos |
| `pnpm db:test:auth-foundation:dev`             | PASS, cleanup cero                                              |
| `pnpm db:test:b3a-invariants:dev`              | PASS, baseline antes/despues                                    |
| unit focalizado schema Professional            | PASS, 1 archivo / 8 tests                                       |
| `pnpm lint`                                    | PASS                                                            |
| `pnpm typecheck`                               | PASS                                                            |
| build + `security:check:client-bundle`         | PASS                                                            |
| Prettier focalizado TASK-006B                  | PASS                                                            |
| `git diff --check 546678b...`                  | PASS                                                            |
| whitespace/conflict markers en archivos nuevos | sin matches                                                     |
| Supabase DB lint                               | PASS, cero resultados                                           |
| sonda CAS independiente                        | FAIL de contrato, R1 reproducido                                |
| sonda email independiente                      | FAIL de contrato, R2 reproducido                                |

La primera ejecucion del runner TASK-006B fallo antes de fixtures por una carrera de credenciales
temporales al ejecutarse en paralelo con `migration list`; repetido de forma aislada paso. No se
conto como evidencia funcional y no dejo datos.

## Baseline DEV

Antes y despues de la ejecucion final:

`e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`

Contenido confirmado:

- 1 Auth User;
- 1 `public.users`;
- 1 PLATFORM_ADMIN;
- 1 Center activo;
- 1 membership ADMIN activa;
- 2 provisioning operations `SUCCEEDED` aprobadas;
- 0 Professionals;
- 0 ProfessionalCenters;
- 0 Specialties;
- 0 ProfessionalCenterSpecialties.

Las sondas independientes usaron `ROLLBACK`; los runners usaron UUIDs/IDs exactos y confirmaron
cleanup y baseline equality. No se usaron `LIKE`/`ILIKE`, discovery por prefijo, sleeps como
mecanismo de correccion, truncate, reset ni borrado amplio del baseline.

## Archivos revisados

Implementacion TASK-006B:

- `package.json`
- `scripts/verify-auth-foundation.mjs`
- `scripts/verify-b3a-db-invariants.mjs`
- `scripts/verify-task006b-db-foundation.mjs`
- `src/lib/supabase/database.types.ts`
- `src/modules/professionals/schemas/create-professional-with-center.ts`
- `src/modules/professionals/schemas/create-professional-with-center.test.ts`
- `supabase/migrations/20261009120000_add_professional_specialty_foundation.sql`
- `supabase/tests/auth-access-foundation.sql`
- `supabase/tests/task-006b-foundation.sql`
- `.harness/tasks/active/TASK-006/implementation-report.md`

Contrato/contexto y regresiones relevantes:

- `.harness/README.md`
- `.harness/tasks/active/TASK-006/brief.md`
- `.harness/tasks/active/TASK-006/plan.md`
- `docs/product.md`
- `docs/status.md`
- `docs/coding-conventions.md`
- `supabase/migrations/20260921150000_initial_domain_schema.sql`
- `supabase/migrations/20260922121000_add_auth_access_helpers_and_policies.sql`
- `supabase/migrations/20260925120000_enforce_professional_membership_assignment.sql`
- `supabase/migrations/20260928120000_make_membership_stale_check_atomic.sql`

## Estado protegido y limites

- `next-env.d.ts`: fuera del review funcional; SHA final
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, igual al esperado.
  El build de review lo regenero temporalmente y se restauraron exactamente sus dos imports DEV.
- Migration auditada: `20261009120000_add_professional_specialty_foundation.sql`; no fue editada.
- Las 14 migrations historicas tampoco fueron editadas.
- Los findings requieren migration incremental nueva; no se corrigieron en esta instancia.
- No se hizo commit, push, PR ni se inicio TASK-006C.
- PROD no fue consultado ni modificado.

**TASK-006B REVIEW CHANGES_REQUESTED**

## Re-review focalizado — R1/R2 (2026-10-09)

**Base:** HEAD `546678b4941360761658ce4f0947d09a6f4de860`; las migrations
`20261009120000`, `20261009130000` y `20261009140000` ya estaban aplicadas en DEV y no se editaron.
Se preserva arriba el primer veredicto y su evidencia historica.

### R1 HIGH — CLOSED

- `20261009130000_enforce_task006_cas_monotonicity.sql` reemplaza ambos triggers de
  `professional_centers` y `specialties` por `private.set_task006_cas_updated_at()`. En cada
  `UPDATE`, el nuevo token es `greatest(clock_timestamp(), old.updated_at + interval '1 microsecond')`.
  Por ello un cambio efectivo avanza estrictamente aun dentro de una transaccion y aunque una
  transaccion iniciada antes se aplique despues.
- Las RPCs evitan el `UPDATE` en no-op de ProfessionalCenter, Specialty, cambio de estado y batch;
  conservan exactamente el token anterior. El batch solo toca el aggregate cuando hay transiciones
  efectivas.
- El runner `node scripts/verify-task006b-db-foundation.mjs` paso dos veces en DEV. La prueba
  determinista sin sleeps verifico
  `token2 > token1 > token0` para ambos aggregates en una misma transaccion, rechazo del token
  anterior tras cada cambio (`P0001 / STALE_PROFESSIONAL_CENTER_STATE` y
  `P0001 / STALE_SPECIALTY_STATE`), y no-op con token identico. La prueba de transaccion antigua
  iniciada antes y aplicada despues verifico `olderAppliedToken > newerCommittedToken`.
- Las pruebas de batch comprobaron token nuevo con transiciones efectivas, token identico con
  activacion/desactivacion ya satisfecha y rechazo stale en carrera batch/batch.

### R2 MEDIUM — CLOSED

- `professional-email-contract-cases.json` es importado directamente por el test Vitest del
  schema server y por `scripts/verify-task006b-db-foundation.mjs`; ambos recorren sus listas
  `valid` e `invalid`. Vitest paso 26/26 casos; el runner PostgreSQL/RPC paso en DEV.
- El caso `a@example.test.` figura en `invalid`: el schema server lo rechazo y la invocacion RPC
  directa como `authenticated`/ADMIN fue rechazada con
  `22023 / INVALID_PROFESSIONAL_INPUT`, sin insertar Professional. El runner exigio ese mismo
  SQLSTATE/token para todos los casos invalidos compartidos y verifico la normalizacion persistida
  para todos los validos.
- `20261009140000_align_professional_email_contract.sql` agrega el validador privado y una
  constraint validada sobre `professionals.email`. La comparacion del cuerpo de
  `admin_create_professional_with_center` con la migration anterior, sustituyendo solo la expresion
  de validacion de email, dio igualdad exacta: permanecen las dos comprobaciones ADMIN, los locks
  identidad -> Center, el flujo de insercion y el retorno. La firma conserva `SECURITY DEFINER`,
  `search_path = ''`, `EXECUTE` solo para `authenticated`; no se agregaron policies ni DML directo.
  El test de catalogo/RLS/grants en DEV paso.

### Regresion y estado DEV

| Check | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS |
| TASK-006B DB/RPC/concurrency, CAS/no-op, email contract, create/link/reactivate, Specialty update/batch, D2 privacy, D4 blocker, RLS/grants | PASS, dos ejecuciones |
| TASK-005 Auth/RLS foundation | PASS; cleanup cero |
| TASK-005B3A DB/RPC/invariants/concurrency | PASS; baseline antes/despues |
| Vitest focalizado Professional email/schema | PASS, 26/26 |
| `pnpm lint`; `pnpm typecheck` | PASS; PASS |
| `supabase db lint --linked --schema public,private --level warning` | PASS, `results: []` |
| Tipos generados desde DEV | PASS, SHA-256 identico al archivo actual |
| Secret guard con build | PASS; `next-env.d.ts` SHA-256 inicial/final `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` |
| Prettier focalizado TASK-006B; `git diff --check` | PASS; PASS (solo avisos LF/CRLF preexistentes) |
| Migration parity inicial/final | 17 local == 17 DEV, cero drift |

El snapshot persistente DEV al inicio y al final de la regresion final fue el mismo SHA-256:
`e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.
Contiene 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center, 1 ADMIN membership,
2 provisioning operations y 0 Professionals, 0 ProfessionalCenters, 0 Specialties y
0 ProfessionalCenterSpecialties. Los runners usaron ownership exacto y confirmaron cleanup.

No se modificaron implementacion ni migrations, no se stageo, commiteo, pusheo ni creo PR;
TASK-006C y PROD permanecieron fuera de alcance. `next-env.d.ts` conserva su contenido original.

**Reconfirmacion tras restaurar login Supabase (2026-10-09):** `migration list --linked`
volvio a mostrar 17 local == 17 DEV sin drift. El runner TASK-006B volvio a pasar, incluidos
R1 CAS monotono dentro de una transaccion, R2 matriz server/PostgreSQL, RPCs y concurrencia.
El baseline DEV fue `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`
antes y despues; el cleanup fue exacto.

**Veredicto final: R1 CLOSED · R2 CLOSED · TASK-006B REVIEW PASS — READY FOR CHECKPOINT**
