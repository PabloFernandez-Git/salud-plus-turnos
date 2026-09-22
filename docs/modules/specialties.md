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
