# Review — TASK-005 Auth, RLS y acceso

**Rol:** Reviewer / Verifier independiente + Database/RLS Reviewer + Security Reviewer

**Fecha:** 2026-09-22; re-reviews de Fase A y reviews B1/B2 2026-09-23; re-review focalizado B2 2026-09-24

**Branch verificada:** `task/005-auth-users-center-access`

**Base:** `main` / `7bf1aa3d50b31d7ce420c805af60fe5b9c2ce01d`

**Destino remoto verificado:** Supabase DEV `ehllxymqyzrofydrvtzo`, `sa-east-1`,
`ACTIVE_HEALTHY`, linkeado. La CLI sólo mostró este proyecto DEV. PROD permaneció fuera de alcance.

**Resultado Fase A:** `TASK-005A REVIEW PASS`

**Resultado B1:** `TASK-005B1 REVIEW PASS`

**Resultado B2:** `TASK-005B2 REVIEW PASS`

**Alcance del veredicto:** Fase A, B1 y B2 están aprobadas. TASK-005 completa no se cierra ni se
archiva; B3 no comenzó.

## Tercer re-review focalizado — TASK-005B2 — 2026-09-24

### Veredicto

`TASK-005B2 REVIEW PASS`

Los dos findings restantes quedaron **CERRADOS**. Root y payload durable rechazan propiedades
desconocidas sin transformar el snapshot en ausencia, y la suite E2E sincroniza la respuesta 503
antes de cualquier refresh. Dos ejecuciones completas consecutivas pasaron 8/8, sin
`Route is already handled`, operaciones `PENDING` ni residuos.

La aprobación alcanza exclusivamente B2. TASK-005 continúa abierta; B3 no comenzó.

### Finding 1 — schemas strict root/payload — CERRADO

- `persistedPlatformOperationIntentSchema` y `platformCenterIntentPayloadSchema` usan `.strict()`.
  No existe otro objeto anidado durable: el payload contiene únicamente campos escalares y queda
  cubierto como unidad cerrada.
- Propiedad extra en root → `INVALID`; propiedad extra dentro de payload → `INVALID`.
- `adminInitialPassword` inyectada dentro del payload → parseo rechazado y cero escritura durable.
  El hook prueba además que intentar persistir un payload con password no crea entrada en storage.
- Los tests verifican que el contenido original queda byte-for-byte intacto, no se llama al factory
  UUID, `operationId` permanece ausente, provisioning no se monta y remount/refresh continúa
  bloqueado. Sólo el botón explícito de abandono elimina el valor y crea B.

Matriz revalidada:

```text
ABSENT  (getItem === null) → puede crear una intención nueva
VALID   (schema completo + actor/scope exactos) → recupera A
INVALID (cualquier contenido presente no confiable) → bloqueado, sin UUID, submit ni auto-delete
```

JSON corrupto, versión desconocida, UUID inválido, actor/scope incorrectos, payload incompleto o
inválido, propiedades desconocidas y excepción de lectura permanecen `INVALID`; ninguno degrada a
`ABSENT` ni aporta campos parciales.

### Finding 2 — race response-loss E2E — CERRADO

`createResponseLossInterceptor()` usa un deferred explícito. El handler:

```text
route.fetch()
→ exige upstream 200
→ await route.fulfill(503)
→ resuelve browserResponseDelivered
```

El test espera `browserResponseDelivered` antes de consultar, desmontar el route handler o refrescar.
No usa sleeps como barrera principal. `afterEach` espera además cualquier route work en vuelo antes
del teardown, eliminando la carrera que anteriormente dejaba operaciones `PENDING`.

El escenario estricto real pasó dos veces y confirmó:

```text
operation_id A
→ Auth + PostgreSQL COMMIT real
→ upstream 200 y browser 503 entregado
→ se agrega propiedad desconocida al snapshot completo
→ refresh → INVALID / sin B
→ segundo refresh → INVALID / sin B
→ 1 Center + 1 membership ADMIN + 1 operación SUCCEEDED
→ abandono explícito → snapshot eliminado + UUID B, sin segundo provisioning
```

Resultados consecutivos: **8/8 + 8/8**, ambos con cleanup cero y sin `Route is already handled`.

### Reactivación y regresiones funcionales

La corrección de la carrera de reactivación modifica sólo el harness. El E2E ya no confía únicamente
en el texto UI: espera por polling que `centers.is_active = true` en PostgreSQL, navega la sesión
tenant con una URL única y exige destino final `/centers/[centerId]`. La propiedad no fue debilitada:
desactivar sigue enviando al tenant a `/no-access`, conserva la membership y reactivar restaura acceso
tenant real.

No hay diff bajo `supabase/`; las nueve migrations siguen sincronizadas local/remoto. No cambiaron
migrations, schema, RLS, RPCs, grants, fingerprints ni provisioning DB. Autorización `/platform`,
identidad nueva/existente, activate/deactivate, tenant isolation, B1 login/access y provisioning A
pasaron sus regresiones.

### Password, actor y secretos

- Password excluida del schema durable y rechazada si se intenta inyectar como propiedad extra.
- No apareció en `sessionStorage`, `localStorage`, cookies, URL, logs, IndexedDB, DB de provisioning,
  snapshot durable ni artefactos cliente.
- Storage continúa namespaced por PLATFORM_ADMIN y el actor dentro del snapshot debe coincidir con el
  actor autenticado; storage no autoriza. Página, lecturas y mutaciones conservan
  `requirePlatformAdmin()` server-side.

### Auth foundation y checks

| Verificación | Resultado |
| --- | --- |
| branch / HEAD / DEV | PASS: `task/005-auth-users-center-access`, `1c90881dab31ea5f9811057a012c8af664b59e33`, DEV `ehllxymqyzrofydrvtzo`; PROD fuera de alcance. |
| `pnpm bootstrap` | PASS; no ejecutó bootstrap persistente. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm db:test:schema:dev` | PASS con concurrencia real. |
| `pnpm db:test:auth-foundation:dev` | PASS; observó por PID real tanto el bootstrap advisory lock como el Center ADMIN advisory lock; cleanup cero. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS y cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS. |
| `pnpm auth:check:dev` | PASS y cleanup cero. |
| `pnpm test:e2e:auth-access:dev` | PASS 9/9 y cleanup cero. |
| `pnpm test:e2e:platform-admin:dev` corrida 1 | PASS 8/8 y cleanup cero. |
| `pnpm test:e2e:platform-admin:dev` corrida 2 | PASS 8/8 y cleanup cero. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS: lint, typecheck y 77/77 tests en 13 archivos. |
| `pnpm build` | PASS; `/platform` dinámica. |
| `pnpm security:check:client-bundle` | PASS; frontera de secretos limpia. |
| migration sync | PASS: nueve migrations locales/remotas coinciden. |
| `git diff --check` | PASS; sólo avisos informativos LF/CRLF. |

`scripts/verify-auth-foundation.mjs` mantiene concurrencia real: captura el PID de la misma conexión
transaccional bloqueada, exige en `pg_locks` un advisory lock `granted = false`, libera la transacción
ganadora y luego verifica el resultado funcional. Ambos barriers fueron observados en esta ronda.

### Cleanup y riesgo residual

Auditoría read-only final contra DEV: 0 Auth users, 0 `public.users`, 0 Centers, 0 memberships, 0
PLATFORM_ADMIN, 0 `private.provisioning_operations` y 0 procesos DB/E2E. No quedó listener local en
puerto 3000.

Permanece aceptado el riesgo ya delimitado: cerrar deliberadamente la pestaña o borrar manualmente
`sessionStorage` pierde metadata no secreta. El contrato aprobado es response-loss + refresh dentro
de la misma pestaña y se cumple.

No se ejecutó bootstrap persistente, no se tocó PROD, no hubo commit/push/PR, TASK-005 continúa
abierta y B3 no comenzó.

## Segundo re-review focalizado — TASK-005B2 B2-F1 — 2026-09-24

### Veredicto

`TASK-005B2 CHANGES_REQUESTED`

El finding ALTO B2-F1 permanece **ABIERTO / parcialmente remediado**. La implementación ya distingue
`ABSENT`, `VALID` e `INVALID` para ausencia real, snapshots válidos, JSON corrupto, versión/campos/UUID,
actor, scope, payload y errores de lectura. En esos caminos `INVALID` no borra storage, no crea UUID y
no monta provisioning; el abandono explícito es el único camino que elimina el snapshot y crea B.

No obstante, la validación no rechaza toda estructura inesperada: los `z.object()` de
`persistedPlatformOperationIntentSchema` y `platformCenterIntentPayloadSchema` no son estrictos. Zod
elimina propiedades desconocidas y devuelve `VALID`. Además, el E2E oficial nuevo tiene una carrera
reproducible entre `route.fetch()/route.fulfill()` y el refresh, por lo que la evidencia requerida no
queda verde ni limpia en su forma entregada.

### ABSENT / VALID / INVALID

**Resultado por camino:**

- `getItem() === null` → `ABSENT` → se crea una intención nueva: PASS.
- Snapshot completamente válido, actor actual y scope exacto → `VALID` → recupera A y payload completo:
  PASS.
- JSON corrupto, versión desconocida, campos faltantes, UUID inválido, actor distinto, scope distinto,
  timezone/payload inválido o fallo de lectura → `INVALID`: PASS. No se usa ningún campo parcial, no se
  borra el valor, no se llama al generador y la UI sólo muestra el estado bloqueado.
- Escritura fallida → el submit hace `preventDefault()` y no llega al provisioning: PASS.
- Borrado fallido durante abandono → conserva `INVALID`, conserva el snapshot, muestra error y no crea
  B: PASS.
- Rerender, dos refresh y navegación/remount no cambian `INVALID`: PASS en unit y en el probe E2E
  sincronizado del reviewer.

**Defecto restante — estructura inesperada:** un probe independiente agregó por separado una propiedad
desconocida en la raíz y otra dentro de `payload`. En ambos casos
`readPlatformOperationIntent(...).status` fue `valid`; las propiedades fueron descartadas. Esto no
genera por sí mismo un segundo Center, pero contradice el criterio explícito de este re-review:
`estructura inesperada → INVALID` y “no recuperar parcialmente contenido que no pasó validación
completa”. Los tests del Implementer no incluyen este caso.

**Objeto:** `src/modules/access/schemas/platform.ts`, schemas
`platformCenterIntentPayloadSchema` y `persistedPlatformOperationIntentSchema`.

**Criterio restante:** validar de forma cerrada la estructura durable (incluido `payload`) y agregar
casos para propiedades desconocidas en ambos niveles que demuestren `INVALID`, snapshot intacto, cero
UUID y provisioning desmontado.

### E2E de snapshot inválido

La prueba entregada sí modela conceptualmente el escenario correcto: POST real, Auth y commit PostgreSQL,
upstream 200, 503 sólo al browser, corrupción de snapshot, dos `page.reload()`, cero input
`operationId`, snapshot intacto, conteos 1/1/1 antes del abandono y UUID nuevo sólo después del botón
explícito.

Sin embargo, `pnpm test:e2e:platform-admin:dev` falló **2/2** en ese caso con
`route.fulfill: Route is already handled`. El test espera que DB muestre el commit, pero eso puede
ocurrir antes de que el callback termine `route.fetch()` y `route.fulfill(503)`; entonces avanza al
refresh y cierra/muta la página mientras el interceptor sigue activo. Cada fallo abortó los cuatro
casos restantes y el teardown dejó una operación `PENDING` porque el request todavía terminaba durante
el cleanup.

Para separar producto de harness, el reviewer agregó temporalmente una única barrera que espera la
finalización de `route.fulfill(503)` antes de corromper/recargar, ejecutó sólo el mismo E2E real y retiró
el cambio. Ese probe pasó 1/1 y confirmó:

```text
operation_id A + Auth/DB COMMIT real + upstream 200 + browser 503
→ snapshot corrupto
→ refresh real
→ INVALID, sin operation_id
→ segundo refresh real
→ INVALID, sin operation_id
→ antes de abandonar: 1 Center, 1 ADMIN activa, 1 SUCCEEDED
→ abandono humano explícito
→ snapshot eliminado y UUID B generado, sin segundo efecto DB
```

Por tanto, la lógica de producto para JSON corrupto está corregida y B no aparece automáticamente;
la suite oficial aún debe incorporar una sincronización equivalente y demostrar ejecución completa y
cleanup determinista.

### Password, actor y autorización

- El snapshot contiene sólo versión, scope, actor UUID, operation UUID y payload material no secreto.
  La contraseña no forma parte del schema/estado persistido y no apareció en session/local storage,
  cookies, URL, logs, IndexedDB, bundle ni DB de provisioning. Tras refresh queda vacía.
- La clave está namespaced por actor y el contenido vuelve a exigir el mismo `actorUserId`; contenido
  de otro actor bajo la clave actual queda `INVALID`. Otro PLATFORM_ADMIN con clave propia ve ausencia
  real, no recupera la intención anterior.
- Storage no autoriza. `/platform` y cada lectura/mutación global continúan usando
  `requirePlatformAdmin()` server-side. No hay cambios en RLS, RPCs, grants, fingerprints ni schema DB.

### Advisory-lock harness

La corrección de `scripts/verify-auth-foundation.mjs` es válida. Obtiene `pg_backend_pid()` en la misma
conexión/transaction B que ejecuta la RPC bloqueada y consulta `pg_locks` por ese PID, `locktype =
'advisory'` y `granted = false`. No depende de `application_name` detrás del pooler ni reemplaza la
espera por una assertion trivial. Después libera A y verifica el resultado de B. Bootstrap y último
ADMIN conservan transacciones concurrentes reales y ambos barriers fueron observados.

`pnpm db:test:auth-foundation:dev` pasó 2/2: en ambas ejecuciones imprimió los PIDs realmente esperando
para bootstrap y Center ADMIN y terminó con cleanup cero.

### Checks y regresiones

| Verificación | Resultado |
| --- | --- |
| branch / HEAD / DEV | PASS: `task/005-auth-users-center-access`, `1c90881dab31ea5f9811057a012c8af664b59e33`, DEV `ehllxymqyzrofydrvtzo`; PROD fuera de alcance. |
| diff `supabase/` / migration sync | PASS: cero cambios funcionales DB y las nueve migrations local/remoto sincronizadas. |
| `pnpm bootstrap` | PASS; no ejecutó bootstrap persistente. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm db:test:schema:dev` | PASS con concurrencia real. |
| `pnpm db:test:auth-foundation:dev` | PASS 2/2 con los dos advisory locks observados y cleanup cero. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS y cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS. |
| `pnpm auth:check:dev` | PASS y cleanup cero. |
| `pnpm test:e2e:auth-access:dev` | PASS 9/9 y cleanup cero. |
| `pnpm test:e2e:platform-admin:dev` | **FAIL 2/2** en el nuevo caso por la carrera `Route is already handled`; sólo 3/8 corrieron en cada intento. |
| probe E2E sincronizado del reviewer | PASS 1/1 para el escenario real inválido, doble refresh, abandono y cleanup cero. |
| tests focalizados del hook | 17/17 PASS incluyendo probes read/remove failure; el probe de estructura desconocida confirmó la aceptación indebida como `VALID`. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS: lint, typecheck y 71/71 tests en 13 archivos. |
| `pnpm build` | PASS; `/platform` dinámica. |
| `pnpm security:check:client-bundle` | PASS. |
| `git diff --check` | PASS; sólo advertencias informativas LF/CRLF. |

Autorización `/platform`, identidad nueva/existente, activate/deactivate, tenant isolation, B1,
response-loss válido y provisioning/fingerprints A no mostraron regresiones en las suites que sí
completaron. El test oficial B2 no pudo volver a ejecutar sus cuatro casos posteriores debido a su
falla serial, por lo que no se los declara verdes en esta ronda sólo por resultados históricos.

### Cleanup y riesgo residual

Cada uno de los dos fallos oficiales dejó una única operación `PENDING` huérfana. Antes de eliminarla,
el reviewer verificó UUID exacto, tipo `PLATFORM_CREATE_CENTER`, `auth_user_id/result_center_id` nulos y
actor ya ausente; eliminó sólo esas dos filas. El probe sincronizado posterior terminó con su cleanup
oficial cero. La auditoría final confirmó 0 Auth users, 0 `public.users`, 0 Centers, 0 memberships, 0
PLATFORM_ADMIN, 0 provisioning operations y 0 procesos DB de tests.
No quedó listener local en puerto 3000 ni proceso E2E activo.

Se mantiene como riesgo residual aceptado que cerrar deliberadamente la pestaña o borrar manualmente
`sessionStorage` pierda metadata no secreta. El contrato aprobado continúa limitado a response-loss +
refresh dentro de la misma pestaña; no se amplía alcance.

No se modificó implementación durante el review, no se ejecutó bootstrap persistente, no se tocó PROD,
no hubo commit/push/PR, TASK-005 continúa abierta y B3 no comenzó.

## Re-review focalizado — TASK-005B2 B2-F1 — 2026-09-24

### Veredicto

`TASK-005B2 CHANGES_REQUESTED`

El camino normal de response-loss + refresh quedó corregido: con un snapshot válido el navegador
recupera `operation_id A`, conserva el payload, deja la contraseña vacía y el retry real termina con
un Center, una membership ADMIN y una operación `SUCCEEDED`. Sin embargo, el finding ALTO permanece
**ABIERTO / parcialmente remediado** porque un snapshot pendiente inválido u obsoleto se borra
silenciosamente y el hook genera `operation_id B`. Un probe E2E independiente reprodujo nuevamente
dos Centers para la misma intención humana después de un commit real y una respuesta perdida.

### Estado del finding histórico B2-F1

#### Lo corregido

- `sessionStorage` persiste sólo UUID, versión y payload material no secreto, namespaced por UUID del
  PLATFORM_ADMIN. Password no forma parte del schema ni del JSON serializado.
- El E2E oficial deja completar un POST real (`route.fetch()` devuelve 200), sustituye únicamente la
  respuesta al browser por 503, hace `page.reload()` real y comprueba que se recupera A.
- El retry cruza UI B2, Server Action, Auth y RPC reales. Resultado observado: exactamente un Center,
  una membership ADMIN activa y una fila `private.provisioning_operations` `SUCCEEDED`, todas ligadas
  a A; luego el snapshot se elimina.
- El payload recuperado queda read-only para nombre, dirección, teléfono, email/timezone del Center y
  nombre/apellido/email del ADMIN. Para una identidad nueva la contraseña vuelve vacía; si Auth aún
  la necesita, la Action devuelve `AUTH_CREATE_FAILED` en modo `same-operation` y exige reingresarla
  manteniendo A.
- Rerender, submit, error ambiguo y refresh conservan A mientras el snapshot sea válido. Éxito
  inequívoco lo limpia; `Crear otro centro` o abandono explícito emiten un UUID nuevo.

#### Defecto restante reproducido — ALTO

**Objeto:** `src/modules/access/components/use-platform-operation-intent.ts:24-40,70-78`.

`readPlatformOperationIntent()` no distingue “no existe intención” de “existe una intención pendiente
pero no puede validarse”. Ante JSON corrupto, versión/schema obsoleto u otro contenido inválido,
ejecuta `removeItem()` y retorna `null`; el inicializador interpreta ese `null` como ausencia de
intención y crea automáticamente B.

**Escenario E2E independiente contra DEV:**

```text
PLATFORM_ADMIN inicia alta con operation_id A
→ POST real llega al servidor
→ Auth + PostgreSQL confirman Center + ADMIN y el upstream responde 200
→ el browser recibe 503 simulado después del commit
→ el snapshot pendiente de A queda ilegible/corrupto
→ refresh real de /platform
→ el hook borra el snapshot y genera operation_id B sin abandono explícito
→ se reenvía el mismo formulario con la identidad Auth ya existente
→ PostgreSQL confirma un segundo Center y una segunda membership ADMIN
```

El probe verificó `B != A` y conteo exacto final de dos Centers antes de su cleanup. La DB se comporta
correctamente: las dos operaciones tienen UUID distintos, por lo que fingerprints/idempotencia A no
pueden reconocerlas como la misma intención. Esto incumple de forma directa el criterio solicitado
`snapshot inválido → no ejecutar provisioning inseguro` y el requisito de no caer silenciosamente a
un UUID nuevo para una intención pendiente.

**Riesgo:** corrupción parcial, cambio incompatible de schema o estado obsoleto durante una intención
ambigua puede reabrir exactamente la duplicación tenant que B2-F1 buscaba cerrar. El usuario no recibe
una señal de que abandonó A ni una opción consciente de reconciliar o descartar.

**Criterio de aceptación restante:**

1. diferenciar de forma explícita `storage key ausente` de `storage key presente pero inválida/no
   legible`;
2. ante estado presente inválido/no legible, bloquear provisioning y no borrar ni sustituir A de
   forma silenciosa; exponer un estado seguro de recuperación/abandono;
3. sólo una acción deliberada de abandono puede descartar esa intención y generar B cuando no sea
   posible recuperar A;
4. agregar unit/component y E2E del caso commit real + response-loss + snapshot inválido/obsoleto +
   refresh, demostrando que no se envía una nueva alta sin abandono explícito;
5. conservar el camino válido ya logrado: mismo A, payload fijo, password no persistida y exactamente
   un efecto de negocio.

### Password, storage, lifecycle y aislamiento

- **Password/storage válido:** PASS. La contraseña no apareció en `sessionStorage`, `localStorage`,
  cookies, URL/query params, logs capturados, IndexedDB (no se usa), bundle, tablas propias ni
  `provisioning_operations`; después del refresh el input quedó vacío.
- **Storage no disponible:** PASS de seguridad. Si `setItem` falla, el submit se cancela y se muestra
  error. Si la lectura lanza, el componente no habilita el formulario; no hay fallback a una Action.
  El manejo no es amable, pero es fail-closed.
- **Storage inválido:** FAIL. Se elimina y se genera B automáticamente, como se detalla arriba.
- **Aislamiento entre usuarios:** PASS. La clave incluye el UUID autenticado; un segundo
  PLATFORM_ADMIN no recupera la intención del primero. El UUID no otorga autorización y todas las
  mutaciones conservan `requirePlatformAdmin()` server-side. Logout/login no convierte metadata del
  browser en autoridad.
- **Lifecycle seguro con estado válido:** PASS. Payload material bloqueado, retry sin password después
  de commit, password nuevamente requerida si Auth no llegó a prepararse, éxito limpia y abandono
  explícito crea un UUID distinto.

`sessionStorage` no sobrevive el cierre deliberado de la pestaña/sesión. Se acepta como riesgo
residual para B2 porque el criterio aprobado exige recuperación tras refresh en la misma pestaña y no
estableció recuperación cross-tab/cross-session; exigirla ahora sería ampliar alcance. Esto no excusa
el defecto bloqueante ante una clave pendiente presente pero inválida.

### Regresiones y evidencia ejecutada

| Verificación | Resultado del re-review |
| --- | --- |
| branch / HEAD / diff DB | PASS: `task/005-auth-users-center-access`, HEAD/base B1 `1c90881dab31ea5f9811057a012c8af664b59e33`; cero cambios bajo `supabase/`. |
| `pnpm bootstrap` | PASS después de reconstruir dependencias locales; no ejecutó bootstrap persistente de PLATFORM_ADMIN. |
| `pnpm supabase:check:dev` | PASS contra DEV `ehllxymqyzrofydrvtzo`; PROD no fue tocado. |
| `pnpm test:e2e:platform-admin:dev` | PASS 7/7. El nuevo caso prueba POST/commit real, 503 sólo hacia browser, refresh real, A recuperado, retry B2, un Center/membership y cleanup. |
| probe E2E independiente snapshot inválido | **REPRODUCE defecto restante:** después de commit + response-loss, refresh eliminó A inválido, generó B y permitió exactamente dos Centers/dos memberships; cleanup cero. |
| tests focalizados de storage | PASS para snapshot válido, password ausente, actor distinto y `setItem` no disponible; confirma FAIL funcional de snapshot inválido al generar B. |
| `pnpm db:test:schema:dev` | PASS, incluida concurrencia real. |
| `pnpm db:test:auth-foundation:dev` | **FAIL 3/3** en `The bootstrap advisory-lock wait was not observed`; las tres ejecuciones completaron cleanup cero. B2 no cambió DB/migrations, pero la regresión requerida no queda verde y no se oculta en el veredicto. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS y cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS con Auth/PostgreSQL reales. |
| `pnpm auth:check:dev` | PASS y cleanup cero. |
| `pnpm test:e2e:auth-access:dev` | PASS 9/9 y cleanup cero. |
| migration sync | PASS: nueve migrations local/remoto sincronizadas. |
| DB lint | PASS: cero errores/resultados. |
| security advisors | PASS con las mismas siete WARN `SECURITY DEFINER` conocidas, cero ERROR y ninguna superficie nueva. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS: lint, typecheck y 61/61 tests en 13 archivos. |
| `pnpm build` | PASS; `/platform` continúa dinámica. |
| `pnpm security:check:client-bundle` | PASS; sin secret/admin client en cliente. |

Las pruebas B2 confirmaron además autorización `/platform`, identidad nueva/existente,
activate/deactivate, tenant isolation, B1, fingerprints/reconciliación A y manejo de secretos. El diff
no introdujo migrations, RLS, grants ni RPCs.

### Cleanup del re-review

Auditoría read-only final contra DEV: 0 `auth.users`, 0 `public.users`, 0 Centers, 0 memberships, 0
PLATFORM_ADMIN, 0 `private.provisioning_operations` y 0 sesiones DB de tests. Los probes temporales y
el store temporal generado durante bootstrap fueron retirados. No se ejecutó bootstrap persistente,
no se tocó PROD y no hubo commit, push, PR, archivo/cierre de TASK-005 ni trabajo de B3.

## Review independiente — TASK-005B2 — Platform Admin — 2026-09-23

### Veredicto

`TASK-005B2 CHANGES_REQUESTED`

La autorización global, los datos expuestos, el provisioning normal, la activación/desactivación y
las regresiones A/B1 pasan. B2 queda bloqueada por un defecto reproducible en el lifecycle de la
intención de alta frente a pérdida de respuesta seguida de refresh: el navegador pierde el
`operation_id` confirmado y permite producir un segundo Center para la misma intención humana.

### Finding abierto

#### B2-F1 — ALTO — el `operation_id` no sobrevive response-loss + refresh y permite duplicar el Center

**Objetos afectados:**

- `src/app/platform/page.tsx` — genera `randomUUID()` en cada montaje de `/platform`;
- `src/modules/access/components/use-platform-operation-intent.ts` — conserva el UUID sólo en
  `useState`;
- `src/modules/access/components/create-center-panel.tsx` — el bloqueo de payload depende de que el
  cliente haya recibido un `PlatformActionState.retryMode`, sin recuperación durable después de
  perder la respuesta.

**Escenario reproducido contra DEV con UI, Action, Auth y PostgreSQL reales:**

```text
PLATFORM_ADMIN completa Center + ADMIN nuevo con operation_id A
→ POST real de Server Action
→ PostgreSQL confirma Center + public.users + membership ADMIN + SUCCEEDED
→ el probe deja terminar el request upstream y descarta deliberadamente su respuesta al browser
→ React recibe un error de transporte no convertido en estado ambiguo controlado
→ refresh completo de /platform
→ el Server Component entrega operation_id B, distinto de A
→ se reingresa exactamente el mismo Center/email
→ la identidad Auth existente se reutiliza
→ se confirma un segundo Center y una segunda membership ADMIN
```

El probe determinista observó dos Centers con el mismo payload material y dos operaciones
`SUCCEEDED`, una para cada UUID. El primer commit no duplicó Auth; la duplicación ocurrió porque el
refresh perdió la intención original. Esto no es un defecto del protocolo A: con el mismo UUID, un
probe integrado separado confirmó un único Center/membership y rechazo de una mutación material. El
problema está en el lifecycle B2 que permite reemplazar el UUID sin una acción deliberada del usuario.

**Riesgo:** una respuesta de Server Action perdida después de un commit válido puede inducir al
PLATFORM_ADMIN a crear silenciosamente un segundo tenant. El nuevo UUID evita que las fingerprints e
idempotencia de Fase A reconozcan el retry.

**Criterio de aceptación restante:**

1. una intención iniciada debe recuperar el mismo `operation_id` después de un refresh completo o
   recuperación equivalente del estado ambiguo, sin persistir la contraseña fuera de Auth;
2. después de commit + pérdida de respuesta, la UI debe reconstruir/reconciliar el resultado de A y
   el retry debe usar el UUID original;
3. el payload material debe permanecer fijado para ese retry; para cambiar datos debe existir una
   acción deliberada de “nueva intención” que emita otro UUID;
4. agregar un E2E real que deje confirmar el request de negocio, descarte la respuesta al navegador,
   recargue o recupere la UI, reintente y demuestre exactamente un Center, una membership ADMIN y una
   operación efectiva;
5. conservar la propiedad actual de que reutilizar el mismo UUID con argumentos materiales distintos
   falla antes de cualquier efecto.

### Autorización `/platform` y Server Actions

**Resultado:** PASS.

- La página empieza con `requirePlatformAdmin()` y las lecturas `listPlatformCenters` y
  `getAccessOverview` consultan estado actual por cliente SSR. No dependen de botones, proxy, claims
  de rol ni estado React como autoridad.
- Resolución exacta, alta y activar/desactivar vuelven a ejecutar `requirePlatformAdmin()` antes de
  validar o mutar; los wrappers DB vuelven a guardear y las RPCs conservan la validación interna de
  Fase A.
- Unit tests y revisión de código confirman PLATFORM_ADMIN permitido; ADMIN, RECEPTION,
  PROFESSIONAL y authenticated común denegados. Un probe real con sesión ADMIN tenant obtuvo DENY
  tanto en `platform_list_centers` como en `platform_set_center_active`.
- Unauthenticated sigue redirigiendo a `/login`; B1 E2E volvió a pasar. No se implementó B3.

### Tabla, contadores y aislamiento

**Resultado:** PASS.

- La tabla muestra exclusivamente nombre, estado, dirección, teléfono, email, fecha de alta, los
  tres contadores y acciones. Tiene estado vacío y CTA, fallbacks, badges y contenedor
  `overflow-x-auto`.
- Los datos vienen sólo de `platform_list_centers`; no se descargan memberships,
  ProfessionalCenter ni Specialty. El alta real mostró `Usuarios = 1`, `Profesionales = 0` y
  `Especialidades = 0`.
- El diff desde `1c90881dab31ea5f9811057a012c8af664b59e33` no toca `supabase/`: cero migrations,
  RLS, grants, RPCs o tipos modificados.
- Un probe con sesión PLATFORM_ADMIN sin membership obtuvo cero filas tenant mediante RLS. Las
  suites A volvieron a confirmar aislamiento cross-center, direct writes denied, último ADMIN y que
  Person/PatientCenter/pacientes/appointments/agenda/availabilities/notas siguen cerrados.

### Alta con identidad nueva y existente

**Resultado funcional:** PASS, sujeto al finding de lifecycle.

- Zod normaliza nombres/contactos con trim, email lowercase y opcionales vacíos; timezone IANA
  inválida y password de 9 caracteres son rechazados, 10 aceptados.
- Identidad nueva: Auth confirmado, perfil y exactamente una membership ADMIN activa. Password sólo
  viaja en el formulario/Action y Auth Admin; no aparece en URL, logs ni tablas propias.
- Identidad existente: la UI no renderiza password; la Action vuelve a resolver y reemplaza cualquier
  nombre/password enviados por los valores autoritativos. El E2E real confirmó email, password,
  nombres y membership previa sin cambios y sólo agregó el nuevo acceso ADMIN.
- La resolución retorna únicamente existencia, UUID/email/nombres mínimos; no filtra otros Centers
  ni roles.

### `operation_id`, retry y concurrencia

**Resultado:** FAIL por B2-F1.

- PASS dentro de un montaje: rerender, submit y retry conservan el UUID; pending deshabilita submit;
  `Crear otro centro` genera uno diferente. El servidor valida UUID y la DB liga actor, scope, tipo
  y payload material; el UUID no autoriza.
- PASS integrado sin refresh: el probe de reviewer hizo commit real + fault injection post-commit a
  través de `performCreatePlatformCenterAction`, reconcilió `SUCCEEDED`, reintentó el mismo UUID y
  obtuvo el mismo Center/membership. La mutación de nombre con ese UUID falló sin segundo efecto.
- FAIL al perder la respuesta HTTP y recargar: el estado in-memory desaparece, se genera un UUID
  nuevo y la misma intención crea un segundo Center. La suite oficial no cubre esta frontera.
- Las suites de Fase A volvieron a pasar response-loss, fingerprints, dos ejecuciones concurrentes
  con el mismo UUID, estado incierto, rollback y compensación fallida.

### Activate/deactivate

**Resultado:** PASS.

`CenterStatusForm` pide confirmación, deshabilita mientras envía y la Action reautoriza/valida antes
de llamar exclusivamente `platform_set_center_active`. El E2E confirmó que desactivar conserva la
membership pero niega tenant, y reactivar restaura acceso con ADMIN activo. La suite A mantiene el
rechazo de reactivación sin ADMIN y la invariante concurrente del último ADMIN. No hay delete.

### Secretos y fronteras cliente/servidor

**Resultado:** PASS.

- Ningún Client Component importa `admin.ts`, `createSupabaseAdminClient` ni módulos Admin.
- El único uso B2 de la secret key está en el runner E2E Node para fixtures. No hay key legacy,
  password en URL/logs, secretos en source maps/bundle ni datasets tenant en `/platform`.
- `security:check:client-bundle` pasó después del build. No se mostró ni imprimió el valor de
  `SUPABASE_SECRET_KEY` y no se ejecutó bootstrap persistente.

### E2E, probes y regresiones ejecutadas

| Verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS con `CI=true`; la primera invocación no interactiva sólo encontró el prompt de pnpm para su store. |
| `pnpm supabase:check:dev` | PASS contra DEV `ehllxymqyzrofydrvtzo`. |
| `pnpm test:e2e:platform-admin:dev` | PASS 6/6 y cleanup cero. Cubre empty/list, alta nueva, `Usuarios = 1`, activate/deactivate, ADMIN/common deny e identidad existente. No cubre response-loss + refresh. |
| probe integrado Action B2 independiente | PASS: commit+response-loss interno, retry mismo UUID, mutación material DENY, ADMIN global DENY y PLATFORM_ADMIN tenant DENY; cleanup cero. |
| probe E2E independiente response-loss + refresh | **REPRODUCE B2-F1**: UUID A fue reemplazado por B y la misma intención confirmó dos Centers. Un primer intento con `route.abort` fue no concluyente por error del harness; la repetición determinista dejó terminar upstream y devolvió 503 al browser. Cleanup cero. |
| `pnpm test:e2e:auth-access:dev` | PASS 9/9 y cleanup cero. |
| `pnpm db:test:schema:dev` | PASS, incluida concurrencia real. |
| `pnpm db:test:auth-foundation:dev` | PASS, incluido último ADMIN/RLS y cleanup cero. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS, incluido response-loss/retry/fingerprints/concurrencia/compensación y cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS con Auth/PostgreSQL reales y fault injection test-only. |
| `pnpm auth:check:dev` | PASS: signup OFF, mínimo 10, Site URL y redirects exactos; cleanup cero. |
| `supabase migration list --linked` | PASS: nueve migrations local/remoto sincronizadas. |
| `supabase db lint --linked --schema public,private --level warning` | PASS: cero resultados. |
| Security advisors `--fail-on error` | PASS con exactamente las siete WARN `SECURITY DEFINER` conocidas y cero ERROR/nueva superficie. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS: lint, typecheck y 56/56 tests en 13 archivos. |
| `pnpm build` | PASS; `/platform` dinámica. |
| `pnpm security:check:client-bundle` | PASS. |
| `git diff --check` | PASS; sólo avisos informativos LF/CRLF. |

### Cleanup final

Auditoría independiente posterior a todas las suites/probes:

- 0 Auth fixtures;
- 0 `public.users` fixtures;
- 0 Centers y Specialty fixtures;
- 0 memberships fixtures;
- 0 PLATFORM_ADMIN fixtures;
- 0 `private.provisioning_operations`;
- 0 sesiones `pg_stat_activity` con `application_name task005*`;
- 0 listener local en puerto 3000;
- los archivos/probes temporales del reviewer fueron retirados.

### Riesgos residuales y estado

- **Bloqueante:** B2-F1 permanece abierto; hasta corregirlo, la foundation idempotente de A no
  protege la intención humana a través de un refresh de browser después de response-loss.
- La suite oficial B2 debe incorporar esta frontera para evitar regresión; hoy sus 6 casos sólo
  prueban el UUID dentro del montaje y una nueva intención después de éxito conocido.
- Se mantienen los riesgos ya aceptados pre-PROD: SMTP de desarrollo, rate limiting definitivo y
  retención futura de operaciones. PROD continuó fuera de alcance.

Sólo se actualizó este review. No hubo corrección de implementación, bootstrap persistente, commit,
push, PR, cierre/archivo de TASK-005 ni trabajo de B3.

## Review independiente — TASK-005B1 — 2026-09-23

### Veredicto

`TASK-005B1 REVIEW PASS`

La aprobación alcanza exclusivamente B1: login/logout, recovery/callback/update-password,
resolución de acceso 0/1/N, selector, shell tenant protegido y placeholder `/platform`. No se
implementó la administración global ni tenant de B2. TASK-005 continúa abierta.

### Login y sesión SSR

**Resultado:** PASS.

- `loginAction` recibe `FormData`, valida email/password con Zod en servidor y llama
  `signInWithPassword` mediante el cliente SSR basado en cookies.
- Los errores del proveedor se colapsan en el único mensaje
  `No pudimos iniciar sesión con esos datos.`. Un E2E independiente comparó email existente con
  password incorrecta contra email inexistente y obtuvo exactamente el mismo resultado público.
- No existe signup público, enlace de registro ni Action de alta.
- No existe `next` post-login controlable por el usuario: el servidor calcula el destino desde DB.
- Los formularios exponen labels asociados, autocomplete correcto, foco inicial, errores asociados,
  `aria-invalid`, mensaje con `alert/status` y botón pending/disabled.
- El proxy llama `getClaims()` para refrescar/copiar cookies, pero la autorización final vuelve a
  ejecutar guards y queries DB en Server Components/Actions. No se usa localStorage, sessionStorage,
  cookies de Center ni estado React como autoridad.

Cadena verificada:

```text
signInWithPassword
→ cookies SSR
→ request server-side / getClaims
→ requireUser + estado actual DB/RLS
→ destino autorizado
→ signOut local
→ guards vuelven a rechazar la sesión
```

### Resolución 0/1/N y selector

**Resultado:** PASS.

`getAccessOverview()` parte de `requireUser()`, consulta exclusivamente memberships activas del UUID
autenticado y después Centers activos alcanzables por esas memberships. Consulta por separado la
fila propia de `platform_admins`; no infiere permisos desde claims de rol.

| Estado actual | Destino observado |
| --- | --- |
| 0 Centers + sin PLATFORM_ADMIN | `/no-access` |
| 1 Center activo | `/centers/[centerId]` |
| 2 Centers activos | `/select-center` |
| membership inactiva / Center inactivo | no cuentan; `/no-access` en el fixture |
| 0 Centers + PLATFORM_ADMIN | `/platform` |

`/select-center` muestra sólo nombre y role de los Centers accesibles. Los links únicamente navegan;
`/centers/[centerId]` vuelve a autorizar el ID. Con cero o una opción, el selector redirige al destino
canónico y no crea preferencias/cookies de autoridad.

### Tenant isolation y `/centers/[centerId]`

**Resultado:** PASS.

- El parámetro se valida como UUID antes de consultar.
- `requireCenterMembership(centerId)` exige identidad/perfil actual, membership activa del mismo
  usuario y Center activo mediante dos queries RLS.
- Si la membership no existe, la segunda query de Center ni siquiera se ejecuta; un actor de A no
  obtiene nombre, timezone ni señal de existencia de B.
- ID inválido, Center ajeno, membership inactiva o Center inactivo terminan en 404. El E2E oficial
  confirmó A→B 404; el probe independiente desactivó el Center accedido y confirmó 404 sin nombre.
- PLATFORM_ADMIN sin membership recibió 404 en tenant. La URL nunca se usa como permiso.

### `/platform` placeholder

**Resultado:** PASS.

La página comienza por `requirePlatformAdmin()` y sólo después resuelve si la misma identidad posee
alguna membership propia para ofrecer navegación tenant independiente. No llama RPCs globales, no
lista Centers, no crea/modifica datos y no importa operaciones de provisioning. Un E2E independiente
confirmó que un ADMIN tenant es rechazado y vuelve a su destino tenant; PLATFORM_ADMIN sin
membership ve sólo el placeholder y tampoco accede a un Center por URL. No se adelantó B2.

### Logout

**Resultado:** PASS.

La Action usa exactamente `signOut({ scope: "local" })` con el cliente SSR, luego redirige a
`/login`. El E2E oficial confirmó que `/` vuelve a login. El probe independiente agregó navegación
atrás y acceso directo posterior a `/centers/[centerId]`: ambos terminaron en login y ningún Server
Component recuperó una sesión útil.

### Recovery, callback y update-password

**Resultado:** PASS con límite de cobertura documentado.

- Recovery valida email con Zod y usa exclusivamente
  `http://localhost:3000/auth/callback`. El error de Supabase nunca se expone y el resultado público
  es siempre anti-enumeración. Un probe real comparó cuenta existente/inexistente y obtuvo el mismo
  mensaje.
- El callback sólo acepta `code`, llama `exchangeCodeForSession(code)` y allowlistea `next` mediante
  igualdad exacta con `/update-password`. Ausencia/código inválido termina en un mensaje seguro de
  login.
- HTTPS externo, protocol-relative, valor percent-encoded, double-encoded y esquema `javascript:`
  fueron probados y permanecieron en el origen local. No hay password ni token persistido por código
  en URL, localStorage o sessionStorage.
- `/update-password` exige `getClaims()` válido tanto al renderizar como en la Server Action, sólo
  envía `{ password }` a `updateUser`, valida mínimo 10 y confirmación coincidente con Zod y nunca
  modifica email. El éxito vuelve a la resolución normal de acceso.
- La suite unitaria confirma que 9 caracteres no alcanzan Auth; `auth:check:dev` confirma además que
  Supabase Auth rechaza 9 y acepta 10 sin composición. El E2E actual valida el estado UI y realiza un
  cambio real seguido de logout/re-login con la contraseña nueva.

**Límite:** la entrega de email y el click de un recovery link PKCE válido no están automatizados
end-to-end; el E2E cubre recovery público, callback inválido y update real bajo sesión válida. La
implementación exacta de `exchangeCodeForSession` y los redirects efectivos de Auth DEV fueron
revisados, por lo que este límite no bloquea B1, pero deberá conservarse visible mientras DEV use el
SMTP de desarrollo.

### Fronteras, secretos y diff

**Resultado:** PASS.

- El diff desde `9c81e0fc03f4bf3ee4fd1e1a9b0d026e2584e889` no contiene cambios bajo
  `supabase/`; no se modificaron migrations, schema, RLS, grants ni RPCs de Fase A.
- Ningún Client Component importa `admin.ts`, `createSupabaseAdminClient` o secrets. El único uso
  nuevo de `SUPABASE_SECRET_KEY` está en el runner E2E Node para crear/eliminar Auth fixtures.
- No hay logs de credenciales/passwords, password en query/href, recovery token en storage ni uso
  nuevo de service-role legacy.
- `security:check:client-bundle` inspeccionó fuentes y `.next/static` después del build y pasó.
- Provisioning/idempotencia/fingerprints, RLS cross-center, último ADMIN y separación
  PLATFORM_ADMIN/tenant pasaron nuevamente sus suites reales.

### E2E y verificaciones ejecutadas

| Verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS. |
| `pnpm supabase:check:dev` | PASS. |
| `pnpm test:e2e:auth-access:dev` | Primer intento: timeout transitorio en el segundo login, cleanup cero. Rerun limpio: PASS 9/9. |
| probe E2E independiente | PASS 6/6 — anti-enumeración, `/platform` deny, logout/back, Center inactivo, recovery comparable y redirects codificados. Archivo retirado. |
| `pnpm db:test:schema:dev` | PASS. |
| `pnpm db:test:auth-foundation:dev` | PASS con concurrencia y cleanup cero. |
| `pnpm db:test:provisioning-reconciliation:dev` | PASS con cleanup cero. |
| `pnpm db:test:provisioning-orchestration:dev` | PASS. |
| `pnpm auth:check:dev` | PASS con cleanup cero. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS — lint, typecheck y 40/40 tests. |
| `pnpm build` | PASS — once rutas compiladas; rutas protegidas dinámicas. |
| `pnpm security:check:client-bundle` | PASS. |
| `git diff --check` | PASS; sólo avisos informativos LF/CRLF, sin whitespace errors. |
| `supabase projects list` | PASS — único proyecto visible/linkeado DEV `ehllxymqyzrofydrvtzo`, `sa-east-1`, `ACTIVE_HEALTHY`. |

### Cleanup final

Una auditoría independiente posterior a todas las suites confirmó:

- 0 Auth users temporales B1;
- 0 `public.users` temporales;
- 0 Centers B1;
- 0 memberships B1;
- 0 PLATFORM_ADMIN temporales;
- 0 `private.provisioning_operations`;
- 0 procesos E2E `task005b1-*` activos.

No se leyó ni imprimió `SUPABASE_SECRET_KEY`. No se ejecutó bootstrap persistente y PROD permaneció
fuera de alcance.

### Riesgos residuales

- La primera corrida E2E tuvo un timeout no reproducido en una Server Action de login; el cleanup
  funcionó y el rerun 9/9 más el probe 6/6 pasaron. Es riesgo de estabilidad del entorno DEV, no una
  falla funcional reproducible.
- El flujo válido completo email → PKCE callback no está automatizado por ausencia de inbox SMTP de
  test; se conserva la cobertura estática/configuración + Auth real parcial indicada arriba.
- SMTP de desarrollo y rate limiting definitivo siguen sin ser aptos para PROD, que permanece fuera
  de alcance.

No hubo commit, push, PR, bootstrap persistente, cierre/archivo de TASK-005 ni trabajo de B2.

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
