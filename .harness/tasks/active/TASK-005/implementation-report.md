# TASK-005 — Implementation Report — Fase A

**Estado:** `TASK-005A COMPLETED` · `TASK-005B READY_FOR_IMPLEMENTATION`

**Rol:** Implementer

**Alcance:** foundation Auth / PostgreSQL / RLS / autorización; UI final fuera de alcance.

## Resultado

- Branch confirmada: `task/005-auth-users-center-access`.
- Supabase DEV confirmado y único destino modificado: `ehllxymqyzrofydrvtzo`, `sa-east-1`.
- PROD no fue consultado ni modificado.
- Las migrations de TASK-004 no se editaron.
- La foundation PostgreSQL, Auth y TypeScript quedó implementada y verificada contra DEV.
- La existencia de `SUPABASE_SECRET_KEY` moderna se verificó sin leer ni mostrar su valor; permanece
  sólo en `.env.local`, archivo ignorado y no versionado.
- La configuración Auth efectiva coincide con la aprobada: signup público OFF, contraseña mínima de
  10 caracteres sin composición, Site URL local y dos redirects exactos.
- La suite Auth/RLS foundation pasó con fixtures Auth/DB temporales, concurrencia real y auditoría
  final de cero residuos.
- El finding de review sobre respuesta perdida quedó remediado con idempotencia persistente por
  `operation_id`, reconciliación obligatoria y compensación posterior a confirmar rollback.
- No se ejecutó el bootstrap persistente ni se creó un PLATFORM_ADMIN.
- TASK-005A obtuvo `TASK-005A REVIEW PASS`; ambos findings quedaron cerrados.
- TASK-005 no se cierra ni archiva; Fase A queda completada como checkpoint y Fase B queda lista
  para implementación.

## Migrations aplicadas en DEV

| Migration | Resultado |
| --- | --- |
| `20260922120000_add_user_email_and_platform_admins.sql` | PASS — email proyectado y tabla global. |
| `20260922121000_add_auth_access_helpers_and_policies.sql` | PASS — helpers, seis policies y grants mínimos. |
| `20260922122000_add_auth_platform_center_rpcs.sql` | PASS — RPCs, bootstrap e invariantes concurrentes. |
| `20260922123000_remove_unused_membership_lock_variable.sql` | PASS — corrección incremental posterior al DB lint; no reescribe historia. |
| `20260923100000_add_provisioning_idempotency.sql` | PASS — lifecycle privado, RPCs idempotentes y reconciliación cross-system. |
| `20260923120000_enforce_provisioning_intent_fingerprints.sql` | PASS — fingerprints autoritativas calculadas por PostgreSQL y binding de intención. |

Las seis migrations de TASK-005 están sincronizadas local/remoto; junto con las tres de TASK-004
forman nueve versiones. La cuarta reemplaza únicamente
`admin_set_center_membership` para eliminar una variable de lock no leída detectada por el linter.

## Objetos PostgreSQL

- `public.users.email`: `text NOT NULL`, lowercase/trim por CHECK, `UNIQUE`, backfill desde
  `auth.users` y fallo explícito ante identidad sin email o colisión normalizada.
- `public.platform_admins(user_id PK/FK -> public.users.id, created_at)` con RLS.
- Helpers `private` `SECURITY DEFINER`, `STABLE`, `search_path=''`, referencias calificadas y
  `EXECUTE` explícito: `is_platform_admin`, `has_active_center_membership`,
  `has_active_center_role`, `active_professional_center_id`, `can_administer_user` y
  `can_view_professional`.
- Policies SELECT: fila propia de plataforma; Center activo con membership activa; perfil propio o
  administrable; membership propia activa o administración del Center; ProfessionalCenter y
  Professional sólo para ADMIN/PROFESSIONAL aprobados. RECEPTION no obtiene esas lecturas.
- `anon`: ningún privilegio de dominio. `authenticated`: SELECT sólo en las seis tablas aprobadas y
  ninguna escritura directa. `platform_admins` no habilita bypass tenant.
- RPCs autenticadas: listado/resumen y resolución exacta de plataforma, alta de Center+primer ADMIN,
  activación/desactivación, resolución tenant, provisioning y modificación explícita de membership.
- RPC service-only: `bootstrap_platform_admin` one-shot con lock y precondición de plataforma vacía.
- `private.provisioning_operations`: lifecycle mínimo sin grants directos, payload hash, vínculo Auth,
  resultados confirmados y estados reconciliables; RPCs de lifecycle sólo para `service_role`.
- `pg_advisory_xact_lock` por Center compartido por creación/estado/membership. El último ADMIN no se
  puede desactivar o degradar; reactivar un Center exige ADMIN activo y desactivar conserva filas.

## Infraestructura server-side

- Cliente `src/lib/supabase/admin.ts`: `server-only`, `SUPABASE_SECRET_KEY`, sin persistencia,
  auto-refresh ni detección de URL; separado de browser/SSR.
- `src/proxy.ts` + helper SSR: refresh de cookies con `getClaims()` para Next.js 16.
- Primitives: `requireUser`, `requirePlatformAdmin`, `requireCenterMembership`, `requireRole` y
  `requireProfessionalContext`; consultan DB actual y rechazan Center/membership inactivos.
- Operaciones estrechas de plataforma/tenant y provisioning Auth/DB.
- Compensación: ante excepción DB primero toma el mismo lock de operación y reconcilia. Sólo elimina
  el Auth user creado por esa operación si confirma ausencia de commit; ante duda preserva Auth.
- Tooling manual one-shot con guard DEV exacto, confirmación exacta, preflight vacío, Auth confirmado,
  RPC, postcondición y compensación. No fue ejecutado.
- El chequeo de bundle exige `server-only` para cualquier referencia a secretos en `src` y valida
  centinelas sobre artefactos cliente.

## Tests y verificaciones ejecutadas

| Verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm auth:check:dev` | PASS; configuración efectiva verificada y fixtures Auth eliminados. |
| Dry-run + apply DEV de cada lote | PASS; project ref/región/PROD revalidados. |
| `supabase migration list --linked` | PASS; nueve migrations local/remoto sincronizadas. |
| `supabase/tests/auth-access-foundation.sql` | PASS; catálogo, helpers, policies y grants. |
| `pnpm db:test:schema:dev` | PASS; transacción revertida, concurrencia real y cleanup. |
| `pnpm db:test:auth-foundation:dev` | PASS; RLS/Auth, bootstrap temporal, provisioning, invariantes y concurrencia real. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS; response-loss, retry, payload conflict, compensación y mismo operation ID concurrente. |
| `supabase db lint --linked --schema public,private --level warning` | PASS; cero resultados finales. |
| Security advisors `--fail-on error` | PASS sin ERROR; siete WARN esperados por RPCs autenticadas `SECURITY DEFINER`. |
| `pnpm db:types` | PASS; tipos generados desde DEV. |
| `pnpm check` | PASS; 22 tests en 6 archivos. |
| `pnpm build` | PASS. |
| `pnpm security:check:client-bundle` | PASS. |
| `pnpm format:check` | PASS. |
| `git diff --check` | PASS; sólo advertencias de conversión LF/CRLF del entorno. |

La suite Auth Admin usa únicamente DEV, crea nueve identidades `@example.test`, prueba bootstrap
concurrente sin persistirlo, RLS por rol/centro, contadores, identidad global preservada, último ADMIN
concurrente y Center inactivo. El `finally` elimina las filas dependientes en orden referencial,
elimina exclusivamente las identidades creadas por la ejecución y luego verifica cero usuarios Auth,
Centers, Professionals y Specialties de fixture. La comprobación de configuración Auth crea como
máximo una identidad aceptada y también confirma su cleanup.

La suite de remediación usa el prefijo exclusivo `task005-remediation-*` y elimina además todas las
filas de `private.provisioning_operations`. La auditoría posterior confirmó cero Auth users,
`public.users`, Centers, memberships, PLATFORM_ADMIN y operaciones temporales.

## Configuración Auth efectiva

- `Allow new users to sign up`: OFF, verificado también con intento real de signup rechazado.
- `Minimum password length`: 10; una contraseña de 9 fue rechazada y una lowercase de 10 aceptada.
- `Password requirements`: sin requisito compositivo adicional.
- `Site URL`: `http://localhost:3000`.
- Redirect allowlist efectiva:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/update-password`
- Un redirect externo no configurado fue rechazado/reemplazado por la Site URL.
- `SUPABASE_SECRET_KEY`: existencia verificada sin exponerla; no existe uso `NEXT_PUBLIC_*` ni key
  legacy `service_role` en la implementación.

## Pendiente deliberado

- El bootstrap persistente del primer PLATFORM_ADMIN **no fue ejecutado**. Requiere autorización
  humana adicional explícita y no bloquea el review de la foundation Fase A.

## TASK-005A Review Remediation

### Estado reconciliado al retomar

La interrupción anterior ocurrió durante el análisis: no había archivos nuevos de remediación,
procesos activos ni migration parcial. DEV tenía las siete migrations anteriores sincronizadas,
cero fixtures/Auth users/PLATFORM_ADMIN y no existía todavía `provisioning_operations`. Se continuó
desde ese estado limpio sin revertir cambios válidos.

### Causa raíz

La orquestación anterior interpretaba cualquier excepción de la RPC como rollback y ejecutaba
`deleteUser` sin comprobar si PostgreSQL había confirmado antes de perderse la respuesta. Las RPCs
de Center, tenant y bootstrap tampoco recibían una identidad estable, por lo que un retry de Center
podía producir un segundo Center válido.

### Modelo de idempotencia

- El caller genera un UUID `operation_id` antes de iniciar Auth; los inputs server-side lo exigen y
  el bootstrap manual requiere `SUPABASE_BOOTSTRAP_OPERATION_ID` estable.
- Un hash SHA-256 canónico fija la intención sin persistir email, password ni payload de negocio.
- `private.provisioning_operations` conserva tipo, actor/scope UUID, vínculo Auth, estado e IDs de
  resultado. No tiene SELECT/DML para `anon`, `authenticated` ni acceso directo de `service_role`.
- Estados: `PENDING`, `AUTH_READY`, `SUCCEEDED`, `COMPENSATION_REQUIRED` y `COMPENSATED`.
- Toda RPC de negocio toma `pg_advisory_xact_lock` por operación. Resultado y `SUCCEEDED` confirman
  en la misma transacción; dos llamadas concurrentes terminan con un solo efecto y mismos IDs.
- El mismo ID con tipo, actor, scope o payload hash diferente falla con SQLSTATE `23514`.

### Reconciliación y compensación

La reconciliación service-only toma el mismo advisory lock, por lo que espera una llamada aún en
vuelo y luego observa su resultado definitivo. `SUCCEEDED` reconstruye el éxito y nunca borra Auth;
`AUTH_READY`/`PENDING` confirman que no hubo commit y habilitan compensar sólo el UUID marcado como
creado por la operación. Si reconciliar falla, el código retorna
`PROVISIONING_RECONCILIATION_REQUIRED`, conserva Auth y no concede acceso. Si `deleteUser` falla, la
operación queda `COMPENSATION_REQUIRED`; el Auth huérfano carece de perfil/membership y puede
reintentarse con el mismo ID. Las identidades preexistentes nunca entran al delete.

El bootstrap aplica exactamente el mismo protocolo y es idempotente para su operation ID. No se
ejecutó el bootstrap persistente.

### Evidencia integrada

La suite nueva usa Auth y PostgreSQL reales de DEV con cleanup en `finally` y cubre:

- commit real + respuesta simuladamente perdida → reconciliación `SUCCEEDED`;
- retry Center y bootstrap → mismos IDs, sin recursos duplicados;
- dos transacciones concurrentes con el mismo operation ID → una espera y un único Center/ADMIN;
- operation ID reutilizado con payload incompatible → rechazo;
- rollback confirmado → delete Auth real + `COMPENSATED`;
- delete Auth controladamente fallido → `COMPENSATION_REQUIRED`, Auth huérfano y cero acceso;
- fallo DB con identidad preexistente → Auth preservado;
- retry tenant → una sola membership;
- cleanup final → cero Auth users, filas de dominio y operaciones temporales.

## Desviaciones

- Se agregó una cuarta migration incremental por una advertencia de DB lint; las migrations ya
  aplicadas permanecieron inmutables y no cambió el diseño.
- Los advisors emiten siete WARN genéricos porque las RPCs autenticadas son `SECURITY DEFINER`; es
  intencional y aprobado. Cada RPC revalida `auth.uid()`, fija `search_path=''`, retorna el mínimo y
  tiene grants por firma.
- La primera ejecución de la suite Auth completó las aserciones funcionales pero falló correctamente
  el comando por un orden de cleanup incompatible con la FK membership → ProfessionalCenter. No hubo
  cambio de schema. El runner se corrigió, la siguiente ejecución retiró exactamente nueve fixtures
  residuales de ese intento y las ejecuciones finales pasaron con auditoría de cero residuos.
- Riesgo remanente conocido: los siete WARN de advisors deben seguir tratándose como intencionales;
  cualquier RPC futura exige la misma revisión de autenticación interna y grants por firma.
- Fase B deberá generar y conservar el `operation_id` mientras un submit pueda reintentarse. Cambiar
  el UUID entre retries representa una operación nueva y anula deliberadamente la idempotencia.
- La tabla privada conserva operaciones reales confirmadas para reconciliación; una política de
  retención puede definirse más adelante, sin borrar registros mientras exista una ventana de retry.

No se modificó `review.md`. No hubo commit, push ni PR.

## TASK-005A Second Review Remediation

### Estado

Los dos findings abiertos del segundo review quedaron corregidos exclusivamente dentro de Fase A.
En ese punto la implementación no avanzó a TASK-005B, no ejecutó el bootstrap persistente y quedó
`TASK-005A READY_FOR_RE-REVIEW`; el re-review posterior otorgó `TASK-005A REVIEW PASS`.

### Fingerprint de intención bajo autoridad PostgreSQL

La causa raíz era que las RPCs de negocio comparaban dos valores controlados por el caller: el
`p_payload_hash` recibido y el hash persistido durante `prepare`. La DB nunca demostraba que ese hash
representara los argumentos que finalmente ejecutaba.

La migration incremental
`20260923120000_enforce_provisioning_intent_fingerprints.sql` reemplaza ese contrato:

- tres RPCs service-only de preparación reciben los argumentos materiales y PostgreSQL construye un
  `jsonb` canónico explícito y calcula SHA-256 mediante `extensions.digest`;
- la creación de Center incluye tipo, actor, scope nulo, email Auth normalizado, nombres del ADMIN y
  nombre/teléfono/email/dirección/timezone del Center;
- el provisioning tenant incluye tipo, actor, Center/scope, email Auth normalizado, nombres, role y
  `professional_center_id`;
- el bootstrap incluye tipo, actor/scope nulos, email Auth normalizado y nombres;
- `lower(btrim(email))`, `btrim` de nombres/campos persistidos y `NULL` explícito para opcionales son
  las únicas normalizaciones; no entran timestamps, orden incidental de claves ni IDs generados;
- el UUID Auth, desconocido al preparar una identidad nueva, permanece ligado por las columnas
  `auth_user_id`/`auth_user_was_created` y se verifica separadamente en cada RPC de negocio;
- las RPCs de negocio ya no reciben `p_payload_hash`: leen el email real desde `auth.users`,
  recalculan la fingerprint desde sus propios argumentos más actor/scope confiables y rechazan
  diferencias con SQLSTATE `23514` antes de devolver un retry exitoso o producir un efecto;
- el mismo `operation_id` con la misma intención sigue devolviendo el mismo resultado, mientras que
  reutilizarlo con otra intención falla en la preparación y también en la frontera de negocio.

Los helpers privados de fingerprint no tienen `EXECUTE` para `PUBLIC`, `anon`, `authenticated` ni
`service_role`. Las tres preparaciones son `SECURITY DEFINER`, `search_path=''` y sólo ejecutables por
`service_role`. `private.provisioning_operations` conserva cero grants directos y no se agregaron
lecturas, bypass de plataforma ni cambios al aislamiento tenant/último ADMIN.

### Fault injection sobre la orquestación real

`src/modules/access/server/provisioning.ts` expone un harness de test de código, inaccesible desde
requests, payloads, headers o variables de cliente y bloqueado salvo `NODE_ENV=test`. La producción
sigue usando dependencias cerradas. El harness permite únicamente sustituir el cliente Admin y
colocar hooks internos después del retorno de persistencia, antes de reconciliar o al borrar la
identidad Auth.

La suite dedicada `pnpm db:test:provisioning-orchestration:dev` importa y ejecuta las funciones
reales `createCenterWithFirstAdmin` y `provisionCenterUser` contra Auth/PostgreSQL DEV:

- la RPC hace COMMIT real, el hook descarta su resultado y lanza, el `catch` real reconcilia
  `SUCCEEDED`, preserva Auth y reconstruye el resultado;
- el retry con el mismo `operation_id` devuelve los mismos IDs, con un único Center/ADMIN y una única
  membership tenant;
- timezone inválida fuerza rollback PostgreSQL real; la reconciliación confirma ausencia y sólo el
  Auth creado por esa operación se elimina, dejando `COMPENSATED`;
- un fallo inyectado de reconciliación retorna `PROVISIONING_RECONCILIATION_REQUIRED`, preserva Auth
  y no intenta delete;
- un fallo inyectado de delete deja Auth huérfano sin perfil/acceso y estado
  `COMPENSATION_REQUIRED`;
- una identidad preexistente sometida a fallo DB no se elimina y conserva sus nombres globales.

La inyección existe sólo como dependencia interna del runner Vitest dedicado. No hay flags de
producción ni una superficie activable por el cliente.

### Pruebas negativas y concurrencia

`pnpm db:test:provisioning-reconciliation:dev` reproduce directamente el bypass reportado: después
de registrar una intención, invoca las RPCs con cambios independientes en nombre/dirección/teléfono/
email de Center, nombres del primer ADMIN, nombres del bootstrap, email tenant, role,
ProfessionalCenter y scope. Todos los cambios son rechazados antes de efectos; la intención idéntica
completa y reintenta correctamente. Dos ejecuciones concurrentes con el mismo `operation_id` siguen
serializadas por el advisory lock y producen exactamente un Center y una membership ADMIN.

### Verificación y cleanup

- `pnpm bootstrap`: PASS.
- `pnpm supabase:check:dev`: PASS contra `ehllxymqyzrofydrvtzo`.
- migration dry-run/aplicación/migration sync: PASS; nueve versiones local/remoto sincronizadas.
- `pnpm db:test:schema:dev`: PASS.
- `pnpm db:test:auth-foundation:dev`: PASS.
- `pnpm db:test:provisioning-reconciliation:dev`: PASS con argumentos alterados y concurrencia.
- `pnpm db:test:provisioning-orchestration:dev`: PASS con Auth/DB/catch/reconcile reales.
- `pnpm auth:check:dev`: PASS y cleanup verificado.
- `pnpm db:types`: PASS; firmas regeneradas desde DEV.
- DB lint `public,private`: PASS, cero errores.
- Security advisors: PASS sin ERROR; permanecen los mismos siete WARN intencionales de RPCs
  autenticadas `SECURITY DEFINER`.
- `pnpm format:check`, `pnpm check`, `pnpm build`, `pnpm security:check:client-bundle` y
  `git diff --check`: PASS.

Cada suite remota elimina en `finally` los Auth users, perfiles, Centers, memberships,
PLATFORM_ADMIN y operaciones que crea. La auditoría final confirmó cero fixtures de todos esos
tipos y cero procesos de test.

El primer intento de aplicar la migration nueva falló dentro de su transacción por haber calificado
`NULLIF` con `pg_catalog`; PostgreSQL revirtió el lote completo y no registró la versión. Se corrigió
antes de la primera aplicación efectiva, se repitió el dry-run y luego se aplicó con éxito. Ninguna
migration aplicada fue reescrita.

PROD permaneció fuera de alcance. No se mostró el secreto, no se ejecutó bootstrap persistente y no
hubo commit, push ni PR.

## Checkpoint formal de Fase A

- Review independiente final: `TASK-005A REVIEW PASS`.
- Findings ALTO y MEDIA: cerrados.
- Estado final de Fase A: `TASK-005A COMPLETED`.
- Siguiente gate: `TASK-005B READY_FOR_IMPLEMENTATION`.
- TASK-005 completa permanece activa en el Harness y no se archiva.
- Supabase DEV: `ehllxymqyzrofydrvtzo`; PROD fuera de alcance.
- Seis migrations de TASK-005 y tres de TASK-004 sincronizadas local/remoto.
- Cero fixtures, cero PLATFORM_ADMIN persistentes y ningún secreto versionado.
- El bootstrap persistente del primer PLATFORM_ADMIN continúa sin ejecutarse.
