# Profesionales

`Professional` y `User` son conceptos distintos.

Un profesional:
- puede existir sin usuario;
- puede trabajar en varios centros;
- puede tener distinta disponibilidad y especialidades según centro.

Datos requeridos:
- nombre;
- apellido;
- nacionalidad ISO 3166-1 alpha-2;
- documento original;
- documento normalizado;
- email.

Opcionales:
- teléfono.

La identidad se deduplica mediante nacionalidad + documento normalizado. PostgreSQL genera el valor
normalizado y conserva el original. `Person` y `Professional` son entidades separadas.

`ProfessionalCenter` define por centro:
- estado activo/inactivo;
- especialidades;
- disponibilidad;
- matrícula opcional sin unicidad en el MVP;
- duración habitual de turno: 30 minutos por defecto, rango 5–480 y múltiplos de 5.

La duración habitual es un default operativo y no obliga a que todos los turnos tengan esa duración.

Desactivar en un centro no afecta otros centros y preserva historia.

En el MVP, un `ProfessionalCenter` representa la actividad propia de como máximo una cuenta con
membership `PROFESSIONAL` activa. Puede conservar asociaciones inactivas históricas, pero no se usa
para modelar cuentas compartidas, asistentes o delegados. Ese caso futuro requerirá una relación y
permisos explícitos diferentes.
