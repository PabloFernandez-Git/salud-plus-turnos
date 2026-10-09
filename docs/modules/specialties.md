# Especialidades

La especialidad pertenece al centro.

Campos principales:
- nombre;
- descripción opcional;
- estado activo/inactivo.

Una especialidad inactiva conserva historia, pero no puede utilizarse para nuevos turnos ni nuevas asignaciones.

El nombre es único dentro del centro ignorando mayúsculas/minúsculas y espacios externos, sin
normalizar acentos. La inactivación conserva reservado el nombre; para reutilizarlo se reactiva la
especialidad existente.

Las especialidades habilitadas para un profesional se definen en su relación `ProfessionalCenter`.

## Administración tenant (TASK-006C)

Un ADMIN activo del Center activo administra las especialidades desde
`/centers/[centerId]/specialties`. El listado incluye activas e inactivas. Puede crear, cambiar
el nombre y activar/desactivar, pero no eliminar ni administrar todavía las asociaciones con
`ProfessionalCenter`.

La ruta y cada Server Action revalidan el rol ADMIN. Las lecturas usan la policy SELECT tenant;
las mutaciones usan únicamente `admin_create_specialty`, `admin_update_specialty` y
`admin_set_specialty_active` con la sesión autenticada del usuario. La DB decide finalmente la
unicidad por Center, ignorando case y espacios externos, también para filas inactivas.

Edición y cambio de estado envían `expected_updated_at` de la fila renderizada. Un conflicto stale
no se reintenta automáticamente: se muestra el error y se refresca el listado. Un no-op válido
conserva el token CAS según las RPCs de TASK-006B. Desactivar conserva todas las asociaciones
existentes y exige confirmación explícita en la UI.
