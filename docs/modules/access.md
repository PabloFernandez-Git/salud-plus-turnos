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

La RPC de negocio toma un advisory lock por operación. Si confirma, guarda `SUCCEEDED` y los IDs de
resultado en la misma transacción; un retry devuelve esos mismos IDs. Si el caller pierde la
respuesta, la reconciliación toma el mismo lock y por eso observa el commit o el rollback definitivo,
no una operación todavía en vuelo.

La compensación sólo borra el UUID Auth vinculado como creado por esa operación y únicamente después
de confirmar ausencia de commit. Un delete fallido deja `COMPENSATION_REQUIRED`, sin perfil ni
membership. Si la reconciliación no puede completarse, Auth se preserva y se devuelve el
`operation_id` para retry controlado.
