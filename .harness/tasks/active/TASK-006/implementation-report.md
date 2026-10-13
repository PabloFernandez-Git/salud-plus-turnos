# TASK-006 — Implementation Report — TASK-006B DB/API foundation

**Estado:** `REMEDIATION COMPLETE — AWAITING INDEPENDENT RE-REVIEW`

**Rol:** Implementer

**Alcance:** foundation PostgreSQL/RLS/RPC, tipos generados y tests DB/concurrencia. UI de
Specialties/Professionals y TASK-006C+ permanecen fuera de alcance.

## Resultado

- Branch confirmada: `task/006-professionals-specialties`.
- Base aprobada confirmada antes de implementar:
  `4760c77360fdadea6e0f2cfdc143da23cbba4e1a`.
- Checkpoint documental previo creado con sólo `brief.md` y `plan.md`:
  `546678b4941360761658ce4f0947d09a6f4de860`.
- Supabase DEV confirmado y único destino modificado: `ehllxymqyzrofydrvtzo`, `sa-east-1`, URL
  `https://ehllxymqyzrofydrvtzo.supabase.co`, `APP_ENV=development` y CLI link exacto.
- PROD no fue consultado ni modificado.
- Las 14 migrations previas no se editaron. Se agregó y aplicó una sola migration incremental.
- No se agregaron tablas ni columnas.
- No se crearon Auth users, `public.users` ni memberships como efecto de las RPCs de Professional.
- No se implementó UI, rutas ni navegación de Professionals/Specialties; tampoco Availability,
  Appointments, Agenda, Patients ni Clinical History.
- La foundation quedó lista para review independiente; TASK-006 no se marca completa y TASK-006C no
  se inició.

## Migration aplicada en DEV

| Migration                                                  | Resultado                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `20261009120000_add_professional_specialty_foundation.sql` | PASS — dos policies SELECT, grants mínimos y nueve RPCs estrechas. |

Paridad final: 15 versiones locales == 15 versiones DEV. El dry-run final de `db push` informó
`upToDate=true`, sin migrations, seeds ni roles pendientes.

## Policies y grants

- `specialties_select_center_admin`: SELECT sólo para ADMIN tenant activo del mismo Center activo.
- `professional_center_specialties_select_center_admin`: mismo alcance por `center_id`.
- `authenticated` recibe SELECT únicamente sobre estas dos tablas nuevas además de las seis lecturas
  aprobadas de TASK-005.
- No se agregaron policies INSERT/UPDATE/DELETE ni grants DML genéricos.
- `anon`, `PUBLIC`, RECEPTION, PROFESSIONAL y PLATFORM_ADMIN-only no reciben nuevas lecturas
  efectivas ni mutaciones.
- Las lecturas existentes de Professional/ProfessionalCenter de TASK-005 permanecen sin cambios.
- Las nueve funciones son `SECURITY DEFINER`, `search_path=''`, referencias calificadas, validación
  interna de `auth.uid()` + ADMIN, `REVOKE ALL` a `PUBLIC/anon/authenticated` y `GRANT EXECUTE` sólo a
  `authenticated` por firma exacta.

## Contratos finales de RPC

| RPC                                                                                      | Contrato                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `admin_resolve_professional_by_document(uuid,text,text)`                                 | Resolución exacta por nacionalidad/documento canónico. Retorna sólo status, nombre/apellido e IDs/token opacos aprobados. |
| `admin_create_professional_with_center(uuid,text,text,text,text,text,text,text,integer)` | Crea identidad global + PC; outcome `CREATED`; nunca crea Auth/User/membership.                                           |
| `admin_link_professional_to_center(uuid,uuid,text,text,timestamptz)`                     | Crea vínculo, reutiliza activo o reactiva la misma fila; outcomes `CREATED_LINK`, `REUSED_ACTIVE`, `REACTIVATED`.         |
| `admin_update_professional_center(uuid,uuid,timestamptz,text,integer)`                   | Edita sólo matrícula/duración local con CAS.                                                                              |
| `admin_set_professional_center_active(uuid,uuid,timestamptz,boolean)`                    | Activa/desactiva con CAS y bloquea D4 si existe membership PROFESSIONAL activa.                                           |
| `admin_create_specialty(uuid,text,text)`                                                 | Crea Specialty activa, trim/null y colisión estable incluida fila inactiva.                                               |
| `admin_update_specialty(uuid,uuid,timestamptz,text,text)`                                | Edita nombre/descripción con CAS y colisión estable.                                                                      |
| `admin_set_specialty_active(uuid,uuid,timestamptz,boolean)`                              | Cambia sólo actividad; preserva asociaciones.                                                                             |
| `admin_update_professional_center_specialties(uuid,uuid,timestamptz,uuid[],uuid[])`      | Delta explícito activate/deactivate, transaccional, same-center, validación de estados y PC como token aggregate.         |

Errores estables del plan implementados: `CENTER_ADMINISTRATION_DENIED`, `RESOURCE_NOT_FOUND`,
`PROFESSIONAL_IDENTITY_ALREADY_EXISTS`, `PROFESSIONAL_IDENTITY_MISMATCH`,
`STALE_PROFESSIONAL_CENTER_STATE`, `PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP`,
`STALE_SPECIALTY_STATE`, `SPECIALTY_NAME_ALREADY_EXISTS`, `PROFESSIONAL_CENTER_NOT_ACTIVE`,
`SPECIALTY_NOT_ACTIVE`, `INVALID_SPECIALTY_BATCH` y `NO_SPECIALTY_CHANGES`.

Se agregaron tres tokens de validación deterministas necesarios para inputs directos de RPC:
`INVALID_PROFESSIONAL_INPUT`, `INVALID_PROFESSIONAL_CENTER_INPUT` e `INVALID_SPECIALTY_INPUT`.

## Locks, CAS y concurrencia

Orden implementado:

1. autorización preliminar e inputs baratos;
2. create/link: advisory lock de identidad canónica;
3. advisory lock común `salud-plus:center:<uuid>`;
4. reautorización bajo lock;
5. fila aggregate `FOR UPDATE`;
6. Specialties/asociaciones ordenadas por UUID `FOR UPDATE` para batch;
7. comparación CAS;
8. mutación y retorno.

El lock de Center es el mismo utilizado por `admin_provision_center_user` y
`admin_set_center_membership`, por lo que D4 queda serializada con altas/cambios de membership. Los
tests observaron waiters reales en `pg_locks`; los delays sólo se usan para polling/watchdog y no
como mecanismo de corrección.

Todas las mutaciones de fila existente comparan `updated_at` bajo lock antes de mutar. El batch toca
`professional_centers.updated_at` sólo cuando cambia al menos una asociación. Una reactivación
concurrente con token no nulo stale falla; el retry idempotente de un snapshot `NOT_LINKED` con token
NULL puede devolver `REUSED_ACTIVE`.

## Semántica no-op

- Update PC y Specialty comparan valores normalizados y no ejecutan UPDATE si son iguales.
- Set active PC/Specialty no ejecuta UPDATE si el estado ya coincide.
- Batch no vacío cuyos IDs ya están en el estado pedido retorna conteos cero y conserva el token.
- Batch con ambos arrays vacíos falla `NO_SPECIALTY_CHANGES` porque no expresa intención.
- Autorización, pertenencia, estados, IDs y CAS se validan antes de aceptar el no-op.

## Email de Professional

- Zod/server: `createProfessionalWithCenterSchema` aplica trim, lowercase, máximo 320 y `z.email()`.
- PostgreSQL/RPC: aplica `lower(btrim(...))`, no vacío, máximo 320 y regex C-locale determinista
  `^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$`.
- La regla deliberadamente no intenta implementar RFC completo.
- La suite invoca directamente la RPC con email inválido y demuestra SQLSTATE `22023`, token
  `INVALID_PROFESSIONAL_INPUT` y cero inserts.

## Tests agregados y adaptados

- `src/modules/professionals/schemas/create-professional-with-center.test.ts`: normalización y
  validación server-side.
- `supabase/tests/task-006b-foundation.sql`: catálogo exacto de policies/grants/firmas,
  `SECURITY DEFINER`, `search_path`, locks y ausencia de listing global.
- `scripts/verify-task006b-db-foundation.mjs`: baseline exacto, ownership por UUID, cleanup exacto,
  RLS/roles, privacidad, dedupe, create/link/reactivation, CAS/no-op, D4, preservación y batch.
- Concurrencia determinista: create/create misma identidad, link/link same-center, reactivación,
  Specialty equivalente case/trim, batch/batch stale y membership assignment vs PC deactivation.
- `auth-access-foundation.sql` y runners Auth/B3A se actualizaron al catálogo aprobado de ocho
  policies/ocho tablas SELECT. PLATFORM_ADMIN-only puede ejecutar SELECT por grant pero RLS retorna
  cero filas.

## Verificación

| Verificación                                                        | Resultado                                                                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm bootstrap`                                                    | PASS inicial y final; Node 24.21.0, pnpm 11.26.0, DEV/link coherentes.                                         |
| Preflight branch/base/link/14 migrations                            | PASS antes del checkpoint y de la implementación.                                                              |
| Dry-run pre-push                                                    | PASS; sólo la migration TASK-006B pendiente.                                                                   |
| Push a DEV                                                          | PASS; aplicado sólo a `ehllxymqyzrofydrvtzo`.                                                                  |
| `pnpm db:test:task006b:dev`                                         | PASS final; DB/RLS/RPC/concurrencia y cleanup exacto.                                                          |
| `pnpm db:test:schema:dev`                                           | PASS; concurrencia real.                                                                                       |
| `pnpm db:test:auth-foundation:dev`                                  | PASS; Auth/RLS/grants y cleanup cero.                                                                          |
| `pnpm db:test:b3a-invariants:dev`                                   | PASS; memberships, D4 coordination y baseline idéntico.                                                        |
| `pnpm db:test:bootstrap-preflight:dev`                              | PASS.                                                                                                          |
| `pnpm db:test:provisioning-reconciliation:dev`                      | PASS; cleanup cero.                                                                                            |
| `pnpm db:test:provisioning-orchestration:dev`                       | PASS 1/1.                                                                                                      |
| `pnpm db:types`                                                     | PASS; diff sólo con nueve RPCs.                                                                                |
| Unit/component                                                      | PASS, 25 archivos / 180 tests.                                                                                 |
| `pnpm lint`                                                         | PASS.                                                                                                          |
| `pnpm typecheck`                                                    | PASS.                                                                                                          |
| `pnpm build`                                                        | PASS.                                                                                                          |
| Formato focalizado de todos los archivos TASK-006B                  | PASS.                                                                                                          |
| `pnpm format:check` global                                          | FAIL preexistente del checkout: 83 archivos ajenos marcados por line endings; no se reescribieron.             |
| `supabase db lint --linked --schema public,private --level warning` | PASS; cero resultados.                                                                                         |
| Security advisors `--fail-on error`                                 | PASS; cero ERROR, 16 WARN intencionales de RPC autenticada (7 previas + 9 nuevas) y warning Auth preexistente. |
| `pnpm security:check:client-bundle`                                 | PASS; fuentes y build sin secretos cliente.                                                                    |
| `git diff --check`                                                  | PASS; sólo avisos informativos LF/CRLF.                                                                        |
| Dry-run final de migrations                                         | PASS; DEV up to date.                                                                                          |

## Baseline DEV

Snapshot exacto final antes/después del runner: SHA-256
`e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.

Contenido aprobado preservado:

- 1 `auth.users`;
- 1 `public.users`;
- 1 `platform_admins`;
- 1 Center activo (`76dcbe41-38be-475d-a590-f4ae6619c1e8`);
- 1 membership ADMIN activa;
- 2 provisioning operations `SUCCEEDED` con IDs aprobados;
- 0 Professionals, 0 ProfessionalCenters, 0 Specialties y 0 asociaciones.

No quedaron fixtures Auth/DB ni datos falsos persistentes.

## Archivos de implementación

- `.harness/tasks/active/TASK-006/implementation-report.md`
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

## Findings y desviaciones

- No hubo desvíos estructurales: cero tablas/columnas nuevas y las firmas son las nueve del plan.
- La validación Zod de alta se adelantó desde la vertical Professionals a B exclusivamente para
  cumplir el contrato explícito email Zod/server + PostgreSQL; no se agregó action, query, ruta ni UI.
- Se formalizaron tres tokens de input inválido no enumerados en la tabla inicial del plan.
- La primera ejecución del runner expuso truncamiento de microsegundos por el parser `pg` de
  `timestamptz`; el runner ahora conserva el string PostgreSQL completo. El SQL CAS no cambió y el
  baseline quedó idéntico.
- `next build` regeneró temporalmente `next-env.d.ts`; se restauraron exactamente sus dos imports
  DEV y el hash inicial/final coincide:
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
  El archivo permanece unstaged y fuera de todos los commits.
- El `format:check` global no pasa por line endings de 83 archivos preexistentes ajenos. El formato
  focalizado de todos los archivos TASK-006B pasa y no se realizó un reformat masivo fuera de scope.

## Git y cierre de subfase

- No se creó PR, no se hizo push y no se hizo commit de implementación.
- No hay archivos staged.
- `next-env.d.ts` permanece como cambio local ajeno, intacto respecto del preflight y unstaged.
- PROD permanece intacto y fuera de alcance.
- TASK-006B está lista para review independiente; TASK-006 continúa activa.

**TASK-006B IMPLEMENTATION COMPLETE — AWAITING REVIEW**

## Remediación del review independiente — R1/R2

El verdict histórico permanece en `review.md` como `TASK-006B REVIEW CHANGES_REQUESTED`. Esta
sección registra exclusivamente la remediación posterior; no se inició TASK-006C.

### R1 — CAS/version token monotónico

**Causa:** `private.set_updated_at()` asignaba `now()`, cuyo valor es constante durante toda la
transacción. Además, el trigger `BEFORE UPDATE` reemplazaba el `clock_timestamp()` que el batch
intentaba asignar. Por eso dos cambios efectivos podían devolver el mismo token y una transacción
antigua podía hacer retroceder `updated_at`.

**Corrección:** migration
`20261009130000_enforce_task006_cas_monotonicity.sql`. Agrega el trigger function privado
`private.set_task006_cas_updated_at()` con:

`greatest(clock_timestamp(), old.updated_at + interval '1 microsecond')`

Sólo los triggers de `professional_centers` y `specialties`, los dos aggregates CAS reales de
TASK-006, fueron reasignados. No se modificó la semántica global de `updated_at`, los locks, el orden
de locks, los stale checks ni la coordinación TASK-005.

El runner prueba sin sleeps:

- `token0 -> cambio efectivo -> token1 -> cambio efectivo en la misma transacción -> token2` y
  verifica en PostgreSQL `token2 > token1 > token0` para ProfessionalCenter y Specialty;
- `token0` y `token1` fallan como stale después de sus respectivos cambios;
- no-op conserva exactamente `token2`;
- una transacción iniciada antes y aplicada después no hace retroceder el token;
- el batch existente conserva avance sólo con transición efectiva y token idéntico en no-op.

### R2 — contrato determinista de email

**Causa:** la regex PostgreSQL original permitía un segmento final terminado en punto, mientras que
`z.email()` lo rechazaba. Una llamada RPC directa podía persistir un Professional global inmutable
con `a@example.test.`.

**Corrección:** migration `20261009140000_align_professional_email_contract.sql`. Agrega
`private.is_valid_professional_email(text)`, un CHECK validado
`professionals_email_contract_check`, y reemplaza la RPC de alta manteniendo su firma, seguridad,
locks, grants y error estable `22023 / INVALID_PROFESSIONAL_INPUT`.

El contrato normaliza con `lower(btrim(email))`, exige máximo 320 caracteres, exactamente un `@`,
local no vacío de hasta 64 caracteres, domain no vacío de hasta 255, ausencia de whitespace,
segmentos vacíos y puntos iniciales/finales, labels DNS ASCII de hasta 63 caracteres sin guiones en
los extremos y TLD alfabético de al menos dos caracteres. El servidor usa el helper explícito
`professionalEmailSchema` en lugar de depender de internals de `z.email()`.

La matriz compartida
`src/modules/professionals/schemas/professional-email-contract-cases.json` alimenta tanto los tests
Vitest del server como las invocaciones directas DB/RPC. Cubre los cuatro válidos solicitados, su
normalización y 17 inválidos, incluidos trailing dot, local/domain vacíos, whitespace interno,
doble punto, punto inicial, múltiples `@`, labels con guiones inválidos, underscore de dominio y TLD
inválido.

### DEV y validación final

- Guard previo: `APP_ENV=development`, ref/URL/link `ehllxymqyzrofydrvtzo`, proyecto exacto
  `salud-plus-turnos-dev`, región `sa-east-1`, status healthy.
- Dry-run previo: sólo las migrations 13:00 (R1) y 14:00 (R2).
- Paridad final: 17 migrations locales == 17 DEV; dry-run final `Remote database is up to date`.
- TASK-006B DB/RPC/RLS/concurrencia: PASS, incluida matriz email y CAS intratransacción.
- Auth/RLS foundation: PASS y cleanup cero.
- TASK-005 B3A invariants/concurrency: PASS y baseline exacto.
- Unit/component: PASS, 25 archivos / 198 tests.
- Lint, typecheck y build: PASS.
- Tipos de base regenerados: PASS; no cambió la firma pública de las RPCs.
- Supabase DB lint `public,private --level warning`: PASS, cero findings.
- Guard de secretos en fuentes y bundle: PASS.
- Prettier focalizado: PASS; no se ejecutó reformat masivo.

Baseline DEV antes/después de la corrida final:
`e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`, con 1 Auth User, 1
`public.users`, 1 PLATFORM_ADMIN, 1 Center activo, 1 ADMIN membership activa, 2 provisioning
operations aprobadas y cero Professionals, ProfessionalCenters, Specialties y asociaciones.

La migration aplicada original `20261009120000_add_professional_specialty_foundation.sql` conserva
su SHA-256 `1C5E388C2DA0ACAADB0DD6A186B437CB258C27C72644837B4C57E533534C66B8`; ninguna de las 14
migrations anteriores fue editada. No hubo commit de implementación, push ni PR. `next-env.d.ts`
permanece unstaged y fuera del alcance. PROD no fue consultado ni modificado.

**TASK-006B REMEDIATION COMPLETE — AWAITING RE-REVIEW**

## TASK-006C — Especialidades (review independiente PASS)

### Preflight y alcance

- Branch `task/006-professionals-specialties` y HEAD local/remoto
  `0e045881aa20428bde595004661656f9a11a9ed6` coincidentes antes de implementar.
- El único cambio previo era `next-env.d.ts`, SHA-256
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; no se editó ni
  stageó para TASK-006C.
- La paridad de 17 migrations locales == 17 DEV y `Remote database is up to date` fue verificada
  manualmente por el usuario desde una terminal autenticada. El CLI local de esta sesión carece de
  `SUPABASE_ACCESS_TOKEN`, por lo que no se repitió esa verificación aquí.
- No se crearon ni editaron migrations. No hubo commit, push, PR ni acceso a PROD.

### Implementación

- Ruta dinámica `/centers/[centerId]/specialties` con guard ADMIN server-side y fallo not-found
  para rol no autorizado o Center ajeno.
- Módulo `src/modules/specialties/`: schemas Zod, query server-only, funciones de dominio que
  llaman exclusivamente las tres RPCs aprobadas, Server Actions delgadas y componente de listado/
  formularios. La descripción existente se conserva en edición mediante lectura server-side.
- Nombre trimeado, no vacío y máximo 120 caracteres en Zod. La unicidad case-insensitive + trim,
  incluida fila inactiva, permanece bajo autoridad de DB y el error se mapea a feedback específico.
- Editar y cambiar estado envían el `expected_updated_at` renderizado. El error stale se muestra,
  cierra el formulario y refresca el listado sin overwrite ni retry. Los no-op pasan por la RPC,
  que conserva el token CAS. Desactivar requiere una segunda confirmación en la UI y comunica que
  las asociaciones se conservan.
- Enlace `Especialidades` en la navegación tenant sólo para ADMIN.

### Verificación

- Pruebas focalizadas: 6 archivos / 38 tests PASS. Cubren ruta ADMIN y denegaciones, listado,
  create/edit/state, validación, CAS, errores duplicate/stale, preservación de descripción,
  confirmación y navegación ADMIN-only.
- Regresión unit/component completa: 30 archivos / 231 tests PASS, incluidas las regresiones
  locales de Access y schemas de TASK-006B.
- Build: PASS, ruta dinámica incluida. Guard de secretos fuente/bundle: PASS.
- Lint, typecheck, Prettier focalizado y `git diff --check`: PASS.
- Se intentó `pnpm db:test:task006b:dev`: el CLI terminó antes de conectar o crear fixtures porque
  esta sesión no tiene `SUPABASE_ACCESS_TOKEN`. No hubo test remoto ni cambio de baseline.
- No se ejecutaron E2E ni tests remotos/fixtures en DEV en esta subfase; el baseline persistente
  no se modificó. La evidencia DB/RLS/CAS/concurrencia remota corresponde a TASK-006B.
- El build regeneró automáticamente `next-env.d.ts`; se restauraron exactamente los bytes previos
  y se verificó de nuevo su SHA-256 esperado. Sigue unstaged y fuera de TASK-006C.
- Review independiente: `TASK-006C REVIEW PASS — READY FOR CHECKPOINT`, sin findings abiertos.
  No se inicia TASK-006D ni se cierra TASK-006.

## TASK-006D — Profesionales / ProfessionalCenter (implementación, pendiente de review)

### Preflight y alcance

- Branch `task/006-professionals-specialties`, HEAD local y remoto
  `1631c2dc1651d90ed72a41caaef35882b448d69b` coincidentes; staging vacío.
- Único cambio previo: `next-env.d.ts`, SHA-256
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
  Permanece unstaged y fuera de TASK-006D.
- Bootstrap pasó. Se usó la evidencia reciente de 17 migrations locales/DEV y cero drift del
  checkpoint. Esta fase no aplicó migrations ni accedió a DEV o PROD.
- Alcance limitado a Professional y ProfessionalCenter. No hay controles de especialidades,
  mutaciones de User/Auth/membership ni servicio privilegiado para operaciones tenant.

### Implementación

- Ruta dinámica `/centers/[centerId]/professionals` con guard ADMIN activo del Center y estados de
  carga/error/vacío. La query server-only exige ADMIN, filtra ProfessionalCenters por Center y
  proyecta de Professional sólo nombre y apellido para el listado. Muestra además matrícula,
  duración habitual, estado y acciones locales.
- Flujo staged de nacionalidad/documento exactos mediante
  `admin_resolve_professional_by_document`: `NOT_FOUND` abre alta con identidad global y
  configuración local; `NOT_LINKED` exige confirmar vínculo; `LINKED_INACTIVE` exige confirmar
  reactivación de la misma fila; `LINKED_ACTIVE` informa que ya pertenece al Center. La resolución
  existente muestra sólo nombre, apellido y estado local. IDs y CAS viajan como datos opacos.
- El alta reutiliza `createProfessionalWithCenterSchema` y su contrato de email; create/link usan
  exclusivamente las RPCs aprobadas. Una carrera `NOT_FOUND` → identidad creada devuelve stale y
  exige nueva resolución/confirmación, sin auto-link.
- Editar sólo matrícula y duración (5–480, múltiplo de 5; default 30). Estado activo/inactivo con
  confirmación. Edición y estado envían el `updated_at` renderizado; stale cierra el formulario,
  descarta el token y refresca. No hay reintento automático ni actualización optimista; el no-op
  se delega a la semántica RPC de TASK-006B.
- D4 se traduce a explicación y enlace a Usuarios. La RPC/DB conserva autoridad para impedir
  desactivar un PC con membership PROFESSIONAL activa. La navegación ADMIN agrega Profesionales y
  conserva Usuarios y Especialidades.

### Verificación

- Focalizados TASK-006D: 5 archivos / 55 tests PASS, incluidos ruta, autorización server-side,
  query Center-scoped, RPCs exactas, validación, email, confirmaciones, CAS, stale, D4 y UI.
- Regresión unit/component completa: 34 archivos / 260 tests PASS, incluida TASK-006C y Access.
- Lint, typecheck, build, Prettier focalizado, `git diff --check` y secret guard fuente/bundle:
  PASS. La ruta `/professionals` figura como dinámica en el build.
- TASK-006B DB/RPC/RLS/concurrencia se apoya en su verificación DEV previa del checkpoint; no se
  repitió DEV ni E2E remoto en esta fase. Baseline DEV no fue tocado; no hay comparación nueva
  antes/después. La paridad DEV se informa según evidencia reciente, no como medición de esta
  sesión.
- Migrations nuevas o editadas: 0. `next-env.d.ts` conserva exactamente el SHA previo después de
  build y guard de secretos. Sin commit, push ni PR.

**TASK-006D IMPLEMENTATION COMPLETE — AWAITING REVIEW**

## TASK-006D — Remediación D-R1 (pendiente de re-review)

- El review independiente registró `TASK-006D REVIEW CHANGES_REQUESTED`, finding único `D-R1 LOW`.
  Su verdict histórico permanece en `review.md`, sin cambios en esta remediación.
- Causa: los schemas de resolve y create sólo exigían `trim().min(1)` para el documento. La cadena
  `"---"` pasaba Zod, pero `private.normalize_document()` eliminaba los guiones y la RPC rechazaba
  el resultado vacío con `22023 / INVALID_PROFESSIONAL_INPUT`; el mapping lo trataba como fallo
  inesperado.
- Se agregó `professionalDocumentSchema`, compartido por resolve/create. Su helper reproduce para
  validación la secuencia aprobada: trim, uppercase,
  remoción de whitespace y puntos, y sólo las variantes de guion enumeradas en la función SQL.
  Exige resultado no vacío, sin cambiar el documento persistido ni la autoridad de PostgreSQL
  para canonicalización y deduplicación. Preserva letras, números y ceros iniciales.
- Si la RPC responde directamente `22023 / INVALID_PROFESSIONAL_INPUT`, la Action devuelve feedback
  seguro de documento/nacionalidad inválidos. Un fallo Zod del documento devuelve el error del
  campo como mensaje visible en la UI de resolve y create.
- Tests nuevos: separadores solos rechazados en ambos schemas y Actions antes de invocar RPC;
  números, letras, ceros iniciales y separadores alrededor de contenido aceptados; mapping RPC
  directo seguro en resolve/create; mensaje visible en componente.
- Verificación: focalizados afectados 3 archivos / 37 tests PASS; suite unit/component completa
  35 archivos / 277 tests PASS; bootstrap, lint, typecheck, Prettier focalizado y guard de secretos
  con build PASS. `git diff --check` y SHA de `next-env.d.ts` se verifican al cierre.
- Migrations nuevas o editadas: 0. No se modificaron RPCs, DEV ni PROD. Sin commit, stage, push,
  PR ni inicio de TASK-006E.

**TASK-006D REMEDIATION COMPLETE — AWAITING RE-REVIEW**

## TASK-006E — ProfessionalCenter ↔ Specialty (implementación, pendiente de review)

### Preflight y alcance

- Branch `task/006-professionals-specialties`; HEAD local y remoto
  `81dcdf1b36f7a294fd1b6a2ef845cf127655b1fa`; staging vacío antes de implementar.
- Único cambio previo: `next-env.d.ts`, SHA-256
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
  El build lo regeneró; se restauraron exactamente sus bytes previos y quedó unstaged.
- Bootstrap pasó. Se usó la evidencia reciente de 17 migrations locales == 17 DEV y
  `Remote database is up to date`; esta fase no consultó ni modificó DEV o PROD.
- Cero migrations nuevas o editadas; no se inició TASK-006F ni se modificó TASK-006C,
  identidad global, Auth, Users o memberships.

### Implementación

- El panel `Configurar` de Profesionales incorpora un editor de Especialidades. La query
  server-only, protegida por ADMIN, carga en dos lecturas por Center todas las Specialties
  (activas e inactivas) y todas las asociaciones (activas e inactivas), sin N+1. Una
  asociación sin Specialty visible falla cerrado.
- Para un PC activo, checkboxes muestran sólo Specialties activas del Center. El editor
  calcula `activate` y `deactivate` comparando con el estado de asociaciones renderizado.
  Una Specialty inactiva ya asociada aparece en sección retenida, marcada `Inactiva`; sólo
  la acción explícita `Desasociar` la agrega al delta de desactivación. Omitirla del selector
  activo no cambia su fila. Al reactivarse la Specialty, la asociación preservada vuelve a
  mostrarse marcada y operativa sin una nueva asignación.
- Con PC inactivo se muestran las asociaciones como no operativas y sólo se permite
  `Desasociar`; no se ofrecen activaciones. La RPC permite esa reducción aunque PC o Specialty
  estén inactivos.
- La Action valida UUIDs, arrays sin duplicados/intersección y token, revalida ADMIN y llama
  exclusivamente `admin_update_professional_center_specialties` una vez por submit, con
  `p_center_id`, `p_professional_center_id`,
  `p_expected_professional_center_updated_at`, `p_activate_specialty_ids` y
  `p_deactivate_specialty_ids`. No hay DML directo, service role, secret key ni admin client.
  El batch vacío se evita en UI y Action; `NO_SPECIALTY_CHANGES` se mapea defensivamente.
- La RPC existente conserva autoridad para same-center, estados activos, CAS bajo lock y
  atomicidad. `SPECIALTY_NOT_ACTIVE`, `PROFESSIONAL_CENTER_NOT_ACTIVE`, stale e IDs ajenos
  producen feedback seguro y recarga obligatoria. Tras éxito se recibe el nuevo token
  `professional_center_updated_at`; la UI cierra el editor, descarta el snapshot anterior
  y refresca la página. El botón `Configurar` de ese PC queda bloqueado hasta que llega el
  nuevo snapshot, evitando reabrir con el token previo. Un no-op válido en RPC conserva el
  token y conteos cero.

### Verificación

- Tests nuevos de query, Action, RPC boundary y UI: lecturas Center-scoped, roles denegados,
  payload exacto, múltiples altas, baja, batch mixto, preservación inactiva, desasociación
  explícita, reactivación visible sin INSERT, PC inactivo, batch vacío, IDs manipulados,
  errores de estado, stale y descarte del token UI.
- La evidencia DB/RPC previa de TASK-006B cubre directamente `SPECIALTY_NOT_ACTIVE`,
  `INVALID_SPECIALTY_BATCH` cross-center, `STALE_PROFESSIONAL_CENTER_STATE`, batch/batch,
  preservación al desactivar Specialty, no-op/token, batch vacío y atomicidad. No se repitió
  DEV; por ello no existe una medición nueva de baseline antes/después en esta fase. El
  baseline conocido permanece como referencia, no como resultado medido de esta sesión.
- Suite unit/component completa: 38 archivos / 303 tests PASS (incluidas regresiones
  TASK-006C y TASK-006D). Lint, typecheck, build, Prettier focalizado,
  `git diff --check` y guard de secretos fuente/bundle: PASS. La ruta de Profesionales
  figura dinámica en el build. No se ejecutaron E2E remotos.
- Sin commit, stage, push o PR. `next-env.d.ts` conserva su SHA esperado; PROD no fue
  consultado ni modificado.

**TASK-006E IMPLEMENTATION COMPLETE — AWAITING REVIEW**
