# TASK-005 — Implementation Report — Fase A

**Estado:** `TASK-005A COMPLETED` · `TASK-005B1 COMPLETED` · `TASK-005B2 COMPLETED`

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

## TASK-005B2 — Platform Admin

**Estado:** `TASK-005B2 COMPLETED`

**Alcance:** `/platform` funcional para listar Centers, consultar metadata/contadores agregados,
crear Center + primer ADMIN y activar/desactivar Center. La administración general de usuarios y
memberships tenant queda fuera de B2 y se mantiene para TASK-005B3.

### Preflight y límites

- Baseline inicial confirmado: branch `task/005-auth-users-center-access`, HEAD
  `1c90881dab31ea5f9811057a012c8af664b59e33` y working tree limpio antes de bootstrap.
- `pnpm bootstrap`, guard de secret moderna y `pnpm supabase:check:dev`: PASS contra DEV
  `ehllxymqyzrofydrvtzo`.
- `SUPABASE_SECRET_KEY` no se mostró ni imprimió; la key legacy permaneció ausente y el archivo local
  continuó ignorado.
- PROD, bootstrap persistente, PLATFORM_ADMIN persistente, migrations, commit, push, PR, cierre y
  archivo de TASK-005 permanecieron fuera de alcance.
- No se modificaron migrations, RLS, grants, RPCs ni tipos generados. B2 consume la foundation A sin
  ampliar permisos.

### Rutas, componentes y listado

- `/platform` reemplaza el placeholder B1 por un panel responsive, server-rendered y protegido al
  comienzo con `requirePlatformAdmin()`.
- El encabezado incluye identidad de sesión, `Crear centro`, navegación tenant independiente sólo si
  la misma identidad ya posee memberships y logout local.
- `loading.tsx` agrega estado de carga sin adelantar datos.
- `PlatformCentersTable` consume exclusivamente `platform_list_centers` mediante
  `listPlatformCenters`; no descarga datasets de memberships, Professionals ni Specialties.
- La tabla muestra exactamente Centro, Estado, Dirección, Teléfono, Email, Fecha de alta, Usuarios,
  Profesionales, Especialidades y Acciones; en pantallas chicas usa scroll horizontal.
- Badges Activo/Inactivo, fallbacks de metadata vacía y estado inicial
  `Todavía no hay centros creados.` con acción `Crear centro` quedaron implementados.
- Los contadores conservan la semántica DB aprobada: memberships activas, ProfessionalCenter
  activos y Specialty activas. El E2E confirmó `Usuarios = 1` inmediatamente después del alta.

### Alta Center + primer ADMIN

- El formulario usa resolución exacta server-side mediante `platform_resolve_user_by_email`; la UI
  sólo recibe existencia y el email normalizado, no otros Centers, roles o memberships.
- Identidad nueva: solicita nombre, apellido y contraseña inicial de mínimo 10 caracteres; Auth se
  crea confirmado mediante el orchestration aprobado.
- Identidad existente: no renderiza password, vuelve a resolver en servidor y usa los nombres
  autoritativos sólo para fijar la intención. No acepta nombres/password enviados por el cliente ni
  modifica email, credenciales, perfil o memberships previas.
- Center valida con Zod nombre, contactos opcionales y timezone IANA explícita; el default visible es
  `America/Argentina/Buenos_Aires`.
- La Server Action empieza reautorizando PLATFORM_ADMIN, valida runtime, resuelve identidad y llama
  `createCenterWithFirstAdmin(...)` con el cliente SSR del actor. Después de éxito revalida
  `/platform`; no inicia sesión como el nuevo ADMIN.
- La UX distingue validación, creación confirmada, éxito confirmado por retry, estado ambiguo o
  reconciliable y error genérico sin exponer causas internas.

### Lifecycle real de `operation_id`

1. El Client Component espera la hidratación, busca primero una intención versionada en
   `sessionStorage` y sólo genera un UUID v4 si no existe una pendiente. Un refresh con intención A
   no genera ni adopta un UUID B.
2. La clave de storage queda namespaced por el UUID del PLATFORM_ADMIN autenticado. El snapshot
   contiene versión, scope, actor, `operation_id` y el payload material no secreto: Center, email
   del ADMIN, nombres de una identidad nueva y el resultado de resolución. Se valida por completo
   con Zod al leer y antes de escribir; ningún dato de un snapshot inválido se usa parcialmente.
3. El snapshot se escribe sincrónicamente antes del POST. Si `sessionStorage` no está disponible, el
   submit se bloquea y no sale al servidor. Rerender, submit, error transitorio, response-loss y
   refresh conservan el mismo UUID.
4. Una intención recuperada muestra `Hay una creación de centro pendiente de confirmar`, reconstruye
   el payload y bloquea los campos materiales. `Reintentar / verificar` vuelve a enviar el UUID A;
   PostgreSQL conserva la fingerprint autoritativa y rechaza cualquier payload diferente.
5. La contraseña inicial nunca integra el snapshot ni otra persistencia. Después del refresh queda
   vacía. Si la operación ya confirmó o ya vinculó Auth, A reconcilia usando A sin password; si Auth
   todavía necesita crear la identidad, la Action conserva A y solicita ingresar la contraseña otra
   vez.
6. Éxito inequívoco o rollback inequívoco retiran un snapshot válido. `Crear otro centro`,
   `Iniciar una nueva alta` y `Abandonar e iniciar nueva alta` son decisiones explícitas: eliminan A
   del storage, desmontan sus datos y generan un UUID nuevo. Un snapshot inválido sólo puede
   retirarse mediante el abandono explícito; desmontar o refrescar por sí solo nunca lo limpia.
7. El UUID, el snapshot y el indicador de retry nunca autorizan: `/platform`, resolución, alta y
   cambio de estado revalidan PLATFORM_ADMIN en servidor; el UUID continúa validándose como UUID.

La estrategia elegida fue `sessionStorage` porque cubre la frontera exigida de refresh dentro de la
pestaña sin enviar metadata a cookies/URL/servidor ni persistir secretos. Su alcance deliberado es la
sesión de esa pestaña; el submit falla cerrado cuando el navegador no permite conservar el snapshot.

### Remediación B2-F1 — response-loss + refresh

- Causa raíz: `page.tsx` generaba un UUID nuevo en cada render de servidor y el hook anterior sólo
  conservaba el valor en `useState`. Tras COMMIT real y respuesta perdida, el refresh destruía A y
  presentaba B antes de poder reconciliar.
- `/platform` ya no genera el UUID en servidor. `usePlatformOperationIntent` recupera A antes de
  crear un fallback y mantiene en memoria el resultado recuperado aun después de retirar la copia
  persistida por un éxito, para poder mostrar la confirmación hasta que el usuario elija otra alta.
- El payload bloqueado no incluye `adminInitialPassword`; el schema durable rechaza propiedades
  extra antes de serializar. No se usa `localStorage`, IndexedDB, cookie, URL, DB, archivo ni log.
- El retry recuperado transporta un flag validado únicamente para UX. No concede permisos. Permite
  que la orquestación A inspeccione una operación que ya tenga Auth/COMMIT sin exigir una password
  ausente; un `AUTH_CREATE_FAILED` conserva el mismo UUID y devuelve un error de campo para pedirla.
- El E2E deja terminar el POST upstream 200 y su COMMIT, reemplaza sólo la respuesta al browser por
  una 503, verifica la fila `SUCCEEDED`, refresca realmente `/platform`, recupera el UUID A, comprueba
  campos materiales `readonly` y password vacía, reintenta y confirma exactamente un Center, una
  membership ADMIN y una operación. Inspecciona `sessionStorage`, `localStorage`, cookies, URL y
  consola para excluir la password.

### Segunda remediación B2-F1 — snapshot inválido fail-closed

- Causa raíz restante: la lectura anterior devolvía `null` tanto para ausencia real como para
  JSON/schema inválidos y, ante el segundo caso, ejecutaba `sessionStorage.removeItem(...)`. El
  inicializador no podía distinguir ambos estados y generaba automáticamente B.
- La lectura ahora produce un resultado discriminado `ABSENT | VALID | INVALID`. Sólo `ABSENT`
  habilita una intención nueva; `VALID` recupera A; `INVALID` conserva el contenido durable intacto,
  no extrae `operation_id`, actor ni payload, no invoca el generador UUID y no monta el formulario.
- JSON malformado, versión desconocida, campos faltantes, UUID inválido, actor/scope inconsistentes,
  payload inválido y excepción al leer storage quedan todos en `INVALID`. Refreshes repetidos
  permanecen bloqueados y no convierten el estado en ausencia.
- La UI explica que existe una creación pendiente no recuperable de forma segura y ofrece una sola
  salida mutante: `Abandonar intención pendiente e iniciar una nueva alta`. Esa acción separada
  elimina el snapshot y genera B sólo si la eliminación fue efectiva; si storage falla, continúa
  bloqueada.
- El schema durable liga la intención a versión, scope y actor completos además del payload material.
  Storage no autoriza: todas las Actions conservan `requirePlatformAdmin()` y toda entrada server-side
  sigue validándose. La password continúa excluida del snapshot y de cualquier persistencia.
- El E2E exacto completa Auth + PostgreSQL con A, deja que upstream responda 200, entrega 503 al
  browser, agrega una propiedad inesperada al snapshot y refresca dos veces. En ambos refreshes confirma UI bloqueada,
  contenido inválido sin auto-delete, ausencia de un input/UUID B y exactamente un Center, una
  membership ADMIN y una operación. Recién tras el abandono explícito aparece B, distinto de A, sin
  ejecutar un segundo provisioning.

### Tercera remediación B2-F1 — schemas cerrados y barrier E2E

- `platformCenterIntentPayloadSchema` y `persistedPlatformOperationIntentSchema` ahora usan
  validación Zod estricta. La raíz acepta exclusivamente versión, scope, actor, operation ID y
  payload; el payload anidado acepta exclusivamente sus nueve campos materiales. Una propiedad
  desconocida en cualquiera de esos niveles produce `INVALID` en vez de ser eliminada.
- Los tests prueban por separado `extraField` en la raíz y dentro del payload. En ambos casos el
  snapshot queda byte-for-byte intacto en `sessionStorage`, no se invoca el generador UUID, no existe
  `operationId` disponible para montar provisioning y el estado continúa bloqueado tras remount. Una
  propiedad `adminInitialPassword` inyectada también se rechaza sin escritura durable.
- Los dos interceptores response-loss comparten una barrera explícita. El handler ejecuta
  `route.fetch()`, exige upstream 200, espera `route.fulfill(503)` y sólo entonces resuelve
  `browserResponseDelivered`; el test espera esa Promise antes de consultar/refrescar. No se usan
  sleeps como sincronización.
- El teardown espera además cualquier trabajo de route ya iniciado antes del cleanup, evitando que
  una operación tardía compita con el borrado de fixtures. El cleanup continúa limitado a UUIDs,
  actores, emails y nombres con namespace exclusivo de esta ejecución.
- El escenario inválido usa ahora JSON completo con una propiedad extra en la raíz: COMMIT real con
  A, upstream 200, 503 entregado, refresh, UI `INVALID`, cero B y conteos 1/1/1; sólo el abandono
  explícito crea B.
- La suite oficial final se ejecutó dos veces consecutivas con el código definitivo: 8/8 + 8/8,
  ambas con cleanup cero y sin `Route is already handled`.

### Activar y desactivar

- `CenterStatusForm` solicita confirmación nativa explícita, deshabilita el botón durante submit y
  muestra el resultado junto a la acción.
- La Server Action reautoriza PLATFORM_ADMIN y usa exclusivamente `platform_set_center_active`
  mediante el wrapper aprobado.
- Desactivar cambia sólo `centers.is_active`; el E2E confirmó que la membership ADMIN continúa
  activa pero el tenant queda sin acceso.
- Reactivar restaura el acceso tenant cuando existe ADMIN activo. El error de PostgreSQL por ausencia
  de ADMIN se convierte en un mensaje seguro y no expone SQL.

### Autorización y fronteras

- PLATFORM_ADMIN explícito: panel permitido.
- ADMIN, RECEPTION y PROFESSIONAL tenant sin `platform_admins`: `PLATFORM_FORBIDDEN`.
- Identidad autenticada común: panel denegado.
- La autorización no depende de botones, estado React, fields hidden, client-side role, proxy ni
  `operation_id`.
- Ningún Client Component importa Admin Supabase ni secretos. `/platform` no consulta ni enlaza
  patients, persons, patient_centers, appointments, agenda, notes o availabilities.
- PLATFORM_ADMIN continúa sin membership implícita ni bypass tenant; el E2E confirmó 404 en una ruta
  tenant sin membership.

### Tests B2

- Schemas: timezone IANA válida/inválida, default aprobado, password de 9/10 caracteres y rechazo
  estricto de propiedades desconocidas en root y payload durable anidado.
- Autorización: PLATFORM_ADMIN permitido; ADMIN, RECEPTION, PROFESSIONAL y usuario común denegados.
- Componentes: estado vacío, acción de alta, metadata, badges y los tres contadores aprobados.
- Actions: reautorización previa, alta con identidad nueva, identidad existente con datos del cliente
  ignorados, retry con mismo UUID y estado confirmado.
- Hook de intención: rerender conserva UUID; unmount/remount recupera el snapshot; éxito lo retira;
  abandonar explícitamente genera otro UUID; propiedades password se eliminan antes de persistir.
  La suite diferencia storage vacío y snapshot válido de JSON corrupto, versión desconocida,
  campos faltantes, UUID, actor, scope y payload inválidos, propiedades extra en root/payload y error
  de lectura; todos los casos `INVALID` bloquean, sobreviven al remount y no invocan el generador
  hasta el abandono explícito.
- Actions: un retry recuperado puede reconciliar sin password persistida; si Auth aún la necesita,
  conserva el mismo UUID y la solicita nuevamente.
- `pnpm test:e2e:platform-admin:dev`: PASS 8/8 con Auth/PostgreSQL DEV reales:
  - login PLATFORM_ADMIN y listado vacío;
  - Center + ADMIN nuevo, metadata, un único Center/ADMIN y `Usuarios = 1`;
  - desactivar → Inactivo → tenant DENY, membership conservada;
  - reactivar → Activo → tenant permitido;
  - ADMIN tenant y usuario común → `/platform` DENY;
  - identidad existente reutilizada sin password en UI y con password/email/nombres/membership
    previa verificados sin cambios.
  - COMMIT real + response-loss HTTP + refresh real + recuperación de A + retry/reconciliación, con
    exactamente un Center, una membership ADMIN y una operación `SUCCEEDED`.
  - COMMIT real + response-loss HTTP + snapshot inválido + dos refreshes reales, sin B ni nuevo
    provisioning; abandono explícito posterior como único punto que elimina el snapshot y crea B.
- La suite captura el `operation_id` enviado por UI, comprueba una única operación `SUCCEEDED` y un
  único `result_center_id`, y verifica que `Crear otro centro` produce un UUID diferente.

### Verificación final

| Verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS. |
| `pnpm supabase:check:dev` | PASS contra DEV aprobado. |
| `pnpm db:test:schema:dev` | PASS con concurrencia real. |
| `pnpm db:test:auth-foundation:dev` | PASS; ambos advisory locks observados por PID backend real, RLS/roles/último ADMIN y cleanup cero. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS; response-loss/retry/fingerprints/cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS; orchestration y fault injection test-only reales. |
| `pnpm auth:check:dev` | PASS; signup/password/redirects y cleanup. |
| `pnpm test:e2e:auth-access:dev` | PASS 9/9; login/logout, 0/1/N, isolation y recovery/update. |
| `pnpm test:e2e:platform-admin:dev` | PASS 8/8 + 8/8 consecutivos; barrier 503, response-loss + refresh válido/strict-invalid, abandono explícito y cleanup cero. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS; lint, typecheck y 77/77 tests en 13 archivos. |
| `pnpm build` | PASS; `/platform` dinámica compilada. |
| `pnpm security:check:client-bundle` | PASS. |
| `git diff --check` | PASS; sólo avisos informativos LF/CRLF. |

### Cleanup y desviaciones

- Cada suite remota eliminó en `finally` sus filas dependientes, profiles, Auth users, Centers,
  memberships, PLATFORM_ADMIN y `private.provisioning_operations`.
- Auditoría B2 final: 0 Auth fixtures, 0 `public.users`, 0 Centers, 0 memberships, 0
  PLATFORM_ADMIN, 0 provisioning operations y ningún proceso E2E persistente.
- El primer regression run de provisioning detectó que una versión intermedia de B2 había agregado
  metadata UX al retorno de `createCenterWithFirstAdmin`. Se retiró ese cambio y el contrato exacto
  de Fase A volvió a pasar; el estado “confirmado por retry” vive ahora sólo en la Server Action.
- El E2E B1 esperaba literalmente el placeholder retirado. Se actualizó únicamente esa aserción al
  panel funcional y el rerun completo pasó 9/9.
- El primer run del nuevo probe encontró que retirar el snapshot también desmontaba prematuramente el
  mensaje de éxito recuperado. Se separó limpieza durable de estado visual en memoria; el rerun
  completo pasó 7/7 y cleanup cero.
- El fallo 3/3 de `db:test:auth-foundation:dev` informado por review se reprodujo en DEV limpio con
  cleanup cero. La propiedad DB seguía operativa: la fragilidad estaba en identificar la sesión
  bloqueada por `application_name` a través del pooler. El harness ahora captura
  `pg_backend_pid()` dentro de cada transacción abierta y observa en `pg_locks` el advisory lock no
  concedido para ese PID; mantiene además las aserciones funcionales. El rerun final observó ambos
  waits y pasó con cleanup cero, sin cambios de DB.
- Durante la repetición E2E, dos corridas intermedias completaron sin error ambos response-loss pero
  fallaron después en la comprobación tenant tras reactivar. La prueba esperaba sólo el texto UI y
  volvía a una URL previamente redirigida. Se agregó una barrera de lectura DB para
  `centers.is_active = true` y una URL de navegación única; con el código final pasaron dos corridas
  completas consecutivas 8/8 y ambos cleanup terminaron en cero.
- La primera regresión B1 terminó 8/9 por una lectura transitoria de `input.validity` en update
  password, sin diff en ese componente; cleanup quedó en cero y el rerun limpio pasó 9/9.
- Riesgo residual explícito: `sessionStorage` garantiza refresh en la misma pestaña, no recuperación
  tras cerrar deliberadamente la pestaña/sesión del browser. Ante lectura o escritura bloqueada la
  UI falla cerrada; el abandono requiere que storage vuelva a permitir la eliminación. Permanecen
  además SMTP DEV/rate limiting pre-PROD y retención futura de operaciones.

No se modificó `review.md`. No hubo bootstrap persistente, migration, commit, push, PR, cierre ni
archivo de TASK-005.

## TASK-005B1 — Auth UI and Center Access

**Estado:** `TASK-005B1 COMPLETED`

**Alcance:** login/logout, recovery, callback PKCE, actualización de contraseña, resolución 0/1/N,
selector de Center, shell tenant mínimo y placeholder temporal protegido para PLATFORM_ADMIN. B2
(`/platform` funcional y administración de usuarios) permanece fuera de alcance.

### Preflight y límites

- Branch/HEAD iniciales confirmados: `task/005-auth-users-center-access` en
  `9c81e0fc03f4bf3ee4fd1e1a9b0d026e2584e889`, working tree limpio antes de bootstrap.
- `pnpm bootstrap` y `pnpm supabase:check:dev`: PASS contra DEV `ehllxymqyzrofydrvtzo`.
- PROD no fue consultado ni modificado; no se aplicaron ni editaron migrations.
- No se ejecutó bootstrap persistente, no se creó un PLATFORM_ADMIN persistente y no se invocaron
  primitives de provisioning. El contrato `operation_id` de Fase A quedó intacto.
- El guard de secretos no imprimió valores. El cliente administrativo continúa fuera del código
  cliente y el E2E sólo lo usa para crear/eliminar identidades Auth temporales.

### Rutas y flujo implementado

- `/login`: email/password, Zod server-side, `signInWithPassword`, error genérico, estado pending,
  labels y navegación a recovery. Una sesión existente se resuelve inmediatamente al destino
  autorizado.
- `/`: landing server-side que resuelve el contexto actual.
- `/no-access`: sólo para identidad autenticada sin PLATFORM_ADMIN ni Center accesible; no lista
  memberships históricas o Centers inactivos e incluye logout.
- `/select-center`: lista exclusivamente Centers activos alcanzables por memberships activas del
  usuario, con nombre y rol. Con cero o una opción redirige al destino canónico.
- `/centers/[centerId]`: usa `requireCenterMembership(centerId)`, muestra Center, cuenta, rol y
  logout. ID inválido o Center no autorizado retorna 404 sin filtrar nombre o existencia.
- `/platform`: placeholder mínimo protegido con `requirePlatformAdmin()`. Informa que B2 habilitará
  la administración; no lista/crea/modifica Centers ni concede acceso tenant.
- `/forgot-password`: validación de email y `resetPasswordForEmail` con callback exacto
  `http://localhost:3000/auth/callback`; el resultado público siempre es anti-enumeración.
- `/auth/callback`: intercambio SSR/PKCE mediante `exchangeCodeForSession`, validación de `code`,
  error seguro y destino allowlisted exclusivamente a `/update-password`.
- `/update-password`: exige sesión válida, valida nueva contraseña y confirmación (mínimo 10), usa
  `updateUser` y vuelve a la resolución normal de acceso.

La resolución aprobada quedó centralizada en `src/modules/access/server/access.ts` y
`src/modules/access/domain/access-routing.ts`:

```text
1 Center accesible  → /centers/[centerId]
N > 1               → /select-center
0 + PLATFORM_ADMIN  → /platform (placeholder B1)
0 sin permiso global → /no-access
```

Un PLATFORM_ADMIN con memberships conserva el flujo tenant 1/N, pero cada ruta vuelve a exigir su
membership. El permiso global nunca satisface `requireCenterMembership`.

### UI y fronteras de seguridad

- Formularios en español, responsive básico, foco inicial, autocomplete, labels, errores asociados,
  `aria-invalid`, mensajes `alert/status` y botones disabled con texto pending.
- No se agregó signup, localStorage, preferencia de Center, cambio de email ni módulos operativos.
- Los Client Components importan únicamente Actions/tipos y configuración pública; no hay secret ni
  admin client en el bundle.
- Las Server Actions sensibles vuelven a autenticar/autorizar. El proxy sólo refresca cookies y no
  reemplaza los guards.
- Logout usa `signOut({ scope: "local" })`; el E2E confirmó que `/` vuelve a `/login` después del
  cierre.

### Tests B1

- Unitarios: login inválido/válido, logout, recovery anti-enumeration, password menor a 10,
  password válida, rutas 0/1/N, inactivos ignorados, callback sin open redirect y PLATFORM_ADMIN
  sin bypass tenant.
- Test directo de la primitive real `requireCenterMembership`: permite A, deniega B, membership
  inactiva, Center inactivo y PLATFORM_ADMIN sin membership.
- `pnpm test:e2e:auth-access:dev`: PASS, 9/9 en Chromium contra Auth/RLS DEV reales:
  login inválido/válido, cookie SSR, usuario autenticado fuera de login, logout, 0/1/2 Centers,
  selección, cross-center 404, inactivos, recovery genérico, callback inválido, PLATFORM_ADMIN
  temporal sin acceso tenant y update password real con re-login usando la nueva contraseña.
- Fixtures E2E: cinco Auth users `task005b1-*`, tres Centers y memberships temporales. Setup y
  cleanup usan el guard exacto de DEV y PostgreSQL de test; `afterAll` verificó cero Auth users,
  perfiles y Centers residuales. El PLATFORM_ADMIN existió únicamente durante la suite.

### Verificación final

| Verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm db:test:schema:dev` | PASS. |
| `pnpm db:test:auth-foundation:dev` | PASS; cleanup cero. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS; cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS. |
| `pnpm auth:check:dev` | PASS; signup OFF, password/redirects y cleanup. |
| `pnpm test:e2e:auth-access:dev` | PASS — 9/9 y cleanup cero. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS — 40 tests en 9 archivos. |
| `pnpm build` | PASS — rutas B1 compiladas. |
| `pnpm security:check:client-bundle` | PASS. |
| `git diff --check` | PASS; sólo avisos informativos LF/CRLF. |

### Desviaciones y decisiones encontradas

- No fue necesario ningún cambio de DB ni migration.
- El placeholder `/platform` es deliberadamente informativo y server-protected; no implementa el
  panel B2.
- El E2E no puede usar DML directo con la secret key moderna porque los grants de Fase A lo impiden
  correctamente. Sus fixtures DB usan la conexión PostgreSQL DEV validada, igual que las suites
  aprobadas, y la secret key queda limitada a Auth Admin temporal.
- Next.js exige que un archivo `"use server"` exporte sólo funciones async. El estado inicial de los
  formularios quedó en Client Components; las Actions no exportan objetos.
- No se modificó `review.md`. No hubo commit, push, PR, cierre ni archivo de TASK-005.

### Checkpoint formal de B1

- Review independiente final: `TASK-005B1 REVIEW PASS`.
- Estado final de B1: `TASK-005B1 COMPLETED`.
- Siguiente gate: `TASK-005B2 READY_FOR_IMPLEMENTATION`.
- TASK-005 completa permanece activa en el Harness y no se archiva.
- El diff B1 desde `9c81e0fc03f4bf3ee4fd1e1a9b0d026e2584e889` no modifica DB, migrations,
  RLS, grants, RPCs ni tipos generados.
- Supabase DEV: `ehllxymqyzrofydrvtzo`; PROD fuera de alcance.
- Cero fixtures, cero PLATFORM_ADMIN persistentes y ningún secreto versionado.
- El bootstrap persistente del primer PLATFORM_ADMIN continúa sin ejecutarse.

## Checkpoint formal de B2

- Review independiente final: `TASK-005B2 REVIEW PASS`.
- Los dos findings de B2 quedaron cerrados.
- Estado final: `TASK-005B2 COMPLETED`.
- El detalle completo de implementación y verificación B2 está registrado en la sección
  `TASK-005B2 — Platform Admin` de este reporte.
- TASK-005 completa permanece activa y no se cierra ni archiva; TASK-005B3 no fue iniciada.
- Supabase DEV: `ehllxymqyzrofydrvtzo`; PROD permaneció fuera de alcance.
- Nueve migrations continúan sincronizadas local/remoto; B2 no modificó schema, migrations, RLS,
  grants, RPCs ni tipos generados.
- Cero fixtures, cero Auth users temporales, cero PLATFORM_ADMIN persistentes y cero operaciones de
  provisioning temporales.
- Ningún secreto fue versionado.
- No hubo bootstrap persistente, migration, commit, push ni PR.
