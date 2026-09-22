# Usuarios y accesos

## Modelo

`User` representa identidad de aplicación asociada 1:1 a Supabase Auth mediante el mismo UUID.
Supabase Auth es la fuente de identidad/login y la baja operativa se realiza desactivando memberships,
sin borrar en cascada la historia de aplicación.

`CenterMembership` relaciona usuario + centro y define:
- rol;
- estado activo/inactivo.

Existe una sola membership y un único rol por User-Center. Para rol Professional,
`CenterMembership` referencia obligatoriamente un `ProfessionalCenter` del mismo centro. Para
Administrator y Reception ese vínculo no existe. Los roles combinados quedan fuera del MVP.

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
