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

TASK-008 agrega una pantalla de disponibilidad por `ProfessionalCenter` activo. ADMIN y RECEPTION
pueden cambiar allí la duración habitual mediante una RPC limitada a ese campo; Profesionales
conserva su edición ADMIN sobre la misma fila y el mismo `updated_at` monotónico. La disponibilidad
separada por centro admite varias franjas semanales activas no solapadas por día. Al reactivar un
vínculo, sus franjas que seguían activas vuelven a ser operativas y pueden revisarse en la pantalla.

Desactivar en un centro no afecta otros centros y preserva historia.

## Administración tenant (TASK-006)

Sólo un ADMIN activo de un Center activo accede a `/centers/[centerId]/professionals`. La ruta,
las queries, las Server Actions y las RPCs revalidan ese acceso; PLATFORM_ADMIN por sí solo no
concede acceso tenant. El listado y las asociaciones se filtran por `center_id` bajo RLS.

La resolución exacta usa nacionalidad y documento canonicalizado por PostgreSQL. Si la identidad
global ya existe, sólo muestra nombre, apellido y su estado respecto del Center actual. IDs y
tokens CAS son internos; no revela email, teléfono, documento almacenado, otros Centers, matrículas,
especialidades, Auth, Users ni memberships. La vinculación exige confirmación explícita.

Tras el alta, nombre, apellido, nacionalidad, documento, email y teléfono globales permanecen
inmutables en este módulo. La creación y vinculación no crean ni modifican Auth, User o memberships.
Existe una sola fila `ProfessionalCenter` por Professional y Center: la reactivación reutiliza la
misma fila y conserva matrícula, duración y asociaciones. Sólo matrícula nullable y duración
habitual de 5 a 480 minutos, múltiplo de 5, son configurables en el Center.

Una membership `PROFESSIONAL` activa asociada bloquea en la RPC la desactivación de su
`ProfessionalCenter`; una inactiva no bloquea. La UI dirige a Usuarios para gestionar el acceso,
sin cambiar la membership automáticamente. La administración de especialidades usa un batch de
deltas explícitos y atómicos: agregar, desasociar o combinar ambas operaciones. Una Specialty
inactiva conserva la asociación existente, no admite alta nueva y vuelve a quedar operativa al
reactivarse. La desasociación explícita inactiva la fila de relación; no la borra.

Edición, estado y batch envían `updated_at` del snapshot renderizado. Las RPCs comparan bajo lock
antes de mutar; ante stale, la UI descarta el estado local y refresca sin retry automático. Un
cambio efectivo avanza el token, mientras un no-op válido lo conserva.

En el MVP, un `ProfessionalCenter` representa la actividad propia de como máximo una cuenta con
membership `PROFESSIONAL` activa. Puede conservar asociaciones inactivas históricas, pero no se usa
para modelar cuentas compartidas, asistentes o delegados. Ese caso futuro requerirá una relación y
permisos explícitos diferentes.
