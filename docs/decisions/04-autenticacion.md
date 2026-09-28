# 4. Autenticación

## Decisión aprobada

**Supabase Auth con email y contraseña**

### Alcance del MVP

La autenticación incluirá:

- inicio de sesión con email y contraseña;
- cierre de sesión;
- sesiones persistentes;
- cambio de contraseña;
- recuperación de contraseña;
- creación de usuarios por parte de un Administrador.

### Creación de usuarios

El Administrador podrá crear directamente un nuevo usuario para su centro.

Al crear el usuario deberá definir:

- nombre;
- apellido;
- email;
- rol dentro del centro;
- contraseña temporal inicial.

La contraseña temporal será definida manualmente por el Administrador.

El usuario no estará obligado a cambiar la contraseña temporal en su primer inicio de sesión.

Podrá cambiarla posteriormente cuando lo desee.

No existe signup público en el MVP. Los usuarios creados administrativamente quedan con email
confirmado por una decisión aplicada exclusivamente server-side y pueden iniciar sesión de
inmediato.

La contraseña inicial tiene un mínimo de 10 caracteres tanto en validación server-side como en la
configuración de Supabase Auth. No se imponen reglas obligatorias de mayúsculas, minúsculas, números
o símbolos ni un máximo artificialmente bajo.

Si el email ya corresponde a una cuenta, se reutilizan `auth.users` y `public.users` y sólo se crea
la nueva membership. No se cambian automáticamente contraseña, email, nombre/apellido ni otras
memberships.

### Recuperación

TASK-005 incluye recuperación de contraseña. DEV utilizará inicialmente el SMTP de desarrollo de
Supabase, con Site URL y redirect allowlist explícitos. Custom SMTP no es requisito de TASK-005,
pero será obligatorio antes de PROD.

### Email de aplicación

`auth.users.email` es la fuente de verdad. `public.users.email` será una proyección lowercase,
`NOT NULL` y única, consultable bajo RLS. No se crea un trigger sobre `auth.users` y el cambio de
email queda fuera de TASK-005.

### Separación entre autenticación y dominio

Supabase Auth será responsable de:

- identidad de acceso;
- credenciales;
- sesiones;
- recuperación y cambio de contraseña.

La aplicación seguirá siendo responsable de:

- datos del usuario;
- accesos a centros;
- roles;
- estado dentro de cada centro;
- permisos.

### Criterio de seguridad

Las operaciones administrativas de creación de usuarios no deberán exponer credenciales privilegiadas en el navegador.

Las operaciones que requieran privilegios administrativos deberán ejecutarse del lado servidor.

Se utilizará únicamente `SUPABASE_SECRET_KEY` moderna en un cliente `supabase-js` administrativo
separado y `server-only`, con `persistSession`, `autoRefreshToken` y `detectSessionInUrl` desactivados.
No se incorporará la key legacy `service_role` ni se utilizará la secret key para acceso normal a
datos del producto.

### Fuera del MVP

No se incluirán inicialmente:

- Google Login;
- Microsoft Login;
- SSO;
- 2FA;
- magic links.

### Estado

**Aprobado**

---
