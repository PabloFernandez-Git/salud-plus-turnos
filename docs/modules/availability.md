# Disponibilidad

Pertenece a `ProfessionalCenter`.

## MVP

- horario semanal recurrente;
- duración habitual de turno por ProfessionalCenter: 30 minutos por defecto, rango 5–480 y
  múltiplos de 5;
- múltiples franjas el mismo día;
- sin excepciones/vacaciones/feriados en v1.

Ejemplo:

```text
Lunes 08:00–12:00
Lunes 16:00–20:00
```

Reglas:
- inicio < fin;
- no solapar franjas del mismo día;
- el final de un slot debe quedar dentro de la franja;
- profesional-centro inactivo no ofrece disponibilidad;
- cancelar un turno libera el slot;
- cambiar horario habitual no modifica/cancela automáticamente turnos futuros existentes.

Los slots se calculan, no se persisten:

```text
horario habitual
- turnos que bloquean
= disponibilidad
```

Las reglas recurrentes usan hora local del centro.

La duración habitual funciona como default operativo para proponer slots; un turno concreto conserva
sus propios `starts_at` y `ends_at` y puede tener otra duración válida.

## Administración (TASK-008)

`/centers/[centerId]/availability` lista los vínculos activos del centro para ADMIN y RECEPTION;
PROFESSIONAL va directamente a su propio detalle. El detalle vive en
`/centers/[centerId]/professionals/[professionalCenterId]/availability`. ADMIN y RECEPTION crean,
editan horas y quitan lógicamente franjas, y cambian la duración habitual. PROFESSIONAL sólo
consulta la propia. PLATFORM_ADMIN no obtiene acceso tenant implícito. La ruta, las Server Actions,
las RPCs y RLS vuelven a comprobar centro, membership y vínculo activos.

La pantalla presenta Lunes–Domingo en secciones verticales, horas locales de `centers.timezone`,
varias franjas por día, vacíos y duración en el mismo lugar. Cada franja representa `[inicio, fin)`;
`13:00` queda fuera de `09:00–13:00`. No cruza medianoche ni usa `24:00`. La edición conserva el día;
para mover una franja a otro día se quita y se crea otra. Quitar fija `is_active=false` sin borrar la
fila. Las inactivas no se exponen por la UI ni por SELECT tenant.

`availabilities_no_active_overlap` (GiST) es la autoridad final de no solapamiento, también en
concurrencia. Las RPCs comparan `updated_at` monotónico bajo lock para edición y retiro; un conflicto
stale exige recarga y no se reintenta automáticamente. La duración usa
`professional_centers.usual_appointment_duration_minutes`, el mismo campo de Profesionales, con
5–480 minutos en múltiplos de 5. La RPC de Availability sólo puede cambiar ese campo.

Tras cada cambio de horario, una helper privada de sólo lectura informa si existen turnos futuros
no cancelados fuera de cualquier franja habitual, usando la zona del centro. La UI muestra sólo un
aviso booleano: no revela turnos ni pacientes y no mueve, cancela ni elimina appointments. La
resolución de esos turnos y la generación de slots corresponden a Agenda (TASK-009).
