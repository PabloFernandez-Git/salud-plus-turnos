# Profesionales

`Professional` y `User` son conceptos distintos.

Un profesional:
- puede existir sin usuario;
- puede trabajar en varios centros;
- puede tener distinta disponibilidad y especialidades según centro.

Datos requeridos:
- nombre;
- apellido;
- documento;
- email.

Opcionales:
- matrícula;
- teléfono.

`ProfessionalCenter` define por centro:
- estado activo/inactivo;
- especialidades;
- disponibilidad;
- duración habitual de turno.

Desactivar en un centro no afecta otros centros y preserva historia.
