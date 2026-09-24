# TASK-005 — Diseño final de Auth, plataforma y acceso a centros

**Estado:** `TASK-005A COMPLETED` · `TASK-005B1 COMPLETED` · `TASK-005B2 COMPLETED`
**Tipo:** contrato de diseño aprobado; A, B1 y B2 implementadas; B3 no iniciada.

## 1. Decisión final y límites

TASK-005 implementará Auth funcional, autorización global/tenant, RLS/grants mínimos y una UI
operativa básica. El bootstrap por centro de la propuesta anterior queda reemplazado por un único
bootstrap del primer PLATFORM_ADMIN y por `/platform` como mecanismo normal para crear centros.

No quedan decisiones `REQUIRES_HUMAN_DECISION` abiertas. Pasar a `READY_FOR_IMPLEMENTATION` no
implica que esta actualización documental cree schema, policies, secretos, usuarios o UI.

Principios invariables:

- identidad Auth, permiso global y permiso tenant son conceptos distintos;
- `PLATFORM_ADMIN` no pertenece al enum `membership_role`;
- PLATFORM_ADMIN no obtiene bypass general de RLS ni acceso operativo a un centro;
- un `centerId` sólo selecciona contexto: nunca concede permiso;
- secret key sólo para Admin Auth, compensación y bootstrap/reconciliación controlada;
- abrir únicamente las operaciones que TASK-005 necesita.

## 2. Modelo final Auth / Platform / Center

```text
Supabase Auth
auth.users
  id
  email (fuente de verdad)
  password / sessions
        │ 1:1, mismo UUID
        ▼
public.users
  id PK/FK → auth.users.id
  first_name
  last_name
  email text NOT NULL, lowercase, UNIQUE (proyección)
        │
        ├──────────────────────────────┐
        │ 0..1                         │ 0..N
        ▼                              ▼
platform_admins                 center_memberships
  user_id PK/FK                   center_id
  created_at                      user_id
                                  role ADMIN|RECEPTION|PROFESSIONAL
                                  professional_center_id
                                  is_active
                                        │
                                        └─ PROFESSIONAL → ProfessionalCenter propio
```

Separación de autoridad:

```text
PLATFORM_ADMIN
→ /platform
→ datos administrativos básicos de Centers
→ contadores agregados aprobados
→ crear/activar/desactivar Center
→ provisionar primer ADMIN

ADMIN de Center
→ /centers/[centerId]/...
→ administrar usuarios/memberships sólo de ese Center

RECEPTION / PROFESSIONAL
→ operación tenant según membership
```

Una misma identidad puede, de forma independiente, ser PLATFORM_ADMIN y tener memberships. Ninguna
relación se deriva automáticamente de la otra. El contexto de la ruta decide qué autorización se
aplica.

`platform_admins` no necesita campos adicionales en TASK-005: `user_id` y `created_at` son
suficientes. No se agrega `is_active` porque la gestión/revocación de PLATFORM_ADMIN adicionales
queda fuera del alcance; inventar un workflow incompleto ampliaría la superficie de seguridad.

## 3. Auth, sesión y UI de acceso

### Login y landing

1. Server Action valida email/contraseña y llama `signInWithPassword` con el cliente SSR.
2. La sesión se guarda en cookies de `@supabase/ssr`.
3. Proxy de Next.js 16 llama `getClaims()` y propaga cookies refrescadas.
4. El servidor resuelve `public.users` por `auth.uid()`.
5. Si es PLATFORM_ADMIN, el destino principal es `/platform`.
6. Si no es PLATFORM_ADMIN:
   - una membership activa en Center activo → redirect directo;
   - varias → selector;
   - ninguna → pantalla “sin acceso activo”.
7. Si además posee memberships, el PLATFORM_ADMIN puede navegar a ellas desde un selector
   independiente; la entrada a cada ruta tenant vuelve a verificar la membership.

No se confía en `getSession()` para autorización server-side. Proxy mantiene sesión; layouts,
queries y Actions aplican autorización real.

### Logout

Server Action con `signOut({ scope: "local" })`. Logout global puede agregarse después como acción
explícita, no como efecto accidental.

### Recuperación y cambio de contraseña

- TASK-005 incluye `resetPasswordForEmail`, callback PKCE y página autenticada de nueva contraseña.
- La respuesta pública es genérica para evitar enumeración.
- DEV usa inicialmente el SMTP de desarrollo de Supabase.
- Site URL y redirect allowlist se configuran explícitamente; se prefiere una URL concreta antes que
  wildcards amplios.
- Custom SMTP no es requisito de TASK-005, pero será obligatorio antes de PROD.
- Cambio autenticado: contraseña actual + nueva mediante `updateUser`.
- Recovery: nueva contraseña dentro de la sesión emitida por el callback.
- Mínimo 10 caracteres en Zod/servidor y configuración Supabase Auth.
- No se exigen mayúsculas, minúsculas, números o símbolos y no se agrega un máximo artificialmente
  bajo; se respetan los límites soportados por Supabase.
- No hay cambio obligatorio en primer login.

### Signup y confirmación

- No existe signup público en el MVP.
- Todo usuario nuevo se crea mediante Admin Auth desde un flujo autorizado.
- `email_confirm: true` es fijado server-side; nunca llega como opción del cliente.
- El usuario puede iniciar sesión inmediatamente con la contraseña inicial.

## 4. Contrato de `SUPABASE_SECRET_KEY`

Se adopta exclusivamente la clave moderna:

```text
SUPABASE_SECRET_KEY
```

Reglas:

- `.env.local` en DEV y secret env del proveedor en deploy;
- nunca `NEXT_PUBLIC_*`, navegador, Git, docs con valores, logs o chat;
- no incorporar `SUPABASE_SERVICE_ROLE_KEY` legacy;
- cliente administrativo separado creado con `@supabase/supabase-js`, no `@supabase/ssr`;
- módulo `server-only` no reexportado a Client Components;
- `persistSession: false`;
- `autoRefreshToken: false`;
- `detectSessionInUrl: false`.

Uso permitido:

- `auth.admin.createUser` y operaciones Auth Admin estrictamente necesarias;
- borrar el Auth user creado por la ejecución actual al compensar;
- bootstrap/reconciliación controlada.

Uso prohibido:

- queries normales de producto;
- listar centros, usuarios o memberships para renderizar páginas;
- ejecutar operaciones tenant ordinarias;
- reemplazar RLS o los clientes SSR de usuario.

El guard de secretos debe conservar la búsqueda estática y el build con centinelas para
`SUPABASE_SECRET_KEY`.

## 5. Email e identidad reutilizable

`auth.users.email` sigue siendo fuente de verdad. `public.users.email` será una proyección
consultable bajo RLS:

- `text`;
- `NOT NULL`;
- `btrim` + lowercase antes de persistir;
- `UNIQUE` sobre el valor ya normalizado;
- CHECK que rechaza vacío y valores no normalizados;
- sin UPDATE directo para `authenticated`;
- sin trigger sobre `auth.users`.

Migration segura:

1. agregar temporalmente la columna nullable;
2. backfill desde `auth.users.email` usando `lower(btrim(...))`;
3. abortar si existe Auth sin email utilizable o una colisión normalizada;
4. agregar CHECK/UNIQUE y `SET NOT NULL`;
5. no instalar sincronización automática.

Creación/provisión:

- la RPC recibe el UUID Auth, lee el email real de `auth.users` y materializa esa proyección;
- email, nombre y contraseña enviados por el cliente no pueden reemplazar datos de una cuenta
  existente;
- para cuenta existente, `public.users` se reutiliza sin UPDATE de nombre/apellido/email;
- cambio de email queda fuera de TASK-005 y en el futuro deberá coordinar Auth, proyección,
  confirmación y autorización global.

### Resolución exacta de cuenta

Las pantallas autorizadas pueden resolver un email exacto mediante RPC estrecha, no mediante SELECT
general ni secret-key data access:

- `platform_resolve_user_by_email(email)` para `/platform`;
- `admin_resolve_user_by_email(center_id, email)` para ADMIN del centro.

Retornan sólo estado de existencia e identidad mínima necesaria; nunca otros centros, roles ni
memberships. Si no existe proyección, se intenta crear Auth. Si Auth informa duplicado pero no existe
`public.users`, se considera un huérfano y se deriva a reconciliación controlada; no se vincula a
ciegas.

## 6. API de autorización server-side

Todos los helpers viven en módulos `server-only`, aceptan inputs validados y no cachean decisiones de
membership/rol entre requests.

| Helper | Responsabilidad | Error seguro |
| --- | --- | --- |
| `requireUser()` | Validar claims y perfil `public.users` | `UNAUTHENTICATED`, `PROFILE_NOT_PROVISIONED` |
| `requirePlatformAdmin()` | Exigir fila propia en `platform_admins` | `PLATFORM_FORBIDDEN` |
| `listAccessibleCenters()` | Memberships activas + Centers activos del usuario | lista mínima |
| `requireCenterMembership(centerId)` | Exigir Center y membership activos | `CENTER_ACCESS_DENIED` |
| `requireRole(centerId, roles)` | Extender contexto tenant con rol permitido | `ROLE_FORBIDDEN` |
| `requireProfessionalContext(centerId)` | Resolver PC propio y activo | `PROFESSIONAL_CONTEXT_MISSING` |

No se mezclan contextos:

- `/platform` llama `requirePlatformAdmin()` y RPCs de plataforma;
- `/centers/[centerId]/...` llama helpers tenant;
- ser PLATFORM_ADMIN nunca satisface `requireCenterMembership`;
- ser ADMIN de un Center nunca satisface `requirePlatformAdmin`.

IDs enviados por formularios/rutas sólo son inputs. Las Server Actions siguen:

```text
parse Zod
→ autenticar
→ autorizar contexto correcto
→ regla/invariante
→ persistir mediante query o RPC estrecha
```

## 7. Centro activo

Representación canónica:

```text
/centers/[centerId]/...
```

- una membership activa → redirect directo;
- varias → selector;
- ninguna y no PLATFORM_ADMIN → pantalla sin acceso;
- `last_active_center_id` no se persiste en DB;
- una cookie futura sólo puede ser hint UX y nunca autoridad;
- cada operación verifica `auth.uid() + centerId + membership activa + Center activo`.

Si una membership o Center se desactiva durante una sesión, la siguiente operación tenant falla y
RLS deja de devolver filas. Las memberships del Center inactivo se conservan sin conceder acceso.

## 8. Alcance funcional de `/platform`

Ruta interna mínima, accesible exclusivamente con `requirePlatformAdmin()`.

### Tabla

- nombre del Center;
- activo/inactivo;
- dirección;
- teléfono;
- email;
- fecha de alta;
- cantidad de usuarios activos = memberships activas;
- cantidad de profesionales activos = ProfessionalCenter activos;
- cantidad de especialidades activas = Specialty activas;
- acciones crear, activar y desactivar.

Los contadores se calculan en PostgreSQL y se devuelven agregados. El frontend no descarga
memberships/profesionales/especialidades para contarlos.

### Formulario Center + primer ADMIN

Center:

- nombre;
- dirección;
- teléfono;
- email;
- timezone IANA.

Primer ADMIN:

- nombre;
- apellido;
- email;
- contraseña inicial sólo si la identidad aún no existe.

La UI puede resolver primero el email exacto. Si la identidad existe, informa que conservará sus
datos/credenciales y no solicita ni utiliza una nueva contraseña. No muestra sus otros centros o
roles.

### Límites

PLATFORM_ADMIN no obtiene por ese rol acceso a Patient/Person/PatientCenter, appointments, agenda,
notas administrativas, disponibilidad ni datos operativos. Tampoco puede administrar usuarios de
un Center excepto provisionar su primer ADMIN durante la creación aprobada.

## 9. Queries/RPCs de plataforma

### `platform_list_centers()`

`SECURITY DEFINER`, valida internamente `auth.uid()` como PLATFORM_ADMIN y retorna únicamente:

- campos administrativos aprobados de Center;
- tres contadores agregados activos.

Puede leer `center_memberships`, `professional_centers` y `specialties` internamente sólo para
`count(*) FILTER (WHERE is_active)`. No retorna filas ni IDs operativos de esas tablas.

### `platform_create_center_with_admin(...)`

`SECURITY DEFINER`, ejecutada con el cliente SSR del PLATFORM_ADMIN:

- valida `auth.uid()` global;
- recibe datos mínimos de Center, UUID Auth del primer ADMIN y nombres sólo para cuenta nueva;
- lee email canónico desde `auth.users`;
- reutiliza `public.users` si existe sin actualizarlo;
- inserta Center + `public.users` si falta + exactamente una membership ADMIN activa en una
  transacción;
- no crea PLATFORM_ADMIN ni otras memberships;
- retorna `center_id`, `membership_id` y estado mínimo de provisión.

### `platform_set_center_active(center_id, is_active)`

`SECURITY DEFINER`, valida PLATFORM_ADMIN y serializa por Center:

- desactivar: actualiza sólo `centers.is_active`; conserva memberships/datos;
- activar: exige al menos una membership ADMIN activa;
- no toca datos operativos ni memberships;
- retorna ID y estado nuevo.

### Resolución exacta

`platform_resolve_user_by_email(email)` valida PLATFORM_ADMIN y devuelve identidad mínima. No es un
buscador libre ni lista Auth users.

No existe ninguna función genérica de administración global.

## 10. Bootstrap del primer PLATFORM_ADMIN

Único bootstrap excepcional:

```text
plataforma vacía
↓
tooling one-shot seguro
↓
auth.users
↓
public.users
↓
platform_admins
```

Procedimiento futuro:

1. script manual server/tooling valida `APP_ENV=development`, ref, URL y link exactos de DEV;
2. requiere confirmación explícita y `SUPABASE_SECRET_KEY` desde `.env.local`;
3. preflight confirma plataforma no inicializada y ausencia de datos del dominio esperados;
4. crea Auth user con email confirmado y contraseña ≥10;
5. llama `bootstrap_platform_admin(auth_user_id, first_name, last_name)`;
6. la RPC service-only adquiere advisory lock global de bootstrap, vuelve a comprobar ausencia de
   `platform_admins`, `public.users`, Centers y memberships, lee email de Auth e inserta perfil +
   PLATFORM_ADMIN en una transacción;
7. verifica postcondiciones sin imprimir contraseña/secret;
8. si falla DB, borra sólo el Auth user creado por esa ejecución;
9. si falla compensación, queda Auth huérfano sin perfil/permisos y se reporta para reconciliación.

La RPC de bootstrap es la única excepción que no usa `auth.uid()`: se ejecuta antes de que exista un
usuario de plataforma, sólo está concedida a `service_role` y se protege por secret key, estado vacío,
lock y precondiciones internas. `PUBLIC`, `anon` y `authenticated` no tienen EXECUTE.

No se crea ahora el primer PLATFORM_ADMIN. Después del bootstrap, los centros se crean únicamente
desde `/platform`; el tooling no vuelve a ser mecanismo de centros.

## 11. Crear Center + primer ADMIN

Orquestación server-side desde `/platform`:

```text
requirePlatformAdmin()
↓
validar Center + email exacto
↓
resolver public.users por RPC
├─ existe → reutilizar UUID; ignorar password/nombres para persistencia
└─ no existe → exigir password ≥10
               → auth.admin.createUser(email_confirm=true)
               → conservar UUID creado por esta ejecución
↓
platform_create_center_with_admin(...)
├─ éxito → exactamente un primer ADMIN activo
└─ fallo → si Auth fue nuevo, auth.admin.deleteUser(UUID)
```

La transacción PostgreSQL crea Center y membership juntos: nunca confirma un Center activo sin su
primer ADMIN. Si la cuenta existía, sólo se agrega la nueva membership. No se modifican sus
credenciales, email, nombres o memberships ajenas.

Un retry:

- no duplica membership por `UNIQUE(center_id, user_id)`;
- si ya se confirmó toda la operación, devuelve conflicto/resultado reconocible y no crea otro
  Center silenciosamente;
- si Auth quedó huérfano, exige reconciliación y no crea una segunda identidad.

## 12. ADMIN de Center → creación/reutilización de usuarios

1. `requireRole(centerId, ["ADMIN"])`.
2. Zod valida email, nombres, rol y PC condicional.
3. `admin_resolve_user_by_email(centerId, email)` resuelve existencia exacta sin otros accesos.
4. Si no existe, contraseña ≥10 y `auth.admin.createUser({ email_confirm: true })`.
5. `admin_provision_center_user`:
   - revalida `auth.uid()` como ADMIN activo del Center;
   - deriva email desde Auth;
   - crea `public.users` sólo si falta;
   - para cuenta existente conserva perfil/credenciales;
   - valida PC activo y del mismo Center para PROFESSIONAL;
   - crea sólo la membership solicitada.
6. Si falla y Auth fue creado ahora, compensar con delete Auth.

Membership existente:

- activa: informar “ya tiene acceso”; no duplicar ni cambiar rol implícitamente;
- inactiva: indicar el flujo explícito de reactivación;
- rol/PC distinto: usar operación explícita `admin_set_center_membership`;
- nunca revelar otros centros/roles.

## 13. Administración de membership y último ADMIN

`admin_set_center_membership(center_id, membership_id, role, professional_center_id, is_active)` es
estrecha y no permite cambiar `center_id`/`user_id` ni borrar la fila.

Para toda creación, reactivación, degradación o desactivación que afecte ADMIN:

1. adquirir `pg_advisory_xact_lock` derivado de `center_id`;
2. bloquear la membership objetivo y leer Center dentro de la transacción;
3. revalidar actor ADMIN activo, salvo RPC de plataforma que usa contexto global;
4. aplicar el cambio tentativo;
5. comprobar que siempre permanezca al menos una membership activa con rol ADMIN, incluso si el
   Center está temporalmente inactivo;
6. abortar toda la transacción si la postcondición falla.

Todos los caminos que cambian rol/actividad o reactivan Center usan el mismo lock por Center. Esto
evita que dos ADMIN se desactiven/degraden concurrentemente observando cada uno al otro como último.
También impide que el último ADMIN se desactive a sí mismo. Un Center inactivo conserva igualmente
su último ADMIN, de modo que no depende de una recuperación extraordinaria para reactivarse.
PLATFORM_ADMIN no cuenta como ADMIN.

## 14. Fallo parcial y reconciliación

Auth y PostgreSQL no comparten transacción distribuida.

Reglas:

- Auth se crea antes porque `public.users.id` referencia `auth.users.id`;
- las filas public relacionadas se crean en una única RPC transaccional;
- sólo se borra como compensación el UUID Auth creado por la ejecución actual;
- nunca se borra ni modifica una cuenta preexistente;
- si delete Auth falla, el huérfano no tiene perfil/membership/plataforma y no accede a datos;
- se registra correlation ID + Auth UUID, nunca contraseña o secret;
- reconciliación controlada decide borrar o completar el perfil después de verificar email/estado;
- no se agrega una tabla genérica de jobs hasta que una necesidad real la justifique.

## 15. Helpers PostgreSQL y RPCs privilegiadas

### Helpers privados para policies/RPCs

| Firma conceptual | Retorno | Uso |
| --- | --- | --- |
| `private.is_platform_admin()` | boolean | validar contexto global |
| `private.has_active_center_membership(center_id)` | boolean | membership+Center activos, anti-recursión |
| `private.has_active_center_role(center_id, roles)` | boolean | rol tenant actual |
| `private.active_professional_center_id(center_id)` | UUID/null | PC propio y activo |
| `private.can_administer_user(target_user_id)` | boolean | intersección ADMIN-target sin filtrar accesos |
| `private.can_view_professional(professional_id)` | boolean | ADMIN del Center o Professional propio |

Necesitan `SECURITY DEFINER` para evitar recursión de `center_memberships`. Requisitos:

- `search_path = ''`;
- nombres totalmente calificados;
- sin SQL dinámico;
- actor tomado de `auth.uid()`;
- parámetros/retornos mínimos;
- `STABLE` cuando corresponda;
- `PUBLIC` y `anon` sin EXECUTE;
- grants por firma a `authenticated` sólo cuando una policy/RPC los necesita.

### RPCs autenticadas

- `platform_list_centers`;
- `platform_resolve_user_by_email`;
- `platform_create_center_with_admin`;
- `platform_set_center_active`;
- `admin_resolve_user_by_email`;
- `admin_provision_center_user`;
- `admin_set_center_membership`.

Todas son `SECURITY DEFINER`, validan internamente `auth.uid()` y el contexto exacto, retornan datos
mínimos y tienen EXECUTE explícito para `authenticated`. No usan la secret key.

### RPC service-only

- `bootstrap_platform_admin`.

EXECUTE sólo para `service_role`; ningún otro rol. No existe RPC `update_anything`, bypass global ni
función que retorne filas operativas arbitrarias.

## 16. Matriz RLS y grants revisada

Estado objetivo por tabla:

| Tabla | SELECT | INSERT | UPDATE | DELETE | GRANT `authenticated` | Responsable |
| --- | --- | --- | --- | --- | --- | --- |
| `platform_admins` | sólo fila propia (`user_id=auth.uid()`) | deny directo | deny directo | deny | `SELECT` | policy `platform_admins_select_self`; bootstrap service-only |
| `centers` | sólo Center activo con membership activa | deny directo | deny directo | deny | `SELECT` | helper membership; plataforma usa RPC agregada |
| `users` | propio; o target compartido administrable por ADMIN activo | deny directo | deny directo, incluido email | deny | `SELECT` | `can_administer_user`; provisioning por RPC |
| `center_memberships` | propia activa; ADMIN activo ve memberships de su Center, incluidas inactivas | deny directo | deny directo | deny | `SELECT` | helper de rol; mutaciones por RPC |
| `professional_centers` | ADMIN activo del Center; PROFESSIONAL sólo su PC activo | deny | deny | deny | `SELECT` | helpers rol/PC |
| `professionals` | ADMIN mediante PC autorizado; PROFESSIONAL sólo identidad propia | deny | deny | deny | `SELECT` | `can_view_professional` |
| `specialties` | default-deny | deny | deny | deny | ninguno | conteo sólo dentro de `platform_list_centers` |
| `professional_center_specialties` | default-deny | deny | deny | deny | ninguno | fuera de TASK-005 |
| `persons` | default-deny | deny | deny | deny | ninguno | fuera de TASK-005 |
| `patient_centers` | default-deny | deny | deny | deny | ninguno | fuera de TASK-005 |
| `availabilities` | default-deny | deny | deny | deny | ninguno | fuera de TASK-005 |
| `appointments` | default-deny | deny | deny | deny | ninguno | fuera de TASK-005 |

Policies SELECT propuestas:

- `platform_admins_select_self`;
- `centers_select_active_members`;
- `users_select_self_or_center_admin`;
- `center_memberships_select_self_or_center_admin`;
- `professional_centers_select_admin_or_linked_professional`;
- `professionals_select_admin_or_linked_professional`.

Grants adicionales:

- `anon`: ninguno sobre tablas/functions del dominio;
- `authenticated`: sólo SELECT de las seis tablas indicadas, USAGE mínimo sobre `private`, EXECUTE
  por firma de helpers/RPCs autenticadas;
- ningún INSERT/UPDATE/DELETE de tabla para `authenticated`;
- `service_role`: EXECUTE de bootstrap y capacidades inherentes sólo desde cliente server-only;
- revocar EXECUTE de `PUBLIC` en toda función propia;
- no usar `GRANT ALL`, `ALL TABLES` ni default privileges amplios.

PLATFORM_ADMIN no aparece como excepción en policies tenant. Sus lecturas globales pasan por RPCs
que validan la fila `platform_admins` y retornan sólo datos aprobados.

Aquí `service_role` nombra al rol PostgreSQL interno al que resuelve la secret key moderna; no se
incorpora ni configura la API key JWT legacy `SUPABASE_SERVICE_ROLE_KEY`.

## 17. Migrations previstas

Migrations incrementales posteriores a TASK-004:

1. **User email + plataforma**
   - backfill/constraints de `public.users.email`;
   - `platform_admins(user_id PK/FK RESTRICT, created_at NOT NULL DEFAULT now())`;
   - RLS enable + revoke inicial.
2. **Helpers, policies y grants**
   - helpers privados anti-recursión;
   - seis policies SELECT;
   - grants mínimos por tabla/schema/firma.
3. **RPCs de Auth/plataforma/centro**
   - RPCs listadas;
   - advisory locks e invariante del último ADMIN;
   - revokes y EXECUTE explícitos.

Después de aplicar sólo en DEV: regenerar `database.types.ts`. Las tres migrations de TASK-004 son
historia inmutable.

## 18. UI mínima prevista

Rutas conceptuales:

- `/login`;
- `/forgot-password`;
- callback Auth permitido;
- `/update-password`;
- `/no-access`;
- `/centers` selector;
- `/centers/[centerId]/...` tenant;
- `/centers/[centerId]/users` administración mínima ADMIN;
- `/platform` tabla/formulario/acciones globales.

La UI prioriza funcionalidad y seguridad:

- estados loading/error/empty;
- confirmación antes de desactivar Center o membership;
- mensajes que no revelan otros centros/roles;
- contraseña sólo en formularios de identidad nueva y nunca re-renderizada/logueada;
- sin diseño visual sofisticado ni framework genérico de permisos.

## 19. Plan de pruebas

### Auth/session

- login válido/inválido sin enumeración;
- persistencia y refresh SSR;
- logout local;
- recovery con redirect válido y rechazo de redirect no permitido;
- cambio/recovery con 9 caracteres rechazado y 10 aceptado;
- no existe endpoint/página de signup público;
- creación administrativa siempre confirma email server-side.

### PLATFORM_ADMIN

```text
usuario normal          → /platform DENY
ADMIN de Center         → /platform DENY
PLATFORM_ADMIN          → lista Centers y agregados
PLATFORM_ADMIN          → crea Center + primer ADMIN
PLATFORM_ADMIN          → activa/desactiva Center
PLATFORM_ADMIN          → no accede a pacientes/appointments
Center inactivo         → memberships conservadas, tenant DENY
nuevo Center            → exactamente un primer ADMIN activo
```

Además:

- tabla muestra campos/contadores correctos sin descargar datasets;
- contador usuarios = memberships activas;
- contador profesionales = PC activos;
- contador especialidades = specialties activas;
- direct SELECT a tablas de conteo sigue denegado para PLATFORM_ADMIN sin membership;
- crear con Auth existente preserva contraseña/email/nombres y otros accesos;
- fallo DB tras crear Auth ejecuta compensación; fallo de compensación queda sin permisos;
- bootstrap sólo pasa una vez; carrera deja un único PLATFORM_ADMIN y compensa al perdedor.

### Tenant/RLS

- sin sesión → sin datos;
- Auth sin perfil/membership → sin datos tenant;
- membership inactiva → deny;
- Center inactivo → deny aunque membership siga activa;
- acceso a A no permite B;
- ADMIN administra sólo su Center;
- RECEPTION no administra usuarios ni lee Professional/PC en TASK-005;
- PROFESSIONAL sólo su ProfessionalCenter y Professional;
- dos Centers → cada ruta revalida la membership correspondiente;
- INSERT/UPDATE/DELETE directos fallan para `authenticated` en todas las tablas.

### Último ADMIN y concurrencia

- desactivar/degradar último ADMIN falla;
- último ADMIN no puede autodesactivarse;
- con dos ADMIN, desactivar uno funciona;
- dos degradaciones concurrentes no pueden confirmar ambas;
- activar Center sin ADMIN activo falla;
- desactivar Center conserva memberships.

### Fixtures y cleanup

- Auth users temporales DEV con emails `@example.test` y passwords aleatorias no logueadas;
- guard exacto de proyecto antes de crear;
- cleanup `try/finally`: relaciones → perfiles → Auth users;
- postcondición de cero fixtures residuales;
- tests unitarios no dependen del seed;
- nunca PROD.

## 20. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| PLATFORM_ADMIN convertido en superusuario tenant | sin bypass/policy global; RPCs concretas |
| Secret key en browser/bundle | `server-only`, cliente separado, guard + centinelas |
| Cookie de usuario altera cliente admin | cliente `supabase-js` no SSR, persist/refresh/detect false |
| Recursión de memberships | helpers privados `SECURITY DEFINER` mínimos |
| Fuga de entidades globales | policies de intersección y resolución exacta por RPC |
| Email proyectado stale | creación deriva de Auth; sin edición en TASK-005 |
| Auth huérfano | compensación + fail-closed + reconciliación |
| Último ADMIN por carrera | advisory lock común por Center + postcondición transaccional |
| Reactivar tenant sin administrador | RPC exige ADMIN activo antes de activar |
| Contadores filtran datos | una RPC devuelve sólo números agregados |
| Center inactivo sigue operando | todos los helpers tenant exigen `centers.is_active` |
| SMTP DEV llega a PROD | custom SMTP documentado como gate obligatorio pre-PROD |
| Helper/RPC demasiado poderoso | parámetros/retornos mínimos, grants por firma, review independiente |

## 21. Fuera de TASK-005

- gestión de PLATFORM_ADMIN adicionales, revocación global y recovery extraordinario de tenants;
- cambio/sincronización de email;
- acceso operativo global a datos tenant;
- CRUD completo de profesionales, pacientes, specialties, disponibilidad y appointments;
- escrituras Professional/ProfessionalCenter;
- signup público, invitaciones, OAuth, SSO, 2FA y magic links;
- custom SMTP de PROD y rate limiting definitivo;
- preferencia persistida/cookie de último Center;
- eliminación física de Center, users o memberships;
- PROD, deploy, commit, push y PR.

## 22. Fuentes oficiales contrastadas

- [Supabase Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [API keys publishable/secret y claves legacy](https://supabase.com/docs/guides/getting-started/api-keys)
- [Auth server-side](https://supabase.com/docs/guides/auth/server-side)
- [Cliente SSR para Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Password-based Auth y recovery](https://supabase.com/docs/guides/auth/passwords)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)

## Gate final

No quedan decisiones humanas abiertas. TASK-005 queda `READY_FOR_IMPLEMENTATION`, sujeto al gate
operativo previo a migrations/configuración Auth/cambios DEV y a reviews independientes posteriores.
