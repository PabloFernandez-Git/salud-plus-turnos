# 5. Autorización

## Decisión aprobada

**Autorización server-side en Next.js + Supabase Row Level Security (RLS) para aislamiento entre centros**

### Principio general

La aplicación separará claramente:

- autenticación → quién es el usuario;
- autorización → qué puede hacer;
- aislamiento de datos → qué información puede consultar o modificar.

### Autorización en Next.js

Las operaciones sensibles deberán validar permisos del lado servidor.

La autorización se basará en:

- usuario autenticado;
- centro activo;
- relación User/CenterMembership;
- estado del acceso;
- rol dentro del centro.

Roles del MVP:

- ADMIN
- RECEPTION
- PROFESSIONAL

Existe además `PLATFORM_ADMIN`, permiso global modelado fuera de `CenterMembership` y del enum de
roles. Los contextos se resuelven por separado:

```text
/platform
→ requirePlatformAdmin()

/centers/[centerId]/...
→ requireCenterMembership(centerId)
→ requireRole(...) / requireProfessionalContext(...)
```

PLATFORM_ADMIN no crea memberships, no reemplaza un rol de centro y no concede bypass operativo a
datos tenant. ADMIN de un Center tampoco concede acceso a `/platform`.

Ocultar acciones en la interfaz no se considera una medida de seguridad suficiente.

La UI podrá reflejar los permisos, pero el servidor deberá aplicarlos realmente.

### Supabase RLS

Supabase Row Level Security se utilizará como segunda capa de protección para mantener el aislamiento entre centros.

Su objetivo principal en el MVP será impedir que un usuario pueda consultar o modificar filas pertenecientes a centros a los que no tiene acceso.

No se utilizará RLS como lugar principal para expresar toda la lógica de negocio o todos los permisos de rol.

Las operaciones globales de plataforma se expondrán mediante RPCs estrechas que validan
PLATFORM_ADMIN y retornan sólo campos administrativos o agregados aprobados. No se abrirá SELECT
general sobre tablas operativas para producir contadores.

No se conceden INSERT/UPDATE/DELETE genéricos de users o memberships a `authenticated`. Las
mutaciones sensibles usan RPCs específicas con validación interna de `auth.uid()`, autorización
explícita, `search_path` vacío, grants por firma y retornos mínimos.

La secuencia de implementación es deliberadamente fail-closed: el schema base puede habilitar RLS
sin policies permisivas ni grants para roles API, dejando `anon` y `authenticated` en default-deny.
Ese estado no equivale a Auth implementada. Las policies funcionales se agregan sólo junto con el
flujo de Auth, memberships y su review de seguridad.

### Profesional

Cuando el usuario tenga rol PROFESSIONAL, las operaciones relacionadas con agenda y turnos deberán además comprobar su relación ProfessionalCenter para limitar el acceso a su propia actividad.

Durante TASK-005, ADMIN puede leer ProfessionalCenter de sus centros y Professional alcanzables;
PROFESSIONAL sólo su relación e identidad propias; RECEPTION no recibe todavía esas lecturas.

### Centros activos

El centro activo se expresa en la ruta y cada operación valida usuario + membership activa + Center
activo. Desactivar un Center conserva memberships pero niega operación tenant. Todo Center activo
debe conservar al menos un ADMIN activo mediante una operación transaccional segura frente a
concurrencia.

### Principio de defensa en profundidad

La regla será:

> La UI refleja permisos, el servidor los aplica y la base de datos protege el aislamiento entre centros.

### Estado

**Aprobado**
