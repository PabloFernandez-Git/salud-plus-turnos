# Usuarios y accesos

## Modelo

`User` representa identidad de aplicación asociada a Supabase Auth.

`CenterMembership` relaciona usuario + centro y define:
- rol;
- estado activo/inactivo.

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
