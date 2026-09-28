# Usuarios y accesos

## Modelo

`User` representa identidad de aplicación asociada 1:1 a Supabase Auth mediante el mismo UUID.
Supabase Auth es la fuente de identidad/login y la baja operativa se realiza desactivando memberships,
sin borrar en cascada la historia de aplicación.

`auth.users.email` es la fuente de verdad del email. `public.users.email` es una proyección lowercase,
`NOT NULL` y única para listados/búsquedas bajo RLS. No se modifica directamente y el cambio de email
queda fuera de TASK-005.

`PlatformAdmin` relaciona globalmente un `User` con la administración de la plataforma. No es un rol
de `CenterMembership`, no pertenece al enum de roles del centro y no concede acceso tenant.

`CenterMembership` relaciona usuario + centro y define:
- rol;
- estado activo/inactivo.

Existe una sola membership y un único rol por User-Center. Para rol Professional,
`CenterMembership` referencia obligatoriamente un `ProfessionalCenter` del mismo centro. Para
Administrator y Reception ese vínculo no existe. Los roles combinados quedan fuera del MVP.

Un `ProfessionalCenter` puede tener como máximo una membership `PROFESSIONAL` activa. Las
memberships inactivas pueden conservar la asociación histórica; no se modelan asistentes, delegados
o cuentas compartidas reutilizando el mismo vínculo. Alta, reactivación y cambio a Professional
exigen un ProfessionalCenter activo y libre. La desactivación pura conserva rol/vínculo y se permite
aunque el ProfessionalCenter ya esté inactivo, porque reduce permisos.

Roles MVP:
- Administrator;
- Reception;
- Professional.

Un mismo usuario puede tener diferentes roles en distintos centros.

## Administración

Solo Administrator gestiona usuarios del centro.

El listado vive en `/centers/[centerId]/users`: muestra exclusivamente las memberships visibles del
Center autorizado, identidad proyectada, rol, estado y la asociación Professional segura cuando
existe. La ruta, sus queries y sus mutaciones requieren `ADMIN` tenant activo; ocultar el enlace es
sólo una ayuda de UX.

Desde esa pantalla, **Agregar usuario** resuelve el email exacto en servidor. Si la identidad ya
existe, se reutiliza sin cambiar email, password, nombre, apellido ni accesos de otros Centers. Si
no existe, se solicitan nombre, apellido y password inicial de al menos 10 caracteres y se usa el
provisioning Auth confirmado → `public.users` → `center_memberships` ya aprobado. Una membership
existente en el mismo Center se informa como estado terminal: no se duplica, reactiva, edita ni
cambia de rol.

El alta inicial admite Administrator, Reception y Professional. Professional sólo queda disponible
cuando existe un `ProfessionalCenter` del mismo Center, activo y libre; el servidor y las
invariantes B3A siguen siendo autoridad ante carreras o selecciones manipuladas. Cambio posterior
de rol, activación/desactivación y edición o reasignación del vínculo profesional se resuelven en
una acción **Administrar** separada sobre la membership existente.

La administración de una membership muestra únicamente identidad global de solo lectura y el rol,
estado y vínculo profesional del Center actual. Cada submit incluye el snapshot visible para detectar
estado stale como ayuda de UX, pero vuelve a autorizar al actor, ata `membership_id` al `center_id` de
la ruta y delega la mutación final a `admin_set_center_membership`. La respuesta usa el estado
persistido retornado por la RPC y luego revalida el listado; no existe actualización optimista.

El precheck server-side del snapshot es sólo feedback rápido. La autoridad stale es atómica dentro
de `admin_set_center_membership`: luego del advisory lock del Center y del `SELECT ... FOR UPDATE` de
la membership, la RPC compara `role`, `is_active` y `professional_center_id` esperados con semántica
null-safe. Si difieren, aborta sin mutar con `STALE_MEMBERSHIP_STATE`; la UI indica que el acceso
cambió y exige recargar/reintentar. La firma anterior sin expected state no existe, por lo que ningún
caller productivo puede omitir el compare-and-swap.

Cambiar rol, reactivar o desactivar requiere una confirmación explícita que identifica al usuario y
la acción. Un ADMIN puede administrarse a sí mismo si sobrevive otro ADMIN activo. Si una
self-demotion conserva acceso tenant, la respuesta navega al inicio del Center; si la membership se
desactiva, navega al selector, sin intentar una lectura ADMIN posterior al commit.

Para `PROFESSIONAL`, el selector ofrece sólo ProfessionalCenters activos del mismo Center que estén
libres o ya pertenezcan a la misma membership. Cross-center, inactivos y ocupados por otra membership
activa no son opciones y la RPC/índice parcial siguen siendo autoridad contra manipulación o carrera.
Una desactivación pura conserva rol/vínculo y puede completarse aunque el ProfessionalCenter haya
quedado inactivo; reactivar, cambiar hacia `PROFESSIONAL` o cambiar el vínculo vuelve a validar todo.

El administrador crea directamente al usuario con:
- nombre;
- apellido;
- email;
- rol;
- contraseña inicial.

Contraseña inicial: mínimo 10 caracteres. No se obliga cambio en primer login.

Desactivar acceso en un centro no afecta otros centros.

Si la cuenta ya existe se reutiliza sin cambiar password, email, nombre/apellido ni memberships de
otros centros. Una membership activa existente no se duplica; una inactiva requiere el flujo
explícito de reactivación.

Todo centro activo conserva al menos un ADMIN activo. Las operaciones de rol/estado impiden, de forma
transaccional y segura frente a concurrencia, desactivar o degradar al último ADMIN.

## Administración de plataforma

Sólo PLATFORM_ADMIN accede a `/platform`. Puede:

- listar centros y contadores administrativos agregados;
- crear un centro junto con su primer ADMIN;
- activar o desactivar un centro.

No puede acceder por ese rol a datos operativos del tenant. El primer PLATFORM_ADMIN se crea con un
tooling one-shot; luego `/platform` reemplaza al bootstrap como mecanismo para crear centros.

## Contextos server-side

```text
requirePlatformAdmin()
→ contexto global

requireCenterMembership(centerId)
requireRole(centerId, roles)
requireProfessionalContext(centerId)
→ contexto tenant
```

El centro activo se expresa en `/centers/[centerId]/...`; el ID de ruta nunca constituye
autorización.

## Idempotencia y reconciliación Auth/DB

Center + primer ADMIN, provisioning tenant y bootstrap reciben un `operation_id` UUID estable. La
intención se fija mediante un hash server-side que excluye la contraseña y rechaza reutilización con
otro payload. `private.provisioning_operations` no tiene grants directos para `anon` ni
`authenticated`; las lecturas/escrituras de lifecycle pasan por RPCs service-only estrechas.

El alta tenant conserva en `sessionStorage` únicamente una intención no secreta acotada por actor y
Center para recuperar el mismo `operation_id` tras refresh o pérdida de respuesta. El snapshot se
valida fail-closed y nunca contiene password. El password existe sólo en memoria durante el submit
y, en un retry que todavía lo requiera para crear Auth, debe ingresarse nuevamente.

La RPC de negocio toma un advisory lock por operación. Si confirma, guarda `SUCCEEDED` y los IDs de
resultado en la misma transacción; un retry devuelve esos mismos IDs. Si el caller pierde la
respuesta, la reconciliación toma el mismo lock y por eso observa el commit o el rollback definitivo,
no una operación todavía en vuelo.

La compensación sólo borra el UUID Auth vinculado como creado por esa operación y únicamente después
de confirmar ausencia de commit. Un delete fallido deja `COMPENSATION_REQUIRED`, sin perfil ni
membership. Si la reconciliación no puede completarse, Auth se preserva y se devuelve el
`operation_id` para retry controlado.
