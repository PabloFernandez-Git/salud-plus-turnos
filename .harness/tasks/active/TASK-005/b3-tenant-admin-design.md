# TASK-005B3 — Tenant ADMIN user and membership administration

**Estado:** `DESIGN APPROVED FOR IMPLEMENTATION`

## 1. Objetivo y alcance exacto

Convertir el shell tenant en una primera superficie administrativa útil para que una membership
`ADMIN` activa gestione exclusivamente los usuarios y accesos de su Center activo.

B3 incluye:

- listado de memberships activas e inactivas del Center, con identidad de aplicación y asociación
  profesional cuando exista;
- resolución exacta por email;
- alta de una identidad nueva o reutilización de una identidad existente;
- creación de una única membership `ADMIN`, `RECEPTION` o `PROFESSIONAL` por User-Center;
- reactivación, desactivación y cambio explícito de rol/ProfessionalCenter;
- autorización server-side, RLS, RPCs estrechas, idempotencia Auth/DB y pruebas negativas;
- navegación tenant mínima y estados accesibles de carga, vacío, éxito y error.

No se edita la identidad global, no se elimina ninguna fila y PLATFORM_ADMIN no aporta autoridad
tenant.

## 2. Baseline DEV persistente auditado

Auditoría read-only del 2026-09-25 contra `ehllxymqyzrofydrvtzo`:

| Entidad | Cantidad | Estado relevante |
| --- | ---: | --- |
| `auth.users` | 1 | identidad persistente del smoke |
| `public.users` | 1 | proyección de la misma identidad |
| `platform_admins` | 1 | PLATFORM_ADMIN persistente |
| `centers` | 1 | `Centro Médico Salud Plus`, activo |
| `center_memberships` | 1 | ADMIN activa; mismo User que PLATFORM_ADMIN |
| `professionals` | 0 | sin datos |
| `professional_centers` | 0 | sin datos |
| `specialties` | 0 | sin datos |
| `private.provisioning_operations` | 2 | ambas `SUCCEEDED` |

El Center persistente es `76dcbe41-38be-475d-a590-f4ae6619c1e8`, timezone
`America/Argentina/Buenos_Aires`. La operación bootstrap
`352a309e-f137-488e-b6e7-4b53e2cdb7b2` terminó `SUCCEEDED` creando la identidad; la operación
`964ec4bf-eeba-4f4f-914a-d2a8ca101934` terminó `SUCCEEDED` reutilizándola para crear el Center y su
primer ADMIN. No existen identidades Auth con los namespaces temporales conocidos de TASK-005.

Estos son **datos persistentes de desarrollo**. B3 no puede borrarlos, convertirlos en fixtures ni
incluirlos en cleanup. Los tests usarán un `runId` propio, registrarán cada UUID creado y borrarán
únicamente esos UUIDs en `finally`; no usarán cleanup global por prefijo.

Las doce migrations locales y DEV están sincronizadas. El catálogo real conserva seis policies
`SELECT`, seis grants de tabla `SELECT` para `authenticated`, cero grants DML genéricos y las tres
RPCs tenant con `EXECUTE` sólo para `authenticated` (no `anon`/`PUBLIC`).

## 3. Rutas, navegación y UI

### Rutas

- `/centers/[centerId]`: inicio del Center y navegación mínima tenant.
- `/centers/[centerId]/users`: listado y administración B3, protegido por
  `requireRole(centerId, ["ADMIN"])`.

El enlace **Usuarios y accesos** se muestra sólo al ADMIN como ayuda de UX, pero la ruta y cada
Server Action vuelven a autorizar. No se crea una ruta de detalle por usuario en B3: alta y edición
se resuelven en panel/dialog accesible dentro del listado.

La tabla propuesta contiene:

- nombre y apellido globales;
- email proyectado;
- rol en este Center;
- estado de la membership;
- profesional asociado y estado del ProfessionalCenter, si corresponde;
- acciones de rol/estado.

No muestra otros Centers, roles externos, contraseña, metadata Auth ni permisos de plataforma. El
usuario actual puede llevar una marca puramente visual; no modifica las reglas de self-demotion.

Mejora UX futura registrada: hoy un usuario que es simultáneamente PLATFORM_ADMIN y tenant ADMIN no
tiene acceso visible desde el Center hacia `/platform`. Queda fuera de B3 salvo aprobación explícita
posterior.

## 4. Operaciones ADMIN y flujo de identidad

### Listar

Una query server-only parte de `center_memberships` filtrada por el `centerId` autorizado y obtiene
el `public.users` visible por RLS. Para asociaciones profesionales consulta únicamente los
ProfessionalCenter del mismo Center que RLS permite al ADMIN y los Professional alcanzables. No se
necesita una RPC de listado ni un cliente privilegiado.

### Alta por email exacto

1. Server Action valida UUID de Center y email lowercase con Zod.
2. `requireRole(centerId, ["ADMIN"])` valida sesión, Center activo y membership ADMIN activa.
3. `admin_resolve_user_by_email(centerId, email)` resuelve una coincidencia exacta.
4. La respuesta nunca incluye otros Centers ni sus roles.
5. Si la membership ya existe:
   - activa: informar que ya tiene acceso y dirigir a la edición explícita;
   - inactiva: ofrecer reactivación mediante `admin_set_center_membership`, no una nueva alta.
6. Si la identidad existe pero no la membership, reutilizar `auth.users`/`public.users`; nombres,
   email y password se muestran como no editables/no solicitados.
7. Si no existe la identidad de aplicación, pedir nombre, apellido y contraseña inicial de al menos
   10 caracteres; `provisionCenterUser` crea Auth confirmado, deriva la proyección desde el Auth
   realmente creado y crea User + membership.

Una identidad Auth sin `public.users` provoca el error reconciliable ya previsto; no se intenta una
segunda cuenta con el mismo email. Los errores de infraestructura son genéricos. El único oracle
aceptado es la búsqueda exacta iniciada por un ADMIN que ya conoce el email; no hay autocomplete,
búsqueda parcial ni listado global.

### Idempotencia y fallo parcial

La UI tenant conserva un `operationId` estable por actor + Center + intención, con contrato estricto
y sin persistir la contraseña. Reutiliza `prepare_tenant_user_provisioning_operation`, binding,
fingerprint, reconciliación y compensación existentes. Un retry idéntico devuelve el resultado; un
payload distinto con el mismo ID falla. Sólo se elimina un Auth creado por esa misma operación y
sólo tras confirmar ausencia de commit DB.

Los cambios de rol/estado no cruzan Auth y DB: usan una única RPC transaccional de estado deseado.
Son reintentables y no requieren una provisioning operation nueva.

## 5. Comportamiento por rol

| Actor / rol objetivo | Listar | Crear/reutilizar | Cambiar rol/estado |
| --- | --- | --- | --- |
| ADMIN tenant activo | Sí, sólo su Center activo | Sí | Sí, sujeto a último ADMIN y vínculo profesional |
| RECEPTION | No | No | No |
| PROFESSIONAL | No | No | No |
| PLATFORM_ADMIN sin ADMIN tenant | No | No | No |
| PLATFORM_ADMIN + ADMIN tenant | Sí, por su membership ADMIN | Sí | Sí |

Para una membership objetivo:

- `ADMIN`: `professional_center_id = NULL`;
- `RECEPTION`: `professional_center_id = NULL`;
- `PROFESSIONAL`: requiere ProfessionalCenter del mismo Center; si la membership queda activa, ese
  ProfessionalCenter también debe estar activo;
- activar: revalida el estado completo y, para PROFESSIONAL, el vínculo activo;
- desactivar: conserva la fila y demás memberships del User;
- cambiar rol: es explícito; nunca ocurre como efecto lateral de alta/reactivación;
- DELETE: no existe en B3.

## 6. Estrategia PROFESSIONAL

B3 no crea Professional ni ProfessionalCenter. DEV actualmente tiene cero filas de ambos tipos y no
se crearán profesionales ficticios para habilitar el formulario.

La UI:

- lista memberships PROFESSIONAL ya existentes y su asociación;
- sólo puede ofrecer un ProfessionalCenter real, activo y del mismo Center;
- bloquea el alta/cambio a PROFESSIONAL cuando no hay opciones válidas y explica que primero debe
  existir el profesional mediante su futuro módulo;
- permite desactivar una membership PROFESSIONAL aunque su ProfessionalCenter haya quedado
  inactivo; reactivarla exige que el vínculo esté activo.

La última regla descubre una corrección necesaria en `admin_set_center_membership`: hoy exige un
ProfessionalCenter activo incluso al desactivar. B3 prevé una migration incremental que mantenga el
check same-center siempre, exija actividad sólo cuando `p_is_active = true` y conserve la autoridad
DB. No agrega escrituras sobre Professional/ProfessionalCenter.

### B3-D1 aprobada — asociación exclusiva activa

La decisión aprobada es:

```text
ProfessionalCenter
→ máximo una center_membership PROFESSIONAL activa
```

No se modelan asistentes, delegados ni cuentas compartidas reutilizando el mismo
ProfessionalCenter. Si aparece esa necesidad tendrá una entidad y autorización explícitas.

La implementación preferida combina DB + RPC:

1. un índice UNIQUE parcial sobre `center_memberships(professional_center_id)` con predicado
   `role = 'PROFESSIONAL' AND is_active` es la autoridad final y concurrentemente segura;
2. `admin_provision_center_user` y `admin_set_center_membership` validan anticipadamente que no haya
   otra membership activa para devolver un error de dominio estable;
3. todas las RPCs legítimas conservan el advisory lock común por `center_id`.

No se usa UNIQUE absoluto porque impediría conservar dos memberships históricas inactivas que, en
momentos distintos, representaron al mismo ProfessionalCenter. PostgreSQL no ofrece una UNIQUE
constraint declarativa parcial equivalente; una exclusion constraint sería más compleja sin aportar
una semántica adicional. El índice UNIQUE parcial expresa exactamente la regla y también protege
frente a un futuro camino de escritura que olvide el precheck RPC.

El índice no único actual sobre `professional_center_id` se conserva: sigue siendo útil para
consultar asociaciones activas e históricas.

### Transiciones PROFESSIONAL exactas

| Operación | Regla DB/RPC |
| --- | --- |
| crear membership PROFESSIONAL activa | PC no nulo, existente, activo, del mismo Center y sin otra membership PROFESSIONAL activa |
| cambiar ADMIN/RECEPTION → PROFESSIONAL | PC válido/activo/same-center y libre; también se verifica último ADMIN |
| cambiar el PC de una membership PROFESSIONAL | nuevo PC válido/activo/same-center y libre |
| reactivar membership PROFESSIONAL | PC asociado válido/activo/same-center y libre |
| desactivar membership PROFESSIONAL sin cambiar rol/PC | permitido aunque el PC esté inactivo; es reducción de permisos |
| repetir el estado inactivo sin cambiar rol/PC | no-op permitido aunque el PC esté inactivo |
| cambiar PROFESSIONAL → ADMIN/RECEPTION | `professional_center_id = NULL`; último ADMIN se verifica si corresponde |

La excepción al requisito de PC activo es estrictamente la reducción/no-op que mantiene el rol y el
`professional_center_id` actuales y deja `is_active = false`. Cambiar rol o asociación no puede
disfrazarse de desactivación: esas operaciones vuelven a exigir un PC activo.

El `user_id` de una membership nunca se cambia. Para asociar el ProfessionalCenter a otra cuenta:

1. desactivar la membership PROFESSIONAL anterior conservando su rol/PC como historial;
2. crear, reactivar o cambiar explícitamente la membership del nuevo User;
3. el índice parcial y el lock impiden que ambos pasos terminen con dos asociaciones activas.

No se agrega una RPC de transferencia: el estado intermedio sin cuenta activa reduce permisos y es
seguro; si el segundo paso falla puede reintentarse. Una transferencia atómica sería complejidad no
necesaria para B3.

El historial preservado es el que permite el modelo actual: filas inactivas no se borran y, durante
una reasignación, la fila anterior conserva rol y PC. `center_memberships` no es una tabla temporal;
si más adelante esa misma fila cambia de rol o PC, no conserva versiones anteriores. Auditoría
temporal completa queda fuera de B3 y requeriría un modelo explícito.

## 7. Invariantes y concurrencia

La autoridad sigue siendo `admin_set_center_membership` y el advisory lock común derivado de
`center_id`:

- desactivar o degradar al último ADMIN aborta con postcondición DB;
- el último ADMIN tampoco puede autodesactivarse/autodegradarse;
- con dos o más ADMIN, uno puede modificarse a sí mismo si permanece otro ADMIN activo;
- dos ADMIN que intenten dejar al otro/ellos mismos como último se serializan y no pueden confirmar
  ambos cambios;
- PLATFORM_ADMIN no cuenta como ADMIN;
- Center inactivo conserva memberships y al menos un ADMIN, pero los guards/RPC tenant deniegan
  operación hasta que plataforma lo reactive;
- reactivar el Center sigue requiriendo un ADMIN activo.

La UI puede anticipar y explicar errores, pero no calcula ni decide por sí sola quién es “el último”.

## 8. Contratos existentes reutilizados

| Contrato | Uso B3 | Estado |
| --- | --- | --- |
| `requireRole(centerId, ["ADMIN"])` | página, queries y cada mutación | sirve sin cambios |
| RLS `center_memberships_select_self_or_center_admin` | listado sólo del Center administrado | sirve sin cambios |
| RLS `users_select_self_or_center_admin` | identidad de members alcanzables | sirve sin cambios |
| policies Professional/ProfessionalCenter | nombre/vínculo visible al ADMIN | sirven sin cambios |
| `admin_resolve_user_by_email` | resolución exacta, sin otros Centers/roles | sirve sin cambios |
| `provisionCenterUser` + provisioning RPCs | alta/reutilización Auth/DB | sirven sin cambios |
| `admin_set_center_membership` | rol, vínculo y estado | requiere validación state-aware y exclusividad activa |

Las Server Actions serán adaptadores delgados: parsean FormData, autorizan, llaman servicios de
`src/modules/access/server/`, mapean errores seguros y revalidan `/centers/[centerId]/users`. Ningún
ID enviado por el cliente se toma como autorización.

## 9. Matriz RLS/grants revisada

| Tabla | SELECT B3 | INSERT | UPDATE | DELETE | Autoridad |
| --- | --- | --- | --- | --- | --- |
| `platform_admins` | sólo fila propia, sin uso para tenant | deny | deny | deny | policy actual |
| `centers` | Center activo de la membership | deny | deny | deny | policy actual |
| `users` | propio o User alcanzable por ADMIN compartiendo Center | deny | deny | deny | policy actual + RPC de provisioning |
| `center_memberships` | propias activas o todas las del Center administrado | deny | deny | deny | policy actual + RPCs estrechas |
| `professional_centers` | ADMIN del Center; PROFESSIONAL propio | deny | deny | deny | policy actual |
| `professionals` | alcanzable por PC administrado; PROFESSIONAL propio | deny | deny | deny | policy actual |

`authenticated` conserva únicamente `SELECT` sobre esas seis tablas. `anon` no recibe acceso de
dominio. `prepare_*`, bind/reconcile/compensación continúan service-only; la secret key no se usa
para listar ni mutar datos normales. No se agregan policies DML ni grants genéricos.

Las demás tablas permanecen default-deny. B3 no necesita SELECT sobre pacientes, personas,
especialidades, disponibilidad ni appointments.

## 10. Cambios previstos

### Database

Una única migration incremental transaccional, propuesta como
`enforce_professional_membership_assignment`, debe:

1. comprobar antes de crear el índice que no existan ProfessionalCenter con más de una membership
   PROFESSIONAL activa; si existen, abortar sin elegir ganadores ni reescribir historia;
2. crear el índice UNIQUE parcial sobre `professional_center_id` para filas
   `role = 'PROFESSIONAL' AND is_active`;
3. reemplazar `admin_provision_center_user` conservando firma, idempotencia, fingerprint, locks,
   autorización y compensación, y agregar el conflicto semántico de PC ya asignado;
4. reemplazar `admin_set_center_membership` conservando firma, autorización, lock y último ADMIN, y
   aplicar las transiciones state-aware definidas arriba;
5. reafirmar `search_path = ''`, schemas calificados, `REVOKE ALL` y `GRANT EXECUTE` sólo a
   `authenticated` para ambas RPCs.

No se prevén tablas, policies, grants de tabla ni RPCs nuevas. Las firmas/retornos no cambian, por lo
que no debería variar `database.types.ts`; igualmente se regenerará/verificará durante implementación
para detectar drift.

### Aplicación

- query server-only de usuarios/memberships del Center;
- schemas, estados y Server Actions tenant;
- operación de resolución + formulario staged;
- hook de intención tenant estable, separado del de plataforma;
- tabla/panel de memberships;
- ruta `/centers/[centerId]/users` y navegación tenant mínima;
- tests unitarios, componentes, integración DEV y E2E.

## 11. Pruebas requeridas

### Unitarias/componentes

- validación de email, password, rol/PC y UUIDs;
- staged flow identidad nueva/existente;
- contraseña nunca persistida en storage/estado serializado;
- intent estable ante retry y rechazo de payload cambiado;
- tabla, vacío, inactive, self-row, PC activo/inactivo y mensajes seguros;
- actions deniegan RECEPTION, PROFESSIONAL, PLATFORM_ADMIN-only y centerId inválido.

### Integración DB/RLS/seguridad

- sin sesión, sin membership, membership inactiva y Center inactivo: deny;
- ADMIN A lista/muta A, nunca B;
- RECEPTION/PROFESSIONAL no administran;
- PLATFORM_ADMIN-only no obtiene capacidad tenant;
- identidad existente conserva password/email/nombres y memberships ajenas;
- identidad nueva queda confirmada y con exactamente una membership;
- membership activa no se duplica; inactiva sólo se reactiva explícitamente;
- direct INSERT/UPDATE/DELETE siguen denegados;
- PROFESSIONAL same-center y activo para altas/cambios/reactivación; cross-center rechazado;
- dos altas/reactivaciones concurrentes para el mismo PC dejan como máximo una activa;
- varias memberships históricas inactivas pueden conservar el mismo PC;
- reasignación: anterior inactiva preservada, nueva activa exclusiva y `user_id` nunca mutado;
- desactivar PROFESSIONAL con PC inactivo funciona, reactivar falla mientras el PC siga inactivo;
- último ADMIN: deactivate/demote/self y carrera concurrente;
- response-loss/retry/compensación del provisioning tenant.

### E2E DEV

- ADMIN navega a usuarios, lista, crea RECEPTION nueva, reutiliza una identidad y cambia
  estado/rol;
- acceso cross-center y actores no ADMIN reciben deny/not-found seguro;
- combinado PLATFORM_ADMIN + ADMIN funciona por el rol tenant y conserva `/platform`;
- Center inactivo conserva datos pero bloquea rutas tenant;
- el flujo profesional se prueba sólo con fixtures reales temporales coherentes con B3-D1.

Cada suite captura el baseline persistente, usa emails `task005b3-<runId>-...@example.test`, guarda
IDs exactos y limpia sólo esos IDs. Debe verificar al final que el Center, User, PLATFORM_ADMIN,
membership y las dos provisioning operations persistentes originales continúan intactos.

## 12. Riesgos

- fuga de existencia global por email: búsqueda exacta, actor ADMIN ya autorizado, sin wildcard ni
  otros Centers/roles;
- confiar en ocultar el enlace: página/actions/query reautorizan siempre;
- convertir PLATFORM_ADMIN en superusuario tenant: nunca se consulta como autoridad B3;
- doble alta o huérfano Auth: operation ID/fingerprint/reconciliación/compensación existentes;
- borrar datos manuales durante tests: cleanup por IDs de la corrida y baseline protegido;
- carrera de último ADMIN: lock y postcondición DB, no conteo en cliente;
- ProfessionalCenter compartido accidentalmente: índice UNIQUE parcial + lock + precheck RPC;
- membership PROFESSIONAL imposible de desactivar si PC inactivo: migration correctiva prevista;
- cambio de email o perfil global accidental: no hay campos ni RPCs para hacerlo;
- mensajes SQL sensibles: mapear a códigos/mensajes de dominio, sin retornar detalles internos.

## 13. Fuera de B3

- CRUD de Professional/ProfessionalCenter y creación de profesionales ficticios;
- pacientes, Person/PatientCenter, agenda, turnos, disponibilidades y especialidades;
- cambio de email, nombre/apellido global o contraseña de otro usuario;
- reset administrativo de password e invitaciones;
- eliminación física de User/membership;
- roles combinados o personalizados;
- recuperación extraordinaria de Centers desde plataforma;
- gestión de PLATFORM_ADMIN;
- enlace visible Center → `/platform`;
- cambios PROD, seeds permanentes o limpieza de datos manuales persistentes.

## 14. Estimación

**4–6 jornadas de ingeniería** incluyendo migration estrecha, UI/server actions, pruebas DEV/E2E,
concurrencia de exclusividad/último ADMIN, verificación de seguridad y documentación de review. La
estimación no incluye el módulo funcional de Profesionales.

## Gate de salida de diseño

B3-D1 quedó resuelta con asociación exclusiva activa. El design review final no encontró decisiones
humanas pendientes. El diseño queda habilitado para una instrucción posterior de implementación;
esta actualización no la ejecuta ni aplica migrations.
