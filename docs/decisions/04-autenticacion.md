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
