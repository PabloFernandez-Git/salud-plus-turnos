# Review — TASK-005A Auth, RLS y Platform Foundation

**Rol:** Reviewer / Verifier independiente + Database/RLS Reviewer + Security Reviewer

**Fecha:** 2026-09-22; re-reviews focalizados 2026-09-23

**Branch verificada:** `task/005-auth-users-center-access`

**Base:** `main` / `7bf1aa3d50b31d7ce420c805af60fe5b9c2ce01d`

**Destino remoto verificado:** Supabase DEV `ehllxymqyzrofydrvtzo`, `sa-east-1`,
`ACTIVE_HEALTHY`, linkeado. La CLI sólo mostró este proyecto DEV. PROD permaneció fuera de alcance.

**Resultado:** `TASK-005A REVIEW PASS`

**Alcance del veredicto:** exclusivamente Fase A. TASK-005 completa no se cierra ni se archiva y no
se avanzó a TASK-005B.

## Segundo re-review focalizado — 2026-09-23

### Veredicto

`TASK-005A REVIEW PASS`

Los dos findings que permanecían abiertos en el re-review anterior quedaron **CERRADOS**. La
aprobación alcanza exclusivamente TASK-005A. TASK-005 completa continúa abierta, no se archiva y no
se avanzó a TASK-005B.

### Finding ALTO — binding DB de la intención: CERRADO

La migration incremental
`20260923120000_enforce_provisioning_intent_fingerprints.sql` elimina `p_payload_hash` de las tres
RPCs de negocio. Las fingerprints se calculan bajo autoridad PostgreSQL mediante
`extensions.digest(..., 'sha256')`, a partir de un `jsonb` explícito construido con:

- tipo fijo de operación;
- actor autenticado/actor efectivo y scope;
- email de identidad autoritativo, leído desde `auth.users` por la RPC de negocio y normalizado con
  `lower(btrim(...))`;
- nombres, role, ProfessionalCenter y todos los datos materiales del Center o usuario;
- actor/scope nulos explícitos para bootstrap.

El UUID Auth no se autocertifica dentro del hash: permanece ligado en
`private.provisioning_operations` y cada RPC lo compara separadamente contra el UUID real recibido.
No entran timestamps, IDs de resultado ni UUIDs generados durante la mutación.

La representación resultó determinista:

- `jsonb::text` normaliza el orden de claves; un probe calculó el mismo SHA-256 para objetos con
  orden de claves invertido;
- nombres y strings persistidos usan `btrim`;
- opcionales vacíos o sólo whitespace se convierten en `NULL` en hash y persistencia;
- emails de identidad tienen una representación lowercase/trimmed;
- el email de contacto del Center conserva case y sólo se trimea, igual que su valor persistido;
  por diseño es un campo de contacto, no la identidad Auth, y un cambio de case es material;
- los enums/UUID se serializan por su representación textual estable;
- actor, scope y tipo no pueden intercambiarse.

La comparación de fingerprint se ejecuta antes de devolver un resultado idempotente `SUCCEEDED` y
antes de cualquier INSERT. El catálogo remoto confirmó que ninguna RPC de negocio conserva un
argumento llamado `p_payload_hash` y que la antigua
`prepare_auth_provisioning_operation(uuid,text,text,uuid,uuid)` ya no existe.

**Probe independiente:** registró intenciones temporales y reintentó el mismo `operation_id`
cambiando por separado nombre, teléfono, email, dirección y timezone del Center; email, nombre y
apellido del ADMIN; nombre/apellido/email/role/ProfessionalCenter del usuario tenant; actor; scope;
y tipo de operación. Todas fueron rechazadas con SQLSTATE `23514`. Los retries equivalentes con
trim, case normalizado de email de identidad y opcionales vacío/whitespace devolvieron la misma
fingerprint. Antes/después se conservaron exactamente los mismos conteos de Centers y memberships.
El archivo temporal se retiró después de su cleanup.

La suite oficial agrega además el ataque directo a las RPCs de negocio una vez preparada y vinculada
la operación. Ninguna combinación “ID original + argumentos materiales alterados” produjo efecto.
Con la intención idéntica, retry y dos transacciones concurrentes devolvieron el mismo Center y la
misma primera membership ADMIN, con un único efecto durable.

### Finding MEDIA — `catch → reconcile` real: CERRADO

`scripts/verify-provisioning-orchestration.integration.mjs` importa las funciones reales de
`src/modules/access/server/provisioning.ts` y usa Auth/PostgreSQL DEV reales. El hook
`afterPersistCommit` se ejecuta sólo después del retorno exitoso de la RPC —por lo tanto después del
COMMIT remoto—, descarta el resultado y lanza dentro del `persist()` real. La excepción entra al
`catch` real de `persistWithAuthReconciliation`, llama a la RPC real de reconcile, observa
`SUCCEEDED` y reconstruye el mismo resultado.

Esto se verificó separadamente para:

- `createCenterWithFirstAdmin`: Auth preservado, mismo Center/membership en retry y cero duplicados;
- `provisionCenterUser`: Auth preservado, misma membership en retry y una única membership;
- rollback PostgreSQL por timezone inválida: reconcile confirma ausencia, delete Auth real y estado
  `COMPENSATED`;
- fallo de DB + fallo inyectado antes de reconcile: error
  `PROVISIONING_RECONCILIATION_REQUIRED`, cero llamadas a delete, Auth preservado, cero perfil o
  acceso y operación `AUTH_READY` para retry posterior;
- rollback confirmado + delete Auth fallido: `COMPENSATION_REQUIRED`, Auth huérfano, cero perfil y
  cero acceso;
- identidad preexistente + fallo DB: no delete, perfil/nombres preservados. La inspección confirmó
  que este camino no contiene `updateUserById` ni UPDATE de perfil/memberships: las únicas mutaciones
  Auth de la orquestación son create para una identidad nueva y delete sólo cuando
  `authUserWasCreated=true`; por ello password, email y memberships anteriores no cambian.

El fault injection está limitado a una dependencia interna en un archivo `server-only`. Para crear
el runtime con hooks se exige `process.env.NODE_ENV === 'test'`; producción siempre usa
`productionRuntime()` sin hooks. No hay lectura de headers, query params, search params, payload,
variables `NEXT_PUBLIC_*` ni flags de request. `provisioningTestOnly` sólo es importado por el runner
Vitest dedicado y cualquier llamada fuera del runtime test falla antes de construir el runtime. El
build y el escaneo del bundle confirmaron que no se abrió una superficie cliente.

### Bootstrap

El bootstrap prepara su fingerprint en PostgreSQL desde email/nombres y actor/scope nulos, luego
vincula el UUID Auth y ejecuta una RPC que vuelve a calcular la fingerprint desde el email
autoritativo de `auth.users`. La misma intención es idempotente; nombre o email distintos bajo el
mismo `operation_id` fueron rechazados antes del efecto. Commit + respuesta perdida se reconcilia
como `SUCCEEDED`. No se ejecutó el bootstrap persistente.

### Migration history y ACL

- `migration list --linked` muestra nueve versiones local/remoto sincronizadas y una única versión
  `20260923120000`.
- `supabase_migrations.schema_migrations` contiene exactamente una fila para esa versión.
- La migration está encerrada por `begin`/`commit`; el primer intento fallido antes del registro no
  dejó la antigua RPC de prepare, firmas intermedias, filas de operación ni otros objetos residuales.
- Las migrations previamente revisadas conservan su contenido; la corrección es exclusivamente una
  migration incremental posterior.
- Los helpers de hash/registro no son ejecutables por `PUBLIC`, `anon`, `authenticated` ni
  `service_role`. Las preparaciones públicas `SECURITY DEFINER` son únicamente `service_role`; las
  RPCs de negocio mantienen `authenticated` y autorización interna. La tabla privada conserva cero
  grants directos.
- RLS, aislamiento cross-center, separación PLATFORM_ADMIN/tenant, último ADMIN y direct writes
  denied no cambiaron.

### Verificación ejecutada en el segundo re-review

| Comando / prueba | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS — Node/pnpm y link DEV correctos. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm db:test:schema:dev` | PASS — concurrencia real y SQLSTATE `23P01`. |
| `pnpm db:test:auth-foundation:dev` | PASS — RLS/cross-center, PLATFORM_ADMIN, último ADMIN concurrente, grants y cleanup. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS — mutaciones, retry, bootstrap, concurrencia y cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS — Auth/DB/catch/reconcile reales. |
| probe independiente de fingerprint/canonicalización/catalog | PASS; archivo temporal retirado. |
| `pnpm auth:check:dev` | PASS — signup/password/Site URL/redirects y cleanup. |
| `pnpm db:types` | PASS. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS — lint, typecheck y 22/22 tests. |
| `pnpm build` | PASS. |
| `pnpm security:check:client-bundle` | PASS. |
| `git diff --check` | PASS; sólo avisos informativos LF/CRLF, sin whitespace errors. |
| `supabase db lint --linked --schema public,private --level warning` | PASS — cero errores. |
| `supabase db advisors --linked --type security --fail-on error` | PASS — exactamente las siete WARN conocidas, cero ERROR y ninguna nueva superficie autenticada. |
| `supabase migration list --linked` | PASS — nueve versiones sincronizadas. |
| `supabase projects list` | PASS — único proyecto visible/linkeado DEV `ehllxymqyzrofydrvtzo`, `sa-east-1`, `ACTIVE_HEALTHY`. |

La auditoría independiente final confirmó: 0 Auth fixtures, 0 `public.users` fixtures, 0 Centers, 0
memberships, 0 PLATFORM_ADMIN fixtures, 0 `private.provisioning_operations` y 0 procesos de test.
No se leyó ni imprimió `SUPABASE_SECRET_KEY`; PROD permaneció fuera de alcance.

### Riesgos residuales aceptados

- Las operaciones confirmadas reales deben conservarse mientras pueda existir un retry/reconcile;
  la política de retención sigue diferida y no bloquea Fase A.
- Los siete WARN `SECURITY DEFINER` siguen siendo aceptables sólo para las firmas y cuerpos
  revisados; una nueva RPC pública autenticada requiere review nuevo.
- El hook test-only depende de que producción no se ejecute con `NODE_ENV=test`, condición estándar
  y además protegida por `server-only` y ausencia total de entrada controlable por request.

No hubo commit, push, PR, cierre/archivo de TASK-005 ni trabajo de TASK-005B.

## Re-review focalizado — 2026-09-23

### Veredicto

`TASK-005A CHANGES_REQUESTED`

La remediación cierra correctamente la ambigüedad entre commit, rollback y estado incierto en el
flujo nominal server-side: el resultado de negocio queda persistido en la misma transacción, toda
excepción de persistencia consulta primero `service_reconcile_provisioning_operation`, un estado no
determinable conserva Auth y devuelve `PROVISIONING_RECONCILIATION_REQUIRED`, y sólo una operación
que tiene vinculada una identidad creada por ella puede compensarla. El mismo protocolo fue aplicado
al bootstrap.

Sin embargo, el finding ALTO original permanece **abierto, parcialmente remediado**. La propiedad
principal requerida, “mismo `operation_id` + intención material diferente → FAIL”, no se cumple en
la frontera DB expuesta. Las RPCs de negocio confían en `p_payload_hash`, proporcionado por el mismo
caller que proporciona los argumentos materiales, y sólo lo comparan con el hash almacenado. No
recalculan el hash desde esos argumentos ni comparan éstos contra una intención canónica persistida.
Un probe independiente demostró que una RPC acepta el hash original junto con nombre, teléfono,
email, dirección y nombres del ADMIN diferentes, y hace commit de esos valores alterados.

Además, la nueva suite usa Auth y PostgreSQL reales, pero su simulación de response-loss no atraviesa
la orquestación real `persistWithAuthReconciliation`: ejecuta y confirma la transacción mediante el
driver PostgreSQL y luego llama a reconciliación de forma separada. Rollback, compensación y fallo de
compensación también son coordinados manualmente por el script. Esto prueba bien el protocolo DB,
pero no satisface la prueba integrada solicitada del caller real entrando a su `catch` después de un
commit verdadero.

### [ALTA][RE-REVIEW] El hash persistido no autentica los argumentos ejecutados

**Objetos afectados:**

- `public.platform_create_center_with_admin(...)` en
  `supabase/migrations/20260923100000_add_provisioning_idempotency.sql:382`;
- `public.admin_provision_center_user(...)` en la misma migration, línea 545;
- `private.bootstrap_platform_admin(...)` en la misma migration, línea 707;
- generación/pasaje de hash en `src/modules/access/server/provisioning.ts`.

**Escenario reproducido independientemente contra DEV:**

1. Se creó una operación temporal `PLATFORM_CREATE_CENTER` y se preparó/vinculó usando el hash
   canónico exacto de un payload “Original”.
2. Como PLATFORM_ADMIN autenticado se llamó a `platform_create_center_with_admin` con el mismo
   `operation_id` y el mismo hash almacenado, pero con otro nombre, teléfono, email, dirección,
   nombre y apellido.
3. La RPC devolvió éxito y la fila del Center contenía los valores alterados. El probe emitió
   `INTENT_BINDING_BYPASS_REPRODUCED`.
4. El `finally` eliminó sólo sus fixtures y verificó cero residuos antes de retirar el archivo
   temporal del probe.

La causa es visible en las validaciones de las líneas 426, 593 y 738: se comprueba
`v_operation.payload_hash <> p_payload_hash`, pero nunca se deriva una intención confiable de los
parámetros efectivamente utilizados. La propia suite refuerza la evidencia: prepara hashes
arbitrarios del fixture que no incluyen todos los argumentos de negocio y aun así las RPCs tienen
éxito. El test “payload incompatible” sólo vuelve a llamar la RPC service-only `prepare` con otro
hash; no ataca la RPC de negocio con el hash guardado y argumentos diferentes.

**Riesgo:** el registro de idempotencia no es una evidencia íntegra de la intención ejecutada. Un
caller `authenticated` autorizado puede reutilizar una operación preparada y cambiar parámetros
materiales sin obtener el fallo requerido. Actor, scope, tipo e identidad Auth sí están protegidos,
por lo que el probe no mostró una elevación cross-center; el defecto es de integridad del protocolo
de provisioning y viola expresamente el criterio principal del finding ALTO.

**Criterio de aceptación restante:** la DB no debe confiar en un hash autocertificado por el caller.
Debe vincular de manera verificable la intención canónica server-side con todos los argumentos
materiales ejecutados, ya sea recalculando/validando una representación canónica exacta en la
frontera confiable o mediante un mecanismo equivalente. Con el mismo `operation_id`, cualquier
cambio material en Center/usuario/rol/ProfessionalCenter/actor/scope/tipo debe fallar; diferencias
normalizadas e irrelevantes deben conservar el mismo resultado. Agregar pruebas negativas directas
para las RPCs de Center y tenant que reutilicen `operation_id` + hash original con argumentos
materiales alterados. Deben fallar antes de producir efectos.

### [MEDIA][RE-REVIEW] Falta una prueba integrada real del `catch → reconcile`

**Archivos afectados:**

- `scripts/verify-provisioning-reconciliation.mjs`;
- `src/modules/access/domain/auth-compensation.test.ts`.

**Evidencia:** el caso response-loss del script hace commit real por conexión PostgreSQL y después
invoca `reconcile()` en otra llamada. No ejecuta `createCenterWithFirstAdmin` o
`provisionCenterUser` ni fuerza que su RPC real arroje una pérdida de respuesta posterior al commit.
Los casos de compensación llaman directamente a Auth Admin y a la RPC de marcado; el fallo de delete
se provoca con un cliente inválido y se registra manualmente. La indisponibilidad de reconciliación
sólo está cubierta con mocks unitarios. Por ello los componentes reales están probados, pero no su
orquestación integrada en las fronteras donde ocurrió el finding original.

**Criterio de aceptación restante:** agregar fault injection controlada que ejecute la orquestación
real con Auth/PostgreSQL DEV, haga commit y luego entregue una excepción al caller, verificando que
entra a reconciliación, preserva Auth, reconstruye el resultado y no duplica recursos. Cubrir por el
mismo camino rollback con compensación exitosa, delete Auth fallido y reconciliación indeterminada
sin delete. Los unit tests mockeados pueden mantenerse, pero no sustituyen esta evidencia.

### Resultado detallado de la remediación

| Propiedad re-revisada | Resultado |
| --- | --- |
| Migration nueva/aditividad | PASS — las migrations previas siguen byte-for-byte sin diff; versión local/remota `20260923100000` sincronizada. |
| Aislamiento de `private.provisioning_operations` | PASS — schema privado, RLS sin policy, grants directos revocados incluso a `service_role`; acceso sólo por funciones service-only. |
| Constraints/estados | PASS — PK UUID, hash SHA-256 lowercase de 64 caracteres, tipos/estados cerrados, binding Auth coherente y resultado exigido para `SUCCEEDED`. No almacena passwords, tokens ni secretos. |
| Grants | PASS — prepare/bind/reconcile/mark-compensation sólo `service_role`; RPCs de negocio conservan sus grants mínimos. `authenticated` no obtiene SELECT/DML sobre la tabla privada. |
| Locks/índices | PASS — PK cubre todos los lookups actuales y el advisory xact lock derivado de `operation_id` serializa retries; no se necesita un índice adicional para el protocolo actual. |
| Mismo ID + mismo payload | PASS — retry y dos llamadas concurrentes retornan un único resultado/efecto de negocio. |
| Mismo ID + actor/scope/tipo/hash declarado diferente | PASS en `prepare`/validaciones. |
| Mismo ID + argumentos materiales diferentes + hash guardado | **FAIL reproducido** — la RPC confía en el hash proporcionado y acepta la intención alterada. |
| Commit + response-loss | PASS a nivel del protocolo DB: `SUCCEEDED`, Auth preservado, resultado reconstruible, sin duplicados. **Evidencia integrada de orquestación incompleta.** |
| Estado incierto | PASS por inspección y unit test: si reconcile falla, no se llama delete y se devuelve `PROVISIONING_RECONCILIATION_REQUIRED`; falta fault injection real. |
| Rollback confirmado + compensación | PASS en protocolo y flujo inspeccionado: sólo puede eliminarse el Auth vinculado y creado por esa operación. |
| Delete Auth fallido | PASS en estado: queda `COMPENSATION_REQUIRED`, Auth huérfano y sin acceso DB; no informa rollback completo. La coordinación fue manual en la suite integrada. |
| Identidad preexistente | PASS — `auth_user_was_created=false`; no delete ni cambios de password/email/nombres/memberships anteriores. |
| Bootstrap | PASS en protocolo/idempotencia/response-loss DB y en inspección de orquestación; no se ejecutó bootstrap persistente. Comparte el defecto estructural del hash, acotado por grant service-only. |
| Retención | Riesgo residual aceptable para esta fase sólo si no se eliminan operaciones mientras un retry/reconcile siga siendo válido; falta política explícita, pero no bloquea por sí sola TASK-005A. |

### Regressions y verificación del re-review

| Comando / verificación | Resultado 2026-09-23 |
| --- | --- |
| `pnpm bootstrap` | PASS. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm db:test:schema:dev` | PASS. |
| `pnpm db:test:auth-foundation:dev` | PASS — incluye RLS/cross-center, isolation PLATFORM_ADMIN, direct writes denied y último ADMIN concurrente. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS de la suite existente; cobertura insuficiente según hallazgo MEDIA. |
| `pnpm auth:check:dev` | PASS. |
| `pnpm db:types` | PASS. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS — lint, typecheck y 22/22 tests. |
| `pnpm build` | PASS. |
| `pnpm security:check:client-bundle` | PASS. |
| `git diff --check` | PASS; sólo avisos informativos de normalización LF/CRLF, sin whitespace errors. |
| `supabase migration list --linked` | PASS — ocho migrations local/remoto sincronizadas. |
| `supabase db lint --linked --schema public,private --level warning` | PASS — cero errores de schema. Un primer intento paralelo recibió un `28P01` transitorio; el rerun aislado pasó. |
| `supabase db advisors --linked --type security --fail-on error` | PASS con las mismas siete WARN ya revisadas y cero ERROR; las RPCs service-only nuevas no ampliaron warnings públicos. |
| `supabase projects list` | PASS — único proyecto visible/linkeado: DEV `ehllxymqyzrofydrvtzo`, `sa-east-1`, `ACTIVE_HEALTHY`. |
| probe independiente de binding de intención | **FAIL esperado/reproducción del defecto** — DB aceptó argumentos alterados bajo el hash original. |
| auditoría final de cleanup/procesos | PASS. |

La auditoría final contra DEV confirmó exactamente: 0 Auth users temporales, 0 `public.users`
temporales, 0 Centers/memberships temporales, 0 PLATFORM_ADMIN temporales, 0
`private.provisioning_operations` de fixture y 0 procesos de test `task005-*` activos. No se leyó ni
imprimió `SUPABASE_SECRET_KEY`. PROD permaneció fuera de alcance. No hubo bootstrap persistente,
commit, push, PR, archivo de la tarea ni trabajo de TASK-005B.

## Conclusión del review original — 2026-09-22

La estructura PostgreSQL, el aislamiento RLS, la separación PLATFORM_ADMIN/tenant, los grants y la
invariante concurrente del último ADMIN pasaron la revisión estática, las suites existentes y un
probe independiente con fixtures temporales. No encontré una escalación de privilegios, bypass RLS,
asociación cross-center de ProfessionalCenter ni acceso operativo tenant derivado de
PLATFORM_ADMIN.

Las siete advertencias de Security Advisors corresponden exactamente a las siete RPCs públicas
autenticadas `SECURITY DEFINER`. En el diseño actual son necesarias, tienen autorización interna,
`search_path=''`, referencias calificadas, retorno estrecho y grants por firma. No deben aceptarse
genéricamente para funciones futuras, pero estas siete son aceptables.

El review no puede aprobar Fase A por un defecto concreto en provisioning/compensación: la creación
de Center + primer ADMIN carece de una identidad idempotente de operación y la compensación trata
cualquier error del llamado RPC como si PostgreSQL no hubiera confirmado. Un retry posterior a un
commit exitoso crea silenciosamente otro Center activo con otra membership ADMIN; un fallo de
transporte posterior al commit entra al camino de compensación sin reconciliar antes el estado DB.
El mismo supuesto aparece en el bootstrap one-shot. Esto incumple el contrato aprobado de retry y
la garantía de que un fallo de compensación queda sin membership. Las pruebas actuales separan SQL
y compensación mockeada, por lo que no prueban esta propiedad end-to-end.

## Hallazgos

### [ALTA] Provisioning no distingue rollback DB de commit confirmado con respuesta perdida

**Archivos/objetos afectados:**

- `src/modules/access/domain/auth-compensation.ts:24`
- `src/modules/access/server/provisioning.ts:102`
- `src/modules/access/server/provisioning.ts:144`
- `scripts/bootstrap-platform-admin.mjs:52`
- `public.platform_create_center_with_admin(...)`
- tests de provisioning/compensación de TASK-005A

**Evidencia:**

- `persistWithAuthCompensation()` interpreta toda excepción de `persist()` como fallo de
  persistencia y, si la identidad Auth fue creada por la ejecución, intenta borrarla inmediatamente.
  No existe consulta de reconciliación ni identidad de operación que determine si la RPC confirmó
  antes de perderse la respuesta.
- `platform_create_center_with_admin()` genera siempre un `center_id` y un `membership_id` nuevos.
  No recibe ni persiste una clave idempotente. Después de un primer commit exitoso, repetir
  `createCenterWithFirstAdmin()` resuelve la identidad ya existente y crea un segundo Center sin
  devolver conflicto ni el resultado previo.
- Si el commit PostgreSQL ocurrió pero el cliente recibe una excepción de transporte, la
  compensación intenta borrar Auth. Las FKs `RESTRICT` pueden hacer fallar ese delete precisamente
  porque ya existen `public.users`/membership. El error es observable como
  `AUTH_COMPENSATION_FAILED`, pero el estado no es fail-closed: la membership confirmada permanece.
- `bootstrap-platform-admin.mjs` tiene el mismo intervalo ambiguo entre la RPC y su respuesta. Ante
  una respuesta perdida posterior al commit intenta borrar Auth sin reconciliar primero
  `public.users`/`platform_admins`.
- `auth-compensation.test.ts` sólo simula `persist()` rechazado antes de cualquier efecto durable.
  `verify-auth-foundation.mjs` prueba las RPCs directamente, pero no ejecuta la orquestación
  TypeScript ni una compensación Auth real después de un fallo DB. Ambas capas pasan por separado y
  dejan sin probar el caso ambiguo que une Auth, PostgreSQL y transporte.

**Riesgo:**

- duplicación silenciosa de Centers activos y primeras memberships ADMIN ante retry;
- operación informada como fallida aunque el acceso ya haya sido concedido;
- compensación aplicada sobre un resultado DB no reconciliado;
- bootstrap informado como fallido aunque la plataforma haya quedado inicializada;
- imposibilidad de sostener la garantía documentada “si falla la compensación, no existe
  membership”.

No observé que este defecto permita a un actor no autorizado elevar privilegios: las RPCs continúan
exigiendo PLATFORM_ADMIN o ADMIN del Center. El impacto es de integridad/autorización operacional y
afecta una garantía de seguridad explícita de la tarea.

**Criterio de aceptación:**

1. La creación Center + primer ADMIN debe tener una identidad server-side de operación o mecanismo
   equivalente que vuelva el retry determinista: una misma operación lógica no puede crear un
   segundo Center ni una segunda primera membership.
2. Ante error/timeout después de invocar la RPC, la orquestación debe reconciliar el resultado antes
   de borrar Auth. Si PostgreSQL confirmó, debe recuperar/devolver ese resultado; si PostgreSQL no
   confirmó, puede compensar únicamente la identidad creada por esa ejecución; si el estado sigue
   siendo incierto, debe devolver un estado explícito de reconciliación y no ejecutar una acción
   destructiva basada en una suposición.
3. El bootstrap debe aplicar la misma distinción entre rollback, commit confirmado y resultado
   ambiguo.
4. Agregar tests integrados que cubran al menos: retry después de éxito, respuesta perdida después
   de commit, rollback DB con compensación exitosa, rollback DB con delete Auth fallido, identidad
   preexistente y verificación de exactamente un Center/membership o cero membership según el caso.
5. Los tests deben comprobar que nunca se borra una identidad preexistente y que los errores
   inciertos incluyen un identificador reconciliable sin exponer credenciales ni secretos.

## Revisión de migrations

| Área | Resultado | Evidencia |
| --- | --- | --- |
| TASK-004 inmutable | PASS | `git diff` contra `main` es vacío para las tres migrations de TASK-004; `HEAD`, `main` y `origin/main` coinciden. |
| Orden incremental | PASS | `migration list --linked` muestra las siete versiones locales/remotas en orden: tres TASK-004 y cuatro TASK-005. |
| `public.users.email` | PASS | Backfill desde `auth.users` aborta ante Auth faltante/email vacío/colisión normalizada; persiste `lower(btrim(email))`; CHECK no vacío/normalizado, `NOT NULL` y `UNIQUE`. |
| Consistencia Auth | PASS con límite aprobado | Backfill y RPCs derivan/verifican el email contra `auth.users`; no existe trigger y el cambio de email sigue fuera de TASK-005. |
| `platform_admins` | PASS | Tabla separada, PK/FK `RESTRICT` a `public.users`, RLS habilitada; PLATFORM_ADMIN no fue agregado a `membership_role`. |
| Deletes/FKs | PASS | FKs relevantes usan `RESTRICT`; no se agregó cascade destructivo. |
| RLS | PASS | Las 12 tablas públicas tienen RLS; las seis policies TASK-005 son SELECT y coinciden con la matriz aprobada. |
| Migration correctiva #4 | PASS | Reemplaza sólo `admin_set_center_membership`, elimina `v_target_user_id` y cambia `SELECT ... INTO` por `PERFORM 1`; conserva lock, autorización, validaciones, postcondición, firma y grant. |

No se observó una reescritura de migrations de TASK-004. Las nuevas migrations de TASK-005 están
sincronizadas por versión con DEV y el catálogo/definiciones efectivos coinciden con el lote local
inspeccionado.

## RLS y aislamiento cross-center

| Objeto | Resultado |
| --- | --- |
| `platform_admins` | PASS — sólo fila propia; ADMIN tenant no ve filas globales. |
| `centers` | PASS — sólo membership activa + Center activo; PLATFORM_ADMIN sin membership ve cero filas directas. |
| `users` | PASS — perfil propio o usuario alcanzable por ADMIN en un Center común; no expone memberships externas. |
| `center_memberships` | PASS — propia activa o filas del Center administrado; no hay lectura cross-center. |
| `professional_centers` | PASS — ADMIN del Center o PROFESSIONAL vinculado/activo; RECEPTION y PLATFORM_ADMIN sin membership ven cero. |
| `professionals` | PASS — identidad global sólo cuando existe vínculo visible en el Center propio; no expone ProfessionalCenter de otros Centers. |
| tablas operativas | PASS — `specialties`, `professional_center_specialties`, `persons`, `patient_centers`, `availabilities` y `appointments` permanecen sin SELECT para `authenticated`. |

El probe independiente confirmó además:

- `auth.uid() = NULL` produce `false`/`NULL` mínimo en los seis helpers y `42501` en RPC global;
- ADMIN de B no puede resolver ni mutar contexto de A;
- un ProfessionalCenter de B no puede asociarse a una membership de A y el statement fallido no
  deja `public.users` ni membership;
- PLATFORM_ADMIN no puede usar RPC tenant y ADMIN tenant no puede usar RPC plataforma;
- `platform_list_centers` expone únicamente las diez columnas aprobadas;
- PLATFORM_ADMIN recibe cero filas directas de Centers, memberships, Professionals y
  ProfessionalCenters, y no tiene privilegio SELECT sobre las seis tablas operativas cerradas.

## Helpers `SECURITY DEFINER`

| Helper | Necesidad y comportamiento | Resultado |
| --- | --- | --- |
| `private.is_platform_admin()` | Evita recursión/bypass de policy y consulta sólo la fila de `auth.uid()`; NULL → false. | PASS |
| `private.has_active_center_membership(uuid)` | Lee membership + Center activos sin recursión; actor derivado de `auth.uid()`; NULL → false. | PASS |
| `private.has_active_center_role(uuid, membership_role[])` | Igual aislamiento y compara únicamente roles propios en el Center activo. | PASS |
| `private.active_professional_center_id(uuid)` | Retorna sólo el PC propio, activo y del mismo Center; NULL/no acceso → NULL. | PASS |
| `private.can_administer_user(uuid)` | Exige intersección con una membership ADMIN activa en Center activo; no retorna centros/roles. | PASS |
| `private.can_view_professional(uuid)` | Exige ADMIN del Center vinculado o PROFESSIONAL propietario activo; no expone vínculos externos. | PASS |

Los seis son `STABLE SECURITY DEFINER`, tienen `search_path=''`, no usan SQL dinámico, califican
schemas/objetos, revocan `PUBLIC`/`anon` y conceden `EXECUTE` sólo a `authenticated`. El uso como
helpers de policies anti-recursión justifica `SECURITY DEFINER`; convertirlos a invoker reintroduciría
recursión o requeriría ampliar grants/policies.

## Revisión de las 7 advertencias de Security Advisors

| RPC advertida | Evaluación | Dictamen |
| --- | --- | --- |
| `platform_list_centers()` | Necesita leer Centers y calcular tres agregados sin SELECT general; valida `is_platform_admin()` y retorna sólo metadata/contadores. | Esperada y aceptable. |
| `platform_resolve_user_by_email(text)` | Necesita resolver email exacto fuera de la policy self; valida PLATFORM_ADMIN, normaliza y retorna identidad mínima. | Esperada y aceptable. |
| `platform_create_center_with_admin(...)` | Necesita leer Auth y escribir User/Center/membership sin DML general; valida PLATFORM_ADMIN y postcondición de un ADMIN. | Esperada; su problema es idempotencia/compensación, no el warning. |
| `platform_set_center_active(uuid, boolean)` | Necesita UPDATE estrecho y lock por Center; valida PLATFORM_ADMIN y ADMIN activo al reactivar. | Esperada y aceptable. |
| `admin_resolve_user_by_email(uuid, text)` | Necesita resolución exacta global sin SELECT general; exige ADMIN activo del Center y sólo informa membership del Center solicitado. | Esperada y aceptable. |
| `admin_provision_center_user(...)` | Necesita leer Auth e insertar User/membership; exige ADMIN activo, PC activo del mismo Center y conserva identidad existente. | Esperada y aceptable. |
| `admin_set_center_membership(...)` | Necesita UPDATE estrecho sin grant directo; exige ADMIN activo, lock común y postcondición del último ADMIN. | Esperada y aceptable. |

Las siete pueden eliminarse sólo ampliando grants/policies o moviendo la mutación fuera del contrato
PostgREST aprobado, lo que sería menos seguro. Advisors: siete WARN, cero ERROR. DB lint: cero
resultados.

## Último ADMIN y concurrencia

**Resultado:** PASS para todos los caminos DB permitidos actuales.

- `platform_create_center_with_admin`, `platform_set_center_active`,
  `admin_provision_center_user` y `admin_set_center_membership` usan la misma clave
  `hashtextextended('salud-plus:center:' || center_id, 0)` con `pg_advisory_xact_lock`.
- Direct INSERT/UPDATE/DELETE de `authenticated` permanece revocado, por lo que no hay un camino API
  alternativo que evite la postcondición.
- La suite observó una espera advisory real entre dos transacciones. Después del commit de la
  primera degradación, la segunda fue rechazada con SQLSTATE `23514`; no pudieron degradarse ambos
  ADMIN.
- Último ADMIN, autodesactivación, degradación, reactivación sin ADMIN, Center inactivo y
  conservación de memberships fueron cubiertos. PLATFORM_ADMIN no cuenta como ADMIN de Center.
- El bootstrap usa un advisory lock global separado; dos intentos concurrentes dejan un único
  PLATFORM_ADMIN y el perdedor recibe `23514`.

## PLATFORM_ADMIN isolation

**Resultado:** PASS.

`auth.users → public.users → platform_admins` permanece independiente de `center_memberships`.
PLATFORM_ADMIN no recibe memberships automáticamente, no satisface helpers tenant y no cuenta como
ADMIN de Center. Sólo puede usar las cuatro operaciones globales aprobadas; reactivar exige un ADMIN
tenant activo. `platform_list_centers` devuelve metadata administrativa y exactamente estos
contadores: memberships activas, ProfessionalCenter activos y Specialty activas. No se concedió
SELECT general sobre Specialty ni otras tablas operativas para calcularlos.

## Secretos y cliente Admin

**Resultado:** PASS.

- `src/lib/supabase/admin.ts` comienza con `import "server-only"` y usa sólo
  `SUPABASE_SECRET_KEY`; no hay `NEXT_PUBLIC_*` privilegiado ni incorporación de
  `SUPABASE_SERVICE_ROLE_KEY`.
- El cliente usa `supabase-js` con `persistSession`, `autoRefreshToken` y `detectSessionInUrl` en
  `false`.
- El único import desde `src` está en `src/modules/access/server/provisioning.ts`, también
  `server-only`; no hay import desde Client Components ni barrel público.
- En la aplicación se usa exclusivamente para `auth.admin.createUser/deleteUser`; no existen
  queries normales de producto mediante ese cliente. El tooling bootstrap usa acceso privilegiado
  sólo para preflight/postcondición/RPC de bootstrap, dentro de la excepción aprobada.
- `.env.local` está ignorado y no versionado; sólo `.env.example` está trackeado. El escaneo de
  archivos trackeados no encontró valores con prefijo de secret/JWT y no se leyó ni mostró el valor
  de `SUPABASE_SECRET_KEY`.
- El build con centinelas confirmó que ningún secreto protegido apareció en `.next/static`.

## Provisioning y compensación

| Propiedad | Resultado |
| --- | --- |
| identidad nueva | PASS parcial — se crea confirmada y nombres/email DB se derivan/validan; falta resolver retry/resultado ambiguo. |
| identidad existente | PASS — no hay update de password, email, nombre, apellido ni memberships previas; prueba real confirmó contraseña y perfil preservados. |
| Center + primer ADMIN | PASS en atomicidad SQL; CHANGES_REQUESTED en idempotencia de la orquestación. |
| usuario tenant | PASS en autorización, PC same-center y atomicidad SQL; la misma ambigüedad de transporte afecta compensación. |
| borrar sólo Auth creado ahora | PASS en código y unit test; `authUserWasCreated=false` nunca llama delete. |
| delete Auth fallido | PASS sólo para el caso mock de rollback DB; no está garantizado “sin membership” cuando hubo commit con respuesta perdida. |
| reconciliación | CHANGES_REQUESTED — existe código de error/Auth UUID, pero no operación idempotente ni consulta que determine commit vs rollback antes de compensar. |

`platform_resolve_user_by_email` y `admin_resolve_user_by_email` son búsquedas exactas, no aceptan
wildcards y no listan otros Centers/roles. El resolver tenant informa únicamente si existe
membership en el Center solicitado. Esto conserva el flujo aprobado, aunque sigue siendo un oracle
de existencia exacta para ADMIN autorizados, riesgo residual aceptado por el diseño.

## Autorización server-side y proxy

**Resultado:** PASS por inspección estática y comportamiento DB subyacente.

- `requireUser`, `requirePlatformAdmin`, `requireCenterMembership`, `requireRole` y
  `requireProfessionalContext` son `server-only`.
- `requireUser` usa `getClaims()` y consulta el perfil actual; los helpers tenant consultan
  membership/Center/ProfessionalCenter actuales bajo RLS, no claims de rol ni `centerId` confiado.
- Center o membership inactivos son rechazados. Contexto global y tenant usan primitives
  diferentes; PLATFORM_ADMIN no satisface una membership.
- `src/proxy.ts` sólo delega refresh de sesión mediante `getClaims()`; no es la única capa de
  autorización.

## Configuración Auth DEV

`pnpm auth:check:dev` verificó conductualmente:

- signup público OFF;
- password de 9 rechazado y lowercase de 10 aceptado, sin composición requerida;
- Site URL `http://localhost:3000`;
- callback `http://localhost:3000/auth/callback` permitido;
- `http://localhost:3000/update-password` permitido;
- redirect externo no permitido;
- cleanup de la identidad temporal.

## Tests y verificaciones ejecutados

| Comando / verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS — Node 24.21.0, pnpm 11.26.0 y link DEV coherente. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm db:test:schema:dev` | PASS — concurrencia real y SQLSTATE `23P01`. |
| `pnpm db:test:auth-foundation:dev` | PASS — RLS/Auth/RPC/último ADMIN y cleanup cero. |
| `pnpm auth:check:dev` | PASS — configuración Auth y cleanup. |
| probe independiente RLS/RPC/cross-center | PASS en tres corridas; archivo temporal retirado después de verificar. |
| `supabase migration list --linked` | PASS — siete versiones local/remoto sincronizadas. |
| `supabase projects list` | PASS — único proyecto visible/linkeado DEV, ref/región esperados. |
| `supabase db lint --linked --level warning` | PASS — cero resultados. |
| `supabase db advisors --linked --type security --fail-on error` | PASS con siete WARN revisados individualmente y cero ERROR. |
| `pnpm db:types` | PASS. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS — lint, typecheck y 20/20 tests. |
| `pnpm build` | PASS. |
| `pnpm security:check:client-bundle` | PASS. |

La suite Auth crea nueve identidades `task005-...@example.test`; el orden corregido de cleanup borra
memberships antes de ProfessionalCenter, luego Centers/Professionals, plataforma/perfiles y por
último Auth. La corrección evita la FK que causó el primer fallo. El pre-cleanup por prefijo permite
recuperar residuos de una corrida interrumpida; debe evitarse ejecutar suites TASK-005 concurrentes
porque comparten ese namespace.

## Cleanup final

La última ejecución del probe independiente verificó después de su `finally`:

- 0 Auth fixtures `task005-*`/`review005-*`;
- 0 `public.users` fixtures;
- 0 filas en `platform_admins`;
- 0 Centers de fixture TASK-005/Review;
- 0 Professionals de fixture;
- 0 Specialties de fixture.

No se ejecutó el bootstrap persistente, no se crearon usuarios persistentes y PROD no fue tocado.

## Riesgos residuales

- Los siete warnings `SECURITY DEFINER` son aceptables sólo para estas firmas y cuerpos revisados;
  cualquier ampliación exige nueva revisión de ACL, autorización interna, salida y SQL.
- La resolución por email exacto permite confirmar existencia a un ADMIN autorizado que ya conoce
  el email; no expone listados, otros centros ni roles y es el trade-off aprobado para reutilización.
- `public.users.email` puede quedar stale si en el futuro se habilita cambio de email fuera del flujo
  coordinado; esa capacidad sigue fuera de TASK-005 y debe resolverse antes de exponerla.
- El SMTP de desarrollo y la ausencia de rate limiting definitivo no son aptos para PROD, que sigue
  fuera de alcance.
- Las suites remotas comparten prefijos de cleanup y no deben ejecutarse en paralelo.

## Estado del review

`TASK-005A CHANGES_REQUESTED`

Este archivo fue creado con evidencia concreta. No se modificó implementación, migrations,
dependencias ni documentación permanente; no hubo commit, push, PR, bootstrap persistente, cierre,
archivo ni trabajo de TASK-005B.
