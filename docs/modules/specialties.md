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
el nombre y la descripción opcional, y activar/desactivar, pero no eliminar. Las asociaciones con
`ProfessionalCenter` se administran desde `/centers/[centerId]/professionals` mediante deltas
explícitos.

La ruta y cada Server Action revalidan el rol ADMIN. Las lecturas usan la policy SELECT tenant;
las mutaciones usan únicamente `admin_create_specialty`, `admin_update_specialty` y
`admin_set_specialty_active` con la sesión autenticada del usuario. La DB decide finalmente la
unicidad por Center, ignorando case y espacios externos, también para filas inactivas.

La UI muestra la descripción en el listado o «Sin descripción» cuando es `NULL`. La capa servidor
trimea el texto; la RPC vuelve a aplicar `btrim` y guarda `NULL` para texto vacío o sólo espacios.
La columna `description` es `text NULL` sin límite de longitud en DB. Crear sin descripción y
limpiar una descripción existente envían `p_description = ''` a las RPCs existentes; ambas
operaciones terminan en `NULL`. No se agregaron migrations.

Edición y cambio de estado envían `expected_updated_at` de la fila renderizada. Un conflicto stale
no se reintenta automáticamente: se muestra el error y se refresca el listado. Un no-op válido
conserva el token CAS según las RPCs de TASK-006B. Desactivar conserva todas las asociaciones
existentes y exige confirmación explícita en la UI.

Crear y editar comparten un modal centrado con nombre y descripción opcional. Si hay cambios sin
guardar, Cancelar, X, Escape y el fondo solicitan confirmar el descarte; sin cambios cierran
directamente. La desactivación se confirma en un modal centrado con acción roja y aviso de que las
asociaciones existentes se conservan. La reactivación mantiene su confirmación de estado.

En creación y edición, Nombre conserva las restricciones nativas `required` y `maxLength`; el
mensaje nativo de campo vacío se reemplaza por «Ingresá el nombre de la especialidad.» bajo el
campo, con borde rojo, foco y asociación accesible. Los nombres compuestos sólo por espacios se
tratan como vacíos antes del envío; la validación del servidor permanece vigente.

Una Specialty inactiva sigue reservando su nombre y conserva las filas de asociación activas.
No puede agregarse a un ProfessionalCenter mientras está inactiva. Al reactivarse, las asociaciones
conservadas vuelven a ser operativas sin crear filas nuevas. El editor de Profesionales distingue
una asociación retenida de una desasociación explícita, que inactiva la relación. La RPC batch
valida Center, estado y token CAS bajo lock y revierte íntegramente el lote si falla una entrada.
