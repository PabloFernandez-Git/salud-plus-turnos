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

Ocultar acciones en la interfaz no se considera una medida de seguridad suficiente.

La UI podrá reflejar los permisos, pero el servidor deberá aplicarlos realmente.

### Supabase RLS

Supabase Row Level Security se utilizará como segunda capa de protección para mantener el aislamiento entre centros.

Su objetivo principal en el MVP será impedir que un usuario pueda consultar o modificar filas pertenecientes a centros a los que no tiene acceso.

No se utilizará RLS como lugar principal para expresar toda la lógica de negocio o todos los permisos de rol.

La secuencia de implementación es deliberadamente fail-closed: el schema base puede habilitar RLS
sin policies permisivas ni grants para roles API, dejando `anon` y `authenticated` en default-deny.
Ese estado no equivale a Auth implementada. Las policies funcionales se agregan sólo junto con el
flujo de Auth, memberships y su review de seguridad.

### Profesional

Cuando el usuario tenga rol PROFESSIONAL, las operaciones relacionadas con agenda y turnos deberán además comprobar su relación ProfessionalCenter para limitar el acceso a su propia actividad.

### Principio de defensa en profundidad

La regla será:

> La UI refleja permisos, el servidor los aplica y la base de datos protege el aislamiento entre centros.

### Estado

**Aprobado**
