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
