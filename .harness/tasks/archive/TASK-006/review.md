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

## TASK-006C REVIEW (2026-10-09)

### Diff y alcance

- Base: `0e045881aa20428bde595004661656f9a11a9ed6` en `task/006-professionals-specialties`; HEAD local y remoto permanecen en ese checkpoint. Se revisaron los archivos tracked modificados y los 12 archivos nuevos aún untracked de la ruta y `src/modules/specialties/`. El único cambio en `src/modules/access/` es el enlace de navegación.
- El alcance implementado es `/centers/[centerId]/specialties`: listar, crear, renombrar, activar y desactivar. No hay DELETE, UI de Professional/ProfessionalCenter, asignación PC ↔ Specialty, Availability, Appointments, Agenda ni Patients. La documentación `docs/modules/specialties.md` y el informe de implementación describen sólo esta vertical; no adelantan TASK-006D/E.
- No se detectaron `insert`, `update` ni `delete` directos desde la aplicación, cliente tenant privilegiado, `SUPABASE_SECRET_KEY` ni `SUPABASE_SERVICE_ROLE_KEY` en los archivos nuevos. Las mutaciones usan el cliente server de la sesión autenticada y exclusivamente `admin_create_specialty`, `admin_update_specialty` y `admin_set_specialty_active`.

### Seguridad y comportamiento

- La página valida `centerId` y exige `requireRole(centerId, ["ADMIN"])`; la query vuelve a exigirlo y filtra `center_id`. Las Server Actions crean el cliente de sesión y reautorizan antes de validar el payload; las funciones de dominio también reautorizan. `requireRole` exige membership activa y Center activo, sin bypass PLATFORM_ADMIN. RECEPTION, PROFESSIONAL, PLATFORM_ADMIN-only y Center ajeno quedan denegados. Ocultar el enlace es sólo UX.
- La policy SELECT de TASK-006B exige ADMIN activo del Center. Las tres RPC comprueban `auth.uid()` y el rol antes y después del advisory lock. Update y status buscan `specialty.id` junto con `specialty.center_id`; un ID de otro Center devuelve `RESOURCE_NOT_FOUND` sin objeto ajeno. No se modificaron grants/RLS.
- El listado incluye filas activas e inactivas del Center actual, muestra su estado y tiene loading, vacío y error de carga. La creación aplica trim, exige nombre no vacío y longitud máxima en servidor. La DB conserva la autoridad de unicidad mediante `(center_id, lower(btrim(name)))`, también para filas inactivas; `Cardiología`, `cardiología` y ` Cardiología ` colisionan.
- La edición expone sólo `name`. La descripción se relee en servidor para preservarla, sin confiar en un campo del formulario; no se editan ID, Center ni timestamps manualmente. Edit y status envían el `expected_updated_at` de la fila renderizada. Las RPC comparan el token bajo row lock antes de mutar; el no-op conserva el mismo token. El trigger monotónico de TASK-006B permanece intacto.
- En edit/activate/deactivate stale se devuelve feedback comprensible; el componente cierra la selección y llama `router.refresh()` sin retry. Al cerrar la selección descarta el token local anterior. La desactivación requiere un segundo paso explícito y explica que la Specialty deja de estar operativa y conserva asociaciones. TASK-006C no toca `professional_center_specialties`.
- El mapping separa validación Zod, duplicate name, stale, autorización y fallo inesperado, sin mostrar SQL ni objetos cross-center. La navegación conserva `Usuarios`, usa el `centerId` de la ruta y muestra `Especialidades` sólo a ADMIN.

### Verificación independiente

| Check | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS |
| `pnpm test` | PASS: 30 archivos, 231/231 tests; incluye tests de ruta, query, Actions, CAS, UI/navegación y la regresión de `requireRole` para ADMIN, RECEPTION, PROFESSIONAL, PLATFORM_ADMIN-only y Center ajeno |
| `pnpm lint`; `pnpm typecheck` | PASS; PASS |
| Prettier focalizado sobre ruta, módulo y navegación | PASS mediante el binario local de Prettier |
| `git diff --check` | PASS; sólo avisos de conversión LF/CRLF |
| `pnpm format:check` global | FAIL por 81 archivos ajenos al diff. El documento `docs/modules/specialties.md` tampoco satisface Prettier, pero su versión en el checkpoint ya fallaba el mismo check; no se atribuye a TASK-006C. |

Los tests focalizados usan mocks para los límites de ruta y Actions; no constituyen una prueba remota nueva de RLS/RPC. Se inspeccionaron además `requireRole`, la policy y las tres RPC de la foundation aprobada. No se ejecutaron E2E ni checks remotos en DEV ni se crearon fixtures: la evidencia remota reciente de TASK-006B registra 17 migrations local == 17 DEV y `db push --dry-run` sin pendientes. No afirmamos una nueva verificación remota. Tampoco se repitió el build del implementer, para mantener intacto `next-env.d.ts`.

### Migrations, estado protegido y findings

- TASK-006C agrega **0 migrations**. Las 17 migrations existentes no fueron editadas; tampoco los tipos generados. Las firmas y argumentos de las tres RPC utilizadas coinciden con `database.types.ts`. No hay cambios de grants ni RLS.
- `next-env.d.ts` continúa modificado localmente, **unstaged**, fuera del diff de TASK-006C y con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` antes y después de los checks.
- No hubo mutación DEV atribuible a TASK-006C. No se accedió a PROD ni se lo modificó. No se stageó, commiteó, pusheó ni creó PR durante este review.
- Findings BLOCKER: ninguno. HIGH: ninguno. MEDIUM: ninguno. LOW: ninguno.

**TASK-006C REVIEW PASS — READY FOR CHECKPOINT**

## TASK-006D REVIEW (2026-10-09)

### Diff y alcance

- Base y HEAD: `1631c2dc1651d90ed72a41caaef35882b448d69b`, branch `task/006-professionals-specialties`. Se revisaron los dos archivos tracked modificados de TASK-006D (`implementation-report.md` y navegación) y los once archivos nuevos untracked de ruta y módulo. Staging vacío; sin commit, push ni PR.
- `next-env.d.ts` es el único cambio ajeno: permanece unstaged y excluido del review funcional, con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Alcance funcional: `/centers/[centerId]/professionals`, listado, resolución exacta, alta, vínculo, reactivación, edición de configuración, estado, navegación y tests. No hay UI ni Actions de ProfessionalCenter ↔ Specialty, Availability, Appointments, Agenda o Patients. TASK-006E no se inició.

### Seguridad, datos y flujos

- La ruta, query y Server Actions exigen ADMIN activo del Center. `requireRole` comprueba membership activa y Center activo; no concede bypass a PLATFORM_ADMIN-only. La query filtra `professional_centers.center_id` y proyecta de `professionals` sólo `id`, `first_name`, `last_name` para los IDs locales; falla si una identidad esperada no es visible por RLS. RECEPTION, PROFESSIONAL, anon y cross-center no obtienen el listado por la cadena de autorización y policies existentes.
- El listado presenta nombre, apellido, matrícula, duración, actividad y acciones. El resolve usa exclusivamente nacionalidad + documento canonicalizado por `private.normalize_document`; la RPC devuelve sólo estado respecto del Center, nombre y apellido, más IDs y token opacos. El server retorna ese contrato; React conserva sólo ese resultado y muestra únicamente los campos de negocio autorizados. No se leen ni exponen email, teléfono, documento almacenado, normalized_document, otros Centers, matrículas/especialidades ajenas, Users, identidades Auth ni memberships. No hay logging nuevo de identidad o errores.
- `NOT_FOUND` abre el alta; la creación valida nombre, apellido, nacionalidad, documento, email mediante el contrato de TASK-006B, teléfono opcional, matrícula opcional y duración. `NOT_LINKED` exige confirmación explícita antes de link. `LINKED_INACTIVE` confirma reactivación de la misma fila con CAS, conservando matrícula, duración y asociaciones; `LINKED_ACTIVE` informa el estado y no ofrece mutación duplicada. Una carrera de identidad existente requiere resolver otra vez.
- Professional permanece separado de User: ninguna ruta nueva llama Auth Admin ni inserta/actualiza `auth.users`, `public.users` o `center_memberships`. Link/reactivate/update sólo invocan las RPCs aprobadas; las RPCs inspeccionadas no mutan identidad global durante link/reactivation/update. No hay edición posterior de nombre, apellido, nacionalidad, documento, email o teléfono.
- La edición local acepta sólo matrícula nullable y duración entera de 5 a 480 en múltiplos de 5. No hay controles para IDs, Center ni timestamps. Update y estado envían el `updated_at` de la fila renderizada; link/reactivation envía el token del resolve. La RPC compara bajo lock, rechaza stale y conserva el token en no-op. La UI cierra y limpia la selección/resolución ante stale, muestra feedback y refresca sin retry. Al cerrar/reabrir, el formulario no conserva su selección ni token local anterior.
- D4 está en la RPC: una membership `PROFESSIONAL` activa que apunta al PC impide desactivarlo; la condición `membership.is_active` evita bloqueo por una inactiva. La UI no hace cascade y dirige a Usuarios sin identificar la cuenta. La DB sigue siendo autoridad.
- Las cinco RPCs invocadas son exactamente `admin_resolve_professional_by_document`, `admin_create_professional_with_center`, `admin_link_professional_to_center`, `admin_update_professional_center` y `admin_set_professional_center_active`. No hay DML tenant directo, cliente service/admin ni uso nuevo de secretos. Las RPCs reautorizan y verifican Center/IDs bajo locks; las policies SELECT y grants de TASK-006B permanecen intactos. La navegación conserva Usuarios y Especialidades, agrega Profesionales con el `centerId` actual y se muestra sólo a ADMIN.

### Verificación independiente y límites

| Check | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS |
| `pnpm test` | PASS: 34 archivos, 260/260 unit/component |
| `pnpm lint`; `pnpm typecheck` | PASS; PASS |
| Prettier focalizado (ruta, módulo, navegación) | PASS mediante binario local |
| `git diff --check 1631c2d...` | PASS; sólo avisos LF/CRLF |
| `pnpm security:check:client-bundle` | PASS; build exitoso, ruta `/professionals` dinámica y secretos ausentes del bundle cliente |
| Migrations/tipos/grants/RLS/RPC vs checkpoint | 0 archivos cambiados; 17 SQL migrations existentes intactas |
| Staging / `next-env.d.ts` | vacío / SHA-256 esperado, unstaged tras restaurar exactamente los dos imports DEV regenerados por el build |

Los tests ejecutados cubren ADMIN list, roles denegados en los límites de ruta/query/Action, Center filtrado, resolve `NOT_FOUND`/existente, respuesta y UI D2, create/link, active/inactive, update, duración inválida, CAS/stale, confirmaciones, D4 y navegación. La autorización server-side se inspeccionó también en `requireRole` y en las RPCs/RLS, no sólo en visibilidad de UI. Los tests locales usan mocks en esos límites; la evidencia DB/RPC real de TASK-006B consta en su review previo. No se conectó a DEV ni se ejecutó DB/E2E remoto en este review; no se afirma una comprobación remota nueva ni se crearon fixtures. El guard de secretos ejecutó un build y regeneró `next-env.d.ts`; se restituyó byte por byte su versión previa mediante los dos imports DEV y se reconfirmó el SHA-256 esperado.

### Findings

**LOW D-R1 — Documento que canonicaliza a vacío recibe mensaje de fallo inesperado.**

- Evidencia: `resolveProfessionalSchema` y `createProfessionalWithCenterSchema` aceptan `documentNumber: "---"` porque aplican sólo `trim().min(1)` (`professional-center.ts:12`, `create-professional-with-center.ts:19`). `private.normalize_document` elimina guiones/puntos/espacios; las RPCs de resolve/create rechazan el resultado vacío con `22023 / INVALID_PROFESSIONAL_INPUT` (`20261009120000_add_professional_specialty_foundation.sql:70,381`). `errorState` no mapea ese código y responde “No pudimos completar la operación...” (`professional-actions.ts:53-94`).
- Riesgo: un input inválido común se presenta como fallo transitorio y pide actualizar/reintentar, sin indicar al ADMIN cómo corregir el documento. La DB rechaza de forma segura y no hay disclosure ni mutación.
- Corrección esperada: validar en servidor que la canonicalización no quede vacía, o mapear específicamente `22023 / INVALID_PROFESSIONAL_INPUT` a feedback de datos inválidos, idealmente con error del campo documento y prueba de resolve/create con separadores solos. Mantener a PostgreSQL como autoridad final.

BLOCKER: ninguno. HIGH: ninguno. MEDIUM: ninguno. LOW: D-R1.

PROD no fue consultado ni modificado. No se modificó implementación, no se agregaron migrations y no se inició TASK-006E.

**TASK-006D REVIEW CHANGES_REQUESTED**

## TASK-006D RE-REVIEW D-R1 (2026-10-13)

### Diff focalizado y contrato

- El estado anterior a la remediación no tuvo commit: se contrastó el working tree actual con el código y el finding registrados en el review original. Los cambios de D-R1 se limitan al nuevo `schemas/professional-document.ts` y su test, el uso del schema en resolve/create, el mapping de `server/professional-actions.ts`, sus tests y `implementation-report.md`. `professional-center.ts` conserva `linkProfessionalSchema` con la validación anterior. Las diferencias de navegación y demás archivos de Professionals frente a HEAD pertenecen a TASK-006D previo a D-R1; no son cambios de esta remediación.
- El helper replica para la comprobación de contenido el trim, uppercase y los separadores de `private.normalize_document()` relevantes al caso: espacios, puntos y las variantes de guion explícitas. `"---"`, vacío y separadores solos son inválidos. Números, letras, ceros iniciales y separadores alrededor de contenido real siguen siendo válidos. El schema conserva el documento trimmeado para enviarlo a las RPCs; no utiliza el valor calculado por el helper como clave ni decide deduplicación.
- PostgreSQL sigue siendo autoridad de identidad con `private.normalize_document()`, UNIQUE y las RPCs existentes. Resolve continúa usando sólo nacionalidad + documento, sin ampliar el retorno D2. Create mantiene nombre, apellido, nacionalidad, contrato de email, teléfono opcional, matrícula y duración previos. Link conserva su schema, confirmación, RPC y CAS anteriores.
- En resolve/create, el error Zod de `"---"` produce `fieldErrors.documentNumber` y el mensaje visible `Ingresá un documento válido.` antes de invocar la RPC. El mapping defensivo requiere conjuntamente SQLSTATE `22023` y token exacto `INVALID_PROFESSIONAL_INPUT`; responde con texto seguro de input inválido, sin SQL ni datos cross-center. No captura otros `22023` de forma indiscriminada. La prueba de UI confirma feedback visible; la ejecución normal de resolve/create/link permanece cubierta.

### Verificación independiente

| Check | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS |
| Vitest focalizado: documento, Actions, componente | PASS: 3 archivos, 37/37 |
| `pnpm test` | PASS: 35 archivos, 277/277 |
| `pnpm lint`; `pnpm typecheck` | PASS; PASS |
| Prettier focalizado sobre archivos de D-R1 | PASS |
| `git diff --check 1631c2d...` | PASS; sólo avisos LF/CRLF |
| Migrations SQL y tipos generados vs checkpoint | 0 cambios; 17 migrations SQL existentes |
| `next-env.d.ts` | SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, unstaged y fuera de TASK-006D |

La suite comprueba separadores solos en ambos schemas y Actions, documentos numéricos/alfanuméricos con ceros y separadores, mapeo directo de la RPC, mensaje visible en UI y regresiones de resolve válido, create válido y link. No se repitió build/guard de bundle en este re-review; el implementer lo reportó PASS, mientras que lint y typecheck se reejecutaron. No se conectó a DEV ni se crearon fixtures; no se repitió DB/concurrency remoto. No se alteraron migrations, definiciones RPC, RLS, grants, navegación, CAS, D4 ni TASK-006E. Staging vacío, sin commit, push ni PR. PROD no fue consultado ni modificado.

**D-R1 LOW — CLOSED.** No se detectaron regresiones introducidas por la remediación ni findings nuevos.

**TASK-006D REVIEW PASS — READY FOR CHECKPOINT**

## TASK-006E REVIEW (2026-10-13)

### Diff, alcance y contrato

- Branch y HEAD: `task/006-professionals-specialties` / `81dcdf1b36f7a294fd1b6a2ef845cf127655b1fa`. Revisé el diff completo del working tree contra ese SHA y los ocho archivos untracked de TASK-006E. El staging permanece vacío; no hubo commit, push ni PR.
- TASK-006E modifica `implementation-report.md`, la ruta y los tests de Profesionales, `professionals-screen.tsx` y su test, y la query `professionals.ts`; agrega editor, schema, Action delgada, función server y tests. No aparecen cambios de TASK-006F, Availability, Patients, Appointments, Agenda, identidad global, User/Auth, memberships ni tooling.
- `next-env.d.ts` es el único cambio ajeno esperado: modificado localmente, unstaged y fuera de TASK-006E. Su SHA-256 inicial y final es `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Brief D5 y plan RPC 9 permiten desasociación explícita de una relación retenida con Specialty o PC inactivo. Exigen preservar la asociación inactiva omitida; no exigen preservación absoluta ante `Desasociar`.

### Lecturas, aislamiento y autorización

- La ruta exige ADMIN activo del Center. `listProfessionalSpecialtyConfiguration` vuelve a exigir `requireRole(centerId, ["ADMIN"])` y hace exactamente dos lecturas, ambas con `.eq("center_id", centerId)`: todas las Specialties y todas las asociaciones del Center, sin N+1. `listProfessionals` mantiene su filtro del Center y la proyección mínima de nombre/apellido del Professional. Una asociación cuya Specialty no sea visible falla cerrada; el componente sólo entrega al editor asociaciones del PC seleccionado.
- Las dos FK compuestas de `professional_center_specialties` a `(professional_center_id, center_id)` y `(specialty_id, center_id)` impiden que una fila etiquetada con ese Center apunte a un PC o una Specialty de otro. Las policies SELECT ADMIN por `center_id`, `requireRole` y la RPC refuerzan el aislamiento. Un ID cross-center en una mutación falla por PC no encontrado o batch inválido, sin revelar datos ajenos.
- Route, query, Action, función server y RPC requieren ADMIN tenant; `requireRole` exige sesión, membership activa y Center activo. RECEPTION, PROFESSIONAL, PLATFORM_ADMIN-only, anon y actor de otro Center no obtienen acceso por esos límites y RLS. La Action directa valida UUID/token y reautoriza; la función server también reautoriza. La RPC reautoriza antes y después del advisory lock del Center.
- No se agregó información global de Professional, otros Centers, Auth, Users o memberships a la UI. No hay logging nuevo de IDs o datos sensibles. La sesión usada es el cliente Supabase SSR tenant normal. La única mutación de asociaciones desde application code es `admin_update_professional_center_specialties`; no hay DML directo, service role, admin client ni secret key.

### Deltas, estados, CAS y token

- El editor forma `activate` sólo con opciones activas seleccionadas que no están asociadas activamente; `deactivate` sólo con opciones activas asociadas que se desmarcan, más IDs retenidos marcados mediante `Desasociar`. Con PC activo, las opciones activas y las retenidas son disjuntas; con PC inactivo, el cálculo omite todas las bajas por checkbox y sólo toma `Desasociar`. El schema y la RPC rechazan duplicados e intersección. El cálculo cubre alta sola/múltiple, baja sola/múltiple y lote mixto sin convertir la omisión de una Specialty inactiva en baja.
- En el caso Cardiología activa + Clínica médica inactiva, ambas asociadas, editar Cardiología u otra opción activa deja Clínica médica fuera de `deactivate`. La sección retenida muestra `Inactiva`; sólo `Desasociar` genera su baja explícita. La RPC cambia `is_active=false` y nunca borra la fila. Al reactivar la Specialty, la asociación conservada vuelve a aparecer marcada y operativa sin INSERT adicional.
- La UI no ofrece una Specialty inactiva para alta. Una ID inactiva enviada manualmente, una desactivación entre render y save, o una ID de otro Center llegan como máximo a la RPC: ésta bloquea/relee, exige Specialty activa y same-center para activar y revierte el lote completo al fallar. La Action mapea el error a feedback seguro y refresh, sin retry. Un PC inactivo no ofrece altas; la RPC rechaza activaciones incluso si se llama la Action directamente, mientras permite desasociaciones reductivas con CAS.
- Cada submit envía `p_expected_professional_center_updated_at` del PC renderizado y una sola RPC batch. La RPC compara CAS bajo lock antes de mutar. Un stale rechaza el lote completo, muestra feedback y refresca sin retry. Tras éxito o stale, `ProfessionalsScreen` cierra el editor, descarta la selección y bloquea `Configurar` de ese PC mientras se conserve la misma referencia de snapshot; el nuevo render desde `router.refresh()` permite reabrir con los datos y token recibidos del servidor. El test de componente comprueba bloqueo inmediato y siguiente submit con token nuevo. La Action devuelve además el token autoritativo de la RPC, aunque la UI opta por recargar.
- Un batch efectivo avanza `professional_centers.updated_at` por el trigger monotónico de TASK-006B. Un no-op válido conserva token y conteos cero. UI y Action evitan normalmente el batch vacío; `NO_SPECIALTY_CHANGES` se mapea como error sin mutación ni token inventado. La evidencia DB/RPC y concurrencia de TASK-006B cubre atomicidad, cross-center, inactivos, stale, monotonicidad y no-op; las migrations no cambiaron desde entonces.

### Regresiones y verificación independiente

| Check | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS |
| `pnpm test` | PASS: 38 archivos, 303/303 tests unit/component, incluidas regresiones 006C/006D |
| `pnpm lint`; `pnpm typecheck` | PASS; PASS |
| Prettier focalizado sobre los 13 archivos de código/tests afectados, con binario local | PASS |
| `git diff --check 81dcdf1b...` | PASS; sólo avisos LF/CRLF |
| SQL migrations, tipos generados, grants/RLS/RPC contra checkpoint | 0 archivos modificados; 17 migrations existentes |
| Staging / `next-env.d.ts` | vacío / SHA-256 esperado, unstaged |

Los tests locales prueban rutas/lecturas ADMIN, roles denegados, dos lecturas filtradas por Center, payload RPC y CAS, lotes mixtos, preservación por omisión, baja retenida explícita, rechazo de IDs/estados inválidos, PC inactivo, stale, batch vacío, reactivación visible y bloqueo de reapertura antes del refresh. Las pruebas de Action y RPC boundary usan mocks; no equivalen a una nueva medición DB. La cobertura DB/RPC real de TASK-006B se reutiliza porque las 17 migrations, tipos, RLS, grants y RPC permanecen intactos. No repetí build ni guard de bundle: el implementer los reportó PASS y el review verificó tipos, lint y ausencia de secretos/DML en el código afectado, manteniendo intacto `next-env.d.ts`.

DEV no fue consultado ni modificado en este review. La paridad `17 local == 17 DEV` y baseline `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a` son evidencia previa de TASK-006B, no una medición nueva. No se crearon fixtures. PROD no fue consultado ni modificado. No se modificó implementación ni se inició TASK-006F.

### Findings y veredicto

BLOCKER: ninguno. HIGH: ninguno. MEDIUM: ninguno. LOW: ninguno.

**TASK-006E REVIEW PASS — READY FOR CHECKPOINT**

## TASK-006F INTEGRATION VERIFICATION — BLOCKED (2026-10-13)

La verificación independiente de TASK-006F no pudo comenzar en DEV. Preflight Git y SHA de
`next-env.d.ts` coincidieron exactamente con el checkpoint `da6ea31968c256a569c5b235f432bc0431bd6127`.
`pnpm bootstrap` pasó y se contaron 17 migrations SQL locales. El primer intento de
`pnpm exec supabase migration list` no alcanzó el proyecto: pnpm intentó reconstruir dependencias
y el registro respondió `EACCES`. Se detuvo el intento y se eliminó sólo `.pnpm-store/`, generado
por él. No hay autenticación Supabase detectada en la sesión, por lo que se cumplió el gate del
usuario: ninguna consulta de baseline, test remoto ni fixture se ejecutó.

Paridad DEV, baseline antes/después, E2E/smoke, regresión DB/RPC, matriz de autorización real,
CAS/concurrencia y suite/build/security actuales no tienen resultado de TASK-006F. La evidencia
previa de TASK-006B–E permanece en las secciones anteriores y no se eleva a PASS de integración.
No se detectó un finding nuevo de producto; el bloqueo es operativo y requiere restaurar el login
de Supabase antes de continuar. Cero migrations nuevas, cero mutaciones DEV/PROD, sin stage, commit,
push ni PR.

**TASK-006F BLOCKED**

## TASK-006F INTEGRATION VERIFICATION — RESUMED / PASS (2026-10-13)

El bloqueo anterior se conserva como evidencia histórica. Tras restaurarse la sesión Supabase,
se midió **antes de fixtures** el baseline completo DEV con digest exacto
`e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.
La última medición, después de todas las regresiones y E2E, devolvió el mismo digest. Cada runner
con fixtures verificó ownership/cleanup; el E2E nuevo elimina sólo UUIDs de sus dos Centers
temporales y falló cerrado ante un baseline inicial distinto.

| Gate | Resultado |
| --- | --- |
| Preflight / CLI | Rama y HEAD esperados; staging vacío; Supabase CLI 2.117.0. |
| Migrations / DB lint | 17 local == 17 DEV; dry-run sin pendientes; cero errores de schema. |
| E2E integración | 1/1 PASS, un worker, con flujo Specialty → Professional → PC → asociaciones → inactivación/reactivación, vínculo entre Centers, D2, D4 y rutas denegadas. |
| DB/RPC/RLS | Runner TASK-006B PASS con baseline exacto antes/después y concurrencia lock-observed. |
| Access | Auth foundation PASS; B3A PASS; E2E Auth 9/9 y B3D 6/6 PASS; schema/concurrencia PASS. |
| Calidad | 303/303 unit/component; lint, typecheck, build, Prettier focalizado, `git diff --check` y secret guard PASS. |
| Baseline final / scope | SHA aprobado exacto; 0 migrations nuevas/editadas; PROD intacto. |

El E2E inicial había supuesto que un 404 cambiaba la URL; la ruta preserva la URL y muestra
correctamente 404. Se ajustó esa aserción del test, se comprobó el cleanup exacto y se reejecutó
el flujo final con PASS. No se cambió producto para acomodar el test.

Las decisiones D1–D8 mantienen evidencia coherente entre código, tests de límites, E2E y DB:
identidad global inmutable; proyección mínima D2; documento PostgreSQL; D4 atómico sin cascade;
asociaciones retenidas por Specialty inactiva; PC único/reutilizable; ADMIN-only con RLS; CAS
under lock con stale sin efectos parciales, token monotónico en cambios y no-op determinista.
La matriz de ruta se observó en DEV para ADMIN, RECEPTION, PROFESSIONAL, PLATFORM_ADMIN-only,
anon y cross-center; las Actions y los IDs manipulados están cubiertos por tests de módulo y las
RPCs/RLS por el runner real. D-R1 y email pasaron en validación server/DB sin drift de contrato.

No hay findings BLOCKER, HIGH, MEDIUM ni LOW abiertos en esta fase. El review final integral de
TASK-006 sigue pendiente; no se archivó la tarea ni se creó retrospectiva. `next-env.d.ts`
conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`,
unstaged. Sin stage, commit, push, PR, merge ni acceso a PROD.

**TASK-006F INTEGRATION PASS — READY FOR FINAL TASK-006 REVIEW**

## TASK-006 FINAL REVIEW (2026-10-13)

### Alcance y preflight

Review independiente del diff acumulado desde `4760c77360fdadea6e0f2cfdc143da23cbba4e1a` hasta
`da6ea31968c256a569c5b235f432bc0431bd6127`, más todos los cambios actuales de TASK-006F y
el archivo E2E untracked. Rama `task/006-professionals-specialties`; HEAD local igual a
`origin/task/006-professionals-specialties`; staging vacío. `next-env.d.ts` es ajeno y conserva
SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
Se leyeron brief, plan, implementation-report, review histórico y `docs/status.md`; se contrastaron
con código, migrations, tests, scripts y documentación modular. `pnpm bootstrap` pasó.

### Resultado por contrato

- D1–D8: la implementación revisada preserva inmutabilidad global, divulgación mínima del resolve,
  autoridad PostgreSQL documental, bloqueo D4 bajo lock, asociaciones retenidas con Specialty
  inactiva, PC único por Professional+Center, ADMIN tenant como autoridad y CAS/no-op monotónico.
  D-R1 LOW permanece CLOSED: resolve/create rechazan `---` en el servidor y DB sigue canonicalizando.
- DB/API: sólo tres migrations nuevas y 17 totales. Las 14 anteriores no se editaron. Las nueve
  RPCs usan `SECURITY DEFINER`, `search_path = ''`, autorización ADMIN y grants `EXECUTE` limitados a
  `authenticated`; no se observó DML tenant genérico ni DELETE de producto. El trigger conserva
  `greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond')`. Tests SQL/runner cubren
  RLS/grants, cross-center, no-op, stale, batch atómico y concurrencia observada.
- Specialties: list/create/rename/estado, unicidad `lower(btrim(name))` aun inactiva y CAS existen;
  queda incompleta la descripción opcional, detallada en F1.
- Professionals y asociaciones: el flujo staged, vinculación/reactivación de la misma fila, matrícula,
  duración, D4, batch de deltas, preservación por omisión y desasociación explícita se corresponden
  con las RPCs. La UI y la API de TASK-006 no crean Auth/User/membership implícitamente. El resolve
  retorna sólo nombre/apellido, estado local y soporte técnico opaco; no se detectaron props, logs ni
  errores que expongan email, teléfono, documento almacenado u otros Centers.
- Autorización: rutas, queries, Actions, funciones server y RPC revalidan ADMIN del Center activo;
  RLS limita SELECT por Center. El runner de DB y el E2E reportan denegación para RECEPTION,
  PROFESSIONAL, PLATFORM_ADMIN-only, anon y cross-center. El E2E omite membership inactiva (F2).
- DEV/fixtures: la evidencia TASK-006F registra CLI 2.117.0, 17 local == 17 DEV, dry-run sin
  pendientes, DB lint sin errores y digest DEV antes/después idéntico
  `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`. El modo nuevo
  `--baseline-only` se bifurca antes del runner mutante y ejecuta sólo el SELECT de snapshot,
  validación y digest. El E2E usa dos Centers/UUID propios, borra por IDs exactos y verifica el
  baseline fail-closed; no usa LIKE, ILIKE ni cleanup por prefijo. El flujo E2E es integración real
  de navegador, Auth, RPC y DB, pero no satisface todo el mínimo del plan (F2).
- Regresión/calidad: el reporte TASK-006F registra Auth foundation, B3A, B3D 6/6, Auth E2E 9/9,
  schema, build, secret guard y DB lint PASS. En este review se reejecutaron `pnpm test` (38 archivos,
  303/303), `pnpm lint`, `pnpm typecheck`, Prettier focalizado y `git diff --check`: PASS. No se
  repitieron fixtures ni mutaciones remotas. El escaneo de patrones de tokens en commits de TASK-006,
  diff actual y E2E untracked no halló valores con forma de secreto; el guard de bundle reportado
  pasó. No se detectó ampliación a Availability, Patients, Appointments, Agenda, historia clínica,
  vacaciones, reservas públicas, recordatorios o billing.
- Documentación/estado: `docs/status.md` deja TASK-006 pendiente de review final, sin afirmar merge,
  PR integrado o archivo. `docs/modules` refleja D1–D8; el módulo Specialties aún presenta la
  descripción como campo del catálogo mientras la UI no la administra (F1). No hay evidencia de
  acceso a PROD; este review no consultó ni modificó PROD.

### Findings abiertos

**F1 — MEDIUM — La descripción de Specialty no se puede crear ni editar desde la administración.**

- Evidencia y ubicación: `brief.md:184-186` exige descripción opcional y edición de nombre y
  descripción; `plan.md:474,478` pide schema y tabla con descripción. En
  `src/modules/specialties/schemas/specialty.ts:17-22` los schemas sólo incluyen `name`;
  `src/modules/specialties/components/specialties-screen.tsx:30,53,157,204-206` sólo ofrece y
  muestra nombre; `src/modules/specialties/server/specialties.ts:52,67-83` fuerza descripción vacía
  al crear y preserva la anterior al editar. La RPC sí acepta `p_description`.
- Impacto: un ADMIN no puede registrar ni mantener el dato aprobado; el criterio funcional de
  Specialties y el plan de TASK-006C quedan incompletos pese a que los tests actuales pasan.
- Corrección esperada: permitir descripción opcional en create/edit, normalizar vacío a NULL,
  mostrarla en el listado, enviarla a las RPCs con CAS y cubrirlo con pruebas de módulo e integración.

**F2 — MEDIUM — El E2E TASK-006F y el smoke no cubren todo el mínimo de integración aprobado.**

- Evidencia y ubicación: `plan.md:569-586` requiere edición de Specialty, nombre reservado cuando
  está inactiva, membership inactiva denegada, stale/refresh con estado persistido y smoke manual;
  `plan.md:558,575-576` requiere comprobar la resolución de D4 hacia Usuarios. En
  `tests/e2e/task-006-integration.spec.mjs:274-283,334-379` se crean y cambian estados de
  Specialties, pero no se edita ni se intenta el nombre reservado. En `:454-470` la membership se
  desactiva/reactiva mediante SQL de fixture, sin recorrer Usuarios. En `:473-505` se prueban roles
  denegados salvo membership inactiva. No hay escenario stale/refresh de navegador en ese archivo
  ni evidencia de smoke manual posterior en `implementation-report.md`.
- Impacto: las pruebas DB/component prueban piezas, pero faltan los flujos end-to-end y la
  comprobación manual que el plan definió como gate de TASK-006F. No se puede afirmar que todos los
  criterios de aceptación del plan estén verificados.
- Corrección esperada: ampliar el E2E con esos flujos y registrar el smoke manual previsto, o
  obtener una modificación explícita del plan antes de solicitar un nuevo review final.

BLOCKER: 0. HIGH: 0. MEDIUM: 2. LOW: 0. No se modificó código, migrations, fixtures, DEV ni PROD;
sin stage, commit, push, PR, merge ni archivo de tarea.

**TASK-006 FINAL REVIEW CHANGES_REQUESTED**

## TASK-006 FINAL RE-REVIEW (2026-10-13)

Este re-review es focalizado en los dos findings MEDIUM del review final anterior. El veredicto
`TASK-006 FINAL REVIEW CHANGES_REQUESTED` y sus findings F1/F2 permanecen íntegros arriba como
historial. Para este cierre se denominan `FINAL-R1 MEDIUM` (F1) y `FINAL-R2 MEDIUM` (F2).

### Preflight y diff de remediación

- Rama `task/006-professionals-specialties`; HEAD local y remoto
  `da6ea31968c256a569c5b235f432bc0431bd6127`; staging vacío. Se revisó todo el diff actual
  desde ese checkpoint y el E2E untracked. La remediación funcional afecta sólo schemas, servidor,
  Actions, UI y tests de Specialties, más el E2E de integración; no cambia módulos Professionals,
  Access, rutas ni migrations. Los cambios anteriores TASK-006F y del review final se preservan.
- `next-env.d.ts` sigue fuera de TASK-006, unstaged, con SHA-256
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Se releyeron brief, plan, implementation-report, review histórico, `docs/status.md`, módulo
  Specialties, código y tests afectados. `pnpm bootstrap` pasó.

### FINAL-R1 — CLOSED

`createSpecialtySchema` y `updateSpecialtySchema` aceptan descripción opcional, la trimean y envían
`''` si falta o se limpia. La Action valida el FormData en servidor y reautoriza ADMIN; las funciones
server pasan el valor a `admin_create_specialty`/`admin_update_specialty`, sin lectura previa que
sobrescriba una edición. Las RPCs existentes aplican `nullif(btrim(p_description), '')` y almacenan
`NULL` para vacío o sólo espacios; la columna es `text NULL` sin límite de longitud. La UI ofrece
crear, editar y limpiar la descripción y muestra el texto o «Sin descripción» en el listado.

El update conserva `expected_updated_at`; la RPC compara CAS bajo lock antes de escribir, compara
nombre y descripción normalizados para no-op, y el trigger monotónico avanza token en un cambio
efectivo. El E2E verifica cambio de nombre y descripción, token avanzado, no-op con token idéntico,
dos pestañas con stale sin overwrite y refresh autoritativo. Duplicate name con fila inactiva y
activate/deactivate siguen cubiertos. Tests focalizados inspeccionados y reejecutados: 33/33 PASS;
suite completa: 308/308 PASS.

### FINAL-R2 — CLOSED

El E2E untracked ahora verifica create/edit/clear de descripción contra UI y DB, nombre reservado
case/trim con Specialty inactiva, stale real entre dos pestañas, mensaje, ausencia de overwrite,
refresh y descarte del editor viejo. Crea un Auth user propio con membership ADMIN del Center de
fixture inactiva, prueba ambas rutas denegadas y luego carga formularios mientras está activa para
desactivar esa misma membership antes de guardar: las Actions de Specialty y Professional rechazan
los submits y la DB no cambia. Nunca toca la membership ADMIN del baseline.

En D4, el E2E comprueba PC y membership PROFESSIONAL activos, bloqueo de desactivación sin efecto
lateral, sigue «Ir a Usuarios», desactiva allí explícitamente la membership mediante la UI de
TASK-005, vuelve a Profesionales y desactiva el PC. El flujo restante conserva la integración
Specialty → ProfessionalCenter → asociaciones y la denegación por roles/Center. El test usa Auth,
Center y membership de fixture propios, UUIDs exactos, `finally` de cleanup y baseline fail-closed;
no depende de filas residuales de DEV ni usa LIKE/ILIKE o borrado por prefijo.

`implementation-report.md` distingue el smoke humano de Playwright y registra PASS 6/6 para
navegación/móvil, descripción y duplicate, Professional/PC, asociación inactiva/reactivada, D4 vía
Usuarios y UX. También preserva la pausa inicial de cleanup por ownership incierto, la confirmación
humana posterior de UUIDs y el cleanup de 2 Specialties, 1 Professional, 1 PC, 1 asociación,
1 membership, 1 provisioning operation, 1 public User y 1 Auth user. El reporte documenta
validación de relaciones dentro de transacción serializable, DELETE por UUID exacto con RETURNING
comprobado y digest final DEV idéntico al aprobado:
`e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.

### Regresiones, calidad y límites de evidencia

- El diff no modifica D1–D8, D2, D-R1, contrato email, identidad Professional,
  ProfessionalCenter, asociaciones, autorizaciones ni TASK-005 Users/Auth. La nueva Action sigue
  exigiendo ADMIN; no hay escritura directa de tabla ni nuevos grants. El scope no agrega
  Availability, Patients, Appointments, Agenda ni funcionalidad clínica.
- 17 migrations SQL locales, exactamente tres nuevas respecto de TASK-005 y ninguna agregada o
  editada por esta remediación. El reporte registra CLI 2.117.0, 17 local == 17 DEV, dry-run sin
  pendientes y DB lint sin errores. Build, secret guard y E2E 1/1 están reportados PASS. Este review
  reejecutó bootstrap, Specialty 33/33, suite completa 308/308, lint, typecheck, Prettier focalizado,
  `node --check` del E2E y `git diff --check`: PASS. Escaneo de patrones de tokens del diff actual y
  E2E untracked: sin valores con forma de secreto. No se hallaron credenciales embebidas.
- Se intentó una lectura independiente `--baseline-only`, pero esta sesión no tiene login de
  Supabase (`LegacyPlatformAuthRequiredError`); no se consultaron filas ni se ejecutaron fixtures.
  La conclusión sobre DEV se apoya en la evidencia exacta antes/después, ownership y cleanup
  documentados en `implementation-report.md`, no en una medición remota nueva de este review.
  `docs/modules/specialties.md`, `docs/status.md` y el informe reflejan remediación completa,
  pendiente de re-review, sin afirmar merge, PR integrado ni archivo de TASK-006.
- PROD no fue consultado ni modificado en este review y el reporte de remediación lo mantiene fuera
  de alcance. No hubo cambios de implementación, stage, commit, push, PR, merge ni archivo durante
  este re-review; sólo se agregó esta sección histórica a `review.md`.

Findings nuevos: ninguno. BLOCKER: 0; HIGH: 0; MEDIUM: 0; LOW: 0.

**FINAL-R1 CLOSED**

**FINAL-R2 CLOSED**

**TASK-006 FINAL REVIEW PASS — READY FOR FINAL CHECKPOINT AND PR**
